import { prisma } from '../../database/db';
import { StageType, StageStatus, Workflow as WorkflowModel, Stage } from '@prisma/client';
import { AIGateway } from '../ai/AIGateway';
import { logger } from '../../utils/logger';

const STAGE_ORDER: StageType[] = ['PRD_DESIGN', 'UI_UX_DESIGN', 'DEVELOPMENT', 'TESTING'];

const STAGE_TITLES: Record<StageType, string> = {
  PRD_DESIGN: 'Product Requirements Document',
  UI_UX_DESIGN: 'UI/UX Design',
  DEVELOPMENT: 'Full-Stack Development',
  TESTING: 'Testing & Quality Assurance',
};

export class WorkflowEngine {
  private aiGateway: AIGateway;

  constructor() {
    this.aiGateway = new AIGateway();
  }

  async createWorkflow(options: {
    projectId: string;
    initialPrompt?: string;
  }): Promise<WorkflowModel & { stages: Stage[] }> {
    // Create workflow with all stages
    const workflow = await prisma.workflow.create({
      data: {
        projectId: options.projectId,
        currentStage: 'PRD_DESIGN',
        status: 'ACTIVE',
        stages: {
          create: STAGE_ORDER.map((stageType, index) => ({
            stageType,
            title: STAGE_TITLES[stageType],
            status: index === 0 ? 'PENDING' : 'PENDING',
          })),
        },
      },
      include: {
        stages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    logger.info({ workflowId: workflow.id }, 'Workflow created with all stages');

    return workflow;
  }

  async triggerAIForStage(stageId: string, projectName: string, initialPrompt?: string): Promise<void> {
    try {
      // Update stage status to AI_PROCESSING
      await prisma.stage.update({
        where: { id: stageId },
        data: { status: 'AI_PROCESSING' },
      });

      // Get the stage and workflow
      const stage = await prisma.stage.findUnique({
        where: { id: stageId },
        include: { workflow: { include: { stages: true } } },
      });

      if (!stage) {
        throw new Error('Stage not found');
      }

      // Get previous approved stage content for context
      const previousStage = await this.getPreviousApprovedStage(stage);

      // Generate content based on stage type
      let aiContent: string;
      const projectContext = {
        projectName,
        prdContent: previousStage?.stageType === 'PRD_DESIGN' ? previousStage.humanContent || previousStage.aiContent : null,
        uiDesignContent: previousStage?.stageType === 'UI_UX_DESIGN' ? previousStage.humanContent || previousStage.aiContent : null,
        codeContent: previousStage?.stageType === 'DEVELOPMENT' ? previousStage.humanContent || previousStage.aiContent : null,
      };

      switch (stage.stageType) {
        case 'PRD_DESIGN':
          aiContent = await this.aiGateway.generatePRD({
            projectName,
            projectDescription: initialPrompt,
            initialPrompt: initialPrompt,
          });
          break;
        case 'UI_UX_DESIGN':
          aiContent = await this.aiGateway.generateUIDesign({
            prdContent: projectContext.prdContent || '',
            projectName,
          });
          break;
        case 'DEVELOPMENT':
          aiContent = await this.aiGateway.generateCode({
            prdContent: projectContext.prdContent || '',
            uiDesignContent: projectContext.uiDesignContent || '',
            projectName,
          });
          break;
        case 'TESTING':
          aiContent = await this.aiGateway.generateTests({
            prdContent: projectContext.prdContent || '',
            uiDesignContent: projectContext.uiDesignContent || '',
            codeContent: projectContext.codeContent || '',
            projectName,
          });
          break;
        default:
          throw new Error(`Unknown stage type: ${stage.stageType}`);
      }

      // Update stage with AI content
      await prisma.stage.update({
        where: { id: stageId },
        data: {
          aiContent,
          status: 'READY_FOR_REVIEW',
        },
      });

      logger.info({ stageId, stageType: stage.stageType }, 'AI generated content for stage');
    } catch (error) {
      logger.error({ error, stageId }, 'Failed to generate AI content');

      // Mark stage as failed
      await prisma.stage.update({
        where: { id: stageId },
        data: { status: 'REVISION_REQUESTED' },
      });

      throw error;
    }
  }

  async triggerAIForNextStage(nextStageId: string, currentWorkflow: WorkflowModel & { stages: Stage[] }, currentStage: Stage): Promise<void> {
    // Get project name
    const project = await prisma.project.findUnique({
      where: { id: currentWorkflow.projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Pass the approved content as context for next stage
    const context = {
      projectName: project.name,
      prdContent: currentStage.stageType === 'PRD_DESIGN' ? currentStage.humanContent || currentStage.aiContent : null,
      uiDesignContent: currentStage.stageType === 'UI_UX_DESIGN' ? currentStage.humanContent || currentStage.aiContent : null,
      codeContent: currentStage.stageType === 'DEVELOPMENT' ? currentStage.humanContent || currentStage.aiContent : null,
    };

    await this.triggerAIForStage(nextStageId, project.name);
  }

  async approveStage(options: {
    stageId: string;
    userId: string;
    approved: boolean;
    feedback?: string;
  }): Promise<{ success: boolean; stage?: Stage; error?: string }> {
    const stage = await prisma.stage.findUnique({
      where: { id: options.stageId },
      include: { workflow: { include: { stages: true } } },
    });

    if (!stage) {
      return { success: false, error: 'Stage not found' };
    }

    if (stage.status !== 'READY_FOR_REVIEW' && stage.status !== 'REVISION_REQUESTED') {
      return { success: false, error: 'Stage is not ready for review' };
    }

    if (options.approved) {
      // Approve the stage
      const updatedStage = await prisma.stage.update({
        where: { id: options.stageId },
        data: {
          approved: true,
          approvedById: options.userId,
          approvedAt: new Date(),
          status: 'APPROVED',
        },
        include: {
          approvedBy: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          comments: {
            include: {
              author: {
                select: { id: true, email: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Create approval record
      await prisma.stageApproval.create({
        data: {
          stageId: options.stageId,
          userId: options.userId,
          approved: true,
          feedback: options.feedback,
        },
      });

      // Update workflow current stage
      const currentIndex = STAGE_ORDER.indexOf(stage.stageType);
      const nextStageType = STAGE_ORDER[currentIndex + 1];

      if (nextStageType) {
        await prisma.workflow.update({
          where: { id: stage.workflowId },
          data: { currentStage: nextStageType },
        });
      } else {
        // Workflow complete
        await prisma.workflow.update({
          where: { id: stage.workflowId },
          data: { status: 'COMPLETED' },
        });
      }

      logger.info({ stageId: options.stageId, userId: options.userId }, 'Stage approved');

      return { success: true, stage: updatedStage };
    } else {
      // Request revision
      const updatedStage = await prisma.stage.update({
        where: { id: options.stageId },
        data: {
          status: 'REVISION_REQUESTED',
        },
        include: {
          approvedBy: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          comments: {
            include: {
              author: {
                select: { id: true, email: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Create revision request record
      await prisma.stageApproval.create({
        data: {
          stageId: options.stageId,
          userId: options.userId,
          approved: false,
          feedback: options.feedback,
        },
      });

      logger.info({ stageId: options.stageId, userId: options.userId }, 'Revision requested');

      return { success: true, stage: updatedStage };
    }
  }

  private async getPreviousApprovedStage(currentStage: Stage & { workflow: { stages: Stage[] } }): Promise<Stage | null> {
    const currentIndex = STAGE_ORDER.indexOf(currentStage.stageType);
    if (currentIndex <= 0) return null;

    const previousStageType = STAGE_ORDER[currentIndex - 1];
    return currentStage.workflow.stages.find(s => s.stageType === previousStageType && s.approved) || null;
  }

  getStageOrder(): StageType[] {
    return STAGE_ORDER;
  }

  getStageTitle(stageType: StageType): string {
    return STAGE_TITLES[stageType];
  }
}