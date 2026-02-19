import { useState } from 'react';
import { useTheme } from '../themes';
import type { TeamMessageBlock as TeamMessageBlockType } from '@/types';

interface Props {
  block: TeamMessageBlockType;
}

function getMessageTypeBadge(messageType: TeamMessageBlockType['messageType']): {
  label: string;
  color: string;
} {
  switch (messageType) {
    case 'message':
      return { label: 'DM', color: '#7c3aed' };
    case 'broadcast':
      return { label: 'Broadcast', color: '#b45309' };
    case 'shutdown_request':
      return { label: 'Shutdown', color: '#dc2626' };
    case 'shutdown_response':
      return { label: 'Shutdown Reply', color: '#dc2626' };
  }
}

export function TeamMessageBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();
  const badge = getMessageTypeBadge(block.messageType);

  const preview =
    block.content.length > 120 && !isExpanded ? block.content.slice(0, 120) + '...' : block.content;

  const directionLabel = block.recipient
    ? `${block.sender} \u2192 ${block.recipient}`
    : `${block.sender} \u2192 all`;

  return (
    <div id={`block-${block.id}`} className="flex justify-center mb-4">
      <div
        className="max-w-xl w-full p-4 rounded-lg cursor-pointer transition-all hover:shadow-md border"
        style={{
          backgroundColor: theme.colors.teamMessageBg,
          color: theme.colors.teamMessageText,
          borderColor: theme.colors.teamMessageAccent + '40',
        }}
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span
            className="px-2 py-0.5 rounded-full font-semibold"
            style={{
              backgroundColor: badge.color + '30',
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
          <span className="opacity-80 font-medium">{directionLabel}</span>
        </div>
        <div className="whitespace-pre-wrap font-mono text-sm">{preview}</div>
        {block.content.length > 120 && (
          <button
            className="text-xs mt-2 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? '\u25B2 Collapse' : '\u25BC Expand'}
          </button>
        )}
      </div>
    </div>
  );
}
