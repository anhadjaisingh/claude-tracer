import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { AnyBlock, Chunk } from '@/types';

export interface WsMessage {
  type: 'blocks:update' | 'blocks:new' | 'session:init' | 'error';
  blocks?: AnyBlock[];
  chunks?: Chunk[];
  error?: string;
}

export interface TracerWebSocketServer {
  broadcast(message: WsMessage): void;
  close(): void;
}

export function createWebSocketServer(server: Server): TracerWebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  let latestBlocks: AnyBlock[] = [];
  let latestChunks: Chunk[] = [];

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');

    // Send current state to new client
    if (latestBlocks.length > 0) {
      ws.send(JSON.stringify({ type: 'session:init', blocks: latestBlocks, chunks: latestChunks }));
    }

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
  };
}
