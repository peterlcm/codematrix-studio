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
  workflow: Workflow | null;
  currentStage: Stage | null;
  isLoading: boolean;
  isGenerating: boolean;
  streamingContent: string;
  error: string | null;
  isAuthenticated: boolean;
  currentUser: User | null;
  backendUrl: string;
  authToken: string | null;

  setWorkflow: (workflow: Workflow) => void;
  setCurrentStage: (stage: Stage) => void;
  selectStage: (stageId: string) => void;
  loadWorkflow: (projectId: string) => Promise<void>;
  createWorkflow: (projectId: string, initialPrompt?: string) => Promise<void>;
  generateStage: (stageId: string, initialPrompt?: string) => Promise<void>;
  updateStageContent: (content: string) => Promise<void>;
  approveStage: (approved: boolean, feedback?: string) => Promise<void>;
  addComment: (content: string, threadId?: string) => Promise<void>;
  regenerateStage: () => Promise<void>;
  setBackendUrl: (url: string) => void;
  setAuthToken: (token: string) => void;
  setAuthStatus: (authenticated: boolean, user?: { user: User }) => void;
  setError: (error: string | null) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflow: null,
  currentStage: null,
  isLoading: false,
  isGenerating: false,
  streamingContent: '',
  error: null,
  isAuthenticated: false,
  currentUser: null,
  backendUrl: 'http://localhost:3001',
  authToken: null,

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
      let { backendUrl } = get();
      // Use default if not set
      if (!backendUrl) {
        backendUrl = 'http://localhost:3001';
        set({ backendUrl });
      }
      const token = get().authToken;

      console.log('[WorkflowStore] Loading workflow for project:', projectId);
      console.log('[WorkflowStore] Backend URL:', backendUrl);
      console.log('[WorkflowStore] Token:', token ? 'present' : 'missing');

      const response = await fetch(`${backendUrl}/api/v1/workflows/project/${projectId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      console.log('[WorkflowStore] Response status:', response.status);
      console.log('[WorkflowStore] Response statusText:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WorkflowStore] Error response:', errorText);
        throw new Error(`Failed to load workflow: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const projectResponse = await fetch(`${backendUrl}/api/v1/projects/${projectId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const projectData = await projectResponse.json();
        const projectName = projectData.data?.name || 'Project';

        const stages = result.data.stages || [];
        const workflowWithName = {
          ...result.data,
          projectName,
          stages,
        };

        set({ workflow: workflowWithName, isLoading: false });

        const currentStage = stages.find(
          (s: Stage) => s.status === 'AI_PROCESSING' ||
                s.status === 'READY_FOR_REVIEW' ||
                s.status === 'REVISION_REQUESTED'
        ) || stages[0] || null;

        set({ currentStage });
      } else if (result.success && !result.data) {
        set({ workflow: null, currentStage: null, isLoading: false });
      } else {
        throw new Error(result.error || 'Failed to load workflow');
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createWorkflow: async (projectId, initialPrompt) => {
    set({ isLoading: true, error: null });

    try {
      const { backendUrl, authToken: token } = get();

      const response = await fetch(`${backendUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ projectId, initialPrompt: initialPrompt || undefined }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create workflow: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        await get().loadWorkflow(projectId);
      } else {
        throw new Error(result.error || 'Failed to create workflow');
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  generateStage: async (stageId, initialPrompt) => {
    set({ isGenerating: true, streamingContent: '', error: null });

    const { backendUrl, authToken: token, workflow } = get();
    if (!workflow) return;

    const stage = workflow.stages.find(s => s.id === stageId);
    if (stage) {
      const updatedStages = workflow.stages.map(s =>
        s.id === stageId ? { ...s, status: 'AI_PROCESSING' as const } : s
      );
      set({
        workflow: { ...workflow, stages: updatedStages },
        currentStage: { ...stage, status: 'AI_PROCESSING' },
      });
    }

    try {
      const response = await fetch(`${backendUrl}/api/v1/workflows/stage/${stageId}/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ initialPrompt }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to generate: ${response.statusText} - ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'chunk') {
              fullContent += data.content;
              set({ streamingContent: fullContent });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      await get().loadWorkflow(workflow.projectId);
      set({ isGenerating: false, streamingContent: '' });
    } catch (error) {
      set({ error: (error as Error).message, isGenerating: false, streamingContent: '' });
      await get().loadWorkflow(workflow.projectId);
    }
  },

  updateStageContent: async (content) => {
    const { currentStage, backendUrl } = get();
    if (!currentStage) return;

    const token = get().authToken;

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

    const token = get().authToken;

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

    const token = get().authToken;

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

    const token = get().authToken;

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

  setAuthToken: (token) => {
    set({ authToken: token, isAuthenticated: true });
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