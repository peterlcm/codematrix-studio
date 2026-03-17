// Type definitions shared between extension and webview

export type StageType = 'PRD_DESIGN' | 'UI_UX_DESIGN' | 'DEVELOPMENT' | 'TESTING';
export type StageStatus = 'PENDING' | 'AI_PROCESSING' | 'READY_FOR_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'COMPLETED';
export type WorkflowStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stage {
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
  comments?: Comment[];
}

export interface Workflow {
  id: string;
  projectId: string;
  currentStage: StageType;
  status: WorkflowStatus;
  stages: Stage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  stageId: string;
  authorId: string;
  author: User;
  content: string;
  threadId: string | null;
  position: { line: number; column: number } | null;
  createdAt: Date;
}

// Webview message types
export type WebviewMessage =
  | { type: 'init'; payload: { projectId: string; backendUrl: string } }
  | { type: 'ready'; payload: { projectId: string; backendUrl: string } }
  | { type: 'workflow:updated'; payload: Workflow }
  | { type: 'stage:updated'; payload: Stage }
  | { type: 'comment:added'; payload: Comment }
  | { type: 'user:presence'; payload: { userId: string; online: boolean } }
  | { type: 'command:execute'; payload: { command: string; args?: unknown[] } }
  | { type: 'settings:save'; payload: { backendUrl?: string; apiKey?: string } };

// Extension to webview messages
export type ExtensionMessage =
  | { type: 'init'; payload: { projectId: string; backendUrl: string } }
  | { type: 'workflow:load'; payload: Workflow }
  | { type: 'stage:load'; payload: Stage }
  | { type: 'auth:status'; payload: { authenticated: boolean; user?: User } }
  | { type: 'error'; payload: { message: string } };