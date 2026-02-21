import { useTheme } from '../themes';
import { GranularitySelector } from './GranularitySelector';
import type { AnyBlock, Chunk, ChunkLevel } from '@/types';
import { isTeamMessageBlock } from '@/types';

interface Props {
  chunks: Chunk[];
  blocks?: AnyBlock[];
  onChunkClick?: (chunkId: string) => void;
  granularity: ChunkLevel;
  onGranularityChange: (level: ChunkLevel) => void;
}

function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1)}k`;
}

export function IndexSidebar({
  chunks,
  blocks = [],
  onChunkClick,
  granularity,
  onGranularityChange,
}: Props) {
  const theme = useTheme();

  const hasTeamMessage = (chunk: Chunk): boolean =>
    chunk.blockIds.some((id) => blocks.find((b) => b.id === id && isTeamMessageBlock(b)));

  return (
    <div className="h-full flex flex-col" style={{ color: theme.colors.indexText }}>
      <h2 className="text-sm font-semibold mb-4 opacity-80">INDEX</h2>

      <div className="flex-1 overflow-auto min-h-0">
        {chunks.length === 0 ? (
          <p className="text-xs opacity-60">No chunks yet</p>
        ) : (
          <ul>
            {chunks.map((chunk, index) => (
              <li
                key={chunk.id}
                className="cursor-pointer hover:opacity-80 transition-opacity py-3"
                style={{
                  borderBottom:
                    index < chunks.length - 1 ? `1px solid ${theme.colors.accent}26` : undefined,
                }}
                onClick={() => onChunkClick?.(chunk.id)}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="opacity-60">{hasTeamMessage(chunk) ? 'team' : '\u25CB'}</span>
                  <span className="truncate flex-1">{chunk.label}</span>
                  <span className="text-xs opacity-40">{String(chunk.blockIds.length)}</span>
                </div>
                <div className="text-xs opacity-50 ml-5">
                  {formatTokens(chunk.totalTokensIn + chunk.totalTokensOut)} tokens
                  {chunk.boundarySignals && chunk.boundarySignals.length > 0 && (
                    <span className="ml-2 opacity-40">
                      {chunk.boundarySignals.map((s) => s.type).join(', ')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-shrink-0" style={{ borderTop: `1px solid ${theme.colors.accent}26` }}>
        <GranularitySelector granularity={granularity} onGranularityChange={onGranularityChange} />
      </div>
    </div>
  );
}
