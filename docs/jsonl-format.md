# Claude Code Session JSONL Format

> **Status:** Reverse-engineered from real session data. No official schema exists.
> **Last verified against:** Claude Code v2.1.12 and v2.1.37
> **Last updated:** 2026-02-18

## Overview

Claude Code writes session transcripts as JSONL files (one JSON object per line) to:

```
~/.claude/projects/<encoded-directory-path>/<session-uuid>.jsonl
```

Where `<encoded-directory-path>` is the project path with `/` replaced by `-` (e.g., `-Users-anhad-Projects-my-app`).

**There is no official Anthropic documentation for this format.** Everything here is reconstructed from real session files and community tooling. The format may change between Claude Code versions.

## File Organization

```
~/.claude/projects/<encoded-dir>/
  <session-uuid>.jsonl              # Main session transcript
  <session-uuid>/
    subagents/
      agent-<agent-id>.jsonl        # Sub-agent transcripts (sidechains)
  memory/
    MEMORY.md                       # Agent memory files
```

## Entry Types

Each JSONL line is a JSON object with a `type` field. Observed types and their frequency in a typical session:

| Type | Description | Frequency |
|------|-------------|-----------|
| `assistant` | Agent response (text, tool calls, thinking) | Very common |
| `user` | User message or tool result | Very common |
| `progress` | Progress events (hooks, bash, MCP, agent) | Very common |
| `file-history-snapshot` | File backup state at each user turn | Common |
| `system` | System events (turn duration, hooks, compaction) | Moderate |
| `queue-operation` | Message queue operations (enqueue/remove) | Rare |

## Common Fields

Most entry types share these fields:

```typescript
interface BaseEntry {
  type: string;                    // Entry type discriminator
  uuid: string;                    // Unique ID for this entry
  parentUuid: string | null;       // Parent entry UUID (forms a tree, NOT a flat list)
  sessionId: string;               // Session UUID
  timestamp: string;               // ISO-8601 (e.g., "2026-02-18T11:30:21.796Z")
  version: string;                 // Claude Code version (e.g., "2.1.12", "2.1.37")
  cwd: string;                     // Working directory
  gitBranch: string;               // Active git branch
  isSidechain: boolean;            // true for sub-agent messages
  userType: string;                // Always "external" in observed data
  slug?: string;                   // Session slug (e.g., "wiggly-imagining-wolf")
  agentId?: string;                // Present on sub-agent entries (e.g., "a4e80a2")
}
```

**Important:** `parentUuid` creates a **tree structure**, not a linear sequence. Branching conversations, sub-agents, and parallel tool calls all create branches in this tree. Some `parentUuid` values may reference UUIDs not present in the file (known bug, see GitHub issue #22526).

---

## type: "user"

User messages and tool results. The `message.content` field can be either a string or an array of content blocks.

### Plain user message

```json
{
  "type": "user",
  "parentUuid": "prev-uuid",
  "message": {
    "role": "user",
    "content": "Implement user authentication"
  },
  "uuid": "abc123",
  "timestamp": "2026-02-18T11:43:58.858Z",
  "thinkingMetadata": { "level": "high", "disabled": false, "triggers": [] },
  "todos": [
    { "content": "Task name", "status": "in_progress", "activeForm": "Working on task" }
  ]
}
```

**Extra fields on user entries:**
- `thinkingMetadata` - Present when user sends a message; indicates thinking level
- `todos` - Snapshot of the todo list at time of message
- `isMeta` - Boolean, true for system-injected messages (skill content, caveats)

### Tool result (inside user entry)

Tool results come back as `type: "user"` entries where `message.content` is an array containing `tool_result` blocks:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01234",
        "content": "file contents here..."
      }
    ]
  },
  "toolUseResult": {
    "stdout": "output text",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  },
  "sourceToolAssistantUUID": "assistant-uuid-that-made-the-call"
}
```

**`toolUseResult` variants by tool type:**

| Tool | Fields |
|------|--------|
| Bash | `stdout`, `stderr`, `interrupted`, `isImage` |
| Read | `type: "text"`, `file: { filePath, content, numLines, startLine, totalLines }` |
| Glob | `filenames: string[]`, `durationMs`, `numFiles`, `truncated` |
| TodoWrite | `oldTodos: Todo[]`, `newTodos: Todo[]` |
| Skill | `success: boolean`, `commandName: string` |
| Write/Edit | `success: boolean` |

### Command messages

Slash commands appear as user entries with XML-like content:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "<command-name>/install-github-app</command-name>\n<command-message>install-github-app</command-message>"
  }
}
```

