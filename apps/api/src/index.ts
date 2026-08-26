import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { connectDb } from './lib/db.js';

const port = Number(process.env.PORT ?? 8080);

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    await connectDb(uri, process.env.MONGODB_DB ?? 'gigaflow');
  }
  const app = createApp();
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
  console.log(`API listening on :${port}`);
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
