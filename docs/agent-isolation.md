# Agent Isolation Strategy

How multiple Claude Code agents can work on this repo simultaneously without
stepping on each other.

## Problem

When agents share a single working directory and branch, they run into:

1. **Port collisions** -- an agent starts Express on port 3000, another agent (or
   the human) tries the same port and fails.
2. **File edit conflicts** -- two agents edit the same file at the same time;
   one set of changes gets silently overwritten.
3. **Git conflicts** -- agents commit to the same branch and create merge
   conflicts or rebase loops.

## Recommended approach: git worktrees + port isolation

### 1. Git worktrees (one per agent)

Each agent should work in its own
[git worktree](https://git-scm.com/docs/git-worktree). A worktree gives the
agent a fully independent working directory that shares the same `.git` history
with the main checkout.

```bash
# Create a worktree for agent "parser-work"
git worktree add ../claude-tracer-parser-work fix/parser-improvements

# Create a worktree for agent "ui-work"
git worktree add ../claude-tracer-ui-work feat/ui-timeline

# List active worktrees
git worktree list

# Remove when done
git worktree remove ../claude-tracer-parser-work
```

Benefits:

- Each agent has its own copy of every file -- no edit conflicts.
- Each agent is on its own branch -- no git conflicts.
- Worktrees are lightweight (they share object storage via `.git`).
- The human keeps the main checkout for `npm run local` / code review.

Setup script (run from the main checkout):

```bash
AGENT_NAME="$1"
BRANCH_NAME="$2"
WORKTREE_DIR="../claude-tracer-${AGENT_NAME}"

git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" 2>/dev/null \
  || git worktree add "$WORKTREE_DIR" "$BRANCH_NAME"

cd "$WORKTREE_DIR" && npm install
echo "Agent worktree ready at $WORKTREE_DIR"
```

### 2. Port isolation

Each agent and the human should use a distinct port range for Express and Vite.
The codebase now supports this via the `VITE_BACKEND_PORT` environment variable
in `vite.config.ts` and the `--port` flag on the Express server.

| Actor         | Express port | Vite port | Notes           |
| ------------- | ------------ | --------- | --------------- |
| Human (local) | 4000         | 4001      | `npm run local` |
| Default (dev) | 3000         | 5173      | `npm run dev`   |
| Agent 1       | 5000         | 5001      | Tests / E2E     |
| Agent 2       | 5002         | 5003      | Tests / E2E     |
| Agent 3       | 5004         | 5005      | Tests / E2E     |

Agents should pick ports in the 5000-5999 range. To start servers on custom ports:

```bash
# Express
npx tsx src/server/index.ts --file ./testdata/session.jsonl --port 5000

# Vite with proxy pointed at the matching Express port
VITE_BACKEND_PORT=5000 npx vite --port 5001
```

Unit tests (vitest) do not start servers, so they have no port conflicts and can
run concurrently without issues.

E2E tests (Playwright) should be configured to use ephemeral ports or the
agent's assigned port range.

### 3. File ownership (when worktrees are not used)

If agents share a single working directory (not recommended, but sometimes
practical for quick tasks):

- Assign non-overlapping **directories** to each agent. For example, one agent
  owns `src/parser/`, another owns `src/ui/`, a third owns `src/server/`.
- Shared files like `package.json`, `vite.config.ts`, and `tsconfig.json` should
  only be edited by one agent at a time, coordinated by the team lead.
- Agents must not run `git checkout`, `git stash`, or `git reset` in a shared
  directory -- these affect all agents simultaneously.

### 4. npm install isolation

Each worktree needs its own `node_modules`. After creating a worktree, run
`npm install` inside it before starting work. The `package-lock.json` is shared
via git, so installs will be deterministic.

## Summary

| Strategy          | Prevents port conflicts | Prevents file conflicts | Prevents git conflicts | Complexity |
| ----------------- | ----------------------- | ----------------------- | ---------------------- | ---------- |
| Worktrees + ports | Yes                     | Yes                     | Yes                    | Low        |
| Branches only     | No                      | No                      | Partial                | Low        |
| File ownership    | No                      | Partial                 | No                     | Medium     |
| Docker per agent  | Yes                     | Yes                     | Yes                    | High       |

**Recommendation: Use git worktrees + port isolation.** It fully solves all three
categories of conflict with minimal overhead. Reserve Docker-based isolation for
CI or when agents need different Node versions.
