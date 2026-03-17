import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { AIGateway } from '../../services/ai/AIGateway';
import { logger } from '../../utils/logger';

export const aiRoutes = Router();
const aiGateway = new AIGateway();

// Validation schemas
const generatePRDSchema = z.object({
  projectName: z.string().min(1),
  projectDescription: z.string().optional(),
  initialPrompt: z.string().optional(),
});

const generateUIDesignSchema = z.object({
  prdContent: z.string().min(1),
  projectName: z.string().min(1),
});

const generateCodeSchema = z.object({
  prdContent: z.string().min(1),
  uiDesignContent: z.string().min(1),
  projectName: z.string().min(1),
  language: z.string().optional(),
});

const generateTestsSchema = z.object({
  prdContent: z.string().min(1),
  uiDesignContent: z.string().min(1),
  codeContent: z.string().min(1),
  projectName: z.string().min(1),
  testFramework: z.string().optional(),
});

// Generate PRD
aiRoutes.post('/generate-prd', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = generatePRDSchema.parse(req.body);

    const result = await aiGateway.generatePRD({
      projectName: data.projectName,
      projectDescription: data.projectDescription,
      initialPrompt: data.initialPrompt,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate PRD');
    res.status(500).json({
      success: false,
      error: 'Failed to generate PRD',
    });
  }
});

// Generate UI/UX Design
aiRoutes.post('/generate-ui-design', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = generateUIDesignSchema.parse(req.body);

    const result = await aiGateway.generateUIDesign({
      prdContent: data.prdContent,
      projectName: data.projectName,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate UI design');
    res.status(500).json({
      success: false,
      error: 'Failed to generate UI design',
    });
  }
});

// Generate Code
aiRoutes.post('/generate-code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = generateCodeSchema.parse(req.body);

    const result = await aiGateway.generateCode({
      prdContent: data.prdContent,
      uiDesignContent: data.uiDesignContent,
      projectName: data.projectName,
      language: data.language,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate code');
    res.status(500).json({
      success: false,
      error: 'Failed to generate code',
    });
  }
});

// Generate Tests
aiRoutes.post('/generate-tests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = generateTestsSchema.parse(req.body);

    const result = await aiGateway.generateTests({
      prdContent: data.prdContent,
      uiDesignContent: data.uiDesignContent,
      codeContent: data.codeContent,
      projectName: data.projectName,
      testFramework: data.testFramework,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate tests');
    res.status(500).json({
      success: false,
      error: 'Failed to generate tests',
    });
  }
});

// Chat/completion endpoint for custom prompts
aiRoutes.post('/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { messages, systemPrompt, temperature = 0.7 } = req.body;

    const result = await aiGateway.chat({
      messages,
      systemPrompt,
      temperature,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to chat with AI');
    res.status(500).json({
      success: false,
      error: 'Failed to chat with AI',
    });
  }
});

// Check AI provider status
aiRoutes.get('/status', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const status = await aiGateway.getStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get AI status');
    res.status(500).json({
      success: false,
      error: 'Failed to get AI status',
    });
  }
});