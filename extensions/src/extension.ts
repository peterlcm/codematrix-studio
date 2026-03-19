import * as vscode from 'vscode';
import { WebviewManager } from './webview/WebviewManager';
import { MainPanel } from './webview/MainPanel';
import { WorkflowSidebarProvider } from './sidebar/WorkflowSidebarProvider';
import { ApiClient } from './services/apiClient';
import { logger } from './utils/logger';

let webviewManager: WebviewManager;
let mainPanel: MainPanel;
let sidebarProvider: WorkflowSidebarProvider;
let apiClient: ApiClient;

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
        const projects = await apiClient.getProjects();

        if (!projects.success || !projects.data || projects.data.length === 0) {
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

        const selected = await vscode.window.showQuickPick(
          (projects.data || []).map((p: any) => ({
            label: p.name,
            project: p,
          })),
          { placeHolder: '选择一个项目' }
        );

        if (selected) {
          webviewManager.openWorkflow(selected.project.id);
        }
      } catch (error) {
        logger.error('Failed to open workflow', error);
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
}

export function deactivate() {
  logger.info('CodeMatrix Studio extension deactivated');
  webviewManager?.dispose();
}
