import { useTheme } from '../themes';
import type { Chunk } from '@/types';

interface Props {
  chunks: Chunk[];
  onChunkClick?: (chunkId: string) => void;
}

export function IndexSidebar({ chunks, onChunkClick }: Props) {
  const theme = useTheme();

  return (
    <div className="h-full" style={{ color: theme.colors.indexText }}>
      <h2 className="text-sm font-semibold mb-4 opacity-80">INDEX</h2>

      {chunks.length === 0 ? (
        <p className="text-xs opacity-60">No chunks yet</p>
      ) : (
        <ul className="space-y-2">
          {chunks.map((chunk) => (
            <li
              key={chunk.id}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onChunkClick?.(chunk.id)}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-60">○</span>
                <span className="truncate">{chunk.label}</span>
              </div>
              <div className="text-xs opacity-50 ml-5">
                {chunk.totalTokensIn + chunk.totalTokensOut} tokens
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
