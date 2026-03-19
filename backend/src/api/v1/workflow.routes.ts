import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/db';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { WorkflowEngine } from '../../services/workflow/WorkflowEngine';
import { AIGateway } from '../../services/ai/AIGateway';
import { logger } from '../../utils/logger';

const aiGateway = new AIGateway();

export const workflowRoutes = Router();

// Validation schemas
const createWorkflowSchema = z.object({
  projectId: z.string().uuid(),
  initialPrompt: z.string().optional(),
});

const updateStageSchema = z.object({
  content: z.string(),
  isAiContent: z.boolean().optional(),
});

const approveStageSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  threadId: z.string().optional(),
  position: z.object({
    line: z.number(),
    column: z.number(),
  }).optional(),
});

const workflowEngine = new WorkflowEngine();

// Get workflow by project ID
workflowRoutes.get('/project/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: req.userId },
          { team: { some: { userId: req.userId } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const workflow = await prisma.workflow.findFirst({
      where: { projectId },
      include: {
        stages: {
          orderBy: { createdAt: 'asc' },
          include: {
            approvedBy: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
            comments: {
              orderBy: { createdAt: 'asc' },
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
    });

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get workflow');
    res.status(500).json({
      success: false,
      error: 'Failed to get workflow',
    });
  }
});

// Create workflow for project
workflowRoutes.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = createWorkflowSchema.parse(req.body);

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
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

    // Check if workflow already exists
    const existingWorkflow = await prisma.workflow.findFirst({
      where: { projectId: data.projectId, status: 'ACTIVE' },
    });

    if (existingWorkflow) {
      return res.status(400).json({
        success: false,
        error: 'Active workflow already exists for this project',
      });
    }

    // Create workflow with initial stages
    const workflow = await workflowEngine.createWorkflow({
      projectId: data.projectId,
      initialPrompt: data.initialPrompt,
    });

    logger.info({ workflowId: workflow.id, projectId: data.projectId }, 'Workflow created');

    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to create workflow');
    res.status(500).json({
      success: false,
      error: 'Failed to create workflow',
    });
  }
});

// Get stage by ID
workflowRoutes.get('/stage/:stageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;

    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
        approvedBy: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        error: 'Stage not found',
      });
    }

    // Check project access
    const hasAccess = stage.workflow.project.ownerId === req.userId ||
      await prisma.projectUser.findFirst({
        where: {
          projectId: stage.workflow.projectId,
          userId: req.userId,
        },
      });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    res.json({
      success: true,
      data: stage,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get stage');
    res.status(500).json({
      success: false,
      error: 'Failed to get stage',
    });
  }
});

// Update stage content (human edits)
workflowRoutes.patch('/stage/:stageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;
    const data = updateStageSchema.parse(req.body);

    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: { workflow: { include: { project: true } } },
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        error: 'Stage not found',
      });
    }

    // Auto-set to READY_FOR_REVIEW when content is provided
    const newStatus = data.content ? 'READY_FOR_REVIEW' : stage.status;

    const updatedStage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        ...(data.content && { humanContent: data.content }),
        version: { increment: 1 },
        status: newStatus,
      },
      include: {
        approvedBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
        comments: { include: { author: { select: { id: true, email: true, name: true, avatarUrl: true } } } },
      },
    });

    logger.info({ stageId, status: newStatus }, 'Stage updated');

    res.json({
      success: true,
      data: updatedStage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to update stage');
    res.status(500).json({
      success: false,
      error: 'Failed to update stage',
    });
  }
});

// Approve or request revision for a stage
workflowRoutes.post('/stage/:stageId/approve', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;
    const data = approveStageSchema.parse(req.body);

    const result = await workflowEngine.approveStage({
      stageId,
      userId: req.userId!,
      approved: data.approved,
      feedback: data.feedback,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to approve stage');
    res.status(500).json({
      success: false,
      error: 'Failed to approve stage',
    });
  }
});

