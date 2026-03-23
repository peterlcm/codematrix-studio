import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewManager } from './webview/WebviewManager';
import { MainPanel } from './webview/MainPanel';
import { WorkflowSidebarProvider, WorkflowTreeItem } from './sidebar/WorkflowSidebarProvider';
import { ApiClient } from './services/apiClient';
import { logger } from './utils/logger';

let webviewManager: WebviewManager;
let mainPanel: MainPanel;
let sidebarProvider: WorkflowSidebarProvider;
let apiClient: ApiClient;

// Track opened generated files to handle saving back to server
const openedGeneratedFiles = new Map<string, { projectId: string; filePath: string }>();

function updateLoginContext(loggedIn: boolean) {
  vscode.commands.executeCommand('setContext', 'codematrix.isLoggedIn', loggedIn);
}

export function activate(context: vscode.ExtensionContext) {
  logger.info('CodeMatrix Studio extension activating...');

  apiClient = new ApiClient(context);

  webviewManager = new WebviewManager(context);
  webviewManager.setApiClient(apiClient);

  mainPanel = new MainPanel(context, apiClient, webviewManager);

  sidebarProvider = new WorkflowSidebarProvider(context, apiClient);
  vscode.window.registerTreeDataProvider('codematrix.workflowSidebar', sidebarProvider);

  registerCommands(context);
  registerAuthCommands(context);

  apiClient.ensureTokenLoaded().then(() => {
    updateLoginContext(apiClient.isAuthenticated());
    sidebarProvider.refresh();
  });

  logger.info('CodeMatrix Studio extension activated');
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openMain', async () => {
      try {
        await mainPanel.open();
      } catch (error) {
        logger.error('Failed to open main panel', error);
        vscode.window.showErrorMessage('无法打开 CodeMatrix Studio');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.initProject', async () => {
      try {
        const projectName = await vscode.window.showInputBox({
          prompt: '请输入项目名称',
          placeHolder: '我的新项目',
          validateInput: (value) => {
            return value.trim() ? null : '项目名称不能为空';
          },
        });

        if (!projectName) return;

        const description = await vscode.window.showInputBox({
          prompt: '请输入项目描述（可选）',
          placeHolder: '简要描述你的项目',
        });

        const result = await apiClient.createProject(projectName, description);

        if (result.success && result.data) {
          vscode.window.showInformationMessage(`项目「${projectName}」创建成功！`);
          webviewManager.openWorkflow((result.data as any).id);
        } else {
          vscode.window.showErrorMessage(`创建项目失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to initialize project', error);
        vscode.window.showErrorMessage('创建项目失败，请确保后端服务正在运行。');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openWorkflow', async () => {
      try {
        const result = await apiClient.getAllProjects();

        if (!result.success || !result.data || result.data.length === 0) {
          const createNew = await vscode.window.showInformationMessage(
            '暂无项目，是否创建新项目？',
            '创建项目',
            '取消'
          );

          if (createNew === '创建项目') {
            vscode.commands.executeCommand('codematrix.initProject');
          }
          return;
        }

        // Show quick pick with all projects including archived
        const items = (result.data || []).map((p: any) => ({
          label: p.archivedAt ? `$(archive) ${p.name} (已归档)` : p.name,
          description: p.archivedAt ? '已归档' : p.description || '',
          detail: p.archivedAt ? `归档于: ${new Date(p.archivedAt).toLocaleString()}` : '',
          project: p,
          archived: !!p.archivedAt,
        }));

        // Add action options
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '选择一个项目打开或管理',
          canPickMany: false,
        });

        if (!selected) return;

        // Show action menu for archived projects
        if (selected.archived) {
          const action = await vscode.window.showQuickPick([
            { label: '📂 打开工作流', description: '打开已归档项目', action: 'open' },
            { label: '🔓 取消归档', description: '取消归档后会显示在侧边栏', action: 'unarchive' },
            { label: '🗑️ 删除项目', description: '彻底删除，不可恢复', action: 'delete' },
          ], { placeHolder: `已归档项目 "${selected.project.name}" - 选择操作` });

          if (!action) return;

          switch (action.action) {
            case 'open':
              webviewManager.openWorkflow(selected.project.id);
              break;
            case 'unarchive': {
              const unarchiveResult = await apiClient.unarchiveProject(selected.project.id);
              if (unarchiveResult.success) {
                vscode.window.showInformationMessage('项目已取消归档，现在会显示在侧边栏');
                sidebarProvider.refresh();
              } else {
                vscode.window.showErrorMessage(`取消归档失败：${unarchiveResult.error}`);
              }
              break;
            }
            case 'delete': {
              const confirm = await vscode.window.showWarningMessage(
                `确定要彻底删除已归档项目 "${selected.project.name}" 吗？此操作不可恢复，所有生成文件都会被删除。`,
                { modal: true },
                '确认删除'
              );
              if (confirm !== '确认删除') return;

              const deleteResult = await apiClient.deleteProject(selected.project.id);
              if (deleteResult.success) {
                vscode.window.showInformationMessage('项目已删除');
                sidebarProvider.refresh();
              } else {
                vscode.window.showErrorMessage(`删除失败：${deleteResult.error}`);
              }
              break;
            }
          }
        } else {
          // Open active project directly
          webviewManager.openWorkflow(selected.project.id);
        }
      } catch (error) {
        logger.error('Failed to open workflow', { error: String(error) });
        vscode.window.showErrorMessage('打开工作流失败');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.approveStage', async () => {
      try {
        const projectId = webviewManager.getCurrentProjectId();
        if (!projectId) {
          vscode.window.showWarningMessage('请先打开一个项目的工作流。');
          return;
        }

        const feedback = await vscode.window.showInputBox({
          prompt: '添加反馈意见（可选）',
          placeHolder: '做得很好！',
        });

        const result = await apiClient.approveCurrentStage(projectId, true, feedback);

        if (result.success) {
          vscode.window.showInformationMessage('阶段已确认通过！');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`确认失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to approve stage', error);
        vscode.window.showErrorMessage('确认阶段失败');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.requestRevision', async () => {
      try {
        const projectId = webviewManager.getCurrentProjectId();
        if (!projectId) {
          vscode.window.showWarningMessage('请先打开一个项目的工作流。');
          return;
        }

        const feedback = await vscode.window.showInputBox({
          prompt: '请描述需要修改的内容',
          placeHolder: '请修改...',
          validateInput: (value) => {
            return value.trim() ? null : '请求修改时必须提供反馈意见';
          },
        });

        if (!feedback) return;

        const result = await apiClient.approveCurrentStage(projectId, false, feedback);

        if (result.success) {
          vscode.window.showInformationMessage('已请求修改');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`请求修改失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to request revision', error);
        vscode.window.showErrorMessage('请求修改失败');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openSettings', async () => {
      try {
        webviewManager.openSettings();
      } catch (error) {
        logger.error('Failed to open settings', error);
      }
    })
  );
}

function registerAuthCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.login', async () => {
      try {
        const email = await vscode.window.showInputBox({
          prompt: '请输入邮箱',
          placeHolder: 'you@example.com',
          validateInput: (value) => {
            return value.includes('@') ? null : '请输入有效的邮箱地址';
          },
        });

        if (!email) return;

        const password = await vscode.window.showInputBox({
          prompt: '请输入密码',
          placeHolder: '密码',
          password: true,
        });

        if (!password) return;

        const result = await apiClient.login(email, password);

        if (result.success) {
          const token = (result.data as any)?.token;
          if (token) {
            await context.secrets.store('authToken', token);
            apiClient.setAuthToken(token);
          }
          updateLoginContext(true);
          sidebarProvider.refresh();
          vscode.window.showInformationMessage('登录成功！');
        } else {
          vscode.window.showErrorMessage(`登录失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Login failed', error);
        vscode.window.showErrorMessage('登录失败，请确保后端服务正在运行。');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.logout', async () => {
      try {
        await apiClient.logout();
        await context.secrets.delete('authToken');
        updateLoginContext(false);
        sidebarProvider.refresh();
        vscode.window.showInformationMessage('已退出登录');
      } catch (error) {
        logger.error('Logout failed', error);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.refreshSidebar', () => {
      sidebarProvider.refresh();
    })
  );

  // Open project workflow from sidebar stage node or project node
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openWorkflowStage', async (item: WorkflowTreeItem) => {
      try {
        const projectId = item.projectId;
        if (!projectId) {
          vscode.window.showErrorMessage('无法获取项目 ID');
          logger.error('Cannot open workflow: no projectId on item', { item });
          return;
        }
        await webviewManager.openWorkflow(projectId);
        logger.info(`Opened workflow for project ${projectId}`);
      } catch (error) {
        logger.error('Failed to open workflow', { error: String(error) });
        vscode.window.showErrorMessage('打开工作流失败');
      }
    })
  );

  // Also allow clicking project node to open workflow
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openProjectWorkflow', async (item: WorkflowTreeItem) => {
      try {
        const projectId = item.projectId;
        if (!projectId) {
          vscode.window.showErrorMessage('无法获取项目 ID');
          return;
        }
        await webviewManager.openWorkflow(projectId);
        logger.info(`Opened workflow for project ${projectId}`);
      } catch (error) {
        logger.error('Failed to open workflow', { error: String(error) });
        vscode.window.showErrorMessage('打开工作流失败');
      }
    })
  );

  // Archive project from sidebar context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.archiveProject', async (item: WorkflowTreeItem) => {
      try {
        const projectId = item.projectId;
        if (!projectId) {
          vscode.window.showErrorMessage('无法获取项目 ID');
          return;
        }

        const result = await apiClient.archiveProject(projectId);
        if (result.success) {
          vscode.window.showInformationMessage('项目已归档');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`归档失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to archive project', { error: String(error) });
        vscode.window.showErrorMessage('归档失败');
      }
    })
  );

  // Unarchive project (not used since archived projects are filtered from sidebar)
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.unarchiveProject', async (item: WorkflowTreeItem) => {
      try {
        const projectId = item.projectId;
        if (!projectId) {
          vscode.window.showErrorMessage('无法获取项目 ID');
          return;
        }

        const result = await apiClient.unarchiveProject(projectId);
        if (result.success) {
          vscode.window.showInformationMessage('项目已取消归档');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`取消归档失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to unarchive project', { error: String(error) });
        vscode.window.showErrorMessage('取消归档失败');
      }
    })
  );

  // Delete project from sidebar context menu (only archived projects can be deleted)
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.deleteProject', async (item: WorkflowTreeItem) => {
      try {
        const projectId = item.projectId;
        if (!projectId) {
          vscode.window.showErrorMessage('无法获取项目 ID');
          return;
        }

        // Confirm deletion
        const confirm = await vscode.window.showWarningMessage(
          '确定要彻底删除这个项目吗？此操作不可恢复，所有生成的文件都会被删除。',
          { modal: true },
          '确认删除'
        );

        if (confirm !== '确认删除') {
          return;
        }

        const result = await apiClient.deleteProject(projectId);
        if (result.success) {
          vscode.window.showInformationMessage('项目已删除');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`删除失败：${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to delete project', { error: String(error) });
        vscode.window.showErrorMessage('删除失败');
      }
    })
  );

  // Open generated file in VS Code editor
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openGeneratedFile', async (projectId: string, filePath: string) => {
      try {
        const result = await apiClient.readFile(projectId, filePath);
        if (!result.success || typeof result.data?.content !== 'string') {
          vscode.window.showErrorMessage(`无法读取文件：${result.error}`);
          return;
        }

        // Create a temporary file in the extension's storage
        const storageDir = context.globalStorageUri.fsPath;
        const projectTempDir = path.join(storageDir, 'generated', projectId);
        const tempFilePath = path.join(projectTempDir, filePath);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(tempFilePath))) {
          fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
        }

        // Write content to temp file
        fs.writeFileSync(tempFilePath, result.data.content, 'utf-8');

        // Track this file for saving back later
        openedGeneratedFiles.set(tempFilePath, { projectId, filePath });

        // Open the file in VS Code
        const document = await vscode.workspace.openTextDocument(tempFilePath);
        await vscode.window.showTextDocument(document);

        logger.info(`Opened generated file: ${filePath}`);
      } catch (error) {
        logger.error('Failed to open generated file', error);
        vscode.window.showErrorMessage('打开文件失败');
      }
    })
  );
}

// Save modified generated file back to server when user saves
vscode.workspace.onDidSaveTextDocument(async (document) => {
  const filePath = document.uri.fsPath;
  const fileInfo = openedGeneratedFiles.get(filePath);
  if (!fileInfo) return;

  try {
    const content = document.getText();
    const result = await apiClient.writeFile(fileInfo.projectId, fileInfo.filePath, content);
    if (result.success) {
      vscode.window.showInformationMessage(`文件已保存到后端: ${fileInfo.filePath}`);
      logger.info(`Saved modified file back to server: ${fileInfo.filePath}`);
    } else {
      vscode.window.showErrorMessage(`保存失败: ${result.error}`);
    }
  } catch (error) {
    logger.error('Failed to save generated file', error);
    vscode.window.showErrorMessage('保存文件失败');
  }
});

// Clean up when document is closed
vscode.workspace.onDidCloseTextDocument((document) => {
  const filePath = document.uri.fsPath;
  openedGeneratedFiles.delete(filePath);
});

export function deactivate() {
  logger.info('CodeMatrix Studio extension deactivated');
  webviewManager?.dispose();
}
