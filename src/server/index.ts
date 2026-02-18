#!/usr/bin/env node

import { createServer } from 'http';
import { createApp } from './app';
import { createWebSocketServer } from './websocket';
import { SessionWatcher } from './watcher';
import { parseArgs, printHelp, printVersion } from './cli';

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
    const watcher = new SessionWatcher();
    watcher.watch(args.file, (blocks) => {
      wss.broadcast({ type: 'blocks:update', blocks });
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
