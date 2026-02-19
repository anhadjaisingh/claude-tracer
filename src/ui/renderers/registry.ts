import type { ToolRendererConfig } from './tool-renderer';
import { genericRenderer } from './tools/generic';
import { bashRenderer } from './tools/bash';
import { readRenderer } from './tools/read';
import { writeRenderer } from './tools/write';
import { editRenderer } from './tools/edit';
import { globRenderer } from './tools/glob';
import { grepRenderer } from './tools/grep';
import { taskRenderer } from './tools/task';
import { todoWriteRenderer } from './tools/todo-write';

const renderers = new Map<string, ToolRendererConfig>();

export function registerToolRenderer(toolName: string, renderer: ToolRendererConfig): void {
  renderers.set(toolName, renderer);
}

export function getToolRenderer(toolName: string): ToolRendererConfig {
  return renderers.get(toolName) ?? genericRenderer;
}

// Register built-in renderers
registerToolRenderer('Bash', bashRenderer);
registerToolRenderer('Read', readRenderer);
registerToolRenderer('Write', writeRenderer);
registerToolRenderer('Edit', editRenderer);
registerToolRenderer('Glob', globRenderer);
registerToolRenderer('Grep', grepRenderer);
registerToolRenderer('Task', taskRenderer);
registerToolRenderer('TodoWrite', todoWriteRenderer);
