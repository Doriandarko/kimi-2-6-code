/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import { createInterface } from 'readline/promises'
import {
  clearAuthRelatedCaches,
  performLogout,
} from '../../commands/logout/logout.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { verifyApiKey } from '../../services/api/claude.js'
import { fetchAndStoreClaudeCodeFirstTokenDate } from '../../services/api/firstTokenDate.js'
import {
  createAndStoreApiKey,
  fetchAndStoreUserRoles,
  shouldUseClaudeAIAuth,
  storeOAuthAccountInfo,
} from '../../services/oauth/client.js'
import { getOauthProfileFromOauthToken } from '../../services/oauth/getOauthProfile.js'
import type { OAuthTokens } from '../../services/oauth/types.js'
import {
  clearOAuthTokenCache,
  getAnthropicApiKeyWithSource,
  getAuthTokenSource,
  getOauthAccountInfo,
  getSubscriptionType,
  isUsing3PServices,
  saveApiKey,
  saveCodexOAuthTokens,
  saveOAuthTokensIfNeeded,
} from '../../utils/auth.js'
import { saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { isRunningOnHomespace } from '../../utils/envUtils.js'
import { errorMessage } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  buildAccountProperties,
  buildAPIProviderProperties,
} from '../../utils/status.js'

/**
 * Returns true if the token carries any Anthropic-issued scope (user:* or org:*).
 * Codex tokens use OpenID Connect scopes (openid, profile, email, offline_access)
 * which are not Anthropic scopes, so this returns false for them.
 */
function hasAnyAnthropicScope(scopes: string[] | undefined): boolean {
  if (!scopes?.length) return false
  return scopes.some((s) => s.startsWith('user:') || s.startsWith('org:'))
}

/**
 * Shared post-token-acquisition logic. Saves tokens, fetches profile/roles,
 * and sets up the local auth state.
 */
export async function installOAuthTokens(tokens: OAuthTokens): Promise<void> {
  // Clear old state before saving new credentials
  await performLogout({ clearOnboarding: false })

  // Reuse pre-fetched profile if available, otherwise fetch fresh
  const profile =
    tokens.profile ?? (await getOauthProfileFromOauthToken(tokens.accessToken))
  if (profile) {
    storeOAuthAccountInfo({
      accountUuid: profile.account.uuid,
      emailAddress: profile.account.email,
      organizationUuid: profile.organization.uuid,
      displayName: profile.account.display_name || undefined,
      hasExtraUsageEnabled:
        profile.organization.has_extra_usage_enabled ?? undefined,
      billingType: profile.organization.billing_type ?? undefined,
      subscriptionCreatedAt:
        profile.organization.subscription_created_at ?? undefined,
      accountCreatedAt: profile.account.created_at,
    })
  } else if (tokens.tokenAccount) {
    // Fallback to token exchange account data when profile endpoint fails
    storeOAuthAccountInfo({
      accountUuid: tokens.tokenAccount.uuid,
      emailAddress: tokens.tokenAccount.emailAddress,
      organizationUuid: tokens.tokenAccount.organizationUuid,
    })
  }

  const storageResult = saveOAuthTokensIfNeeded(tokens)
  clearOAuthTokenCache()

  if (storageResult.warning) {
    logEvent('tengu_oauth_storage_warning', {
      warning:
        storageResult.warning as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }

  // Roles and first-token-date may fail for limited-scope tokens (e.g.
  // inference-only from setup-token). They're not required for core auth.
  await fetchAndStoreUserRoles(tokens.accessToken).catch(err =>
    logForDebugging(String(err), { level: 'error' }),
  )

  if (shouldUseClaudeAIAuth(tokens.scopes)) {
    await fetchAndStoreClaudeCodeFirstTokenDate().catch(err =>
      logForDebugging(String(err), { level: 'error' }),
    )
  } else if (hasAnyAnthropicScope(tokens.scopes)) {
    // API key creation is critical for Console users — let it throw.
    const apiKey = await createAndStoreApiKey(tokens.accessToken)
    if (!apiKey) {
      throw new Error(
        'Unable to create API key. The server accepted the request but did not return a key.',
      )
    }
  } else {
    // Third-party provider (e.g. OpenAI Codex) — tokens carry no Anthropic
    // scopes. Skip Anthropic API key creation entirely and store the tokens
    // in their own dedicated config slot.
    saveCodexOAuthTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? '',
      expiresAt: tokens.expiresAt ?? Date.now() + 3600_000,
      accountId: (tokens.tokenAccount?.uuid ?? ''),
    })
  }

  await clearAuthRelatedCaches()
}

