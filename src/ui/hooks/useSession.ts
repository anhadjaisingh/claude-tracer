import { useState, useEffect, useCallback } from 'react';
import type { AnyBlock, Chunk } from '@/types';

interface WsMessage {
  type: 'blocks:update' | 'blocks:new' | 'session:init' | 'error';
  blocks?: AnyBlock[];
  chunks?: Chunk[];
}

export function useSession() {
  const [blocks, setBlocks] = useState<AnyBlock[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as WsMessage;

        switch (message.type) {
          case 'session:init':
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

  const scrollToBlock = useCallback((blockId: string) => {
    const element = document.getElementById(`block-${blockId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return {
    blocks,
    chunks,
    isConnected,
    scrollToBlock,
  };
}
