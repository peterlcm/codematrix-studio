import * as vscode from 'vscode';
import { ApiClient } from '../services/apiClient';
import { logger } from '../utils/logger';

interface WorkflowTreeItem extends vscode.TreeItem {
  id: string;
  stageType?: string;
  status?: string;
  projectId?: string;
}

export class WorkflowSidebarProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorkflowTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;
  private apiClient: ApiClient;
  private projects: Array<{ id: string; name: string }> = [];
  private selectedProjectId: string | undefined;

  constructor(context: vscode.ExtensionContext, apiClient: ApiClient) {
    this.context = context;
    this.apiClient = apiClient;

    // Refresh on focus
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
    // If no element, show project list
    if (!element) {
      return this.getProjectItems();
    }

    // If element is a project, show workflow stages
    if (element.projectId) {
      return this.getStageItems(element.projectId);
    }

    return [];
  }

  private async getProjectItems(): Promise<WorkflowTreeItem[]> {
    try {
      const result = await this.apiClient.getProjects();

      if (!result.success || !result.data) {
        return [this.createItem('No Projects', 'Create a new project to get started', 'codematrix.initProject')];
      }

      return result.data.map((project: { id: string; name: string }) =>
        this.createItem(
          project.name,
          `Project: ${project.name}`,
          undefined,
          'project',
          project.id
        )
      );
    } catch (error) {
      logger.error({ error }, 'Failed to load projects');
      return [this.createItem('Error', 'Failed to load projects', undefined)];
    }
  }

  private async getStageItems(projectId: string): Promise<WorkflowTreeItem[]> {
    try {
      const result = await this.apiClient.getWorkflow(projectId);

      if (!result.success || !result.data) {
        return [this.createItem('No Workflow', 'Start a workflow to see stages', undefined)];
      }

      const workflow = result.data;
      const stages = workflow.stages || [];

      return stages.map((stage: { id: string; stageType: string; status: string; title: string; approved: boolean }) =>
        this.createItem(
          `${this.getStageEmoji(stage.stageType)} ${stage.title}`,
          this.getStatusText(stage.status, stage.approved),
          undefined,
          'stage',
          stage.id,
          stage.stageType,
          stage.status,
          projectId
        )
      );
    } catch (error) {
      logger.error({ error }, 'Failed to load workflow');
      return [this.createItem('Error', 'Failed to load workflow', undefined)];
    }
  }

  private createItem(
    label: string,
    description: string,
    commandId?: string,
    type?: string,
    id?: string,
    stageType?: string,
    status?: string,
    projectId?: string
  ): WorkflowTreeItem {
    const item = new vscode.TreeItem(label);

    item.description = description;
    item.collapsibleState = type === 'project' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None;

    if (commandId) {
      item.command = {
        command: commandId,
        title: label,
      };
    }

    // Set icon based on type and status
    if (type === 'stage' && status) {
      item.iconPath = this.getStatusIcon(status);
    }

    // Store additional data
    (item as WorkflowTreeItem).id = id || '';
    (item as WorkflowTreeItem).stageType = stageType;
    (item as WorkflowTreeItem).status = status;
    (item as WorkflowTreeItem).projectId = projectId;

    return item;
  }

  private getStageEmoji(stageType: string): string {
    const emojis: Record<string, string> = {
      'PRD_DESIGN': '📋',
      'UI_UX_DESIGN': '🎨',
      'DEVELOPMENT': '💻',
      'TESTING': '🧪',
    };
    return emojis[stageType] || '📄';
  }

  private getStatusText(status: string, approved: boolean): string {
    if (approved) return '✅ Approved';

    const statusTexts: Record<string, string> = {
      'PENDING': '⏳ Pending AI processing',
      'AI_PROCESSING': '🤖 AI is generating...',
      'READY_FOR_REVIEW': '👀 Ready for review',
      'REVISION_REQUESTED': '🔄 Revision requested',
      'APPROVED': '✅ Approved',
      'COMPLETED': '🎉 Completed',
    };
    return statusTexts[status] || status;
  }

  private getStatusIcon(status: string): vscode.Uri | undefined {
    // Using built-in VS Code icons
    const iconMap: Record<string, string> = {
      'PENDING': 'circle-outline',
      'AI_PROCESSING': 'sync~spin',
      'READY_FOR_REVIEW': 'eye',
      'REVISION_REQUESTED': 'refresh',
      'APPROVED': 'check',
      'COMPLETED': 'check-all',
    };

    const iconName = iconMap[status] || 'circle-outline';
    return vscode.Uri.parse(`vscode://${iconName}`);
  }
}