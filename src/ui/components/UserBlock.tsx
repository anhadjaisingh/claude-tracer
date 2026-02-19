import { useTheme } from '../themes';
import type { UserBlock as UserBlockType } from '@/types';

interface Props {
  block: UserBlockType;
  onExpand: (block: UserBlockType) => void;
}

export function UserBlock({ block, onExpand }: Props) {
  const theme = useTheme();

  // Compact rendering for system-injected (isMeta) messages
  if (block.isMeta) {
    return (
      <div id={`block-${block.id}`} className="flex justify-end mb-2">
        <div
          className="px-3 py-1.5 rounded-full text-xs opacity-60 cursor-pointer hover:opacity-80"
          style={{
            backgroundColor: theme.colors.userBg + '80',
            color: theme.colors.userText,
          }}
          onClick={() => {
            onExpand(block);
          }}
        >
          <span>{block.metaLabel ?? 'system'}</span>
        </div>
      </div>
    );
  }

  const preview = block.content.length > 100 ? block.content.slice(0, 100) + '...' : block.content;

  return (
    <div id={`block-${block.id}`} className="flex justify-end mb-4">
      <div
        className="max-w-xl p-4 rounded-lg cursor-pointer transition-all hover:shadow-md"
        style={{
          backgroundColor: theme.colors.userBg,
          color: theme.colors.userText,
        }}
        onClick={() => {
          onExpand(block);
        }}
      >
        <div className="flex items-center gap-2 mb-2 text-xs opacity-60">
          <span>user</span>
          {block.tokensIn && <span>{block.tokensIn} tokens</span>}
        </div>
        <div className="whitespace-pre-wrap font-mono text-sm">{preview}</div>
        {block.content.length > 100 && (
          <div className="text-xs mt-2 opacity-60">Click to expand</div>
        )}
      </div>
    </div>
  );
}
