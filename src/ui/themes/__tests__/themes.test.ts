import { describe, it, expect } from 'vitest';
import { claudeTheme } from '../claude';
import { darkTheme } from '../dark';
import { lightTheme } from '../light';

describe('themes', () => {
  it('all themes include edgeColor', () => {
    expect(claudeTheme.colors.edgeColor).toBeDefined();
    expect(darkTheme.colors.edgeColor).toBeDefined();
    expect(lightTheme.colors.edgeColor).toBeDefined();
  });

  it('edgeColor is a valid hex color', () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    expect(claudeTheme.colors.edgeColor).toMatch(hexPattern);
    expect(darkTheme.colors.edgeColor).toMatch(hexPattern);
    expect(lightTheme.colors.edgeColor).toMatch(hexPattern);
  });
});
