export interface Block {
  id: string;
  timestamp: number;
  type: 'user' | 'agent' | 'tool' | 'mcp';
  parentId?: string;
  tokensIn?: number;
  tokensOut?: number;
  wallTimeMs?: number;
}

export interface UserBlock extends Block {
  type: 'user';
  content: string;
}

export interface AgentBlock extends Block {
  type: 'agent';
  content: string;
  thinking?: string;
  toolCalls: string[];
}

export interface ToolBlock extends Block {
  type: 'tool';
  parentId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: 'pending' | 'success' | 'error';
}

export interface McpBlock extends Block {
  type: 'mcp';
  parentId: string;
  serverName: string;
  method: string;
  input: unknown;
  output: unknown;
  status: 'pending' | 'success' | 'error';
}

export type AnyBlock = UserBlock | AgentBlock | ToolBlock | McpBlock;

export function isUserBlock(block: Block): block is UserBlock {
  return block.type === 'user';
}

export function isAgentBlock(block: Block): block is AgentBlock {
  return block.type === 'agent';
}

export function isToolBlock(block: Block): block is ToolBlock {
  return block.type === 'tool';
}

export function isMcpBlock(block: Block): block is McpBlock {
  return block.type === 'mcp';
}
