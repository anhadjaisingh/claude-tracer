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

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-0 right-0 flex gap-1">
        <button
          className="w-8 h-8 rounded flex items-center justify-center text-lg"
          style={{
            backgroundColor: theme.colors.headerBg,
            color: theme.colors.headerText,
          }}
        >
          −
        </button>
        <button
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
      <div className="pt-12">
        {blocks.length === 0 ? (
          <div
            className="text-center py-20 opacity-60"
            style={{ color: theme.colors.agentText }}
          >
            No blocks to display. Open a session file to begin.
          </div>
        ) : (
          blocks.map((block) => {
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
          })
        )}
      </div>
    </div>
  );
}
