import { describe, it, expect, afterAll } from 'vitest';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import { createWebSocketServer } from '../websocket';
import type { AnyBlock } from '@/types';

describe('WebSocket server', () => {
  const server = createServer();
  const wss = createWebSocketServer(server);
  let port: number;

  const ready = new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        port = addr.port;
      }
      resolve();
    });
  });

  afterAll(() => {
    wss.close();
    server.close();
  });

  it('includes filePath in session:init', { timeout: 10000 }, async () => {
    await ready;
    wss.setFilePath('/home/user/sessions/test-session.jsonl');
    const testBlock: AnyBlock = {
      id: 'block-1',
      timestamp: Date.now(),
      type: 'user',
      content: 'Hello',
    };
    wss.broadcast({ type: 'blocks:update', blocks: [testBlock], chunks: [] });
    const ws = new WebSocket(`ws://localhost:${String(port)}/ws`);
    const message = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('timeout'));
      }, 8000);
      ws.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString('utf8')) as Record<string, unknown>);
      });
      ws.on('error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });
    expect(message.type).toBe('session:init');
    expect(message.filePath).toBe('/home/user/sessions/test-session.jsonl');
    expect(message.blocks).toBeDefined();
    ws.close();
  });

  it('omits filePath when not set', { timeout: 10000 }, async () => {
    await ready;
    const server2 = createServer();
    const wss2 = createWebSocketServer(server2);
    await new Promise<void>((resolve) => {
      server2.listen(0, resolve);
    });
    const addr2 = server2.address();
    const port2 = addr2 && typeof addr2 === 'object' ? addr2.port : 0;
    const testBlock: AnyBlock = {
      id: 'block-2',
      timestamp: Date.now(),
      type: 'user',
      content: 'Test',
    };
    wss2.broadcast({ type: 'blocks:update', blocks: [testBlock], chunks: [] });
    const ws2 = new WebSocket(`ws://localhost:${String(port2)}/ws`);
    const message = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('timeout'));
      }, 8000);
      ws2.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString('utf8')) as Record<string, unknown>);
      });
      ws2.on('error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });
    expect(message.type).toBe('session:init');
    expect(message.filePath).toBeUndefined();
    ws2.close();
    wss2.close();
    server2.close();
  });
});
