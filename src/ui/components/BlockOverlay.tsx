import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../themes';
import { isUserBlock, isAgentBlock, isToolBlock } from '@/types';
import type { AnyBlock } from '@/types';

interface BlockOverlayProps {
  block: AnyBlock;
  onClose: () => void;
}

function OverlayContent({ block, onClose }: BlockOverlayProps) {
  const theme = useTheme();
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger fade-in on mount
    requestAnimationFrame(() => {
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '1';
      }
    });
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        opacity: 0,
        transition: 'opacity 200ms ease-in-out',
        /* Exclude sidebar area: the sidebar is w-64 (16rem) on the right */
        paddingRight: '16rem',
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: '80%',
          maxHeight: '90vh',
          backgroundColor: theme.colors.agentBg,
          color: theme.colors.agentText,
          borderRadius: '0.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0,
          }}
        >
          <span className="text-sm font-semibold" style={{ color: theme.colors.accent }}>
            {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-lg"
            aria-label="Close overlay"
          >
            &times;
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1rem',
            flex: 1,
          }}
        >
          {isUserBlock(block) && <UserBlockContent block={block} />}
          {isAgentBlock(block) && <AgentBlockContent block={block} />}
          {isToolBlock(block) && <ToolBlockContent block={block} />}
        </div>
      </div>
    </div>
  );
}

function UserBlockContent({ block }: { block: Extract<AnyBlock, { type: 'user' }> }) {
  const theme = useTheme();
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs opacity-60">
        <span>user</span>
        {block.isMeta && <span className="px-2 py-0.5 rounded bg-white/10">meta</span>}
        {block.metaLabel && <span>{block.metaLabel}</span>}
        {block.tokensIn != null && <span>{block.tokensIn} tokens</span>}
      </div>
      <div
        className="whitespace-pre-wrap font-mono text-sm"
        style={{ color: theme.colors.agentText }}
      >
        {block.content}
      </div>
    </div>
  );
}

function AgentBlockContent({ block }: { block: Extract<AnyBlock, { type: 'agent' }> }) {
  const theme = useTheme();
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs opacity-60">
        <span>agent</span>
        {block.tokensIn != null && <span>{block.tokensIn} in</span>}
        {block.tokensOut != null && <span>{block.tokensOut} out</span>}
        {block.wallTimeMs != null && <span>{(block.wallTimeMs / 1000).toFixed(1)}s</span>}
      </div>

      {block.thinking && (
        <div className="mb-4">
          <div className="text-xs font-semibold mb-1" style={{ color: theme.colors.accent }}>
            Thinking
          </div>
          <div
            className="p-3 rounded text-xs whitespace-pre-wrap font-mono"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
          >
            {block.thinking}
          </div>
        </div>
      )}

      <div className="whitespace-pre-wrap font-mono text-sm">{block.content}</div>

      {block.toolCalls.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold mb-2" style={{ color: theme.colors.accent }}>
            Tool Calls ({block.toolCalls.length})
          </div>
          <ul className="list-disc list-inside text-xs opacity-80 space-y-1">
            {block.toolCalls.map((toolId, i) => (
              <li key={i} className="font-mono">
                {toolId}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ToolBlockContent({ block }: { block: Extract<AnyBlock, { type: 'tool' }> }) {
  const theme = useTheme();
  const inputText =
    typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2);
  const outputText =
    typeof block.output === 'string' ? block.output : JSON.stringify(block.output, null, 2);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="px-2 py-0.5 rounded text-xs"
          style={{
            backgroundColor: block.status === 'success' ? '#166534' : '#991b1b',
            color: '#fff',
          }}
        >
          {block.toolName}
        </span>
        <span className="text-xs opacity-60">{block.status}</span>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold mb-1" style={{ color: theme.colors.accent }}>
          Input
        </div>
        <pre
          className="p-3 rounded text-xs whitespace-pre-wrap font-mono"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          {inputText}
        </pre>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: theme.colors.accent }}>
          Output
        </div>
        <pre
          className="p-3 rounded text-xs whitespace-pre-wrap font-mono"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          {outputText}
        </pre>
      </div>
    </div>
  );
}

export function BlockOverlay({ block, onClose }: BlockOverlayProps) {
  return createPortal(<OverlayContent block={block} onClose={onClose} />, document.body);
}
