import { BaseParser } from './base';
import type {
  AnyBlock,
  ParsedSession,
  UserBlock,
  AgentBlock,
  ToolBlock,
  TeamMessageBlock,
  SystemBlock,
  ProgressBlock,
  FileSnapshotBlock,
  QueueOperationBlock,
} from '@/types';

interface ClaudeCodeEntry {
  type: 'user' | 'assistant' | 'system' | 'progress' | 'file-history-snapshot' | 'queue-operation';
  message?: {
    role: string;
    content: string | ContentBlock[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  timestamp?: string;
  uuid?: string;
  parentUuid?: string | null;
  requestId?: string;
  isMeta?: boolean;
  toolUseResult?: Record<string, unknown>;
  sourceToolAssistantUUID?: string;
  costUSD?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  // system entry fields
  subtype?: string;
  // progress entry fields
  data?: Record<string, unknown>;
  toolUseID?: string;
  parentToolUseID?: string;
  // file-history-snapshot fields
  messageId?: string;
  snapshot?: {
    messageId?: string;
    trackedFileBackups?: Record<
      string,
      { backupFileName: string; version: number; backupTime: string }
    >;
    timestamp?: string;
  };
  // queue-operation fields
  operation?: string;
  content?: string;
  sessionId?: string;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  thinking?: string;
}

interface SendMessageInput {
  type?: 'message' | 'broadcast' | 'shutdown_request' | 'shutdown_response';
  recipient?: string;
  content?: string;
  summary?: string;
  approve?: boolean;
  request_id?: string;
}

/**
 * Parser for Claude Code session JSONL files
 */
export class ClaudeCodeParser extends BaseParser {
  private pendingToolCalls = new Map<
    string,
    { name: string; input: unknown; agentBlockId: string }
  >();
  private currentAgentBlockId: string | null = null;
  private activeAgentBlocks = new Map<string, AgentBlock>(); // requestId -> AgentBlock

  /**
   * Reset internal state (used before batch processing)
   */
  reset(): void {
    this.pendingToolCalls.clear();
    this.currentAgentBlockId = null;
    this.activeAgentBlocks.clear();
  }

  canParse(content: string): boolean {
    try {
      // Find the first non-empty line
      const lines = content.split('\n');
      let firstLine = '';
      for (const line of lines) {
        if (line.trim()) {
          firstLine = line.trim();
          break;
        }
      }
      if (!firstLine) return false;
      const entry = JSON.parse(firstLine) as Record<string, unknown>;
      return 'type' in entry;
    } catch {
      return false;
    }
  }

  parse(content: string): ParsedSession {
    this.reset();
    const lines = content.trim().split('\n').filter(Boolean);
    const blocks: AnyBlock[] = [];

    for (const line of lines) {
      const block = this.parseLine(line);
      if (block) {
        // If merged block, check if already in array by id
        const existingIndex = blocks.findIndex((b) => b.id === block.id);
        if (existingIndex >= 0) {
          blocks[existingIndex] = block;
        } else {
          blocks.push(block);
        }
      }
    }

    return this.createSession('session.jsonl', blocks);
  }

  parseLine(line: string): AnyBlock | null {
    try {
      const entry = JSON.parse(line) as ClaudeCodeEntry;
      return this.parseEntry(entry);
    } catch {
      return null;
    }
  }

  private parseEntry(entry: ClaudeCodeEntry): AnyBlock | null {
    const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();

    if (entry.type === 'user') return this.parseUserEntry(entry, timestamp);
    if (entry.type === 'assistant') return this.parseAssistantEntry(entry, timestamp);
    if (entry.type === 'system') return this.parseSystemEntry(entry, timestamp);
    if (entry.type === 'progress') return this.parseProgressEntry(entry, timestamp);
    if (entry.type === 'file-history-snapshot')
      return this.parseFileSnapshotEntry(entry, timestamp);

    // entry.type must be 'queue-operation' at this point (all other types handled above)
    return this.parseQueueOperationEntry(entry, timestamp);
  }

  private setUuidFields(block: AnyBlock, entry: ClaudeCodeEntry): void {
    if (entry.uuid) {
      block.uuid = entry.uuid;
    }
    if (entry.parentUuid) {
      block.sourceParentUuid = entry.parentUuid;
    }
  }

  private parseUserEntry(entry: ClaudeCodeEntry, timestamp: number): AnyBlock | null {
    if (!entry.message) return null;
    const content = entry.message.content;

    // Check if it's a tool result
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const toolCall = this.pendingToolCalls.get(block.tool_use_id);
          if (toolCall) {
            this.pendingToolCalls.delete(block.tool_use_id);
            const toolBlock: ToolBlock = {
              id: this.generateBlockId(),
              timestamp,
              type: 'tool',
              parentId: toolCall.agentBlockId,
              toolName: toolCall.name,
              input: toolCall.input,
              output: block.content,
              status: 'success',
            };
            this.setUuidFields(toolBlock, entry);
            return toolBlock;
          }
        }
      }
    }

