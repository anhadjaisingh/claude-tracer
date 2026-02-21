import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { AnyBlock, Chunk, ChunkLevel, SearchRequest } from '@/types';
import type { HybridSearchEngine } from '@/core';

export interface WsMessage {
  type:
    | 'blocks:update'
    | 'blocks:new'
    | 'session:init'
    | 'error'
    | 'search:results'
    | 'embeddings:progress'
    | 'embeddings:ready';
  blocks?: AnyBlock[];
  chunks?: Chunk[];
  filePath?: string;
  error?: string;
  [key: string]: unknown;
}

export interface TracerWebSocketServer {
  broadcast(message: WsMessage): void;
  close(): void;
  setSearchEngine(engine: HybridSearchEngine): void;
  setFilePath(filePath: string): void;
  setGranularity(level: ChunkLevel): void;
  getGranularity(): ChunkLevel;
  setRechunkCallback(cb: (level: ChunkLevel) => void): void;
}

let queryCounter = 0;

export function createWebSocketServer(server: Server): TracerWebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();
  let searchEngine: HybridSearchEngine | null = null;
  let sessionFilePath: string | undefined;
  let granularity: ChunkLevel = 'turn';
  let rechunkCallback: ((level: ChunkLevel) => void) | null = null;

  let latestBlocks: AnyBlock[] = [];
  let latestChunks: Chunk[] = [];

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');

    // Send current state to new client
    if (latestBlocks.length > 0) {
      ws.send(
        JSON.stringify({
          type: 'session:init',
          blocks: latestBlocks,
          chunks: latestChunks,
          filePath: sessionFilePath,
        }),
      );
    }

    ws.on('message', (rawData: Buffer) => {
      try {
        const raw = JSON.parse(rawData.toString('utf8')) as Record<string, unknown>;
        if (raw.type === 'search' && searchEngine) {
          const queryId = String(++queryCounter);
          const message = raw as unknown as SearchRequest;
          searchEngine
            .search(message.query, message.mode, message.limit)
            .then((results) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'search:results',
                    results,
                    mode: message.mode,
                    queryId,
                  }),
                );
              }
            })
            .catch((err: unknown) => {
              console.error('Search error:', err);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: 'Search failed',
                  }),
                );
              }
            });
        } else if (raw.type === 'granularity:set') {
          const level = raw.level as string;
          if (level === 'turn' || level === 'task' || level === 'theme') {
            granularity = level;
            if (rechunkCallback) {
              rechunkCallback(level);
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  return {
    broadcast(message: WsMessage) {
      // Track latest blocks and chunks state
      if (message.type === 'blocks:update') {
        latestBlocks = message.blocks ?? latestBlocks;
        latestChunks = message.chunks ?? latestChunks;
      } else if (message.type === 'blocks:new') {
        if (message.blocks) {
          latestBlocks = [...latestBlocks, ...message.blocks];
        }
        if (message.chunks) {
          latestChunks = message.chunks;
        }
      }

      const data = JSON.stringify(message);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    },
    close() {
      wss.close();
    },
    setSearchEngine(engine: HybridSearchEngine) {
      searchEngine = engine;
    },
    setFilePath(filePath: string) {
      sessionFilePath = filePath;
    },
    setGranularity(level: ChunkLevel) {
      granularity = level;
    },
    getGranularity(): ChunkLevel {
      return granularity;
    },
    setRechunkCallback(cb: (level: ChunkLevel) => void) {
      rechunkCallback = cb;
    },
  };
}
