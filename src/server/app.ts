import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Serve static UI files in production
  const uiPath = path.join(__dirname, '../../dist/ui');
  app.use(express.static(uiPath));

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // SPA fallback (Express 5 requires named catch-all parameter)
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'));
  });

  return app;
}
