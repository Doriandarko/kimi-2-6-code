# Kimi 2.6 Code

Terminal-native coding agent powered by Moonshot Kimi K2.6.

Kimi 2.6 Code brings an interactive AI engineering workflow into your shell: chat with your codebase, edit files, run commands with approval controls, use slash commands, connect tools, and work through multi-step coding tasks from one local CLI.

## Highlights

- Kimi K2.6 as the main model
- Moonshot OpenAI-compatible API integration
- Interactive REPL for coding, debugging, refactors, and repo exploration
- Tool use for file edits, shell commands, search, MCP servers, and project workflows
- `/login` flow for saving a Moonshot API key locally
- Clear Kimi auth status, logout, and invalid-key handling
- Kimi-themed terminal UI and status colors
- Bun-based local build with development and compiled binaries

## Requirements

- Bun 1.3.11 or newer
- macOS or Linux
- A Moonshot API key from the Kimi Open Platform

Create an API key in the Moonshot console:

```text
https://platform.kimi.ai/console/api-keys
```

## Install

```bash
bun install
bun run build:dev
```

The development binary is created at:

```bash
./cli-dev
```

For a standard local binary:

```bash
bun run build
./cli
```

## Run Globally

To run Kimi 2.6 Code from any terminal directory as `kimi-code`, build once and link the package globally:

```bash
bun install
bun run build
bun link
```

Then run it from anywhere:

```bash
kimi-code
```

One-shot mode also works globally:

```bash
kimi-code -p "summarize this repository"
```

If you rebuild later, the linked `kimi-code` command will use the updated `./cli` binary.

## Authenticate

Use the built-in login command:

```bash
./cli-dev auth login --api-key 'YOUR_MOONSHOT_API_KEY'
```

Or start the interactive CLI and run:

```text
/login
```

You can also use an environment variable:

```bash
export MOONSHOT_API_KEY='YOUR_MOONSHOT_API_KEY'
./cli-dev
```

When both a saved login key and `MOONSHOT_API_KEY` are present, the saved login key is preferred for Kimi requests.

Check auth status:

```bash
./cli-dev auth status --json
```

Clear saved auth:

```bash
./cli-dev auth logout
```

## Usage

Start the interactive coding session:

```bash
./cli-dev
```

Ask a one-shot question:

```bash
./cli-dev -p "summarize this repository"
```

Use Kimi K2.6 explicitly:

```bash
./cli-dev --model kimi-k2.6
```

Run from source:

```bash
bun run dev
```

## Common Commands

```bash
# Install dependencies
bun install

# Standard build: ./cli
bun run build

# Development build: ./cli-dev
bun run build:dev

# Development build with experimental feature set
bun run build:dev:full

# Compiled build: ./dist/cli
bun run compile

# Run from source
bun run dev
```

## Configuration

Kimi 2.6 Code uses Moonshot's OpenAI-compatible service:

```text
https://api.moonshot.ai/v1
```

Primary environment variables:

| Variable | Purpose |
|---|---|
| `MOONSHOT_API_KEY` | Moonshot API key for Kimi |
| `ANTHROPIC_BASE_URL` | Optional custom compatible endpoint |
| `CLAUDE_CODE_USE_KIMI` | Enables the Kimi provider path when needed |
| `CLAUDE_CODE_MAX_RETRIES` | Override API retry count |
| `API_TIMEOUT_MS` | Override request timeout |

## Project Structure

```text
src/
  entrypoints/       CLI bootstrap
  screens/           Ink/React terminal screens
  components/        Reusable terminal UI
  commands/          Slash command implementations
  services/          API clients, auth, MCP, analytics stubs
  tools/             Tool registry and tool implementations
  utils/             Shared model, auth, config, and formatting utilities
  state/             App state store
  hooks/             React hooks used by the terminal UI
```

## Development Notes

- The main interactive UI lives in `src/screens/REPL.tsx`.
- Slash commands are registered in `src/commands.ts`.
- Tool implementations are registered through `src/tools.ts`.
- Model invocation is coordinated through `src/QueryEngine.ts` and `src/services/api/`.
- Kimi provider helpers live in `src/utils/model/kimi.ts`.

## Validation

After changes, run:

```bash
bun run build:dev
./cli-dev auth status --json
```

For auth behavior, test an invalid key with:

```bash
./cli-dev auth login --api-key invalid-test-key
```

It should fail immediately and should not save the invalid key.

## License

Private internal repository. All rights reserved.
