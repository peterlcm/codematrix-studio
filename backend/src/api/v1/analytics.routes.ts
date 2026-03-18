import { Router, Response } from 'express';
import { prisma } from '../../database/db';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { Prisma } from '@prisma/client';

export const analyticsRoutes = Router();

// Get dashboard analytics data for current user
analyticsRoutes.get('/dashboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Count projects
    const totalProjects = await prisma.project.count({
      where: {
        OR: [
          { ownerId: userId },
          { team: { some: { userId } } },
        ],
      },
    });

    const activeProjects = await prisma.project.count({
      where: {
        OR: [
          { ownerId: userId },
          { team: { some: { userId } } },
        ],
        archivedAt: null,
      },
    });

    const archivedProjects = totalProjects - activeProjects;

    // Get project progress from workflows
    const projectsWithWorkflow = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { team: { some: { userId } } },
        ],
        archivedAt: null,
      },
      include: {
        workflows: {
          include: {
            stages: true,
          },
          take: 1,
        },
      },
      take: 10,
    });

    const progress = projectsWithWorkflow
      .filter(p => p.workflows.length > 0)
      .map(p => {
        const workflow = p.workflows[0];
        const stages = workflow.stages;
        const completedStages = stages.filter(s => s.status === 'COMPLETED').length;
        const totalStages = stages.length;
        const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

        return {
          projectId: p.id,
          projectName: p.name,
          totalStages,
          completedStages,
          progress: progressPercent,
          status: p.archivedAt ? 'ARCHIVED' : 'ACTIVE',
        };
      });

    // Count team members
    const teamQuery = await prisma.projectUser.findMany({
      where: {
        project: {
          OR: [
            { ownerId: userId },
            { team: { some: { userId } } },
          ],
        },
      },
      distinct: ['userId'],
    });

    const uniqueUserIds = new Set(teamQuery.map(t => t.userId));
    const totalMembers = uniqueUserIds.size;

    // For now, return mock AI usage data since we don't have AI usage tracking yet
    const aiUsage = {
      totalRequests: 0,
      totalTokens: 0,
      requestsByModel: {},
      monthlyRequests: [],
    };

    // Get recent activity from various tables
    const recentProjects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { team: { some: { userId } } },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      include: {
        owner: {
          select: { name: true, email: true },
        },
      },
    });

    const recentActivity = recentProjects.map(project => ({
      user: project.owner.name || project.owner.email,
      action: 'Created project',
      project: project.name,
      timestamp: project.createdAt.toISOString(),
    }));

    const teamStats = {
      totalMembers: totalMembers || 1,
      activeProjects,
      recentActivity,
    };

    res.json({
      success: true,
      data: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          archived: archivedProjects,
          progress,
        },
        ai: aiUsage,
        team: teamStats,
      },
    });
  } catch (err) {
    logger.error('Error getting dashboard analytics:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data',
    });
  }
});
