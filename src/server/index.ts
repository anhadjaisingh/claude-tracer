#!/usr/bin/env node

import { createServer } from 'http';
import { createApp } from './app';
import { createWebSocketServer } from './websocket';
import { SessionWatcher } from './watcher';
import { ClaudeCodeParser } from '../parser/claude-code';
import { Chunker } from '../core/chunker';
import { parseArgs, printHelp, printVersion } from './cli';
import type { AnyBlock } from '../types';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.version) {
    printVersion();
    return;
  }

  const app = createApp();
  const server = createServer(app);
  const wss = createWebSocketServer(server);

  if (args.file) {
    const watcher = new SessionWatcher({ parser: new ClaudeCodeParser() });
    let allBlocks: AnyBlock[] = [];

    watcher.watch(args.file, (newBlocks) => {
      // Merge by id (updated blocks replace, new ones append)
      const blockMap = new Map(allBlocks.map(b => [b.id, b]));
      for (const block of newBlocks) {
        blockMap.set(block.id, block);
      }
      allBlocks = Array.from(blockMap.values());

      const chunks = new Chunker().createChunks(allBlocks);
      wss.broadcast({ type: 'blocks:update', blocks: allBlocks, chunks });
    });
  }

  const port = args.port || 3000;
  server.listen(port, () => {
    console.log(`Claude Tracer running at http://localhost:${port}`);
    if (args.file) {
      console.log(`Watching: ${args.file}`);
    }
  });
}

main().catch(console.error);
