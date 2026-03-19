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
      await this.loadContent();
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

    await this.apiClient.ensureTokenLoaded();

    const isAuthenticated = !!this.apiClient.getToken();
    logger.info('Loading content', { isAuthenticated });

    let projects: any[] = [];
    if (isAuthenticated) {
      try {
        const result = await this.apiClient.getProjects();
        if (result.success && Array.isArray(result.data)) {
          projects = result.data;
        }
      } catch (error) {
        logger.error('Failed to fetch projects for panel', { error: String(error) });
      }
    }

    const html = this.getHtml(isAuthenticated, projects);
    this.panel.webview.html = html;
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
        const token = (result.data as any)?.token;
        if (token) {
          await this.apiClient.saveAuthToken(token);
          vscode.commands.executeCommand('setContext', 'codematrix.isLoggedIn', true);
        }
        await this.loadContent();
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
        const token = (result.data as any)?.token;
        if (token) {
          await this.apiClient.saveAuthToken(token);
          vscode.commands.executeCommand('setContext', 'codematrix.isLoggedIn', true);
        }
        await this.loadContent();
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
    } catch (error) {
      logger.error('Logout error', { error: String(error) });
    }
    await this.apiClient.clearAuthToken();
    vscode.commands.executeCommand('setContext', 'codematrix.isLoggedIn', false);
    await this.loadContent();
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
      } else {
        this.panel?.webview.postMessage({ type: 'projects', payload: [] });
        if (result.error) {
          logger.warn('Failed to fetch projects from API', { error: result.error });
        }
      }
    } catch (error) {
      logger.error('Failed to get projects', { error: String(error) });
      this.panel?.webview.postMessage({ type: 'projects', payload: [] });
      this.panel?.webview.postMessage({
        type: 'error',
        payload: { message: 'Failed to load projects. Is the backend running?' },
      });
    }
  }

  private getHtml(isAuthenticated: boolean, projects: any[] = []): string {
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
        <button class="btn btn-secondary" onclick="logout()">退出登录</button>
      </div>
    </div>

    <div id="authSection" class="${isAuthenticated ? 'hidden' : ''}">
      <div class="tabs">
        <button class="tab active" onclick="showTab('login')">登录</button>
        <button class="tab" onclick="showTab('register')">注册</button>
      </div>

      <div id="loginTab">
        <div class="card">
          <h2>登录</h2>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" id="loginEmail" placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" id="loginPassword" placeholder="请输入密码">
          </div>
          <button class="btn btn-primary" onclick="login()">登录</button>
          <div id="loginError" class="error"></div>
        </div>
      </div>

      <div id="registerTab" class="hidden">
        <div class="card">
          <h2>注册</h2>
          <div class="form-group">
            <label>姓名</label>
            <input type="text" id="registerName" placeholder="你的姓名">
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" id="registerEmail" placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" id="registerPassword" placeholder="请输入密码">
          </div>
          <button class="btn btn-primary" onclick="register()">注册</button>
          <div id="registerError" class="error"></div>
        </div>
      </div>
    </div>

    <div id="projectsSection" class="${isAuthenticated ? '' : 'hidden'}">
      <div class="card">
        <h2>创建新项目</h2>
        <div class="form-group">
          <label>项目名称</label>
          <input type="text" id="projectName" placeholder="我的项目">
        </div>
        <div class="form-group">
          <label>项目描述（可选）</label>
          <input type="text" id="projectDescription" placeholder="简要描述你的项目">
        </div>
        <button class="btn btn-primary" onclick="createProject()">创建项目</button>
        <div id="createProjectError" class="error"></div>
        <div id="createProjectSuccess" class="success"></div>
      </div>

      <h2>我的项目</h2>
      <div id="projectList" class="project-list"></div>
    </div>
  </div>

  <script>
    (function() {
      var vscode = acquireVsCodeApi();
      var initialProjects = ${JSON.stringify(projects)};

      function postMsg(type, payload) {
        vscode.postMessage({ type: type, payload: payload });
      }

      function renderProjects(projects) {
        var container = document.getElementById('projectList');
        if (!container) return;
        if (!projects || projects.length === 0) {
          container.innerHTML = '<p>暂无项目，请在上方创建。</p>';
          return;
        }
        container.innerHTML = projects.map(function(p) {
          return '<div class="project-item" data-id="' + p.id + '">' +
            '<div><div class="project-name">' + (p.name || '') + '</div>' +
            '<div class="project-date">创建于：' + new Date(p.createdAt).toLocaleDateString() + '</div></div>' +
            '<button class="btn btn-primary">打开</button></div>';
        }).join('');

        container.querySelectorAll('.project-item').forEach(function(el) {
          el.addEventListener('click', function() {
            postMsg('openProject', { projectId: el.getAttribute('data-id') });
          });
        });
      }

      window.showTab = function(tab) {
        document.getElementById('loginTab').classList.toggle('hidden', tab !== 'login');
        document.getElementById('registerTab').classList.toggle('hidden', tab !== 'register');
        document.querySelectorAll('.tab').forEach(function(el, i) {
          el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
        });
      };
      window.login = function() {
        var email = document.getElementById('loginEmail').value;
        var password = document.getElementById('loginPassword').value;
        if (!email || !password) { document.getElementById('loginError').textContent = '请填写所有字段'; return; }
        postMsg('login', { email: email, password: password });
      };
      window.register = function() {
        var name = document.getElementById('registerName').value;
        var email = document.getElementById('registerEmail').value;
        var password = document.getElementById('registerPassword').value;
        if (!name || !email || !password) { document.getElementById('registerError').textContent = '请填写所有字段'; return; }
        postMsg('register', { name: name, email: email, password: password });
      };
      window.logout = function() { postMsg('logout'); };
      window.createProject = function() {
        var name = document.getElementById('projectName').value;
        var description = document.getElementById('projectDescription').value;
        if (!name) { document.getElementById('createProjectError').textContent = '请输入项目名称'; return; }
        document.getElementById('createProjectError').textContent = '';
        document.getElementById('createProjectSuccess').textContent = '';
        postMsg('createProject', { name: name, description: description });
      };

      window.addEventListener('message', function(event) {
        var message = event.data;
        if (message.type === 'projects') {
          renderProjects(message.payload);
        } else if (message.type === 'error') {
          var errorEl = document.querySelector('.error');
          if (errorEl) errorEl.textContent = (message.payload && message.payload.message) || '发生错误';
        } else if (message.type === 'projectCreated') {
          document.getElementById('createProjectSuccess').textContent = '项目创建成功！';
          document.getElementById('projectName').value = '';
          document.getElementById('projectDescription').value = '';
          postMsg('refresh');
        }
      });

      renderProjects(initialProjects);
    })();
  </script>
</body>
</html>`;
  }
}