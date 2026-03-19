import * as vscode from 'vscode';
import { WebviewManager } from './webview/WebviewManager';
import { MainPanel } from './webview/MainPanel';
import { WorkflowSidebarProvider } from './sidebar/WorkflowSidebarProvider';
import { ApiClient } from './services/apiClient';
import { logger } from './utils/logger';

// Global references to prevent garbage collection
let webviewManager: WebviewManager;
let mainPanel: MainPanel;
let sidebarProvider: WorkflowSidebarProvider;
let apiClient: ApiClient;

export function activate(context: vscode.ExtensionContext) {
  logger.info('CodeMatrix Studio extension activating...');

  // Initialize API client
  apiClient = new ApiClient(context);

  // Initialize webview manager
  webviewManager = new WebviewManager(context);

  // Initialize main panel (for login/project UI)
  mainPanel = new MainPanel(context, apiClient, webviewManager);

  // Initialize sidebar provider
  sidebarProvider = new WorkflowSidebarProvider(context, apiClient);
  vscode.window.registerTreeDataProvider('codematrix.workflowSidebar', sidebarProvider);

  // Register commands
  registerCommands(context);

  // Register authentication commands
  registerAuthCommands(context);

  logger.info('CodeMatrix Studio extension activated');
}

function registerCommands(context: vscode.ExtensionContext) {
  // Open main panel (login, projects, etc.)
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openMain', async () => {
      try {
        await mainPanel.open();
      } catch (error) {
        logger.error('Failed to open main panel', error);
        vscode.window.showErrorMessage('Failed to open CodeMatrix Studio');
      }
    })
  );

  // Initialize new project
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.initProject', async () => {
      try {
        const projectName = await vscode.window.showInputBox({
          prompt: 'Enter project name',
          placeHolder: 'My Awesome Project',
          validateInput: (value) => {
            return value.trim() ? null : 'Project name is required';
          },
        });

        if (!projectName) return;

        const description = await vscode.window.showInputBox({
          prompt: 'Enter project description (optional)',
          placeHolder: 'A brief description of your project',
        });

        // Create project via API
        const result = await apiClient.createProject(projectName, description);

        if (result.success && result.data) {
          vscode.window.showInformationMessage(`Project "${projectName}" created successfully!`);

          // Open the workflow webview
          webviewManager.openWorkflow((result.data as any).id);
        } else {
          vscode.window.showErrorMessage(`Failed to create project: ${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to initialize project', error);
        vscode.window.showErrorMessage('Failed to initialize project. Make sure the backend is running.');
      }
    })
  );

  // Open workflow
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openWorkflow', async () => {
      try {
        // Show project picker
        const projects = await apiClient.getProjects();

        if (!projects.success || !projects.data || projects.data.length === 0) {
          const createNew = await vscode.window.showInformationMessage(
            'No projects found. Create a new project?',
            'Create Project',
            'Cancel'
          );

          if (createNew === 'Create Project') {
            vscode.commands.executeCommand('codematrix.initProject');
          }
          return;
        }

        const selected = await vscode.window.showQuickPick(
          (projects.data || []).map((p: any) => ({
            label: p.name,
            project: p,
          })),
          { placeHolder: 'Select a project' }
        );

        if (selected) {
          webviewManager.openWorkflow(selected.project.id);
        }
      } catch (error) {
        logger.error('Failed to open workflow', error);
        vscode.window.showErrorMessage('Failed to open workflow');
      }
    })
  );

  // Approve current stage
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.approveStage', async () => {
      try {
        const projectId = webviewManager.getCurrentProjectId();
        if (!projectId) {
          vscode.window.showWarningMessage('No project selected. Open a workflow first.');
          return;
        }

        const feedback = await vscode.window.showInputBox({
          prompt: 'Add feedback (optional)',
          placeHolder: 'Great work!',
        });

        const result = await apiClient.approveCurrentStage(projectId, true, feedback);

        if (result.success) {
          vscode.window.showInformationMessage('Stage approved!');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`Failed to approve: ${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to approve stage', error);
        vscode.window.showErrorMessage('Failed to approve stage');
      }
    })
  );

  // Request revision
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.requestRevision', async () => {
      try {
        const projectId = webviewManager.getCurrentProjectId();
        if (!projectId) {
          vscode.window.showWarningMessage('No project selected. Open a workflow first.');
          return;
        }

        const feedback = await vscode.window.showInputBox({
          prompt: 'Describe the changes needed',
          placeHolder: 'Please revise the...',
          validateInput: (value) => {
            return value.trim() ? null : 'Feedback is required when requesting revision';
          },
        });

        if (!feedback) return;

        const result = await apiClient.approveCurrentStage(projectId, false, feedback);

        if (result.success) {
          vscode.window.showInformationMessage('Revision requested');
          sidebarProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`Failed to request revision: ${result.error}`);
        }
      } catch (error) {
        logger.error('Failed to request revision', error);
        vscode.window.showErrorMessage('Failed to request revision');
      }
    })
  );

  // Open settings
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.openSettings', async () => {
      try {
        // Get backend URL from settings
        const config = vscode.workspace.getConfiguration('codematrix');
        const backendUrl = config.get<string>('backendUrl', 'http://localhost:3001');

        // Open webview with settings
        webviewManager.openSettings();
      } catch (error) {
        logger.error('Failed to open settings', error);
      }
    })
  );
}

function registerAuthCommands(context: vscode.ExtensionContext) {
  // Login
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.login', async () => {
      try {
        const email = await vscode.window.showInputBox({
          prompt: 'Enter your email',
          placeHolder: 'you@example.com',
          validateInput: (value) => {
            return value.includes('@') ? null : 'Please enter a valid email';
          },
        });

        if (!email) return;

        const password = await vscode.window.showInputBox({
          prompt: 'Enter your password',
          placeHolder: 'Password',
          password: true,
        });

        if (!password) return;

        const result = await apiClient.login(email, password);

        if (result.success) {
          // Save token to extension global state
          const token = (result.data as any)?.token;
          if (token) {
            await context.secrets.store('authToken', token);
            apiClient.setAuthToken(token);
          }
          vscode.window.showInformationMessage('Logged in successfully!');
        } else {
          vscode.window.showErrorMessage(`Login failed: ${result.error}`);
        }
      } catch (error) {
        logger.error('Login failed', error);
        vscode.window.showErrorMessage('Login failed. Make sure the backend is running.');
      }
    })
  );

  // Logout
  context.subscriptions.push(
    vscode.commands.registerCommand('codematrix.logout', async () => {
      try {
        await apiClient.logout();
        await context.secrets.delete('authToken');
        vscode.window.showInformationMessage('Logged out successfully');
      } catch (error) {
        logger.error('Logout failed', error);
      }
    })
  );
}

export function deactivate() {
  logger.info('CodeMatrix Studio extension deactivated');
  webviewManager?.dispose();
}