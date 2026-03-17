import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  stageId: string;
  authorId: string;
  author: User;
  content: string;
  threadId: string | null;
  position: { line: number; column: number } | null;
  createdAt: string;
}

export interface Stage {
  id: string;
  workflowId: string;
  stageType: 'PRD_DESIGN' | 'UI_UX_DESIGN' | 'DEVELOPMENT' | 'TESTING';
  status: 'PENDING' | 'AI_PROCESSING' | 'READY_FOR_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'COMPLETED';
  title: string;
  aiContent: string | null;
  humanContent: string | null;
  version: number;
  approved: boolean;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}

export interface Workflow {
  id: string;
  projectId: string;
  projectName?: string;
  currentStage: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowState {
  // Data
  workflow: Workflow | null;
  currentStage: Stage | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  currentUser: User | null;
  backendUrl: string;

  // Actions
  setWorkflow: (workflow: Workflow) => void;
  setCurrentStage: (stage: Stage) => void;
  selectStage: (stageId: string) => void;
  loadWorkflow: (projectId: string) => Promise<void>;
  updateStageContent: (content: string) => Promise<void>;
  approveStage: (approved: boolean, feedback?: string) => Promise<void>;
  addComment: (content: string, threadId?: string) => Promise<void>;
  regenerateStage: () => Promise<void>;
  setBackendUrl: (url: string) => void;
  setAuthStatus: (authenticated: boolean, user?: { user: User }) => void;
  setError: (error: string | null) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state
  workflow: null,
  currentStage: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  currentUser: null,
  backendUrl: 'http://localhost:3001',

  // Actions
  setWorkflow: (workflow) => {
    set({ workflow });

    // Find current stage based on status
    const currentStage = workflow.stages.find(
      (s) => s.status === 'AI_PROCESSING' ||
            s.status === 'READY_FOR_REVIEW' ||
            s.status === 'REVISION_REQUESTED'
    ) || workflow.stages[0];

    set({ currentStage });
  },

  setCurrentStage: (stage) => {
    set({ currentStage: stage });
  },

  selectStage: (stageId) => {
    const { workflow } = get();
    if (!workflow) return;

    const stage = workflow.stages.find((s) => s.id === stageId);
    if (stage) {
      set({ currentStage: stage });
    }
  },

  loadWorkflow: async (projectId) => {
    set({ isLoading: true, error: null });

    try {
      const { backendUrl } = get();
      const token = localStorage.getItem('authToken');

      const response = await fetch(`${backendUrl}/api/v1/workflows/project/${projectId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load workflow: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Fetch project name for display
        const projectResponse = await fetch(`${backendUrl}/api/v1/projects/${projectId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const projectData = await projectResponse.json();
        const projectName = projectData.data?.name || 'Project';

        const workflowWithName = {
          ...result.data,
          projectName,
        };

        set({ workflow: workflowWithName, isLoading: false });

        // Set current stage
        const currentStage = workflowWithName.stages.find(
          (s: Stage) => s.status === 'AI_PROCESSING' ||
                s.status === 'READY_FOR_REVIEW' ||
                s.status === 'REVISION_REQUESTED'
        ) || workflowWithName.stages[0];

        set({ currentStage });
      } else {
        throw new Error(result.error || 'Failed to load workflow');
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateStageContent: async (content) => {
    const { currentStage, backendUrl } = get();
    if (!currentStage) return;

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`${backendUrl}/api/v1/workflows/stage/${currentStage.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content, isAiContent: false }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        const { workflow } = get();
        if (workflow) {
          const updatedStages = workflow.stages.map((s) =>
            s.id === currentStage.id
              ? { ...s, humanContent: content, version: s.version + 1 }
              : s
          );
          set({
            workflow: { ...workflow, stages: updatedStages },
            currentStage: { ...currentStage, humanContent: content, version: currentStage.version + 1 },
          });
        }
      }
    } catch (error) {
      console.error('Failed to update stage:', error);
    }
  },

  approveStage: async (approved, feedback) => {
    const { currentStage, workflow, backendUrl } = get();
    if (!currentStage) return;

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`${backendUrl}/api/v1/workflows/stage/${currentStage.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ approved, feedback }),
      });

      const result = await response.json();

      if (result.success) {
        // Reload workflow to get updated state
        if (workflow) {
          await get().loadWorkflow(workflow.projectId);
        }
      }
    } catch (error) {
      console.error('Failed to approve stage:', error);
    }
  },

  addComment: async (content, threadId) => {
    const { currentStage, backendUrl } = get();
    if (!currentStage) return;

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`${backendUrl}/api/v1/workflows/stage/${currentStage.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content, threadId }),
      });

      const result = await response.json();

      if (result.success) {
        // Add comment to local state
        const { workflow, currentStage: stage } = get();
        if (workflow && stage) {
          const updatedComments = [...(stage.comments || []), result.data];
          set({
            currentStage: { ...stage, comments: updatedComments },
          });
        }
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  },

  regenerateStage: async () => {
    const { currentStage, backendUrl, workflow } = get();
    if (!currentStage) return;

    const token = localStorage.getItem('authToken');

    try {
      await fetch(`${backendUrl}/api/v1/workflows/stage/${currentStage.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      // Reload workflow after a short delay
      setTimeout(async () => {
        if (workflow) {
          await get().loadWorkflow(workflow.projectId);
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to regenerate stage:', error);
    }
  },

  setBackendUrl: (url) => {
    set({ backendUrl: url });
  },

  setAuthStatus: (authenticated, user) => {
    set({
      isAuthenticated: authenticated,
      currentUser: user?.user || null,
    });
  },

  setError: (error) => {
    set({ error });
  },
}));