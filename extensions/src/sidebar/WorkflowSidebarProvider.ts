import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from '../services/apiClient';
import { logger } from '../utils/logger';

export interface WorkflowTreeItem extends vscode.TreeItem {
  projectId?: string;
  filePath?: string;
  itemType?: 'project' | 'stage' | 'files-root' | 'directory' | 'file' | 'action';
  actionType?: 'create-project' | 'login' | 'refresh' | 'settings';
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  children?: FileTreeNode[];
}

export class WorkflowSidebarProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorkflowTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private context: vscode.ExtensionContext;
  private apiClient: ApiClient;
  private projects: Array<{ id: string; name: string }> = [];
  private selectedProjectId: string | undefined;
  private mainPanelCommand: vscode.Command | undefined;

  // Cache for file trees
  private fileTreeCache: Map<string, FileTreeNode[]> = new Map();

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
    this.fileTreeCache.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
    if (!element) {
      // Root level - show header with actions
      const items: WorkflowTreeItem[] = [];
      
      // Header with logo/title
      const headerItem = this.createItem(
        '🔷 CodeMatrix Studio',
        'AI 协作开发平台',
        undefined,
        'header'
      );
      items.push(headerItem);

      if (!this.apiClient.isAuthenticated()) {
        // Not logged in - show login prompt
        const loginItem = this.createItem(
          '$(sign-in) 登录 / 注册',
          '点击登录到 CodeMatrix',
          'codematrix.login',
          'action',
          undefined,
          undefined,
          undefined,
          undefined,
          'login'
        );
        
        const createProjectItem = this.createItem(
          '$(add) 创建新项目',
          '初始化新项目',
          'codematrix.initProject',
          'action',
          undefined,
          undefined,
          undefined,
          undefined,
          'create-project'
        );
        
        const settingsItem = this.createItem(
          '$(gear) 设置',
          '配置后端和 API 密钥',
          'codematrix.openSettings',
          'action',
          undefined,
          undefined,
          undefined,
          undefined,
          'settings'
        );
        
        return [...items, loginItem, createProjectItem, settingsItem];
      }

      // Logged in - show user info and actions
      const userInfo = await this.getUserInfo();
      if (userInfo) {
        const userItem = this.createItem(
          `$(account) ${userInfo.name || userInfo.email}`,
          '已登录',
          undefined,
          'user'
        );
        items.push(userItem);
      }

      // Quick actions
      const newProjectItem = this.createItem(
        '$(add) 新建项目',
        '创建新项目',
        'codematrix.initProject',
        'action',
        undefined,
        undefined,
        undefined,
        undefined,
        'create-project'
      );
      
      const openProjectItem = this.createItem(
        '$(folder-opened) 打开项目',
        '打开已有项目',
        'codematrix.openWorkflow',
        'action',
        undefined,
        undefined,
        undefined,
        undefined,
        'open-project'
      );
      
      const settingsItem = this.createItem(
        '$(gear) 设置',
        '配置后端和 API',
        'codematrix.openSettings',
        'action',
        undefined,
        undefined,
        undefined,
        undefined,
        'settings'
      );
      
      const refreshItem = this.createItem(
        '$(refresh) 刷新',
        '刷新项目列表',
        'codematrix.refreshSidebar',
        'action',
        undefined,
        undefined,
        undefined,
        undefined,
        'refresh'
      );

      // Divider
      const dividerItem = this.createItem(
        '─── 项目 ───',
        '',
        undefined,
        'divider'
      );
      
      const projectItems = await this.getProjectItems();
      
      return [...items, newProjectItem, openProjectItem, settingsItem, refreshItem, dividerItem, ...projectItems];
    }

    // Project node: show stages + generated files
    if (element.itemType === 'project') {
      const stageItems = await this.getStageItems(element.projectId!);
      const filesRootItem = this.createItem(
        '📁 生成文件',
        'AI 生成的产物文件',
        undefined,
        'files-root',
        undefined,
        undefined,
        undefined,
        undefined,
        element.projectId!
      );
      return [...stageItems, filesRootItem];
    }

    // Files root or directory node: show file tree children
    if (element.itemType === 'files-root' || element.itemType === 'directory') {
      const projectId = element.projectId!;
      const parentPath = element.filePath || '';
      return this.getFileTreeItems(projectId, parentPath);
    }

    // Stage node: no children
    if (element.itemType === 'stage' && element.projectId) {
      return [];
    }

    // File node: no children
    if (element.itemType === 'file') {
      return [];
    }

    return [];
  }

  private async getUserInfo(): Promise<{ name: string; email: string } | null> {
    try {
      const result = await this.apiClient.getCurrentUser();
      if (result.success && result.data) {
        const user = result.data as any;
        return {
          name: user.name || user.email?.split('@')[0] || '用户',
          email: user.email || ''
        };
      }
    } catch (error) {
      logger.error('Failed to get user info', { error: String(error) });
    }
    return null;
  }

  private async getProjectItems(): Promise<WorkflowTreeItem[]> {
    try {
      const result = await this.apiClient.getProjects();

      if (!result.success || !result.data || result.data.length === 0) {
        return [this.createItem('暂无项目', '点击「打开 CodeMatrix Studio」开始', 'codematrix.openMain', 'command')];
      }

      return result.data.map((project: { id: string; name: string }) =>
        this.createItem(
          project.name,
          '',
          'codematrix.openProjectWorkflow',
          'project',
          project.id,
          undefined,
          undefined,
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
        return [this.createItem('暂无工作流', '启动工作流查看各阶段', undefined, 'info')];
      }

      const workflow = result.data as any;
      const stages = workflow.stages || [];

      return stages.map((stage: { id: string; stageType: string; status: string; title: string; approved: boolean }) =>
        this.createItem(
          `${this.getStageEmoji(stage.stageType)} ${stage.title}`,
          this.getStatusText(stage.status, stage.approved),
          'codematrix.openWorkflowStage',
          'stage',
          stage.id,
          stage.stageType,
          stage.status,
          projectId
        )
      );
    } catch (error) {
      logger.error('Failed to load workflow', { error: String(error) });
      return [this.createItem('错误', '加载工作流失败', undefined, 'error')];
    }
  }

  private async getFileTreeItems(projectId: string, parentPath: string): Promise<WorkflowTreeItem[]> {
    try {
      // Get from cache or fetch
      let tree: FileTreeNode[];
      if (parentPath === '' && this.fileTreeCache.has(projectId)) {
        tree = this.fileTreeCache.get(projectId)!;
      } else {
        const result = await this.apiClient.getFileTree(projectId);
        if (!result.success || !result.data) {
          return [this.createItem('暂无文件', 'AI 还未生成文件', undefined, 'info', undefined, undefined, undefined, projectId)];
        }
        tree = result.data as FileTreeNode[];
        if (parentPath === '') {
          this.fileTreeCache.set(projectId, tree);
        }
      }

      // If parentPath is empty, we use the root tree, otherwise find the parent node
      let nodesToShow = tree;
      if (parentPath !== '') {
        // Find the directory in cached tree
        const findDirectory = (nodes: FileTreeNode[], targetPath: string): FileTreeNode[] | null => {
          for (const node of nodes) {
            if (node.path === targetPath && node.type === 'directory' && node.children) {
              return node.children;
            }
            if (node.children) {
              const found = findDirectory(node.children, targetPath);
              if (found) return found;
            }
          }
          return null;
        };
        const found = findDirectory(tree, parentPath);
        if (found) {
          nodesToShow = found;
        } else {
          return [];
        }
      }

      return nodesToShow.map(node => {
        const itemType = node.type === 'directory' ? 'directory' : 'file';
        const icon = this.getFileIcon(node.extension);
        return this.createFileItem(node.name, node.path, itemType, node.extension, projectId, icon);
      });
    } catch (error) {
      logger.error('Failed to load file tree', { error: String(error) });
      return [this.createItem('错误', '加载文件列表失败', undefined, 'error', undefined, undefined, undefined, projectId)];
    }
  }

  private createItem(
    label: string,
    description: string,
    commandId?: string,
    itemType?: string,
    id?: string,
    stageType?: string,
    status?: string,
    projectId?: string,
    actionType?: string
  ): WorkflowTreeItem {
    const item = new vscode.TreeItem(label);

    item.description = description;

    // Set collapsible state based on item type
    if (itemType === 'project') {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (itemType === 'files-root' || itemType === 'directory') {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (itemType === 'header' || itemType === 'user' || itemType === 'divider') {
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      item.contextValue = itemType;
    } else {
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    // Handle command with or without arguments
    if (commandId) {
      // For action items, don't pass item as argument
      if (itemType === 'action') {
        item.command = {
          command: commandId,
          title: label,
        };
      } else {
        item.command = {
          command: commandId,
          title: label,
          arguments: [item],
        };
      }
    }

    // Set icon based on type and status
    if (itemType === 'stage' && status) {
      item.iconPath = this.getStatusIcon(status);
    } else if (itemType === 'files-root') {
      item.iconPath = new vscode.ThemeIcon('folder-opened');
    }

    // Store additional data as context value
    (item as any).stageType = stageType;
    (item as any).status = status;
    (item as any).projectId = projectId;
    (item as any).itemType = itemType;

    // Set context value for menu filtering
    if (itemType === 'project') {
      item.contextValue = 'project';
    }

    return item;
  }

  private createFileItem(
    name: string,
    filePath: string,
    itemType: 'directory' | 'file',
    extension: string | undefined,
    projectId: string,
    icon: vscode.ThemeIcon
  ): WorkflowTreeItem {
    const item = new vscode.TreeItem(name);
    (item as any).filePath = filePath;
    (item as any).projectId = projectId;
    (item as any).itemType = itemType;
    item.description = '';
    item.iconPath = icon;

    if (itemType === 'directory') {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else {
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      // Add click handler to open file
      item.command = {
        command: 'codematrix.openGeneratedFile',
        title: '打开文件',
        arguments: [projectId, filePath],
      };
    }

    return item;
  }

  private getFileIcon(extension?: string): vscode.ThemeIcon {
    if (!extension) return new vscode.ThemeIcon('file');

    // VS Code theme icon mapping for common file types
    const iconMap: Record<string, string> = {
      'ts': 'code',
      'tsx': 'code',
      'js': 'code',
      'jsx': 'code',
      'html': 'browser',
      'css': 'symbol-color',
      'scss': 'symbol-color',
      'json': 'json',
      'md': 'markdown',
      'markdown': 'markdown',
      'gitignore': 'git-branch',
      'txt': 'file-text',
      'svg': 'file-media',
      'png': 'file-media',
      'jpg': 'file-media',
      'jpeg': 'file-media',
      'gif': 'file-media',
    };

    const iconName = iconMap[extension.toLowerCase()] || 'file';
    return new vscode.ThemeIcon(iconName);
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