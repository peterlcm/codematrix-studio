import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../services/apiClient';
import { WebviewManager } from './WebviewManager';
import { logger } from '../utils/logger';

export class MainPanel {
  private context: vscode.ExtensionContext;
  private panel: vscode.WebviewPanel | undefined;
  private apiClient: ApiClient;
  private webviewManager: WebviewManager;

  constructor(context: vscode.ExtensionContext, apiClient: ApiClient, webviewManager: WebviewManager) {
    this.context = context;
    this.apiClient = apiClient;
    this.webviewManager = webviewManager;
  }

  async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'codematrix.main',
      'CodeMatrix Studio',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
        ],
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    await this.loadContent();
  }

  private async loadContent(): Promise<void> {
    if (!this.panel) return;

    // Wait for token to be loaded from secrets
    await this.apiClient.ensureTokenLoaded();

    const isAuthenticated = !!this.apiClient.getToken();
    logger.info('Loading content', { isAuthenticated, hasToken: !!this.apiClient.getToken() });

    const html = this.getHtml(isAuthenticated);
    this.panel.webview.html = html;

    if (isAuthenticated) {
      // Send projects data
      await this.sendProjects();
    }
  }

  private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    switch (message.type) {
      case 'login':
        await this.handleLogin(message.payload as { email: string; password: string });
        break;
      case 'register':
        await this.handleRegister(message.payload as { email: string; password: string; name: string });
        break;
      case 'logout':
        await this.handleLogout();
        break;
      case 'createProject':
        await this.handleCreateProject(message.payload as { name: string; description?: string });
        break;
      case 'openProject':
        await this.handleOpenProject(message.payload as { projectId: string });
        break;
      case 'refresh':
        await this.sendProjects();
        break;
    }
  }

  private async handleLogin(payload: { email: string; password: string }): Promise<void> {
    try {
      const result = await this.apiClient.login(payload.email, payload.password);

      if (result.success) {
        logger.info('User logged in');
        // Save token to VS Code secrets
        const token = (result.data as any)?.token;
        if (token) {
          await this.apiClient.saveAuthToken(token);
        }
        await this.loadContent();
        this.panel?.webview.postMessage({ type: 'loggedIn', payload: result.data });
      } else {
        this.panel?.webview.postMessage({ type: 'error', payload: { message: result.error || 'Login failed' } });
      }
    } catch (error) {
      logger.error('Login error', { error: String(error) });
      this.panel?.webview.postMessage({ type: 'error', payload: { message: String(error) } });
    }
  }

  private async handleRegister(payload: { email: string; password: string; name: string }): Promise<void> {
    try {
      const result = await this.apiClient.register(payload.email, payload.password, payload.name);

      if (result.success) {
        logger.info('User registered');
        // Save token to VS Code secrets
        const token = (result.data as any)?.token;
        if (token) {
          await this.apiClient.saveAuthToken(token);
        }
        await this.loadContent();
        this.panel?.webview.postMessage({ type: 'registered', payload: result.data });
      } else {
        this.panel?.webview.postMessage({ type: 'error', payload: { message: result.error || 'Registration failed' } });
      }
    } catch (error) {
      logger.error('Registration error', { error: String(error) });
      this.panel?.webview.postMessage({ type: 'error', payload: { message: String(error) } });
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await this.apiClient.logout();
      await this.apiClient.clearAuthToken();
      await this.loadContent();
      this.panel?.webview.postMessage({ type: 'loggedOut' });
    } catch (error) {
      logger.error('Logout error', { error: String(error) });
      // Still try to clear local state
      await this.apiClient.clearAuthToken();
      await this.loadContent();
      this.panel?.webview.postMessage({ type: 'loggedOut' });
    }
  }

  private async handleCreateProject(payload: { name: string; description?: string }): Promise<void> {
    try {
      const result = await this.apiClient.createProject(payload.name, payload.description);

      if (result.success && result.data) {
        logger.info('Project created', { projectId: result.data.id });
        await this.sendProjects();
        this.panel?.webview.postMessage({ type: 'projectCreated', payload: result.data });
      } else {
        this.panel?.webview.postMessage({ type: 'error', payload: { message: result.error || 'Failed to create project' } });
      }
    } catch (error) {
      logger.error('Create project error', { error: String(error) });
      this.panel?.webview.postMessage({ type: 'error', payload: { message: String(error) } });
    }
  }

  private async handleOpenProject(payload: { projectId: string }): Promise<void> {
    await this.webviewManager.openWorkflow(payload.projectId);
  }

  private async sendProjects(): Promise<void> {
    try {
      const result = await this.apiClient.getProjects();
      if (result.success && result.data) {
        this.panel?.webview.postMessage({ type: 'projects', payload: result.data });
      }
    } catch (error) {
      logger.error('Failed to get projects', { error: String(error) });
    }
  }

  private getHtml(isAuthenticated: boolean): string {
    const backendUrl = vscode.workspace.getConfiguration('codematrix').get<string>('backendUrl', 'http://localhost:3001');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMatrix Studio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { margin-bottom: 20px; font-size: 24px; }
    .card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: 500; }
    input {
      width: 100%;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
    }
    input:focus { outline: 1px solid var(--vscode-focusBorder); }
    .btn {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 10px;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); }
    .btn-primary { background: var(--vscode-button-background); }
    .error { color: var(--vscode-errorForeground); margin-top: 10px; }
    .success { color: var(--vscode-terminal-ansiGreen); margin-top: 10px; }
    .project-list { margin-top: 20px; }
    .project-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: var(--vscode-list-hoverBackground);
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .project-item:hover { background: var(--vscode-list-activeSelectionBackground); }
    .project-name { font-weight: 500; }
    .project-date { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .user-info { color: var(--vscode-descriptionForeground); }
    .tabs { display: flex; border-bottom: 1px solid var(--vscode-focusBorder); margin-bottom: 20px; }
    .tab { padding: 10px 20px; cursor: pointer; border: none; background: none; color: var(--vscode-editor-foreground); }
    .tab.active { border-bottom: 2px solid var(--vscode-button-background); }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CodeMatrix Studio</h1>
      <div id="userInfo" class="${isAuthenticated ? '' : 'hidden'}">
        <span class="user-info" id="userEmail"></span>
        <button class="btn btn-secondary" onclick="logout()">Logout</button>
      </div>
    </div>

    <!-- Auth Section -->
    <div id="authSection" class="${isAuthenticated ? 'hidden' : ''}">
      <div class="tabs">
        <button class="tab active" onclick="showTab('login')">Login</button>
        <button class="tab" onclick="showTab('register')">Register</button>
      </div>

      <!-- Login Form -->
      <div id="loginTab">
        <div class="card">
          <h2>Login</h2>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="loginEmail" placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="loginPassword" placeholder="Password">
          </div>
          <button class="btn btn-primary" onclick="login()">Login</button>
          <div id="loginError" class="error"></div>
        </div>
      </div>

      <!-- Register Form -->
      <div id="registerTab" class="hidden">
        <div class="card">
          <h2>Register</h2>
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="registerName" placeholder="Your Name">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="registerEmail" placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="registerPassword" placeholder="Password">
          </div>
          <button class="btn btn-primary" onclick="register()">Register</button>
          <div id="registerError" class="error"></div>
        </div>
      </div>
    </div>

    <!-- Projects Section -->
    <div id="projectsSection" class="${isAuthenticated ? '' : 'hidden'}">
      <div class="card">
        <h2>Create New Project</h2>
        <div class="form-group">
          <label>Project Name</label>
          <input type="text" id="projectName" placeholder="My Project">
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" id="projectDescription" placeholder="Project description">
        </div>
        <button class="btn btn-primary" onclick="createProject()">Create Project</button>
        <div id="createProjectError" class="error"></div>
        <div id="createProjectSuccess" class="success"></div>
      </div>

      <h2>Your Projects</h2>
      <div id="projectList" class="project-list">
        <p>Loading projects...</p>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function showTab(tab) {
      document.getElementById('loginTab').classList.toggle('hidden', tab !== 'login');
      document.getElementById('registerTab').classList.toggle('hidden', tab !== 'register');
      document.querySelectorAll('.tab').forEach((el, i) => {
        el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
      });
    }

    function login() {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        document.getElementById('loginError').textContent = 'Please fill in all fields';
        return;
      }

      vscode.postMessage({ type: 'login', payload: { email, password } });
    }

    function register() {
      const name = document.getElementById('registerName').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;

      if (!name || !email || !password) {
        document.getElementById('registerError').textContent = 'Please fill in all fields';
        return;
      }

      vscode.postMessage({ type: 'register', payload: { name, email, password } });
    }

    function logout() {
      vscode.postMessage({ type: 'logout' });
    }

    function createProject() {
      const name = document.getElementById('projectName').value;
      const description = document.getElementById('projectDescription').value;

      if (!name) {
        document.getElementById('createProjectError').textContent = 'Please enter a project name';
        return;
      }

      document.getElementById('createProjectError').textContent = '';
      document.getElementById('createProjectSuccess').textContent = '';
      vscode.postMessage({ type: 'createProject', payload: { name, description } });
    }

    function openProject(projectId) {
      vscode.postMessage({ type: 'openProject', payload: { projectId } });
    }

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'projects') {
        renderProjects(message.payload);
      } else if (message.type === 'loggedIn' || message.type === 'registered') {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('projectsSection').classList.remove('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('userEmail').textContent = message.payload?.user?.email || '';
      } else if (message.type === 'loggedOut') {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('projectsSection').classList.add('hidden');
        document.getElementById('userInfo').classList.add('hidden');
      } else if (message.type === 'error') {
        const errorEl = document.querySelector('.card:not(.hidden) .error');
        if (errorEl) errorEl.textContent = message.payload?.message || 'An error occurred';
      } else if (message.type === 'projectCreated') {
        document.getElementById('createProjectSuccess').textContent = 'Project created!';
        document.getElementById('projectName').value = '';
        document.getElementById('projectDescription').value = '';
        vscode.postMessage({ type: 'refresh' });
      }
    });

    function renderProjects(projects) {
      const container = document.getElementById('projectList');
      if (!projects || projects.length === 0) {
        container.innerHTML = '<p>No projects yet. Create one above!</p>';
        return;
      }

      let html = '';
      for (const p of projects) {
        html += '<div class="project-item" onclick="openProject(\'' + p.id + '\')">' +
          '<div><div class="project-name">' + p.name + '</div>' +
          '<div class="project-date">Created: ' + new Date(p.createdAt).toLocaleDateString() + '</div></div>' +
          '<button class="btn btn-primary">Open</button></div>';
      }
      container.innerHTML = html;
    }

    // Request initial data if authenticated
    vscode.postMessage({ type: 'refresh' });
  </script>
</body>
</html>`;
  }
}