import * as vscode from 'vscode';
import { ApiClient } from '../services/apiClient';
import { logger } from '../utils/logger';

interface WorkflowTreeItem extends vscode.TreeItem {
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
  private mainPanelCommand: vscode.Command | undefined;

  constructor(context: vscode.ExtensionContext, apiClient: ApiClient) {
    this.context = context;
    this.apiClient = apiClient;

    // Create command to open main panel
    this.mainPanelCommand = {
      command: 'codematrix.openMain',
      title: '打开 CodeMatrix Studio',
    };

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
    if (!element) {
      const openStudioItem = this.createItem(
        '🚀 打开 CodeMatrix Studio',
        '',
        'codematrix.openMain'
      );

      if (!this.apiClient.isAuthenticated()) {
        const loginItem = this.createItem(
          '$(sign-in) 请先登录',
          '点击标题栏的登录按钮',
          'codematrix.login'
        );
        return [openStudioItem, loginItem];
      }

      const projectItems = await this.getProjectItems();
      return [openStudioItem, ...projectItems];
    }

    if (element.projectId) {
      return this.getStageItems(element.projectId);
    }

    return [];
  }

  private async getProjectItems(): Promise<WorkflowTreeItem[]> {
    try {
      const result = await this.apiClient.getProjects();

      if (!result.success || !result.data || result.data.length === 0) {
        return [this.createItem('暂无项目', '点击「打开 CodeMatrix Studio」开始', 'codematrix.openMain')];
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
      logger.error('Failed to load projects', { error: String(error) });
      return [this.createItem('错误', '加载项目列表失败', undefined)];
    }
  }

  private async getStageItems(projectId: string): Promise<WorkflowTreeItem[]> {
    try {
      const result = await this.apiClient.getWorkflow(projectId);

      if (!result.success || !result.data) {
        return [this.createItem('暂无工作流', '启动工作流查看各阶段', undefined)];
      }

      const workflow = result.data as any;
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
      logger.error('Failed to load workflow', { error: String(error) });
      return [this.createItem('错误', '加载工作流失败', undefined)];
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
    if (approved) return '✅ 已确认';

    const statusTexts: Record<string, string> = {
      'PENDING': '⏳ 待处理',
      'AI_PROCESSING': '🤖 AI 生成中...',
      'READY_FOR_REVIEW': '👀 待审核',
      'REVISION_REQUESTED': '🔄 需要修改',
      'APPROVED': '✅ 已确认',
      'COMPLETED': '🎉 已完成',
    };
    return statusTexts[status] || status;
  }

  private getStatusIcon(status: string): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      'PENDING': 'circle-outline',
      'AI_PROCESSING': 'sync~spin',
      'READY_FOR_REVIEW': 'eye',
      'REVISION_REQUESTED': 'refresh',
      'APPROVED': 'check',
      'COMPLETED': 'check-all',
    };

    const iconName = iconMap[status] || 'circle-outline';
    return new vscode.ThemeIcon(iconName);
  }
}