import { app } from './app';
import { config } from './config/env';
import { db } from './config/database';

async function bootstrap(): Promise<void> {
  // Verify database connection before starting server
  try {
    const client = await db.connect();
    client.release();
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${config.PORT}`);
    console.log(`📋 Environment: ${config.NODE_ENV}`);
    console.log(`🔒 CORS allowed origin: ${config.FRONTEND_URL}`);
  });

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('✅ HTTP server closed');
      await db.end();
      console.log('✅ Database pool closed');
      process.exit(0);
    });
    // server.close() waits for in-flight connections to finish on their own;
    // a hung/keep-alive connection would otherwise block shutdown forever.
    setTimeout(() => {
      console.error('❌ Forced exit — shutdown did not complete within 10s');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A rejected promise or thrown error with no handler anywhere up the chain
  // would otherwise crash the process silently (or, pre-Node 15, not at
  // all) with no record of why. Log first so the cause is visible, then
  // fail fast rather than continue in a possibly-corrupted state.
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
