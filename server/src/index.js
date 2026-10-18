import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { seedDemo } from './seed.js';
import { createApp } from './app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Minimal .env loader (no dependency). Real environment variables win.
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
let secret = env.SESSION_SECRET;
if (!secret) {
  secret = randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET not set - using a random one. Sessions reset on restart. Set it in .env.');
}

const db = openDb(env.DATABASE_PATH || join(root, 'data', 'upi-bridge.db'));
if (env.SEED_DEMO_DATA !== 'false' && seedDemo(db)) console.log('Seeded SAMPLE demo users and transactions.');

const staticDir = join(root, 'client');
const server = createApp({
  db,
  secret,
  staticDir: existsSync(staticDir) ? staticDir : null,
  demoMode: env.DEMO_MODE !== 'false',
  exchangeRateApiUrl: env.EXCHANGE_RATE_API_URL || '',
  aiExplainEnabled: false,
});

const port = Number(env.PORT) || 3000;
server.listen(port, () => {
  console.log(`UPI Bridge Global (SIMULATED demo) running at http://localhost:${port}`);
});
