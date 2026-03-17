import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/db';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

export const userRoutes = Router();

// JWT secret
const getJwtSecret = () => process.env.JWT_SECRET || 'development-secret';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register new user
userRoutes.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    logger.info({ userId: user.id }, 'User registered');

    // Generate JWT token
    const token = generateToken(user.id);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to register user');
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
    });
  }
});

// Login
userRoutes.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to login');
    res.status(500).json({
      success: false,
      error: 'Failed to login',
    });
  }
});

// Get current user
userRoutes.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get user');
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

// Update current user
userRoutes.patch('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update user');
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
  }
});

// Logout (invalidate session)
userRoutes.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.substring(7);
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to logout');
    res.status(500).json({
      success: false,
      error: 'Failed to logout',
    });
  }
});

// Helper function to generate token
function generateToken(userId: string): string {
  const secret = getJwtSecret();
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

// Helper function to generate refresh token
function generateRefreshToken(userId: string): string {
  const secret = getJwtSecret();
  return jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: '30d' });
}

// Change password
userRoutes.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user || !user.passwordHash) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change password for OAuth users',
      });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all existing sessions
    await prisma.session.deleteMany({
      where: { userId: req.userId },
    });

    // Generate new token
    const token = generateToken(req.userId!);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: req.userId!,
        token,
        expiresAt,
      },
    });

    logger.info({ userId: req.userId }, 'Password changed successfully');

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
      data: { token },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to change password');
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
    });
  }
});

// Refresh token
userRoutes.post('/refresh-token', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(refreshToken, secret) as { userId: string; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate new tokens
    const newToken = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store new session
    await prisma.session.create({
      data: {
        userId: decoded.userId,
        token: newToken,
        expiresAt,
      },
    });

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to refresh token');
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }
});

// Search users (for adding team members)
userRoutes.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q as string, mode: 'insensitive' } },
          { name: { contains: q as string, mode: 'insensitive' } },
        ],
        NOT: { id: req.userId }, // Exclude current user
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
      take: Number(limit),
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to search users');
    res.status(500).json({
      success: false,
      error: 'Failed to search users',
    });
  }
});

// Get user preferences
userRoutes.get('/preferences', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        // Add preferences fields here when needed
      },
    });

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get preferences');
    res.status(500).json({
      success: false,
      error: 'Failed to get preferences',
    });
  }
});

// Update user preferences
userRoutes.patch('/preferences', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name && { name }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update preferences');
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
    });
  }
});

// Get user's sessions
userRoutes.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get sessions');
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
    });
  }
});

// Revoke a session
userRoutes.delete('/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.userId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    res.json({
      success: true,
      message: 'Session revoked',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke session');
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
    });
  }
});

// Revoke all sessions (logout from all devices)
userRoutes.post('/revoke-all-sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const currentToken = req.headers.authorization?.substring(7);

    // Delete all sessions except current one
    await prisma.session.deleteMany({
      where: {
        userId: req.userId,
        ...(currentToken && { NOT: { token: currentToken } }),
      },
    });

    res.json({
      success: true,
      message: 'All other sessions revoked',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke sessions');
    res.status(500).json({
      success: false,
      error: 'Failed to revoke sessions',
    });
  }
});