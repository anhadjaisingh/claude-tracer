import { useState } from 'react';
import { useTheme } from '../themes';
import type { UserBlock as UserBlockType } from '@/types';

interface Props {
  block: UserBlockType;
}

export function UserBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();

  const preview =
    block.content.length > 100 && !isExpanded
      ? block.content.slice(0, 100) + '...'
      : block.content;

  return (
    <div id={`block-${block.id}`} className="flex justify-end mb-4">
      <div
        className="max-w-xl p-4 rounded-lg cursor-pointer transition-all hover:shadow-md"
        style={{
          backgroundColor: theme.colors.userBg,
          color: theme.colors.userText,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
          <span>user</span>
          {block.tokensIn && <span>{block.tokensIn} tokens</span>}
        </div>
        <div className="whitespace-pre-wrap font-mono text-sm">{preview}</div>
        {block.content.length > 100 && (
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
      </div>
    </div>
  );
}
