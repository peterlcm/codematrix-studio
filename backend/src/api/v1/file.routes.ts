import { Router, Request, Response } from 'express';
import * as path from 'path';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { FileWriter } from '../../services/file/FileWriter';
import { prisma } from '../../database/db';
import { logger } from '../../utils/logger';

export const fileRoutes = Router();

async function checkProjectAccess(projectId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { team: { some: { userId } } },
      ],
    },
  });
  return !!project;
}

fileRoutes.get('/:projectId/tree', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!(await checkProjectAccess(projectId, req.userId))) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const projectDir = FileWriter.getProjectDir(projectId);
    const tree = await FileWriter.getFileTree(projectDir);

    res.json({ success: true, data: tree });
  } catch (error) {
    logger.error('Failed to get file tree', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to get file tree' });
  }
});

fileRoutes.get('/:projectId/read/*', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const filePath = (req.params as any)[0] || '';

    if (!(await checkProjectAccess(projectId, req.userId))) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const content = FileWriter.readFile(projectId, filePath);
    if (content === null) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.json({ success: true, data: { path: filePath, content } });
  } catch (error) {
    logger.error('Failed to read file', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to read file' });
  }
});

fileRoutes.put('/:projectId/write/*', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const filePath = (req.params as any)[0] || '';
    const { content } = req.body;

    if (!(await checkProjectAccess(projectId, req.userId))) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    FileWriter.writeFile(projectId, filePath, content);
    res.json({ success: true, message: 'File saved' });
  } catch (error) {
    logger.error('Failed to write file', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to write file' });
  }
});

fileRoutes.get('/:projectId/preview/*', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const filePath = (req.params as any)[0] || 'index.html';

    const content = FileWriter.readFile(projectId, filePath);
    if (content === null) {
      return res.status(404).send('File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.md': 'text/markdown; charset=utf-8',
      '.ts': 'text/plain; charset=utf-8',
      '.tsx': 'text/plain; charset=utf-8',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'text/plain; charset=utf-8');
    res.send(content);
  } catch (error) {
    logger.error('Failed to preview file', { error: String(error) });
    res.status(500).send('Internal server error');
  }
});
