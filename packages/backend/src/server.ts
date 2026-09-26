// ========================================================================
// Server Entry Point
// ========================================================================

import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  getDatabaseClient,
  PostgresDatabaseClient,
  SupabaseDatabaseClient,
  getSupabaseClient,
  isPostgresDatabaseActive,
  probeSupabaseHealth,
  markSupabaseHealthy,
  markSupabaseUnreachable,
} from './db/client.js';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', async () => {
  console.log(`[SMS Backend] Server running on http://127.0.0.1:${env.PORT}`);
  console.log(`[SMS Backend] Environment: ${env.NODE_ENV}`);

  const supabase = getSupabaseClient();
  if (supabase) {
    console.log('[SMS Backend] Checking Supabase cloud database connectivity...');
    const client = new SupabaseDatabaseClient(supabase);
    const conn = await client.testConnection();
    if (conn.ok) {
      markSupabaseHealthy();
      console.log(`\x1b[32m[SMS Backend] Database Connected:\x1b[0m ${conn.message}`);
    } else {
      markSupabaseUnreachable(conn.error);
      console.log(`\x1b[33m[SMS Backend] Database Mode: High-Speed In-Memory Relational Engine (Cloud Offline: ${conn.error})\x1b[0m`);
    }

    // Schedule periodic background probe (every 60 seconds) to detect if Supabase comes back
    const healthInterval = setInterval(() => {
      probeSupabaseHealth().catch(() => {});
    }, 60000);
    healthInterval.unref?.();
  } else if (isPostgresDatabaseActive()) {
    console.log('[SMS Backend] Database Mode: PostgreSQL Database (Active)');
    const client = getDatabaseClient();
    if (client instanceof PostgresDatabaseClient) {
      const conn = await client.testConnection();
      if (conn.ok) {
        console.log(`\x1b[32m[SMS Backend] Database Connected:\x1b[0m ${conn.message}`);
      } else {
        console.error(`\x1b[31m[SMS Backend] Database Connection Warning:\x1b[0m ${conn.error}`);
      }
    }
  } else {
    console.log('[SMS Backend] Database Mode: In-Memory Relational Engine (Standalone / Local Mode)');
  }
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m[SMS Backend] Port ${env.PORT} is already in use. Please terminate existing process on port ${env.PORT}.\x1b[0m`);
    process.exit(1);
  }
});

const gracefulShutdown = (signal: string) => {
  console.log(`[SMS Backend] ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('[SMS Backend] Server terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
