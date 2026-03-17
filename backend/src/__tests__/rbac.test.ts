import { Response, NextFunction } from 'express';
import {
  Permission,
  getUserProjectRole,
  hasProjectPermission,
  requireProjectPermission,
  requireProjectOwner,
} from '../middleware/rbac';
import { AuthRequest } from '../middleware/auth';
import { ProjectRole } from '@prisma/client';

// Mock dependencies
jest.mock('../database/db', () => ({
  prisma: {
    project: {
      findFirst: jest.fn(),
    },
    projectUser: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../database/db';

describe('RBAC (Role-Based Access Control)', () => {
  describe('getUserProjectRole', () => {
    it('should return OWNER if user is the project owner', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });

      const role = await getUserProjectRole('user-1', 'project-1');

      expect(role).toBe(ProjectRole.OWNER);
    });

    it('should return EDITOR if user is an editor', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue({
        role: ProjectRole.EDITOR,
      });

      const role = await getUserProjectRole('user-2', 'project-1');

      expect(role).toBe(ProjectRole.EDITOR);
    });

    it('should return VIEWER if user is a viewer', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue({
        role: ProjectRole.VIEWER,
      });

      const role = await getUserProjectRole('user-2', 'project-1');

      expect(role).toBe(ProjectRole.VIEWER);
    });

    it('should return null if user is not a member', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue(null);

      const role = await getUserProjectRole('user-2', 'project-1');

      expect(role).toBeNull();
    });
  });

  describe('hasProjectPermission', () => {
    it('should return true if owner has PROJECT_VIEW permission', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });

      const hasPermission = await hasProjectPermission(
        'user-1',
        'project-1',
        Permission.PROJECT_VIEW
      );

      expect(hasPermission).toBe(true);
    });

    it('should return false if viewer tries to delete project', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue({
        role: ProjectRole.VIEWER,
      });

      const hasPermission = await hasProjectPermission(
        'user-2',
        'project-1',
        Permission.PROJECT_DELETE
      );

      expect(hasPermission).toBe(false);
    });

    it('should return true if editor has STAGE_EDIT permission', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue({
        role: ProjectRole.EDITOR,
      });

      const hasPermission = await hasProjectPermission(
        'user-2',
        'project-1',
        Permission.STAGE_EDIT
      );

      expect(hasPermission).toBe(true);
    });

    it('should return false for non-member', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue(null);

      const hasPermission = await hasProjectPermission(
        'user-2',
        'project-1',
        Permission.PROJECT_VIEW
      );

      expect(hasPermission).toBe(false);
    });
  });

  describe('requireProjectPermission middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
      mockRequest = {
        userId: 'user-1',
        params: { projectId: 'project-1' },
        body: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      nextFunction = jest.fn();
    });

    it('should return 400 if no projectId provided', async () => {
      mockRequest.params = {};

      const middleware = requireProjectPermission(Permission.PROJECT_VIEW);
      await middleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next if user has permission', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });

      const middleware = requireProjectPermission(Permission.PROJECT_DELETE);
      await middleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 403 if user lacks permission', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue({
        role: ProjectRole.VIEWER,
      });

      const middleware = requireProjectPermission(Permission.PROJECT_DELETE);
      await middleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireProjectOwner middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
      mockRequest = {
        userId: 'user-1',
        params: { id: 'project-1' },
        body: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      nextFunction = jest.fn();
    });

    it('should call next if user is owner', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });

      const middleware = requireProjectOwner();
      await middleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 403 if user is not owner', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

      const middleware = requireProjectOwner();
      await middleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});

describe('Permission Enum', () => {
  it('should have all required project permissions', () => {
    expect(Permission.PROJECT_VIEW).toBe('project:view');
    expect(Permission.PROJECT_EDIT).toBe('project:edit');
    expect(Permission.PROJECT_DELETE).toBe('project:delete');
    expect(Permission.PROJECT_MANAGE_MEMBERS).toBe('project:manage_members');
  });

  it('should have all required workflow permissions', () => {
    expect(Permission.WORKFLOW_VIEW).toBe('workflow:view');
    expect(Permission.WORKFLOW_CREATE).toBe('workflow:create');
    expect(Permission.WORKFLOW_EDIT).toBe('workflow:edit');
    expect(Permission.WORKFLOW_APPROVE).toBe('workflow:approve');
  });

  it('should have all required stage permissions', () => {
    expect(Permission.STAGE_VIEW).toBe('stage:view');
    expect(Permission.STAGE_EDIT).toBe('stage:edit');
    expect(Permission.STAGE_COMMENT).toBe('stage:comment');
    expect(Permission.STAGE_APPROVE).toBe('stage:approve');
  });
});