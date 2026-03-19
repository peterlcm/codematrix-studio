import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { projectRoutes } from './api/v1/project.routes';
import { workflowRoutes } from './api/v1/workflow.routes';
import { userRoutes } from './api/v1/user.routes';
import { aiRoutes } from './api/v1/ai.routes';
import { inviteRoutes } from './api/v1/invite.routes';
import { analyticsRoutes } from './api/v1/analytics.routes';
import { pluginRoutes, setPluginLoader } from './extensions/plugin.routes';
import { analyticsRoutes } from './api/v1/analytics.routes';
import { PluginLoader } from './extensions/PluginLoader';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { WebSocketHandler } from './services/collaboration/WebSocketHandler';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // Socket.IO setup
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Store io instance for use in routes
  app.set('io', io);

  // Middleware
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/workflows', workflowRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/invite', inviteRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/plugins', pluginRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);

  // Initialize plugin loader
  const pluginsDir = process.env.PLUGINS_DIR || './plugins';
  const pluginLoader = new PluginLoader({
    pluginsDir,
    autoEnable: true,
    watchForChanges: process.env.NODE_ENV !== 'production',
  });
  setPluginLoader(pluginLoader);

  // Initialize plugins asynchronously
  pluginLoader.initialize(app).catch(err => {
    logger.error({ error: err }, 'Failed to initialize plugins');
  });

  // Initialize WebSocket handler
  new WebSocketHandler(io);

  // Error handling
  app.use(errorHandler);

  return { app, httpServer, io };
}