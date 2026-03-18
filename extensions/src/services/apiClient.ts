import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private authToken: string | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    // Get backend URL from configuration
    const config = vscode.workspace.getConfiguration('codematrix');
    const backendUrl = config.get<string>('backendUrl', 'http://localhost:3001');

    this.client = axios.create({
      baseURL: backendUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logger.warn('Authentication required');
          vscode.window.showWarningMessage('Please login to continue');
        }
        return Promise.reject(error);
      }
    );

    // Try to load saved token
    this.loadSavedToken();
  }

  private async loadSavedToken(): Promise<void> {
    try {
      // Get token from secrets
      const token = await this.context.secrets.get('authToken');
      if (token) {
        this.authToken = token;
        logger.info('Loaded saved auth token');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load saved token', { error: errMsg });
    }
  }

  async saveAuthToken(token: string): Promise<void> {
    try {
      await this.context.secrets.store('authToken', token);
      this.authToken = token;
      logger.info('Auth token saved');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save auth token', { error: errMsg });
    }
  }

  async clearAuthToken(): Promise<void> {
    try {
      await this.context.secrets.delete('authToken');
      this.authToken = undefined;
      logger.info('Auth token cleared');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to clear auth token', { error: errMsg });
    }
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  getAuthToken(): string | undefined {
    return this.authToken;
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  // Auth endpoints
  async register(email: string, password: string, name?: string): Promise<ApiResponse> {
    try {
      const response = await this.client.post('/api/v1/users/register', {
        email,
        password,
        name,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async login(email: string, password: string): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/users/login', {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.client.post('/api/v1/users/logout');
      this.authToken = undefined;
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCurrentUser(): Promise<ApiResponse> {
    try {
      const response = await this.client.get('/api/v1/users/me');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Project endpoints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getProjects(): Promise<any> {
    try {
      const response = await this.client.get('/api/v1/projects');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getProject(projectId: string): Promise<ApiResponse> {
    try {
      const response = await this.client.get(`/api/v1/projects/${projectId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createProject(name: string, description?: string): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/projects', {
        name,
        description,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateProject(projectId: string, data: { name?: string; description?: string }): Promise<ApiResponse> {
    try {
      const response = await this.client.patch(`/api/v1/projects/${projectId}`, data);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteProject(projectId: string): Promise<ApiResponse> {
    try {
      const response = await this.client.delete(`/api/v1/projects/${projectId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Workflow endpoints
  async getWorkflow(projectId: string): Promise<ApiResponse> {
    try {
      const response = await this.client.get(`/api/v1/workflows/project/${projectId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createWorkflow(projectId: string, initialPrompt?: string): Promise<ApiResponse> {
    try {
      const response = await this.client.post('/api/v1/workflows', {
        projectId,
        initialPrompt,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getStage(stageId: string): Promise<ApiResponse> {
    try {
      const response = await this.client.get(`/api/v1/workflows/stage/${stageId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateStage(stageId: string, content: string): Promise<ApiResponse> {
    try {
      const response = await this.client.patch(`/api/v1/workflows/stage/${stageId}`, {
        content,
        isAiContent: false,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async approveCurrentStage(projectId: string, approved: boolean, feedback?: string): Promise<ApiResponse> {
    try {
      // First get the workflow to find the current stage
      const workflowResponse = await this.getWorkflow(projectId);
      if (!workflowResponse.success || !workflowResponse.data) {
        return { success: false, error: 'Workflow not found' };
      }

      const workflow = workflowResponse.data;
      const currentStage = workflow.stages?.find(
        (s: { status: string; stageType: string }) =>
          s.status === 'READY_FOR_REVIEW' || s.status === 'REVISION_REQUESTED'
      );

      if (!currentStage) {
        return { success: false, error: 'No stage ready for review' };
      }

      const response = await this.client.post(`/api/v1/workflows/stage/${currentStage.id}/approve`, {
        approved,
        feedback,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async regenerateStage(stageId: string): Promise<ApiResponse> {
    try {
      const response = await this.client.post(`/api/v1/workflows/stage/${stageId}/regenerate`);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Comment endpoints
  async addComment(stageId: string, content: string, threadId?: string): Promise<ApiResponse> {
    try {
      const response = await this.client.post(`/api/v1/workflows/stage/${stageId}/comments`, {
        content,
        threadId,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // AI endpoints
  async generatePRD(projectName: string, description?: string): Promise<ApiResponse> {
    try {
      const response = await this.client.post('/api/v1/ai/generate-prd', {
        projectName,
        projectDescription: description,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async generateCode(projectId: string): Promise<ApiResponse> {
    try {
      // Get workflow and stages for context
      const workflowResponse = await this.getWorkflow(projectId);
      if (!workflowResponse.success) {
        return { success: false, error: 'Failed to get workflow' };
      }

      const workflow = workflowResponse.data;
      const prdStage = workflow.stages?.find((s: { stageType: string }) => s.stageType === 'PRD_DESIGN');
      const uiDesignStage = workflow.stages?.find((s: { stageType: string }) => s.stageType === 'UI_UX_DESIGN');

      const response = await this.client.post('/api/v1/ai/generate-code', {
        prdContent: prdStage?.humanContent || prdStage?.aiContent || '',
        uiDesignContent: uiDesignStage?.humanContent || uiDesignStage?.aiContent || '',
        projectName: workflow.project?.name || 'Project',
      });
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown): ApiResponse {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error || error.message;
      logger.error('API request failed', { error: message });
      return {
        success: false,
        error: message,
      };
    }
    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }
}