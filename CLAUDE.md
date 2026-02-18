# Claude Code Project Instructions

## Project Overview

claude-tracer is a standalone trace visualization and debugging tool for Claude Code sessions. It runs locally, parses session JSONL files, and generates an interactive web-based visualizer.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **UI:** React + Vite + Tailwind CSS v4
- **Server:** Node.js + Express + WebSocket (ws)
- **Search:** MiniSearch
- **Testing:** vitest (unit), Playwright (E2E)
- **Linting:** ESLint (typescript-eslint strict + stylistic) + Prettier

## Key Architecture

- Single package with module folders: `src/types/`, `src/parser/`, `src/core/`, `src/server/`, `src/ui/`
- `src/types/` is the shared contract between all modules
- E2E tests in `e2e/` (Playwright), unit tests co-located in `src/**/__tests__/` (vitest)

## Development Commands

```bash
npm run dev          # Start dev server (Express + Vite concurrently)
npm test             # Run unit tests (vitest watch mode)
npm run test:run     # Run unit tests once
npm run test:e2e     # Run E2E tests (Playwright)
npm run lint         # ESLint check
npm run format       # Prettier format
npm run typecheck    # TypeScript type checking
```

## Coding Conventions

- No `I` prefix on interfaces (e.g., `Block` not `IBlock`)
- Use `as` syntax for type assertions, never angle brackets
- Prefer `unknown` over `any`
- PascalCase for types/enums, camelCase for functions/variables
- Use `enum`, not `const enum`
- All code formatted with Prettier (see `.prettierrc`)

## Testing

- **TDD approach:** Write tests before implementation
- Unit test files: `*.test.ts` (vitest)
- E2E test files: `*.spec.ts` (Playwright)
- Test fixtures in `e2e/fixtures/sessions/`
- **Always run unit tests locally** (`npm run test:run`) after making changes -- they're cheap
- **Run E2E tests** (`npm run test:e2e`) when changes might break integration or when additional testing confidence is needed
- For UI changes, include before/after screenshots of the affected flow in the PR description

## Git Workflow

- **Push significant changes upstream.** Don't let work sit only locally -- if no one else can see it, it doesn't count. After committing meaningful work, push to the remote or open a PR.
- For feature work, create a branch and open a PR for review.
- For smaller changes (docs, config, fixes), pushing directly to main is fine.

## PR and Code Review Process

- **Agent teammates must work on feature branches** and open PRs rather than pushing directly to main.
- **Track PR status.** Monitor the automated Claude Code Action and Security Review comments on each PR. Address any issues flagged before requesting human review.
- **When a PR is ready for human review**, notify the team lead with the PR URL. Mention if PRs have dependencies or need to be reviewed/merged in a specific order.
- **Surface architectural decisions.** If any significant design choices are made during implementation (new patterns, interface changes, dependency additions, structural decisions), explicitly flag them to the team lead. This is critical -- don't bury architectural decisions in commit messages.
- **Code review feedback must be addressed** before merging. Check PR comments and resolve conversations.

## Permissions Note

If you find yourself repeatedly needing permission for a specific command pattern, ask me to add a permanent permission for it rather than asking each time. I prefer to grant broad permissions for safe development commands within this project.
