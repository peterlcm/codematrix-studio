import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/db';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { requireProjectOwner, Permission, hasProjectPermission } from '../../middleware/rbac';
import { logger } from '../../utils/logger';
import { ProjectRole } from '@prisma/client';

export const projectRoutes = Router();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// Get all projects for current user
projectRoutes.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        team: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get projects');
    res.status(500).json({
      success: false,
      error: 'Failed to get projects',
    });
  }
});

// Get single project
projectRoutes.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        team: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
        workflows: {
          include: {
            stages: {
              orderBy: { createdAt: 'asc' },
              include: {
                comments: {
                  include: {
                    author: {
                      select: { id: true, email: true, name: true, avatarUrl: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get project');
    res.status(500).json({
      success: false,
      error: 'Failed to get project',
    });
  }
});

// Create new project
projectRoutes.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: req.userId!,
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    logger.info({ projectId: project.id, userId: req.userId }, 'Project created');

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to create project');
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
    });
  }
});

// Update project
projectRoutes.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateProjectSchema.parse(req.body);

    // Check ownership
    const existing = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to update project');
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
    });
  }
});

// Delete project
projectRoutes.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    await prisma.project.delete({
      where: { id },
    });

    logger.info({ projectId: id, userId: req.userId }, 'Project deleted');

    res.json({
      success: true,
      message: 'Project deleted',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project');
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
    });
  }
});

// Add team member
projectRoutes.post('/:id/team', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role = 'EDITOR' } = req.body;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Add to team
    const projectUser = await prisma.projectUser.upsert({
      where: {
        projectId_userId: { projectId: id, userId: user.id },
      },
      update: { role },
      create: {
        projectId: id,
        userId: user.id,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: projectUser,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to add team member');
    res.status(500).json({
      success: false,
      error: 'Failed to add team member',
    });
  }
});

// Get team members
projectRoutes.get('/:id/team', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    const teamMembers = await prisma.projectUser.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json({
      success: true,
      data: teamMembers,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get team members');
    res.status(500).json({
      success: false,
      error: 'Failed to get team members',
    });
  }
});

// Update team member role
projectRoutes.patch('/:id/team/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    // Can't change owner's role
    if (project.ownerId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change owner role',
      });
    }

    const validRoles = [ProjectRole.EDITOR, ProjectRole.VIEWER];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be EDITOR or VIEWER',
      });
    }

    const updatedMember = await prisma.projectUser.update({
      where: {
        projectId_userId: { projectId: id, userId },
      },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    res.json({
      success: true,
      data: updatedMember,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update team member');
    res.status(500).json({
      success: false,
      error: 'Failed to update team member',
    });
  }
});

// Remove team member
projectRoutes.delete('/:id/team/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    // Can't remove owner
    if (project.ownerId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove project owner',
      });
    }

    await prisma.projectUser.delete({
      where: {
        projectId_userId: { projectId: id, userId },
      },
    });

    res.json({
      success: true,
      message: 'Team member removed',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to remove team member');
    res.status(500).json({
      success: false,
      error: 'Failed to remove team member',
    });
  }
});

// Search projects
projectRoutes.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
        ...(q ? {
          OR: [
            { name: { contains: q as string, mode: 'insensitive' } },
            { description: { contains: q as string, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.project.count({
      where: {
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
        ...(q ? {
          OR: [
            { name: { contains: q as string, mode: 'insensitive' } },
            { description: { contains: q as string, mode: 'insensitive' } },
          ],
        } : {}),
      },
    });

    res.json({
      success: true,
      data: projects,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to search projects');
    res.status(500).json({
      success: false,
      error: 'Failed to search projects',
    });
  }
});

// Get project statistics
projectRoutes.get('/:id/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    // Get workflow stats
    const workflowStats = await prisma.workflow.groupBy({
      by: ['status'],
      where: { projectId: id },
      _count: true,
    });

    // Get stage stats
    const stageStats = await prisma.stage.groupBy({
      by: ['status'],
      where: { workflow: { projectId: id } },
      _count: true,
    });

    // Get comment count
    const commentCount = await prisma.comment.count({
      where: { stage: { workflow: { projectId: id } } },
    });

    // Get team member count
    const teamCount = await prisma.projectUser.count({
      where: { projectId: id },
    });

    res.json({
      success: true,
      data: {
        workflows: workflowStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
        stages: stageStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>),
        comments: commentCount,
        teamSize: teamCount + 1, // +1 for owner
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get project stats');
    res.status(500).json({
      success: false,
      error: 'Failed to get project stats',
    });
  }
});

// Leave project
projectRoutes.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Can't leave your own project
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (project) {
      return res.status(400).json({
        success: false,
        error: 'Owners cannot leave their own project. Transfer ownership or delete the project instead.',
      });
    }

    // Check if user is a team member
    const member = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: { projectId: id, userId: req.userId! },
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'You are not a member of this project',
      });
    }

    await prisma.projectUser.delete({
      where: {
        projectId_userId: { projectId: id, userId: req.userId! },
      },
    });

    res.json({
      success: true,
      message: 'Successfully left the project',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to leave project');
    res.status(500).json({
      success: false,
      error: 'Failed to leave project',
    });
  }
});

