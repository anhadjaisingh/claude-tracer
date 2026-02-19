import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  storageKey: string;
}

interface UseResizableReturn {
  width: number;
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
  isResizing: boolean;
}

function getInitialWidth(storageKey: string, defaultWidth: number, minWidth: number): number {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed) && parsed >= minWidth) {
        return parsed;
      }
    }
  } catch {
    // localStorage may not be available
  }
  return defaultWidth;
}

export function useResizable({
  minWidth,
  maxWidth,
  defaultWidth,
  storageKey,
}: UseResizableOptions): UseResizableReturn {
  const [width, setWidth] = useState(() => getInitialWidth(storageKey, defaultWidth, minWidth));
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      setIsResizing(true);
    },
    [width],
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      // Sidebar is on the RIGHT, drag handle is on its LEFT edge.
      // Moving mouse LEFT (decreasing clientX) should INCREASE the sidebar width.
      const delta = startXRef.current - e.clientX;
      const effectiveMax = Math.min(maxWidth, window.innerWidth / 2);
      const newWidth = Math.max(minWidth, Math.min(startWidthRef.current + delta, effectiveMax));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  // Persist to localStorage whenever width changes and not actively resizing
  useEffect(() => {
    if (!isResizing) {
      try {
        localStorage.setItem(storageKey, String(width));
      } catch {
        // localStorage may not be available
      }
    }
  }, [width, isResizing, storageKey]);

  return {
    width,
    handleProps: { onMouseDown },
    isResizing,
  };
}