    // Regular user message
    const textContent = typeof content === 'string' ? content : this.extractTextContent(content);
    const userBlock: UserBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'user',
      content: textContent,
    };
    this.setUuidFields(userBlock, entry);

    // Handle isMeta user entries
    if (entry.isMeta) {
      userBlock.isMeta = true;
      if (textContent) {
        userBlock.metaLabel =
          textContent.length > 40 ? textContent.slice(0, 37) + '...' : textContent;
      } else {
        userBlock.metaLabel = 'System';
      }
    }

    return userBlock;
  }

  private parseAssistantEntry(entry: ClaudeCodeEntry, timestamp: number): AnyBlock | null {
    if (!entry.message) return null;
    const content = entry.message.content;
    const requestId = entry.requestId;

    // Extract content from this entry
    let textContent = '';
    let thinking: string | undefined;
    const newToolCallIds: string[] = [];

    let sendMessageBlock: TeamMessageBlock | null = null;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textContent += block.text;
        }
        if (block.type === 'thinking' && block.thinking) {
          thinking = block.thinking;
        }
        if (block.type === 'tool_use' && block.id && block.name) {
          if (block.name === 'SendMessage') {
            sendMessageBlock = this.parseSendMessageBlock(block, timestamp);
          } else {
            newToolCallIds.push(block.id);
          }
        }
      }
    } else if (typeof content === 'string') {
      textContent = content;
    }

    // Extract tokens from message.usage (real data) or fall back to top-level fields (legacy)
    const tokensIn = entry.message.usage?.input_tokens ?? entry.inputTokens;
    const tokensOut = entry.message.usage?.output_tokens ?? entry.outputTokens;

    // Check if we should merge with an existing block by requestId
    const existing = requestId ? this.activeAgentBlocks.get(requestId) : undefined;

    // If this entry is purely a SendMessage tool call, return the team message block
    if (sendMessageBlock && !textContent && newToolCallIds.length === 0 && !existing) {
      return sendMessageBlock;
    }
    if (existing) {
      // Merge text content
      if (textContent) {
        existing.content = existing.content ? existing.content + textContent : textContent;
      }

      // Set thinking if not already set
      if (thinking && !existing.thinking) {
        existing.thinking = thinking;
      }

      // Register new tool calls and add their ids (skip SendMessage)
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && block.id && block.name && block.name !== 'SendMessage') {
            this.pendingToolCalls.set(block.id, {
              name: block.name,
              input: block.input,
              agentBlockId: existing.id,
            });
          }
        }
      }
      existing.toolCalls = [...existing.toolCalls, ...newToolCallIds];

      // Accumulate tokens
      if (tokensIn !== undefined) {
        existing.tokensIn = (existing.tokensIn ?? 0) + tokensIn;
      }
      if (tokensOut !== undefined) {
        existing.tokensOut = (existing.tokensOut ?? 0) + tokensOut;
      }

      this.currentAgentBlockId = existing.id;
      return existing;
    }

    // Create new block
    const blockId = this.generateBlockId();
    this.currentAgentBlockId = blockId;

    // Register tool calls for this new block (skip SendMessage)
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use' && block.id && block.name && block.name !== 'SendMessage') {
          this.pendingToolCalls.set(block.id, {
            name: block.name,
            input: block.input,
            agentBlockId: blockId,
          });
        }
      }
    }

    const agentBlock: AgentBlock = {
      id: blockId,
      timestamp,
      type: 'agent',
      content: textContent,
      thinking,
      toolCalls: newToolCallIds,
      tokensIn,
      tokensOut,
      wallTimeMs: entry.durationMs,
    };
    this.setUuidFields(agentBlock, entry);

    // Store in active blocks map if we have a requestId
    if (requestId) {
      this.activeAgentBlocks.set(requestId, agentBlock);
    }

    return agentBlock;
  }

  private parseSystemEntry(entry: ClaudeCodeEntry, timestamp: number): SystemBlock {
    // Build data from entry, excluding fields that go into block metadata
    const excludeKeys = new Set(['type', 'timestamp', 'uuid', 'parentUuid', 'subtype']);
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (!excludeKeys.has(key)) {
        data[key] = value;
      }
    }
    const block: SystemBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'system',
      subtype: entry.subtype ?? 'unknown',
      data,
    };
    this.setUuidFields(block, entry);
    if (entry.durationMs !== undefined) {
      block.wallTimeMs = entry.durationMs;
    }
    return block;
  }

  private parseProgressEntry(entry: ClaudeCodeEntry, timestamp: number): ProgressBlock {
    const data = entry.data ?? {};
    const progressType = typeof data.type === 'string' ? data.type : 'unknown';
    const block: ProgressBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'progress',
      progressType,
      data,
      parentToolUseId: entry.parentToolUseID ?? entry.toolUseID,
    };
    this.setUuidFields(block, entry);
    return block;
  }

  private parseFileSnapshotEntry(entry: ClaudeCodeEntry, timestamp: number): FileSnapshotBlock {
    const trackedFiles = entry.snapshot?.trackedFileBackups ?? {};
    const block: FileSnapshotBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'file-snapshot',
      messageId: entry.messageId ?? entry.snapshot?.messageId ?? '',
      trackedFiles,
    };
    this.setUuidFields(block, entry);
    return block;
  }

  private parseQueueOperationEntry(entry: ClaudeCodeEntry, timestamp: number): QueueOperationBlock {
    const operation = entry.operation === 'remove' ? 'remove' : 'enqueue';
    const block: QueueOperationBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'queue-operation',
      operation,
      content: entry.content,
    };
    this.setUuidFields(block, entry);
    return block;
  }

  private parseSendMessageBlock(block: ContentBlock, timestamp: number): TeamMessageBlock | null {
    const input = block.input as SendMessageInput | undefined;
    if (!input) return null;

    const msgType = input.type ?? 'message';
    const validTypes = ['message', 'broadcast', 'shutdown_request', 'shutdown_response'];
    if (!validTypes.includes(msgType)) return null;

    return {
      id: this.generateBlockId(),
      timestamp,
      type: 'team-message',
      parentId: this.currentAgentBlockId ?? undefined,
      sender: 'agent',
      recipient: input.recipient,
      content: input.content ?? input.summary ?? '',
      messageType: msgType,
    };
  }

  private extractTextContent(content: ContentBlock[]): string {
    return content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text ?? '')
      .join('\n');
  }
}
