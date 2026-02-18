import { BaseParser } from './base';
import type { AnyBlock, ParsedSession, UserBlock, AgentBlock, ToolBlock } from '@/types';

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

/**
 * Parser for Claude Code session JSONL files
 */
export class ClaudeCodeParser extends BaseParser {
  private pendingToolCalls: Map<string, { name: string; input: unknown; agentBlockId: string }> =
    new Map();
  private currentAgentBlockId: string | null = null;
  private activeAgentBlocks: Map<string, AgentBlock> = new Map(); // requestId -> AgentBlock

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
      const entry = JSON.parse(firstLine);
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
        const existingIndex = blocks.findIndex(b => b.id === block.id);
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
      const entry: ClaudeCodeEntry = JSON.parse(line);
      return this.parseEntry(entry);
    } catch {
      return null;
    }
  }

  private parseEntry(entry: ClaudeCodeEntry): AnyBlock | null {
    const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();

    if (entry.type === 'user') {
      return this.parseUserEntry(entry, timestamp);
    }

    if (entry.type === 'assistant') {
      return this.parseAssistantEntry(entry, timestamp);
    }

    // Skip system, progress, file-history-snapshot, queue-operation entries
    return null;
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

    // Handle isMeta user entries
    if (entry.isMeta) {
      userBlock.isMeta = true;
      userBlock.metaLabel = textContent.length > 40 ? textContent.slice(0, 37) + '...' : (textContent || 'System');
      if (!textContent) {
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

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textContent += block.text;
        }
        if (block.type === 'thinking' && block.thinking) {
          thinking = block.thinking;
        }
        if (block.type === 'tool_use' && block.id && block.name) {
          newToolCallIds.push(block.id);
        }
      }
    } else if (typeof content === 'string') {
      textContent = content;
    }

    // Extract tokens from message.usage (real data) or fall back to top-level fields (legacy)
    const tokensIn = entry.message.usage?.input_tokens ?? entry.inputTokens;
    const tokensOut = entry.message.usage?.output_tokens ?? entry.outputTokens;

    // Check if we should merge with an existing block by requestId
    if (requestId && this.activeAgentBlocks.has(requestId)) {
      const existing = this.activeAgentBlocks.get(requestId)!;

      // Merge text content
      if (textContent) {
        existing.content = existing.content ? existing.content + textContent : textContent;
      }

      // Set thinking if not already set
      if (thinking && !existing.thinking) {
        existing.thinking = thinking;
      }

      // Register new tool calls and add their ids
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && block.id && block.name) {
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
        existing.tokensIn = (existing.tokensIn || 0) + tokensIn;
      }
      if (tokensOut !== undefined) {
        existing.tokensOut = (existing.tokensOut || 0) + tokensOut;
      }

      this.currentAgentBlockId = existing.id;
      return existing;
    }

    // Create new block
    const blockId = this.generateBlockId();
    this.currentAgentBlockId = blockId;

    // Register tool calls for this new block
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use' && block.id && block.name) {
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

    // Store in active blocks map if we have a requestId
    if (requestId) {
      this.activeAgentBlocks.set(requestId, agentBlock);
    }

    return agentBlock;
  }

  private extractTextContent(content: ContentBlock[]): string {
    return content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text!)
      .join('\n');
  }
}
