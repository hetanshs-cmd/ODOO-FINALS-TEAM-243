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
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
