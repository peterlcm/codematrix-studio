import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/db';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

export const inviteRoutes = Router();

// Validation schemas
const acceptInviteSchema = z.object({
  token: z.string(),
});

// Get invite info (without accepting)
inviteRoutes.get('/:token', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: 'Invalid invite token',
      });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Invite has expired',
      });
    }

    // Check if user is already a member
    let alreadyMember = false;
    if (req.userId) {
      const existingMember = await prisma.projectUser.findUnique({
        where: {
          projectId_userId: {
            projectId: invite.projectId,
            userId: req.userId,
          },
        },
      });
      alreadyMember = !!existingMember;
    }

    res.json({
      success: true,
      data: {
        project: invite.project,
        role: invite.role,
        expiresAt: invite.expiresAt,
        invitedBy: invite.createdBy,
        alreadyMember,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get invite info');
    res.status(500).json({
      success: false,
      error: 'Failed to get invite info',
    });
  }
});

// Accept invite (authenticated)
inviteRoutes.post('/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = acceptInviteSchema.parse(req.body);

    const invite = await prisma.projectInvite.findUnique({
      where: { token: data.token },
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: 'Invalid invite token',
      });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Invite has expired',
      });
    }

    // Check if already a member
    const existingMember = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: invite.projectId,
          userId: req.userId!,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: 'You are already a member of this project',
      });
    }

    // Add user to project
    await prisma.projectUser.create({
      data: {
        projectId: invite.projectId,
        userId: req.userId!,
        role: invite.role,
      },
    });

    // Delete the invite after use
    await prisma.projectInvite.delete({
      where: { id: invite.id },
    });

    logger.info({ projectId: invite.projectId, userId: req.userId }, 'User joined project via invite');

    res.json({
      success: true,
      message: 'Successfully joined the project',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to accept invite');
    res.status(500).json({
      success: false,
      error: 'Failed to accept invite',
    });
  }
});