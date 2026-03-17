export type StageType = 'PRD_DESIGN' | 'UI_UX_DESIGN' | 'DEVELOPMENT' | 'TESTING';
export type StageStatus = 'PENDING' | 'AI_PROCESSING' | 'READY_FOR_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'COMPLETED';
export type WorkflowStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

// API Request/Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface CreateWorkflowDto {
  projectId: string;
  initialPrompt?: string; // For AI to generate initial PRD
}

export interface UpdateStageDto {
  content: string; // Updated content (human edits)
  isAiContent?: boolean; // Whether this is AI content update
}

export interface ApproveStageDto {
  approved: boolean;
  feedback?: string;
}

export interface AddCommentDto {
  content: string;
  threadId?: string;
  position?: {
    line: number;
    column: number;
  };
}

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: UserDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface StageDto {
  id: string;
  workflowId: string;
  stageType: StageType;
  status: StageStatus;
  title: string;
  aiContent: string | null;
  humanContent: string | null;
  version: number;
  approved: boolean;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comments?: CommentDto[];
}

export interface WorkflowDto {
  id: string;
  projectId: string;
  currentStage: StageType;
  status: WorkflowStatus;
  stages: StageDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentDto {
  id: string;
  stageId: string;
  authorId: string;
  author: UserDto;
  content: string;
  threadId: string | null;
  position: { line: number; column: number } | null;
  createdAt: Date;
}

// WebSocket event types
export interface WsEvent {
  type: string;
  payload: unknown;
}

export interface StageUpdateEvent extends WsEvent {
  type: 'stage:updated';
  payload: {
    stageId: string;
    stage: StageDto;
  };
}

export interface WorkflowUpdateEvent extends WsEvent {
  type: 'workflow:updated';
  payload: {
    workflow: WorkflowDto;
  };
}

export interface CommentEvent extends WsEvent {
  type: 'comment:added';
  payload: {
    comment: CommentDto;
  };
}

export interface UserPresenceEvent extends WsEvent {
  type: 'user:presence';
  payload: {
    userId: string;
    projectId: string;
    online: boolean;
  };
}

// AI Request types
export interface AIGeneratePRDRequest {
  projectName: string;
  projectDescription?: string;
  initialPrompt?: string;
}

export interface AIGenerateUIDesignRequest {
  prdContent: string;
  projectName: string;
}

export interface AIGenerateCodeRequest {
  prdContent: string;
  uiDesignContent: string;
  projectName: string;
  language?: string; // e.g., 'typescript', 'python'
}

export interface AIGenerateTestsRequest {
  prdContent: string;
  uiDesignContent: string;
  codeContent: string;
  projectName: string;
  testFramework?: string; // e.g., 'jest', 'pytest'
}

export interface AIResponse {
  content: string;
  metadata?: {
    tokensUsed?: number;
    model?: string;
  };
}