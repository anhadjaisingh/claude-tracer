import { useState } from 'react';
import { useTheme } from '../themes';
import type { ToolBlock as ToolBlockType } from '@/types';

interface Props {
  block: ToolBlockType;
}

export function ToolBlock({ block }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = useTheme();

  const inputPreview =
    typeof block.input === 'string'
      ? block.input
      : JSON.stringify(block.input, null, 2);

  const outputPreview =
    typeof block.output === 'string'
      ? block.output
      : JSON.stringify(block.output, null, 2);

  return (
    <div id={`block-${block.id}`} className="flex justify-start ml-8 mb-2">
      <div
        className="max-w-xl p-3 rounded cursor-pointer transition-all hover:shadow-md font-mono text-xs"
        style={{
          backgroundColor: theme.colors.toolBg,
          color: theme.colors.toolText,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor:
                block.status === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {block.toolName}
          </span>
          <span className="opacity-60">{block.status}</span>
        </div>

        {isExpanded && (
          <>
            <div className="mt-2">
              <div className="opacity-60 mb-1">Input:</div>
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                {inputPreview.slice(0, 500)}
                {inputPreview.length > 500 && '...'}
              </pre>
            </div>
            <div className="mt-2">
              <div className="opacity-60 mb-1">Output:</div>
              <pre className="whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                {outputPreview.slice(0, 500)}
                {outputPreview.length > 500 && '...'}
              </pre>
            </div>
          </>
        )}

        {!isExpanded && <div className="opacity-60">Click to expand</div>}
      </div>
    </div>
  );
}
