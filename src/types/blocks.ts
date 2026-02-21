export interface Block {
  id: string;
  timestamp: number;
  type:
    | 'user'
    | 'agent'
    | 'tool'
    | 'mcp'
    | 'team-message'
    | 'system'
    | 'progress'
    | 'file-snapshot'
    | 'queue-operation';
  parentId?: string;
  tokensIn?: number;
  tokensOut?: number;
  wallTimeMs?: number;
  uuid?: string;
  sourceParentUuid?: string;
}

export interface UserBlock extends Block {
  type: 'user';
  content: string;
  isMeta?: boolean;
  metaLabel?: string;
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

export interface TeamMessageBlock extends Block {
  type: 'team-message';
  sender: string;
  recipient?: string;
  content: string;
  messageType: 'message' | 'broadcast' | 'shutdown_request' | 'shutdown_response';
}

export interface SystemBlock extends Block {
  type: 'system';
  subtype: string;
  data: Record<string, unknown>;
}

export interface ProgressBlock extends Block {
  type: 'progress';
  progressType: string;
  data: Record<string, unknown>;
  parentToolUseId?: string;
}

export interface FileSnapshotBlock extends Block {
  type: 'file-snapshot';
  messageId: string;
  trackedFiles: Record<string, { backupFileName: string; version: number; backupTime: string }>;
}

export interface QueueOperationBlock extends Block {
  type: 'queue-operation';
  operation: 'enqueue' | 'remove';
  content?: string;
}

export type AnyBlock =
  | UserBlock
  | AgentBlock
  | ToolBlock
  | McpBlock
  | TeamMessageBlock
  | SystemBlock
  | ProgressBlock
  | FileSnapshotBlock
  | QueueOperationBlock;

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

export function isTeamMessageBlock(block: Block): block is TeamMessageBlock {
  return block.type === 'team-message';
}

export function isSystemBlock(block: Block): block is SystemBlock {
  return block.type === 'system';
}

export function isProgressBlock(block: Block): block is ProgressBlock {
  return block.type === 'progress';
}

export function isFileSnapshotBlock(block: Block): block is FileSnapshotBlock {
  return block.type === 'file-snapshot';
}

export function isQueueOperationBlock(block: Block): block is QueueOperationBlock {
  return block.type === 'queue-operation';
}
