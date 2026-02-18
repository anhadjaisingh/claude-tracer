import { useState } from 'react';
import { useTheme } from '../themes';
import type { AgentBlock as AgentBlockType } from '@/types';

interface Props {
  block: AgentBlockType;
}

export function AgentBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const theme = useTheme();

  const preview =
    block.content.length > 200 && !isExpanded
      ? block.content.slice(0, 200) + '...'
      : block.content;

  return (
    <div id={`block-${block.id}`} className="flex justify-start mb-4">
      <div
        className="max-w-2xl p-4 rounded-lg cursor-pointer transition-all hover:shadow-md"
        style={{
          backgroundColor: theme.colors.agentBg,
          color: theme.colors.agentText,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
          <span>agent</span>
          {block.tokensIn && <span>{block.tokensIn} in</span>}
          {block.tokensOut && <span>{block.tokensOut} out</span>}
          {block.wallTimeMs && (
            <span>{(block.wallTimeMs / 1000).toFixed(1)}s</span>
          )}
        </div>

        {block.thinking && (
          <div className="mb-2">
            <button
              className="text-xs opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setShowThinking(!showThinking);
              }}
            >
              {showThinking ? '▲ Hide thinking' : '▼ Show thinking'}
            </button>
            {showThinking && (
              <div
                className="mt-2 p-2 rounded text-xs opacity-80 whitespace-pre-wrap"
                style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
              >
                {block.thinking}
              </div>
            )}
          </div>
        )}

        <div className="whitespace-pre-wrap font-mono text-sm">{preview}</div>

        {block.content.length > 200 && (
          <button
            className="text-xs mt-2 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        )}

        {block.toolCalls.length > 0 && (
          <div className="mt-2 text-xs opacity-60">
            {block.toolCalls.length} tool call
            {block.toolCalls.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