// Add comment to stage
workflowRoutes.post('/stage/:stageId/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;
    const data = addCommentSchema.parse(req.body);

    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: { workflow: { include: { project: true } } },
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        error: 'Stage not found',
      });
    }

    // Check project access
    const hasAccess = stage.workflow.project.ownerId === req.userId ||
      await prisma.projectUser.findFirst({
        where: {
          projectId: stage.workflow.projectId,
          userId: req.userId,
        },
      });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const comment = await prisma.comment.create({
      data: {
        stageId,
        authorId: req.userId!,
        content: data.content,
        threadId: data.threadId,
        position: data.position as any,
      },
      include: {
        author: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });

    // Broadcast comment
    const io = req.app.get('io');
    io?.to(`project:${stage.workflow.projectId}`).emit('comment:added', comment);

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    logger.error({ error }, 'Failed to add comment');
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
    });
  }
});

// Trigger AI regeneration for current stage
workflowRoutes.post('/stage/:stageId/regenerate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;

    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: { workflow: { include: { project: true } } },
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        error: 'Stage not found',
      });
    }

    // Check project access
    const hasAccess = stage.workflow.project.ownerId === req.userId ||
      await prisma.projectUser.findFirst({
        where: {
          projectId: stage.workflow.projectId,
          userId: req.userId,
          role: { in: ['OWNER', 'EDITOR'] },
        },
      });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Trigger AI regeneration (non-streaming fallback)
    await workflowEngine.triggerAIForStage(stageId, stage.workflow.project.name);

    res.json({
      success: true,
      message: 'AI regeneration triggered',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to trigger AI regeneration');
    res.status(500).json({
      success: false,
      error: 'Failed to trigger AI regeneration',
    });
  }
});

// SSE streaming AI generation for a stage
workflowRoutes.post('/stage/:stageId/generate-stream', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { stageId } = req.params;

  try {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        workflow: {
          include: {
            project: true,
            stages: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!stage) {
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }

    const project = stage.workflow.project;
    const hasAccess = project.ownerId === req.userId ||
      await prisma.projectUser.findFirst({
        where: { projectId: project.id, userId: req.userId, role: { in: ['OWNER', 'EDITOR'] } },
      });

    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.stage.update({
      where: { id: stageId },
      data: { status: 'AI_PROCESSING' },
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const allStages = stage.workflow.stages;
    const prdStage = allStages.find((s: any) => s.stageType === 'PRD_DESIGN' && (s.approved || s.aiContent));
    const uiStage = allStages.find((s: any) => s.stageType === 'UI_UX_DESIGN' && (s.approved || s.aiContent));
    const codeStage = allStages.find((s: any) => s.stageType === 'DEVELOPMENT' && (s.approved || s.aiContent));

    const variables: Record<string, string | undefined> = {
      projectName: project.name,
      projectDescription: req.body.initialPrompt,
      initialPrompt: req.body.initialPrompt,
      prdContent: prdStage ? (prdStage.humanContent || prdStage.aiContent || '') : '',
      uiDesignContent: uiStage ? (uiStage.humanContent || uiStage.aiContent || '') : '',
      codeContent: codeStage ? (codeStage.humanContent || codeStage.aiContent || '') : '',
      testFramework: 'Jest + React Testing Library',
    };

    const prompt = aiGateway.renderPrompt(stage.stageType, variables);
    let fullContent = '';

    try {
      for await (const chunk of aiGateway.completeStream(prompt)) {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }

      await prisma.stage.update({
        where: { id: stageId },
        data: { aiContent: fullContent, status: 'READY_FOR_REVIEW' },
      });

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      logger.info('Streaming AI generation completed', { stageId, stageType: stage.stageType });
    } catch (aiError) {
      await prisma.stage.update({
        where: { id: stageId },
        data: { status: 'PENDING' },
      });
      res.write(`data: ${JSON.stringify({ type: 'error', message: String(aiError) })}\n\n`);
      logger.error('Streaming AI generation failed', { stageId, error: String(aiError) });
    }

    res.end();
  } catch (error) {
    logger.error('Failed to start streaming generation', { stageId, error: String(error) });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to start generation' });
    }
  }
});