import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../database/db', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
    },
    user: {
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

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should return 401 if no authorization header', async () => {
      await authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unauthorized',
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Basic some-token',
      };

      await authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (prisma.session.findUnique as jest.Mock).mockResolvedValue(null);

      await authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if session is expired', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      // Create a real valid token for testing
      const token = jwt.sign({ userId: 'user-1' }, 'test-secret');
      mockRequest.headers.authorization = `Bearer ${token}`;

      (prisma.session.findUnique as jest.Mock).mockResolvedValue({
        expiresAt: expiredDate,
        user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      });

      await authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() and set user if token is valid', async () => {
      // Create a real valid token for testing
      const token = jwt.sign({ userId: 'user-1' }, 'test-secret');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      (prisma.session.findUnique as jest.Mock).mockResolvedValue({
        expiresAt: futureDate,
        user: { id: 'user-1', email: 'test@test.com', name: 'Test User' },
      });

      await authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.userId).toBe('user-1');
      expect(mockRequest.user).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
      });
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});

describe('JWT Token', () => {
  it('should generate a valid token', () => {
    const token = jwt.sign({ userId: 'test-user' }, 'test-secret', {
      expiresIn: '7d',
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify a valid token', () => {
    const token = jwt.sign({ userId: 'test-user' }, 'test-secret', {
      expiresIn: '7d',
    });

    const decoded = jwt.verify(token, 'test-secret') as { userId: string };
    expect(decoded.userId).toBe('test-user');
  });

  it('should throw error for invalid token', () => {
    expect(() => {
      jwt.verify('invalid-token', 'test-secret');
    }).toThrow();
  });
});