import type { ReactNode } from 'react';

export interface ToolRendererConfig {
  /** Tool icon/emoji or short label for the badge */
  icon: string;
  /** One-line summary for the header (always visible) */
  headerSummary(input: unknown, output: unknown): string;
  /** 2-3 line preview for collapsed state */
  preview(input: unknown, output: unknown): ReactNode;
  /** Full rendered content for the expanded overlay */
  fullContent(input: unknown, output: unknown): ReactNode;
}
