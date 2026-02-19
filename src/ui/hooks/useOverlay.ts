import { useState, useEffect, useCallback } from 'react';
import type { AnyBlock } from '@/types';

export function useOverlay() {
  const [overlayBlock, setOverlayBlock] = useState<AnyBlock | null>(null);

  const open = useCallback((block: AnyBlock) => {
    setOverlayBlock(block);
  }, []);

  const close = useCallback(() => {
    setOverlayBlock(null);
  }, []);

  useEffect(() => {
    if (!overlayBlock) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [overlayBlock, close]);

  return { overlayBlock, open, close };
}
