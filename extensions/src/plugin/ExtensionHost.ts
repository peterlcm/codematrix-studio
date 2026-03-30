/**
 * Extension Host API for VS Code Extension
 *
 * This provides a standardized API for extensions to interact with CodeMatrix Studio
 */

import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export interface ExtensionContext {
  extensionId: string;
  extensionPath: string;
  storagePath: string;
  globalState: vscode.Memento;
  workspaceState: vscode.Memento;
  secrets: vscode.SecretStorage;
}

export interface ExtensionAPI {
  // Extension info
  id: string;
  version: string;

  // VS Code APIs
  vscode: typeof vscode;

  // CodeMatrix APIs
  api: CodeMatrixAPI;
}

export interface CodeMatrixAPI {
  // Project
  projects: ProjectAPI;

  // Workflow
  workflow: WorkflowAPI;

  // AI
  ai: AIAPI;

  // Events
  events: EventEmitter;

  // UI
  ui: UIAPI;
}

export interface ProjectAPI {
  getAll(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(name: string, description?: string): Promise<Project>;
  update(id: string, data: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;

  // Team management
  getTeam(projectId: string): Promise<TeamMember[]>;
  addMember(projectId: string, email: string, role: string): Promise<TeamMember>;
  removeMember(projectId: string, userId: string): Promise<void>;

  // Events
  onCreated(callback: (project: Project) => void): void;
  onUpdated(callback: (project: Project) => void): void;
  onDeleted(callback: (projectId: string) => void): void;
}

export interface WorkflowAPI {
  getByProject(projectId: string): Promise<Workflow | null>;
  create(projectId: string, initialPrompt?: string): Promise<Workflow>;
  getStage(stageId: string): Promise<Stage | null>;
  updateStage(stageId: string, content: string): Promise<Stage>;
  approveStage(stageId: string, approved: boolean, feedback?: string): Promise<Stage>;

  // Events
  onStageUpdated(callback: (stage: Stage) => void): void;
  onStageApproved(callback: (stage: Stage) => void): void;
}

export interface AIAPI {
  generatePRD(prompt: string): Promise<string>;
  generateUIDesign(prdContent: string): Promise<string>;
  generateCode(prdContent: string, uiDesign: string): Promise<string>;
  generateTests(code: string): Promise<string>;

  // Chat
  chat(messages: ChatMessage[]): Promise<ChatResponse>;
}

export interface UIAPI {
  showInformationMessage(message: string): Promise<void>;
  showWarningMessage(message: string): Promise<void>;
  showErrorMessage(message: string): Promise<void>;
  showConfirm(message: string, confirmText: string): Promise<boolean>;

  // Webview
  createWebview(options: WebviewOptions): vscode.WebviewPanel;
  postMessage(panel: vscode.WebviewPanel, message: any): void;

  // Tree view
  registerTreeProvider(provider: vscode.TreeDataProvider<any>): vscode.Disposable;
}

export interface EventEmitter {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, ...args: any[]): void;
}

export interface WebviewOptions {
  title: string;
  viewType: string;
  iconPath?: vscode.Uri;
  webviewOptions?: vscode.WebviewPanelOptions;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name?: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  avatarUrl?: string;
}

export interface Workflow {
  id: string;
  projectId: string;
  currentStage: string;
  status: string;
  stages: Stage[];
}

export interface Stage {
  id: string;
  workflowId: string;
  stageType: string;
  status: string;
  title: string;
  aiContent?: string;
  humanContent?: string;
  version: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Create the extension API for a given extension
 */
export function createExtensionAPI(context: ExtensionContext): ExtensionAPI {
  return {
    id: context.extensionId,
    version: '1.0.0',
    vscode,
    api: {
      projects: createProjectAPI(),
      workflow: createWorkflowAPI(),
      ai: createAIAPI(),
      events: createEventEmitter(),
      ui: createUIAPI(),
    },
  };
}

function createProjectAPI(): ProjectAPI {
  return {
    getAll: async () => {
      // Implementation would call the API client
      return [];
    },
    get: async (id: string) => {
      return null;
    },
    create: async (name: string, description?: string) => {
      return { id: '', name, description, ownerId: '', createdAt: '', updatedAt: '' };
    },
    update: async (id: string, data: Partial<Project>) => {
      return { id, name: '', createdAt: '', updatedAt: '', ...data };
    },
    delete: async (id: string) => {},
    getTeam: async (projectId: string) => [],
    addMember: async (projectId: string, email: string, role: string) => {
      return { id: '', userId: '', email, role: role as any };
    },
    removeMember: async (projectId: string, userId: string) => {},
    onCreated: (callback) => {},
    onUpdated: (callback) => {},
    onDeleted: (callback) => {},
  };
}

function createWorkflowAPI(): WorkflowAPI {
  return {
    getByProject: async (projectId: string) => null,
    create: async (projectId: string, initialPrompt?: string) => {
      return { id: '', projectId, currentStage: '', status: '', stages: [] };
    },
    getStage: async (stageId: string) => null,
    updateStage: async (stageId: string, content: string) => {
      return { id: stageId, workflowId: '', stageType: '', status: '', title: '', humanContent: content, version: 1 };
    },
    approveStage: async (stageId: string, approved: boolean, feedback?: string) => {
      return { id: stageId, workflowId: '', stageType: '', status: approved ? 'APPROVED' : '', title: '', version: 1 };
    },
    onStageUpdated: (callback) => {},
    onStageApproved: (callback) => {},
  };
}

function createAIAPI(): AIAPI {
  return {
    generatePRD: async (prompt: string) => '',
    generateUIDesign: async (prdContent: string) => '',
    generateCode: async (prdContent: string, uiDesign: string) => '',
    generateTests: async (code: string) => '',
    chat: async (messages: ChatMessage[]) => ({ content: '' }),
  };
}

function createEventEmitter(): EventEmitter {
  const handlers: Map<string, Set<Function>> = new Map();

  return {
    on(event: string, handler: Function) {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
    },
    off(event: string, handler: Function) {
      handlers.get(event)?.delete(handler);
    },
    emit(event: string, ...args: any[]) {
      handlers.get(event)?.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          logger.error('Event handler error', { error, event });
        }
      });
    },
  };
}

function createUIAPI(): UIAPI {
  return {
    showInformationMessage: async (message: string) => {
      vscode.window.showInformationMessage(message);
    },
    showWarningMessage: async (message: string) => {
      vscode.window.showWarningMessage(message);
    },
    showErrorMessage: async (message: string) => {
      vscode.window.showErrorMessage(message);
    },
    showConfirm: async (message: string, confirmText: string) => {
      const result = await vscode.window.showInformationMessage(message, confirmText, 'Cancel');
      return result === confirmText;
    },
    createWebview: (options: WebviewOptions) => {
      return vscode.window.createWebviewPanel(
        options.viewType,
        options.title,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          ...options.webviewOptions,
        }
      );
    },
    postMessage: (panel: vscode.WebviewPanel, message: any) => {
      panel.webview.postMessage(message);
    },
    registerTreeProvider: (provider: vscode.TreeDataProvider<any>) => {
      return vscode.window.registerTreeDataProvider('codematrix.custom', provider);
    },
  };
}