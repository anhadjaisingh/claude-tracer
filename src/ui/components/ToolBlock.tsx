import { useState } from 'react';
import { useTheme } from '../themes';
import { getToolRenderer } from '../renderers';
import type { ToolBlock as ToolBlockType } from '@/types';

interface Props {
  block: ToolBlockType;
}

export function ToolBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();
  const renderer = getToolRenderer(block.toolName);

  /** 10% darker variant of the tool block background for the header bar */
  function darkenColor(hex: string): string {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 25);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 25);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 25);
    return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
  }

  return (
    <div
      id={`block-${block.id}`}
      className="flex justify-start ml-8 mb-2 pl-3 border-l-2"
      style={{ borderColor: theme.colors.accent + '60' }}
    >
      <div
        className="max-w-xl rounded cursor-pointer transition-all hover:shadow-md font-mono text-xs overflow-hidden"
        style={{
          backgroundColor: theme.colors.toolBg,
          color: theme.colors.toolText,
        }}
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
      >
        {/* Header bar with slightly darker background */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ backgroundColor: darkenColor(theme.colors.toolBg) }}
        >
          <span className="shrink-0">{renderer.icon}</span>
          <span
            className="px-2 py-0.5 rounded text-xs shrink-0"
            style={{
              backgroundColor: block.status === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {block.toolName}
          </span>
          <span className="opacity-80 truncate">
            {renderer.headerSummary(block.input, block.output)}
          </span>
          <span className="opacity-40 ml-auto shrink-0">{block.status}</span>
        </div>

        {/* Body: preview or full content */}
        <div className="px-3 py-2">
          {isExpanded
            ? renderer.fullContent(block.input, block.output)
            : renderer.preview(block.input, block.output)}
        </div>
      </div>
    </div>
  );
}
