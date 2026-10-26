import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { logger } from './config/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`);
});

// Finish in-flight requests, close DB connections, then exit (Docker/Kubernetes send SIGTERM)
function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
