import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionWatcher } from '../watcher';
import fs from 'fs';
import path from 'path';
import os from 'os';

const testChokidarOptions = {
  persistent: true,
  usePolling: true,
  interval: 50,
};

describe('SessionWatcher', () => {
  let tmpDir: string;
  let testFile: string;
  let watcher: SessionWatcher;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'));
    testFile = path.join(tmpDir, 'test.jsonl');
  });

  afterEach(() => {
    watcher.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads initial file content', async () => {
    const line = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(testFile, line + '\n');

    watcher = new SessionWatcher({ chokidar: testChokidarOptions });
    const callback = vi.fn();

    await watcher.watch(testFile, callback);

    expect(callback).toHaveBeenCalled();
    const blocks = callback.mock.calls[0][0];
    expect(blocks.length).toBe(1);
  });

  it('detects new lines appended to file', async () => {
    const line1 = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'First' },
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(testFile, line1 + '\n');

    watcher = new SessionWatcher({ chokidar: testChokidarOptions });

    // Use a promise to wait for the second callback
    const secondCall = new Promise<void>((resolve) => {
      let callCount = 0;
      const callback = vi.fn(() => {
        callCount++;
        if (callCount === 2) resolve();
      });
      watcher.watch(testFile, callback).then(() => {
        // After watcher is ready, append new content
        const line2 = JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Second' },
          timestamp: new Date().toISOString(),
        });
        fs.appendFileSync(testFile, line2 + '\n');
      });
    });

    // Wait up to 5s for the change to be detected
    await Promise.race([
      secondCall,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for file change')), 5000),
      ),
    ]);
  });
});
