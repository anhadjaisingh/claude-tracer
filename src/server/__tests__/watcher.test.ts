import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionWatcher } from '../watcher';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Use polling for reliable change detection in test/tmp environments
const testChokidarOptions = {
  persistent: true,
  usePolling: true,
  interval: 50,
};

describe('SessionWatcher', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'));
    testFile = path.join(tmpDir, 'test.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads initial file content', async () => {
    const line = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(testFile, line + '\n');

    const watcher = new SessionWatcher({ chokidar: testChokidarOptions });
    const callback = vi.fn();

    await watcher.watch(testFile, callback);

    expect(callback).toHaveBeenCalled();
    const blocks = callback.mock.calls[0][0];
    expect(blocks.length).toBe(1);

    watcher.stop();
  });

  it('detects new lines appended to file', async () => {
    fs.writeFileSync(testFile, '');

    const watcher = new SessionWatcher({ chokidar: testChokidarOptions });
    const callback = vi.fn();

    await watcher.watch(testFile, callback);

    // Append a new line
    const line = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      timestamp: new Date().toISOString(),
    });
    fs.appendFileSync(testFile, line + '\n');

    // Wait for polling to detect the change
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(callback).toHaveBeenCalledTimes(2); // Initial + update

    watcher.stop();
  });
});
