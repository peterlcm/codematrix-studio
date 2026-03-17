import dotenv from 'dotenv';
import { createApp } from './app';
import { logger } from './utils/logger';
import { prisma } from './database/db';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Create and start server
    const { httpServer } = createApp();

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
      await prisma.$disconnect();
      logger.info('Database disconnected');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();