### Local command output

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "<local-command-stdout>See ya!</local-command-stdout>"
  }
}
```

---

## type: "assistant"

Agent responses. The `message` field contains the **full Anthropic API response object**.

```json
{
  "type": "assistant",
  "parentUuid": "user-uuid",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_017TKwBGQSY9phGZp1ZFrNiJ",
    "type": "message",
    "role": "assistant",
    "content": [ /* content blocks */ ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 2,
      "cache_creation_input_tokens": 10408,
      "cache_read_input_tokens": 14265,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 0,
        "ephemeral_1h_input_tokens": 10408
      },
      "output_tokens": 1,
      "service_tier": "standard",
      "inference_geo": "not_available"
    }
  },
  "requestId": "req_011CYFTXWXWj2oSjRhNTQw6d",
  "uuid": "1c2d3b03-...",
  "timestamp": "2026-02-18T11:30:24.575Z"
}
```

**Key differences from what you might expect:**
- Token counts are at `message.usage.*`, NOT at the top level
- `message.model` identifies the model used (e.g., `"claude-opus-4-5-20251101"`, `"claude-opus-4-6"`)
- `stop_reason` can be `null` (for multi-block streamed responses), `"end_turn"`, `"tool_use"`, etc.
- `requestId` links all assistant entries from the same API call

### Content block types in assistant messages

**Text:**
```json
{ "type": "text", "text": "I'll implement the feature..." }
```

**Tool use:**
```json
{
  "type": "tool_use",
  "id": "toolu_0176XTM5zoL6eKnFz1q1ct1u",
  "name": "Read",
  "input": { "file_path": "/src/auth.ts" },
  "caller": { "type": "direct" }
}
```

**Thinking (extended thinking / chain-of-thought):**
```json
{
  "type": "thinking",
  "thinking": "The user wants me to research...",
  "signature": "EuEDCkYICxgCKkDy7ea8NP..."
}
```

### Multi-block assistant responses

A single API call can produce multiple JSONL entries with different content blocks but the **same `requestId`**. For example, an assistant turn that thinks, writes text, and calls a tool may produce 3 separate JSONL lines:

1. Line with `thinking` block
2. Line with `text` block
3. Line with `tool_use` block

All share the same `requestId` and same `message.id`.

---

## type: "progress"

Real-time progress events. The `data.type` field discriminates subtypes:

| `data.type` | Description | Fields |
|-------------|-------------|--------|
| `hook_progress` | Hook execution | `hookEvent`, `hookName`, `command` |
| `bash_progress` | Bash command progress | `output`, `fullOutput`, `elapsedTimeSeconds`, `totalLines`, `timeoutMs` |
| `agent_progress` | Sub-agent dispatch | `message` (contains the sub-agent's initial prompt) |
| `mcp_progress` | MCP tool progress | `status`, `serverName`, `toolName` |
| `query_update` | Web search progress | `query` |
| `search_results_received` | Search results arrived | `resultCount`, `query` |

### hook_progress example
```json
{
  "type": "progress",
  "data": {
    "type": "hook_progress",
    "hookEvent": "SessionStart",
    "hookName": "SessionStart:startup",
    "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"
  },
  "parentToolUseID": "7ca761bc-...",
  "toolUseID": "7ca761bc-..."
}
```

### bash_progress example
```json
{
  "type": "progress",
  "data": {
    "type": "bash_progress",
    "output": "",
    "fullOutput": "",
    "elapsedTimeSeconds": 2,
    "totalLines": 0,
    "timeoutMs": 120000
  },
  "toolUseID": "bash-progress-0",
  "parentToolUseID": "toolu_01BkANrSv5xki5QCvhGJUfvo"
}
```

### agent_progress example
```json
{
  "type": "progress",
  "data": {
    "type": "agent_progress",
    "message": {
      "type": "user",
      "message": {
        "role": "user",
        "content": [{ "type": "text", "text": "Research the trade-offs..." }]
      }
    }
  }
}
```

---

## type: "file-history-snapshot"

Written before each user turn to track file backup state. These are very frequent (one per user message) and can dominate smaller session files.

```json
{
  "type": "file-history-snapshot",
  "messageId": "613a3e70-...",
  "snapshot": {
    "messageId": "613a3e70-...",
    "trackedFileBackups": {
      "src/auth.ts": {
        "backupFileName": "2f36e7b54885556b@v2",
        "version": 2,
        "backupTime": "2026-02-18T12:14:30.527Z"
      }
    },
    "timestamp": "2026-02-18T12:14:30.526Z"
  },
  "isSnapshotUpdate": false
}
```

**Note:** `trackedFileBackups` is empty (`{}`) until files are actually modified.

---

## type: "system"

System events. Discriminated by `subtype`:

### system:turn_duration
```json
{
  "type": "system",
  "subtype": "turn_duration",
  "durationMs": 31869,
  "isMeta": false
}
```

### system:stop_hook_summary
```json
{
  "type": "system",
  "subtype": "stop_hook_summary",
  "hookCount": 2,
  "hookInfos": [
    { "command": "terminal-notifier -title \"Claude Code\" -message \"Done\"" }
  ],
  "hookErrors": [],
  "preventedContinuation": false,
  "stopReason": "",
  "hasOutput": false,
  "level": "suggestion"
}
```

### system:compact_boundary
Marks where context compaction occurred (older messages were summarized to fit context window).

---

## type: "queue-operation"

Message queue operations for queued user messages:

```json
{ "type": "queue-operation", "operation": "enqueue", "sessionId": "...", "content": "Before you transition..." }
{ "type": "queue-operation", "operation": "remove", "sessionId": "..." }
```

---

## Sub-agent Files

Sub-agent transcripts are stored at:
```
<session-uuid>/subagents/agent-<agent-id>.jsonl
```

They use the same format as main session files but:
- All entries have `isSidechain: true`
- All entries have `agentId: "<id>"` (e.g., `"a4e80a2"`)
- The first entry is `type: "user"` with the sub-agent's initial prompt
- `parentUuid: null` for the first entry

Sub-agent IDs from the main session's `agent_progress` events link to these files.

---

## Message Tree Structure

The `parentUuid` field creates a tree, not a flat list. Example flow:

```
null
 └─ user: "Hello" (uuid: A)
     └─ assistant: "Hi!" (uuid: B)
         ├─ assistant: [tool_use: Read] (uuid: C, same requestId as B)
         │   └─ user: [tool_result] (uuid: D)
         │       └─ assistant: "The file contains..." (uuid: E)
         └─ assistant: [tool_use: Bash] (uuid: F, same requestId as B)
             └─ user: [tool_result] (uuid: G)
