import { useState, useEffect } from 'react';
import type { AnyBlock, Chunk } from '@/types';

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

interface WsMessage {
  type: 'blocks:update' | 'blocks:new' | 'session:init' | 'error';
  blocks?: AnyBlock[];
  chunks?: Chunk[];
  filePath?: string;
}

export function useSession() {
  const [blocks, setBlocks] = useState<AnyBlock[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [filePath, setFilePath] = useState<string | undefined>();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setConnectionStatus('connecting');
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      setConnectionStatus('error');
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as WsMessage;

        switch (message.type) {
          case 'session:init':
            if (message.filePath) {
              setFilePath(message.filePath);
            }
            if (message.blocks) {
              setBlocks(message.blocks);
            }
            if (message.chunks) {
              setChunks(message.chunks);
            }
            break;

          case 'blocks:update':
            if (message.blocks) {
              setBlocks(message.blocks);
            }
            if (message.chunks) {
              setChunks(message.chunks);
            }
            break;

          case 'blocks:new':
            if (message.blocks) {
              setBlocks((prev) => [...prev, ...(message.blocks ?? [])]);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return {
    blocks,
    chunks,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    filePath,
  };
}
