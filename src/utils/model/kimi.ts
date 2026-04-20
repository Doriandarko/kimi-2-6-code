import { isEnvTruthy } from '../envUtils.js'

export const KIMI_DEFAULT_MODEL = 'kimi-k2.6'
export const KIMI_ANTHROPIC_BASE_URL = 'https://api.moonshot.ai/anthropic'

export function isKimiAnthropicBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) return false
  try {
    const url = new URL(baseUrl)
    return (
      url.hostname === 'api.moonshot.ai' &&
      (url.pathname === '/anthropic' ||
        url.pathname.startsWith('/anthropic/'))
    )
  } catch {
    return false
  }
}

export function isKimiProviderEnabled(): boolean {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_KIMI)) return false
  return true
}

export function getMoonshotApiKey(): string | undefined {
  return process.env.MOONSHOT_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
}
