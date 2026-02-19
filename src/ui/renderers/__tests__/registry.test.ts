import { describe, it, expect } from 'vitest';
import { getToolRenderer, registerToolRenderer } from '../registry';
import type { ToolRendererConfig } from '../tool-renderer';
import { genericRenderer } from '../tools/generic';

describe('Tool renderer registry', () => {
  it('returns the generic renderer for unknown tools', () => {
    const renderer = getToolRenderer('SomeUnknownTool');
    expect(renderer).toBe(genericRenderer);
  });

  it('returns registered renderers for known tools', () => {
    const renderer = getToolRenderer('Bash');
    expect(renderer.icon).toBe('$');
  });

  it('returns Read renderer', () => {
    const renderer = getToolRenderer('Read');
    expect(renderer.icon).toBe('\u{1F4C4}');
  });

  it('returns Write renderer', () => {
    const renderer = getToolRenderer('Write');
    expect(renderer.icon).toBe('\u270F\uFE0F');
  });

  it('returns Edit renderer', () => {
    const renderer = getToolRenderer('Edit');
    expect(renderer.icon).toBe('\u{1F527}');
  });

  it('returns Glob renderer', () => {
    const renderer = getToolRenderer('Glob');
    expect(renderer.icon).toBe('\u{1F50D}');
  });

  it('returns Grep renderer', () => {
    const renderer = getToolRenderer('Grep');
    expect(renderer.icon).toBe('\u{1F50E}');
  });

  it('returns Task renderer', () => {
    const renderer = getToolRenderer('Task');
    expect(renderer.icon).toBe('\u{1F916}');
  });

  it('returns TodoWrite renderer', () => {
    const renderer = getToolRenderer('TodoWrite');
    expect(renderer.icon).toBe('\u{1F4CB}');
  });

  it('allows registering custom renderers', () => {
    const custom: ToolRendererConfig = {
      icon: '!',
      headerSummary: () => 'custom summary',
      preview: () => null,
      fullContent: () => null,
    };
    registerToolRenderer('CustomTool', custom);
    expect(getToolRenderer('CustomTool')).toBe(custom);
  });
});
