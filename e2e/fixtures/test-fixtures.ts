import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

type SessionFixture = {
  sessionDir: string;
  sessionFile: string;
  appendToSession: (line: object) => void;
};

export const test = base.extend<SessionFixture>({
  sessionDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },

  sessionFile: async ({ sessionDir }, use) => {
    const src = path.join(__dirname, 'sessions', 'simple-chat.jsonl');
    const dest = path.join(sessionDir, 'test-session.jsonl');
    fs.copyFileSync(src, dest);
    await use(dest);
  },

  appendToSession: async ({ sessionFile }, use) => {
    const append = (line: object) => {
      fs.appendFileSync(sessionFile, JSON.stringify(line) + '\n');
    };
    await use(append);
  },
});

export { expect };
