#!/usr/bin/env node

import { createServer } from 'http';
import { createApp } from './app';
import { createWebSocketServer } from './websocket';
import { SessionWatcher } from './watcher';
import { ClaudeCodeParser } from '../parser/claude-code';
import { Chunker } from '../core/chunker';
import { EmbeddingEngine } from '../core/embeddings';
import { HybridSearchEngine } from '../core/hybrid-search';
import { parseArgs, printHelp, printVersion } from './cli';
import path from 'path';
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

  // Initialize embedding engine and hybrid search
  const embeddingEngine = new EmbeddingEngine();
  const hybridSearch = new HybridSearchEngine(embeddingEngine);
  wss.setSearchEngine(hybridSearch);

  // Load embedding model in background
  embeddingEngine
    .init()
    .then(() => {
      console.log('Embedding model loaded');
    })
    .catch((err: unknown) => {
      console.error('Failed to load embedding model:', err);
    });

  if (args.file) {
    wss.setFilePath(path.resolve(args.file));
    const watcher = new SessionWatcher({ parser: new ClaudeCodeParser() });
    let allBlocks: AnyBlock[] = [];

    await watcher.watch(args.file, (newBlocks) => {
      // Merge by id (updated blocks replace, new ones append)
      const blockMap = new Map(allBlocks.map((b) => [b.id, b]));
      for (const block of newBlocks) {
        blockMap.set(block.id, block);
      }
      allBlocks = Array.from(blockMap.values());

      const chunks = new Chunker().createChunks(allBlocks);
      wss.broadcast({ type: 'blocks:update', blocks: allBlocks, chunks });

      // Background-index all blocks for hybrid search
      hybridSearch
        .indexBlocks(allBlocks, (indexed, total) => {
          wss.broadcast({
            type: 'embeddings:progress',
            indexed,
            total,
          } as unknown as Parameters<typeof wss.broadcast>[0]);
        })
        .then(() => {
          if (hybridSearch.isVectorReady()) {
            wss.broadcast({
              type: 'embeddings:ready',
            } as unknown as Parameters<typeof wss.broadcast>[0]);
            console.log('Vector index ready');
          }
        })
        .catch((err: unknown) => {
          console.error('Embedding indexing error:', err);
        });
    });
  }

  const port = args.port ?? 3000;
  server.listen(port, () => {
    console.log(`Claude Tracer running at http://localhost:${String(port)}`);
    if (args.file) {
      console.log(`Watching: ${args.file}`);
    }
  });
}

main().catch(console.error);
