import { useState } from 'react';
import { useTheme } from '../themes';
import { UserBlock } from './UserBlock';
import { AgentBlock } from './AgentBlock';
import { ToolBlock } from './ToolBlock';
import { isUserBlock, isAgentBlock, isToolBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface Props {
  blocks: AnyBlock[];
}

export function TraceView({ blocks }: Props) {
  const theme = useTheme();
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  const zoomReset = () => setZoomLevel(1.0);

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-0 right-0 flex gap-1 items-center z-10">
        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded flex items-center justify-center text-lg"
          style={{
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
          }}
        >
          −
        </button>
        <button
          onClick={zoomReset}
          className="px-2 h-8 rounded flex items-center justify-center text-xs"
          style={{
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
          }}
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded flex items-center justify-center text-lg"
          style={{
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
          }}
        >
          +
        </button>
      </div>

      {/* Blocks */}
      <div
        className="pt-12"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          width: `${100 / zoomLevel}%`,
        }}
      >
        {blocks.length === 0 ? (
          <div
            className="text-center py-20 opacity-60"
            style={{ color: theme.colors.agentText }}
          >
            No blocks to display. Open a session file to begin.
          </div>
        ) : (
          blocks.map((block, index) => {
            const rendered = (() => {
              if (isUserBlock(block)) {
                return <UserBlock key={block.id} block={block} />;
              }
              if (isAgentBlock(block)) {
                return <AgentBlock key={block.id} block={block} />;
              }
              if (isToolBlock(block)) {
                return <ToolBlock key={block.id} block={block} />;
              }
              return null;
            })();

            if (!rendered) return null;

            return (
              <div key={block.id}>
                {index > 0 && (
                  <div className="flex justify-center my-1">
                    <div
                      className="w-0.5 h-4"
                      style={{ backgroundColor: theme.colors.accent + '40' }}
                    />
                  </div>
                )}
                {rendered}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
