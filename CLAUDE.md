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

- **Nothing is "done" until it's committed, published as a PR, and merged.** Local-only work doesn't count.
- For feature work, create a branch and open a PR for review.
- For smaller changes (docs, config, fixes), pushing directly to main is fine.
- **Prefer rebase merges** (`gh pr merge --rebase`) for clean linear history. Only use squash or three-way merges when rebase creates excessive noise (e.g., many trivial fixup commits that should be combined).
- **Rebase before merging** when a PR has conflicts with main. Checkout the branch, `git rebase origin/main`, resolve conflicts, `git push --force-with-lease`.

## PR and Code Review Process

- **Every meaningful change must go through a PR.** Agent teammates and sub-agents must drive work to completion by PR submission -- commit, push, create PR, monitor CI, address review, merge.
- **All CI/tests must pass before merge.** Tests must pass in both spirit and reality. Never disable or skip tests to land a change. If a test is genuinely wrong, fix the test with an explanation -- don't delete it.
- **Failing tests need root-cause analysis.** If CI fails, investigate the root cause and add an explanation on the PR. Surface the failure to the team lead (TL) agent, who decides whether to fix or escalate to the human reviewer.
- **Use the code-review agent** before requesting human review. If both CI and code review pass, merge the PR. If something fails or requires a judgment call that wouldn't pass a senior engineer's smell test, tag the human reviewer (@anhad) on the PR.
- **Surface architectural decisions.** If any significant design choices are made during implementation (new patterns, interface changes, dependency additions, structural decisions), explicitly flag them to the team lead. Don't bury architectural decisions in commit messages.
- **Code review feedback must be addressed** before merging. Check PR comments and resolve conversations.

## Agent Team Workflow

### Team Lead (TL) Role

The TL agent's primary job is to **stay available to the human** for planning, design, and decision-making. The TL should:

- **Delegate implementation and fix work to sub-agents/teammates.** Don't do coding, lint fixing, CI debugging, or test repairs yourself -- fire off an agent for that.
- **Never block the main loop.** No `sleep` commands, no `sleep && gh pr checks`, no long-running poll loops on the main conversation. Dispatch a background agent to monitor CI/PRs and notify you when done.
- **Coordinate and integrate.** After parallel agent work completes, verify integration, open PRs, and monitor CI. If CI fails, dispatch a sub-agent to fix it.
- **Escalate, don't block.** If something needs human judgment, tag @anhad on the PR or surface it in conversation. Don't sit on blockers.
- **Persist instructions in CLAUDE.md**, not just memory files. All operational rules, workflow expectations, and team guidelines must be written to CLAUDE.md (and team docs if applicable) so they survive across sessions and agents.

### PR Shepherd Role

When running parallel agents that produce multiple PRs, **always spawn a PR Shepherd background agent**. The shepherd handles cross-agent PR coordination so neither the TL nor the human needs to worry about merges, rebases, or stuck queues.

- **Steps in after agents finish.** Each agent is responsible for getting their own PR to CI-green. The shepherd handles what happens next: merging green PRs, rebasing downstream PRs after upstream merges, and fixing stuck queues.
- **Merges green PRs** (rebase merge) in dependency order — least-conflicting first.
- **Rebases conflicting PRs** when earlier merges cause conflicts on downstream branches.
- **Dispatches fix agents** for CI failures it encounters during the merge process.
- **Reports to the TL** after each merge or when blocked on something needing a human decision.

The TL and human should never manually check PR status, run rebases, or do merges. See `docs/team-setup.md` for the full PR Shepherd specification.

### Teammate / Sub-agent Responsibilities

- **Drive work to PR submission.** Each agent is responsible for committing, pushing, and opening PRs for their workstream.
- **Monitor CI after pushing.** If CI fails on your PR, investigate and fix. Don't leave broken CI for someone else.
- **Surface blockers immediately** to the TL agent. If the issue is non-trivial or needs a decision, the TL escalates to the human reviewer via GitHub PR comment or direct conversation.

## Essential Docs (Read on Spawn)

When starting a new session or spawning a new agent, **always read these docs** to get full context. They contain operational details that don't fit in CLAUDE.md and may be lost on context compaction:

- **`docs/team-setup.md`** — Team structure, agent roles (including PR Shepherd), file ownership, coordination protocol, spawning instructions.
- **`docs/agent-isolation.md`** — Git worktrees, port isolation, how agents avoid stepping on each other.
- **`docs/ui-requirements.md`** — UI/UX requirements and constraints. **Any agent making UI changes must read this first** and ensure their work conforms. Conflicts must be surfaced to TL/human, never silently broken.
- **`docs/plans/`** — Design docs and implementation plans for current/upcoming work.

## Port Allocation

- **Default dev ports:** Express on `3000`, Vite on `5173` — used by `npm run dev`
- **Local dev ports:** Express on `4000`, Vite on `4001` — used by `npm run local` (for human-facing local instance, avoids conflicts with agent test servers)
- **Agents should use default ports** for testing. The local dev command uses separate ports so agents and the human's local instance don't interfere with each other.

## Permissions Note

If you find yourself repeatedly needing permission for a specific command pattern, ask me to add a permanent permission for it rather than asking each time. I prefer to grant broad permissions for safe development commands within this project.
