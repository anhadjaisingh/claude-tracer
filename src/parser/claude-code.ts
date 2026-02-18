import { BaseParser } from './base';
import type { AnyBlock, ParsedSession, UserBlock, AgentBlock, ToolBlock } from '@/types';

interface ClaudeCodeEntry {
  type: 'user' | 'assistant' | 'system';
  message: {
    role: string;
    content: string | ContentBlock[];
  };
  timestamp?: string;
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

  canParse(content: string): boolean {
    try {
      const firstLine = content.split('\n')[0];
      const entry = JSON.parse(firstLine);
      return 'type' in entry && 'message' in entry;
    } catch {
      return false;
    }
  }

  parse(content: string): ParsedSession {
    const lines = content.trim().split('\n').filter(Boolean);
    const blocks: AnyBlock[] = [];

    for (const line of lines) {
      const block = this.parseLine(line);
      if (block) {
        blocks.push(block);
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

    return null;
  }

  private parseUserEntry(entry: ClaudeCodeEntry, timestamp: number): AnyBlock | null {
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
    const userBlock: UserBlock = {
      id: this.generateBlockId(),
      timestamp,
      type: 'user',
      content: typeof content === 'string' ? content : this.extractTextContent(content),
    };
    return userBlock;
  }

  private parseAssistantEntry(entry: ClaudeCodeEntry, timestamp: number): AnyBlock | null {
    const content = entry.message.content;
    const blockId = this.generateBlockId();
    this.currentAgentBlockId = blockId;

    let textContent = '';
    let thinking: string | undefined;
    const toolCallIds: string[] = [];

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textContent += block.text;
        }
        if (block.type === 'thinking' && block.thinking) {
          thinking = block.thinking;
        }
        if (block.type === 'tool_use' && block.id && block.name) {
          this.pendingToolCalls.set(block.id, {
            name: block.name,
            input: block.input,
            agentBlockId: blockId,
          });
          toolCallIds.push(block.id);
        }
      }
    } else if (typeof content === 'string') {
      textContent = content;
    }

    const agentBlock: AgentBlock = {
      id: blockId,
      timestamp,
      type: 'agent',
      content: textContent,
      thinking,
      toolCalls: toolCallIds,
      tokensIn: entry.inputTokens,
      tokensOut: entry.outputTokens,
      wallTimeMs: entry.durationMs,
    };

    return agentBlock;
  }

  private extractTextContent(content: ContentBlock[]): string {
    return content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text!)
      .join('\n');
  }
}
