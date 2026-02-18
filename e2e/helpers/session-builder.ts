interface BuilderOptions {
  turns: number;
  toolCallsPerTurn?: number;
  includeThinking?: boolean;
}

export function buildSession(options: BuilderOptions): string {
  const lines: string[] = [];
  const baseTime = new Date('2026-01-15T10:00:00Z').getTime();

  for (let i = 0; i < options.turns; i++) {
    const turnTime = new Date(baseTime + i * 10000).toISOString();

    lines.push(
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: `User prompt for turn ${i + 1}` },
        timestamp: turnTime,
        sessionId: 'generated-session',
      }),
    );

    const content: unknown[] = [];

    if (options.includeThinking) {
      content.push({ type: 'thinking', thinking: `Thinking about turn ${i + 1}...` });
    }

    content.push({ type: 'text', text: `Agent response for turn ${i + 1}` });

    const toolCount = options.toolCallsPerTurn ?? 0;
    for (let t = 0; t < toolCount; t++) {
      content.push({
        type: 'tool_use',
        id: `toolu_${i}_${t}`,
        name: 'Read',
        input: { file_path: `/src/file${t}.ts` },
      });
    }

    lines.push(
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content },
        timestamp: new Date(baseTime + i * 10000 + 5000).toISOString(),
        sessionId: 'generated-session',
        inputTokens: 100 + i * 50,
        outputTokens: 50 + i * 25,
        durationMs: 1000 + i * 200,
      }),
    );

    for (let t = 0; t < toolCount; t++) {
      lines.push(
        JSON.stringify({
          type: 'tool_result',
          tool_use_id: `toolu_${i}_${t}`,
          content: `Contents of file${t}.ts`,
          timestamp: new Date(baseTime + i * 10000 + 6000 + t * 1000).toISOString(),
          sessionId: 'generated-session',
        }),
      );
    }
  }

  return lines.join('\n') + '\n';
}
