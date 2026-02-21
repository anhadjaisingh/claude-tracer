import { useState, useEffect, useRef, useCallback } from 'react';
import type { AnyBlock, Chunk, ChunkLevel } from '@/types';

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
  const [granularity, setGranularityState] = useState<ChunkLevel>(() => {
    const stored = localStorage.getItem('claude-tracer-granularity');
    if (stored === 'turn' || stored === 'task' || stored === 'theme') {
      return stored;
    }
    return 'turn';
  });

  const wsRef = useRef<WebSocket | null>(null);

  const setGranularity = useCallback((level: ChunkLevel) => {
    setGranularityState(level);
    localStorage.setItem('claude-tracer-granularity', level);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'granularity:set', level }));
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      // Send current granularity on connect so server uses the right level
      const stored = localStorage.getItem('claude-tracer-granularity');
      if (stored === 'task' || stored === 'theme') {
        ws.send(JSON.stringify({ type: 'granularity:set', level: stored }));
      }
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
      wsRef.current = null;
      ws.close();
    };
  }, []);

  return {
    blocks,
    chunks,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    filePath,
    granularity,
    setGranularity,
  };
}