export async function authLogin({
  apiKey,
}: {
  apiKey?: string
}): Promise<void> {
  const inputKey = apiKey
  let key = inputKey?.trim()

  if (!key) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    key = (await rl.question('Enter your Kimi API key: ')).trim()
    rl.close()
  }

  if (!key) {
    process.stderr.write('Kimi API key is required.\n')
    process.exit(1)
  }

  try {
    process.stdout.write('Validating Kimi API key...\n')
    const valid = await verifyApiKey(key, false)
    if (!valid) {
      process.stderr.write(
        'Kimi API key was rejected. Paste a valid Moonshot API key.\n',
      )
      process.exit(1)
    }

    await performLogout({ clearOnboarding: false })
    await saveApiKey(key)
    saveGlobalConfig(current => ({
      ...current,
      hasCompletedOnboarding: true,
    }))
    await clearAuthRelatedCaches()
    process.stdout.write('Kimi API key saved.\n')
    process.exit(0)
  } catch (err) {
    logError(err)
    process.stderr.write(`Login failed: ${errorMessage(err)}\n`)
    process.exit(1)
  }
}

export async function authStatus(opts: {
  json?: boolean
  text?: boolean
}): Promise<void> {
  const { source: authTokenSource, hasToken } = getAuthTokenSource()
  const { source: apiKeySource } = getAnthropicApiKeyWithSource()
  const hasApiKeyEnvVar =
    !!process.env.MOONSHOT_API_KEY ||
    (!!process.env.ANTHROPIC_API_KEY && !isRunningOnHomespace())
  const oauthAccount = getOauthAccountInfo()
  const subscriptionType = getSubscriptionType()
  const using3P = isUsing3PServices()
  const apiProvider = getAPIProvider()
  const loggedIn =
    hasToken || apiKeySource !== 'none' || hasApiKeyEnvVar || using3P

  // Determine auth method
  let authMethod: string = 'none'
  if (apiProvider === 'kimi' && loggedIn) {
    authMethod = 'api_key'
  } else if (using3P) {
    authMethod = 'third_party'
  } else if (authTokenSource === 'claude.ai') {
    authMethod = 'claude.ai'
  } else if (authTokenSource === 'apiKeyHelper') {
    authMethod = 'api_key_helper'
  } else if (authTokenSource !== 'none') {
    authMethod = 'oauth_token'
  } else if (
    apiKeySource === 'ANTHROPIC_API_KEY' ||
    apiKeySource === '/login managed key' ||
    hasApiKeyEnvVar
  ) {
    authMethod = 'api_key'
  }

  if (opts.text) {
    const properties = [
      ...buildAccountProperties(),
      ...buildAPIProviderProperties(),
    ]
    let hasAuthProperty = false
    for (const prop of properties) {
      const value =
        typeof prop.value === 'string'
          ? prop.value
          : Array.isArray(prop.value)
            ? prop.value.join(', ')
            : null
      if (value === null || value === 'none') {
        continue
      }
      hasAuthProperty = true
      if (prop.label) {
        process.stdout.write(`${prop.label}: ${value}\n`)
      } else {
        process.stdout.write(`${value}\n`)
      }
    }
    if (!hasAuthProperty && hasApiKeyEnvVar) {
      process.stdout.write(
        `API key: ${process.env.MOONSHOT_API_KEY ? 'MOONSHOT_API_KEY' : 'ANTHROPIC_API_KEY'}\n`,
      )
    }
    if (!loggedIn) {
      process.stdout.write(
        'Not logged in. Run kimi auth login to save your Kimi API key.\n',
      )
    }
  } else {
    const resolvedApiKeySource =
      apiKeySource !== 'none'
        ? apiKeySource
        : hasApiKeyEnvVar
          ? process.env.MOONSHOT_API_KEY
            ? 'MOONSHOT_API_KEY'
            : 'ANTHROPIC_API_KEY'
          : null
    const output: Record<string, string | boolean | null> = {
      loggedIn,
      authMethod,
      apiProvider,
    }
    if (resolvedApiKeySource) {
      output.apiKeySource = resolvedApiKeySource
    }
    if (authMethod === 'claude.ai') {
      output.email = oauthAccount?.emailAddress ?? null
      output.orgId = oauthAccount?.organizationUuid ?? null
      output.orgName = oauthAccount?.organizationName ?? null
      output.subscriptionType = subscriptionType ?? null
    }

    process.stdout.write(jsonStringify(output, null, 2) + '\n')
  }
  process.exit(loggedIn ? 0 : 1)
}

export async function authLogout(): Promise<void> {
  try {
    await performLogout({ clearOnboarding: false })
  } catch {
    process.stderr.write('Failed to log out.\n')
    process.exit(1)
  }
  process.stdout.write('Successfully removed saved authentication.\n')
  process.exit(0)
}
