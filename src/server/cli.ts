export interface CliArgs {
  file?: string;
  port?: number;
  help?: boolean;
  version?: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '-v' || arg === '--version') {
      args.version = true;
    } else if (arg === '-p' || arg === '--port') {
      const port = parseInt(argv[++i], 10);
      if (!isNaN(port)) {
        args.port = port;
      }
    } else if (!arg.startsWith('-') && !args.file) {
      args.file = arg;
    }
  }

  return args;
}

export function printHelp(): void {
  console.log(`
Usage: claude-tracer [options] [session-file]

Arguments:
  session-file          Path to .jsonl session file (optional)

Options:
  -p, --port <number>   Port to run server on (default: 3000)
  -h, --help            Show help
  -v, --version         Show version

Examples:
  claude-tracer                              # Opens session picker
  claude-tracer ./session.jsonl              # Opens specific file in watch mode
  npx claude-tracer ./session.jsonl          # Via npx
`);
}

export function printVersion(): void {
  // Read from package.json in production
  console.log('claude-tracer v0.1.0');
}
