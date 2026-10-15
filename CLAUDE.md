# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@alanvncs/tarefy-mcp`: a stdio MCP server that exposes [Tarefy](https://tarefy.com) tasks (general data + internal and public conversations) to AI agents. Published to npm and run by clients via `npx @alanvncs/tarefy-mcp@latest`. All user-facing text (tool descriptions, error messages, docs, test names, code comments) is written in **Portuguese (pt-BR)**; keep it that way.

## Commands

Bun is the package manager and test runner; the published build targets Node ≥ 18.

- `bun install`: install dependencies
- `bun run build`: `tsc` → `build/` (test files are excluded by `tsconfig.json`)
- `bun run dev`: run the server from source without building
- `bun run inspector`: build and open the MCP Inspector against `build/index.js` (UI on http://localhost:6274)
- `bun test`: all unit tests; single file: `bun test src/tools/get-task.test.ts`; single test: `bun test -t "<test name pattern>"`
- `bun run lint` (zero warnings allowed) / `bun run lint:fix`
- `bun run fmt` / `bun run fmt:check`: Prettier over `src/**/*.ts` and `project/**/*.md` (the README's `bun run format` is outdated; the script is `fmt`)
- `bun run release [-- minor|major]`: `scripts/release.ts` bumps `package.json` (patch by default), commits `vX.Y.Z`, tags, and pushes. The tag push triggers `.github/workflows/publish-npm.yml`, which installs, builds, runs `bun test`, and publishes via npm Trusted Publishing (OIDC, no `NPM_TOKEN`).

## Architecture

- `src/index.ts`: creates the `McpServer`, registers the tools with Zod input schemas, and connects the stdio transport. Each handler delegates to a `run*` function and turns thrown errors into `{ isError: true }` text results. stdout is the MCP channel, so log with `console.error` only. The server `version` here is hardcoded and does not track `package.json`.
- `src/tools/`: one file per tool, exporting a `run*` function with the logic.
  - `login.ts`: launches headed Chrome via Playwright (`channel: "chrome"`, so system Chrome must be installed), waits up to 5 min for the user to leave `/login`, grabs the `tarefy` cookie, and saves it as the token.
  - `get-task.ts`: loads the token, fetches the task, then uses the task's numeric `id` (the "ticketId", which differs from the `taskId` in the URL) to fetch internal and public comments in parallel. It returns `{ task, comments, publicComments }` as JSON. The optional `prompt` is not processed server-side; it is only prepended as instructions for the client.
  - `list-tasks.ts`: lists the logged-in user's tasks by `category` (the "Minhas tasks" tabs). The required `userId` comes from the `id` field of the saved JWT's payload (`src/auth/jwt.ts`). Each item's `id_tarefa` is the URL `taskId` that `get-task` expects.
  - `add-comment.ts`: resolves the URL `taskId` to the ticketId via `fetchTask`, converts plain text to the HTML the Tarefy editor stores (`textToHtml`), and posts it. Defaults to an internal comment; `client: true` makes it visible to the customer.
- `src/api/tarefy.ts`: thin `fetch` client for `https://app.tarefy.com/nodeapi/...` with `Authorization: Bearer <token>`. Comments live under `/nodeapi/v2/comments` (`GET /{ticketId}?type=internal|client`, `POST` to create); the old `/nodeapi/task/comments` routes were removed by Tarefy. These endpoints are undocumented; they were discovered from the public app bundle (`https://app.tarefy.com/assets/index-*.js`), which is the place to look when a route starts returning 404.
- `src/auth/token-store.ts`: persists the token at `~/.tarefy-mcp/token.txt`.

Imports use `.js` extensions (`module: NodeNext`), even from `.ts` files.

## Testing conventions

Tests use `bun:test` and are colocated (`*.test.ts`). External boundaries are mocked rather than hit for real: `globalThis.fetch` is swapped per test (and restored), and modules like `token-store` are replaced with `mock.module(...)` **before** the code under test is loaded through a dynamic `await import(...)`. The Playwright `login` tool has no tests. Per project directives, tool-level tests are the main focus.

## Project documentation rules (from `project/AGENTS.md`)

- `project/AGENTS.md` and `project/MCP-SPEC.md` are the project "seed" from which the project could be regenerated. **On every change, update both coherently** (AGENTS.md has a "Estado do projeto" section describing the current state).
- The root `README.md` must stay **self-sufficient**: installation, tool descriptions, Tarefy API headers/endpoints, and dev commands, without requiring other files. Update it when tools, API usage, or commands change.
- Prettier handles formatting; ESLint uses `eslint-config-prettier`, so it adds no style rules.
