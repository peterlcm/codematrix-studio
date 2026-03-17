import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/db';
import { logger } from '../../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  projectId?: string;
  userName?: string;
}

let wsHandler: WebSocketHandler | null = null;

export function getWebSocketHandler(): WebSocketHandler | null {
  return wsHandler;
}

export class WebSocketHandler {
  private io: Server;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

  constructor(io: Server) {
    this.io = io;
    wsHandler = this;
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.use(this.authenticate.bind(this));

    this.io.on('connection', this.handleConnection.bind(this));
  }

  private async authenticate(socket: AuthenticatedSocket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const secret = process.env.JWT_SECRET || 'development-secret';
      const decoded = jwt.verify(token as string, secret) as { userId: string };

      const session = await prisma.session.findUnique({
        where: { token: token as string },
      });

      if (!session || session.expiresAt < new Date()) {
        return next(new Error('Invalid or expired token'));
      }

      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  }

  private async handleConnection(socket: AuthenticatedSocket) {
    logger.info({ socketId: socket.id, userId: socket.userId }, 'Client connected');

    // Track user sockets
    if (socket.userId) {
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId)!.add(socket.id);
    }

    // Join project room
    socket.on('project:join', async (projectId: string) => {
      try {
        // Verify user has access to project
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [
              { ownerId: socket.userId },
              { team: { some: { userId: socket.userId } } },
            ],
          },
        });

        if (!project) {
          socket.emit('error', { message: 'Access denied to project' });
          return;
        }

        socket.projectId = projectId;
        await socket.join(`project:${projectId}`);

        // Notify others in the project
        socket.to(`project:${projectId}`).emit('user:presence', {
          userId: socket.userId,
          projectId,
          online: true,
        });

        // Send list of online users
        const onlineUsers = await this.getOnlineUsers(projectId);
        socket.emit('project:users', onlineUsers);

        logger.info({ projectId, userId: socket.userId }, 'User joined project room');
      } catch (error) {
        logger.error({ error }, 'Failed to join project room');
        socket.emit('error', { message: 'Failed to join project' });
      }
    });

    // Leave project room
    socket.on('project:leave', async (projectId: string) => {
      await socket.leave(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('user:presence', {
        userId: socket.userId,
        projectId,
        online: false,
      });
    });

    // Handle stage updates
    socket.on('stage:update', async (data: { stageId: string; content: string }) => {
      // Broadcast to project room (excluding sender)
      socket.to(`project:${socket.projectId}`).emit('stage:updated', {
        stageId: data.stageId,
        content: data.content,
        updatedBy: socket.userId,
      });
    });

    // Handle comments
    socket.on('comment:add', async (data: { stageId: string; content: string; threadId?: string }) => {
      socket.to(`project:${socket.projectId}`).emit('comment:added', {
        ...data,
        authorId: socket.userId,
        createdAt: new Date().toISOString(),
      });
    });

    // Handle cursor/selection position
    socket.on('cursor:move', async (data: { stageId: string; position: { line: number; column: number } }) => {
      socket.to(`project:${socket.projectId}`).emit('cursor:moved', {
        userId: socket.userId,
        stageId: data.stageId,
        position: data.position,
      });
    });

    // Handle typing indicator
    socket.on('typing:start', (data: { stageId: string }) => {
      socket.to(`project:${socket.projectId}`).emit('user:typing', {
        userId: socket.userId,
        stageId: data.stageId,
      });
    });

    socket.on('typing:stop', (data: { stageId: string }) => {
      socket.to(`project:${socket.projectId}`).emit('user:stopped_typing', {
        userId: socket.userId,
        stageId: data.stageId,
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId: socket.userId }, 'Client disconnected');

      // Remove from user sockets
      if (socket.userId) {
        const sockets = this.userSockets.get(socket.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(socket.userId);
            // Notify all projects user was in
            if (socket.projectId) {
              this.io.to(`project:${socket.projectId}`).emit('user:presence', {
                userId: socket.userId,
                projectId: socket.projectId,
                online: false,
              });
            }
          }
        }
      }
    });
  }

  private async getOnlineUsers(projectId: string): Promise<Array<{ userId: string; socketId: string }>> {
    const room = this.io.sockets.adapter.rooms.get(`project:${projectId}`);
    if (!room) return [];

    const onlineUsers: Array<{ userId: string; socketId: string }> = [];
    for (const socketId of room) {
      const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.userId) {
        onlineUsers.push({ userId: socket.userId, socketId });
      }
    }
    return onlineUsers;
  }

  // Public method to broadcast stage updates from HTTP handlers
  broadcastStageUpdate(projectId: string, stage: unknown) {
    this.io.to(`project:${projectId}`).emit('stage:updated', stage);
  }

  // Public method to broadcast workflow updates
  broadcastWorkflowUpdate(projectId: string, workflow: unknown) {
    this.io.to(`project:${projectId}`).emit('workflow:updated', workflow);
  }

  // Broadcast notification to user
  sendNotificationToUser(userId: string, notification: unknown) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.io.to(socketId).emit('notification', notification);
      }
    }
  }

  // Broadcast notification to project
  sendNotificationToProject(projectId: string, notification: unknown) {
    this.io.to(`project:${projectId}`).emit('notification', notification);
  }

  // Get user info for presence
  private async getUserInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    return user;
  }
}