// Transfer project ownership
projectRoutes.post('/:id/transfer', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newOwnerId } = req.body;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    // Verify new owner exists and is a team member
    const newOwner = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: { projectId: id, userId: newOwnerId },
      },
    });

    if (!newOwner) {
      return res.status(400).json({
        success: false,
        error: 'New owner must be a team member',
      });
    }

    // Transaction: update owner and adjust roles
    await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: { ownerId: newOwnerId },
      }),
      prisma.projectUser.update({
        where: {
          projectId_userId: { projectId: id, userId: req.userId! },
        },
        data: { role: ProjectRole.EDITOR },
      }),
      prisma.projectUser.update({
        where: {
          projectId_userId: { projectId: id, userId: newOwnerId },
        },
        data: { role: ProjectRole.OWNER },
      }),
    ]);

    logger.info({ projectId: id, newOwnerId }, 'Project ownership transferred');

    res.json({
      success: true,
      message: 'Project ownership transferred',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to transfer project ownership');
    res.status(500).json({
      success: false,
      error: 'Failed to transfer project ownership',
    });
  }
});

// Generate project invite link
projectRoutes.post('/:id/invite', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role = 'VIEWER', expiresIn = 7 * 24 * 60 * 60 * 1000 } = req.body; // Default 7 days

    // Check project access (owner or editor)
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId, role: { in: ['OWNER', 'EDITOR'] } } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    // Generate invite token
    const crypto = await import('crypto');
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn);

    // Store invite
    const invite = await prisma.projectInvite.create({
      data: {
        projectId: id,
        token: inviteToken,
        role: role as any,
        expiresAt,
        createdById: req.userId!,
      },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${baseUrl}/invite/${inviteToken}`;

    logger.info({ projectId: id, inviteId: invite.id }, 'Project invite created');

    res.status(201).json({
      success: true,
      data: {
        inviteLink,
        expiresAt: invite.expiresAt,
        role,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create project invite');
    res.status(500).json({
      success: false,
      error: 'Failed to create project invite',
    });
  }
});

// Get active invites
projectRoutes.get('/:id/invites', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    const invites = await prisma.projectInvite.findMany({
      where: {
        projectId: id,
        expiresAt: { gt: new Date() },
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: invites,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get project invites');
    res.status(500).json({
      success: false,
      error: 'Failed to get project invites',
    });
  }
});

// Revoke invite
projectRoutes.delete('/:id/invites/:inviteId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, inviteId } = req.params;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    await prisma.projectInvite.delete({
      where: { id: inviteId },
    });

    res.json({
      success: true,
      message: 'Invite revoked',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke invite');
    res.status(500).json({
      success: false,
      error: 'Failed to revoke invite',
    });
  }
});

// Archive project
projectRoutes.post('/:id/archive', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    logger.info({ projectId: id }, 'Project archived');

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to archive project');
    res.status(500).json({
      success: false,
      error: 'Failed to archive project',
    });
  }
});

// Unarchive project
projectRoutes.post('/:id/unarchive', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check ownership
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found or unauthorized',
      });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { archivedAt: null },
    });

    logger.info({ projectId: id }, 'Project unarchived');

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to unarchive project');
    res.status(500).json({
      success: false,
      error: 'Failed to unarchive project',
    });
  }
});