```

Parallel tool calls from the same assistant turn share the same `requestId` but have different `uuid`s. Tool results link back via `sourceToolAssistantUUID`.

---

## Known Issues

- **Orphaned parentUuid:** Some entries reference UUIDs not in the file ([#22526](https://github.com/anthropics/claude-code/issues/22526))
- **Duplicate entries:** Can occur with stream-json input ([#5034](https://github.com/anthropics/claude-code/issues/5034))
- **Large files:** 9MB+ / 900+ lines may cause hangs ([#22365](https://github.com/anthropics/claude-code/issues/22365))
- **30-day deletion:** Claude Code deletes session logs after 30 days by default

---

## Community Parsers

These tools parse the same format and serve as additional reference:

| Tool | Language | URL |
|------|----------|-----|
| claude-code-log | Python | https://github.com/daaain/claude-code-log |
| claude-JSONL-browser | Web | https://github.com/withLinda/claude-JSONL-browser |
| cctrace | Python | https://github.com/jimmc414/cctrace |
| ccusage | TypeScript | https://github.com/ryoppippi/ccusage |
| claude-code-data | Python | https://github.com/osolmaz/claude-code-data |
| clog | TypeScript | https://github.com/HillviewCap/clog |

---

## Version History

| Claude Code Version | Observed Changes |
|--------------------|------------------|
| 2.1.12 | Base format documented here |
| 2.1.37 | Same format, added `slug` field, `mcp_progress` subtype |

> This document should be updated as new entry types or format changes are discovered.
