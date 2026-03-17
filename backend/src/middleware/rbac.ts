import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../database/db';
import { ProjectRole } from '@prisma/client';

/**
 * Permission levels
 */
export enum Permission {
  // Project permissions
  PROJECT_VIEW = 'project:view',
  PROJECT_EDIT = 'project:edit',
  PROJECT_DELETE = 'project:delete',
  PROJECT_MANAGE_MEMBERS = 'project:manage_members',

  // Workflow permissions
  WORKFLOW_VIEW = 'workflow:view',
  WORKFLOW_CREATE = 'workflow:create',
  WORKFLOW_EDIT = 'workflow:edit',
  WORKFLOW_APPROVE = 'workflow:approve',

  // Stage permissions
  STAGE_VIEW = 'stage:view',
  STAGE_EDIT = 'stage:edit',
  STAGE_COMMENT = 'stage:comment',
  STAGE_APPROVE = 'stage:approve',
}

/**
 * Role-based permission mapping
 */
const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  [ProjectRole.OWNER]: [
    Permission.PROJECT_VIEW,
    Permission.PROJECT_EDIT,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_MANAGE_MEMBERS,
    Permission.WORKFLOW_VIEW,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_EDIT,
    Permission.WORKFLOW_APPROVE,
    Permission.STAGE_VIEW,
    Permission.STAGE_EDIT,
    Permission.STAGE_COMMENT,
    Permission.STAGE_APPROVE,
  ],
  [ProjectRole.EDITOR]: [
    Permission.PROJECT_VIEW,
    Permission.WORKFLOW_VIEW,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_EDIT,
    Permission.WORKFLOW_APPROVE,
    Permission.STAGE_VIEW,
    Permission.STAGE_EDIT,
    Permission.STAGE_COMMENT,
    Permission.STAGE_APPROVE,
  ],
  [ProjectRole.VIEWER]: [
    Permission.PROJECT_VIEW,
    Permission.WORKFLOW_VIEW,
    Permission.STAGE_VIEW,
    Permission.STAGE_COMMENT,
  ],
};

/**
 * Get user's role in a project
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });

  if (project) {
    return ProjectRole.OWNER;
  }

  const projectUser = await prisma.projectUser.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });

  return projectUser?.role ?? null;
}

/**
 * Check if user has specific permission in a project
 */
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);

  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Factory function to create permission check middleware
 */
export function requireProjectPermission(permission: Permission) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const hasPermission = await hasProjectPermission(
        req.userId!,
        projectId,
        permission
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user is project owner
 */
export function requireProjectOwner() {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const projectId = req.params.id || req.params.projectId;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: req.userId },
      });

      if (!project) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only the project owner can perform this action',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require authenticated user (alias for authMiddleware)
 */
export function requireAuth() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
    next();
  };
}