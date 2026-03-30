import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MessageBus, MessageHandler } from './MessageBus';
import { ApiClient } from '../services/apiClient';
import { logger } from '../utils/logger';

export class WebviewManager implements MessageHandler {
  private context: vscode.ExtensionContext;
  private panel: vscode.WebviewPanel | undefined;
  private messageBus: MessageBus;
  private currentProjectId: string | undefined;
  private apiClient: ApiClient | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.messageBus = new MessageBus(this);

    // Register handler for messages from webview
    this.messageBus.on('openProject', async (data: any) => {
      this.currentProjectId = data.projectId;
    });

    this.messageBus.on('authenticated', async (data) => {
      // Handle auth responses
      logger.info('Authentication response received', { data });
    });
  }

  async openWorkflow(projectId: string): Promise<void> {
    this.currentProjectId = projectId;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      const distPath = this.getWebviewDistPath();
      this.panel = vscode.window.createWebviewPanel(
        'codematrix.workflow',
        'CodeMatrix Workflow',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
            ...(distPath ? [vscode.Uri.file(distPath)] : []),
          ],
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage(async (message) => {
        await this.messageBus.handleMessage(message);
      });
    }

    await this.loadWebviewContent(projectId);
  }

  private getWebviewDistPath(): string | undefined {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const candidates = [
      workspaceRoot ? path.join(workspaceRoot, 'webview-ui', 'dist') : '',
      path.join(this.context.extensionPath, '..', 'webview-ui', 'dist'),
      path.join(this.context.extensionPath, '..', '..', 'webview-ui', 'dist'),
    ].filter(Boolean);

    for (const p of candidates) {
      try {
        if (fs.existsSync(path.join(p, 'index.html'))) {
          return p;
        }
      } catch { /* ignore */ }
    }
    return candidates[0] || undefined;
  }

  async openSettings(): Promise<void> {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'codematrix.settings',
        'CodeMatrix Settings',
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
        await this.handleSettingsMessage(message);
      });
    } else {
      this.panel.reveal(vscode.ViewColumn.One);
    }

    this.panel.webview.html = await this.getSettingsHtml();
  }

  private async handleSettingsMessage(message: { type: string; payload?: unknown }): Promise<void> {
    switch (message.type) {
      case 'settings:save': {
        const { backendUrl, apiKey } = message.payload as { backendUrl: string; apiKey: string };
        
        // Save backend URL to configuration
        const config = vscode.workspace.getConfiguration('codematrix');
        await config.update('backendUrl', backendUrl, vscode.ConfigurationTarget.Global);
        
        // Save API key to secrets
        if (apiKey) {
          await this.context.secrets.store('apiKey', apiKey);
        }
        
        vscode.window.showInformationMessage('设置已保存！');
        break;
      }
      case 'settings:load': {
        // Load current settings
        const config = vscode.workspace.getConfiguration('codematrix');
        const backendUrl = config.get<string>('backendUrl', 'http://localhost:3001');
        let apiKey = '';
        try {
          apiKey = (await this.context.secrets.get('apiKey')) || '';
        } catch {
          // Secrets not available
        }
        
        this.panel?.webview.postMessage({
          type: 'settings:loaded',
          payload: { backendUrl, apiKey: apiKey ? '******' : '' }
        });
        break;
      }
    }
  }

  private async getSettingsHtml(): Promise<string> {
    // Load current settings
    const config = vscode.workspace.getConfiguration('codematrix');
    const backendUrl = config.get<string>('backendUrl', 'http://localhost:3001');
    let apiKey = '';
    try {
      apiKey = (await this.context.secrets.get('apiKey')) || '';
    } catch {
      // Secrets not available
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMatrix Settings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      padding: 24px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
    .setting { margin-bottom: 20px; }
    .setting label { display: block; margin-bottom: 8px; font-weight: 500; }
    .setting input {
      width: 100%;
      padding: 10px 12px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 14px;
    }
    .setting input:focus { outline: 1px solid var(--vscode-focusBorder); }
    .setting .hint { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
    .btn {
      padding: 10px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); }
    .section { 
      background: var(--vscode-editorWidget-background); 
      border-radius: 8px; 
      padding: 20px; 
      margin-bottom: 20px; 
    }
    .section-title { 
      font-size: 14px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      color: var(--vscode-editorWidget-foreground); 
    }
    .status { 
      padding: 12px; 
      border-radius: 4px; 
      font-size: 13px; 
      margin-bottom: 20px; 
    }
    .status.connected { background: rgba(46, 125, 50, 0.2); color: #4ec9b0; }
    .status.disconnected { background: rgba(218, 45, 46, 0.2); color: #f14c4c; }
    .success { color: #4ec9b0; }
    .error { color: #f14c4c; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚙️ CodeMatrix 设置</h1>
    
    <div id="status" class="status disconnected">
      检查后端连接...
    </div>

    <div class="section">
      <div class="section-title">后端配置</div>
      <div class="setting">
        <label>后端服务器地址</label>
        <input type="text" id="backendUrl" value="${backendUrl}" placeholder="http://localhost:3001" />
        <div class="hint">CodeMatrix Studio 后端服务的 URL 地址</div>
      </div>
      <div class="setting">
        <label>Anthropic API 密钥</label>
        <input type="password" id="apiKey" value="${apiKey ? '******' : ''}" placeholder="sk-ant-..." />
        <div class="hint">用于 AI 生成的 Anthropic API 密钥 (sk-ant-...)</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">快捷操作</div>
      <button class="btn" onclick="testConnection()">🔗 测试连接</button>
      <button class="btn btn-secondary" onclick="openMainPanel()">🚀 打开主面板</button>
    </div>

    <div class="section">
      <button class="btn" onclick="saveSettings()">💾 保存设置</button>
    </div>

    <div id="message" style="margin-top: 16px;"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentBackendUrl = '${backendUrl}';

    function showMessage(text, isError = false) {
      const el = document.getElementById('message');
      el.innerHTML = '<span class="' + (isError ? 'error' : 'success') + '">' + text + '</span>';
      setTimeout(() => { el.innerHTML = ''; }, 5000);
    }

    async function testConnection() {
      const backendUrl = document.getElementById('backendUrl').value;
      const status = document.getElementById('status');
      
      status.className = 'status';
      status.textContent = '正在连接...';
      
      try {
        const response = await fetch(backendUrl + '/health', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok || response.status === 404) {
          status.className = 'status connected';
          status.textContent = '✓ 后端服务已连接';
        } else {
          status.className = 'status disconnected';
          status.textContent = '✗ 后端连接失败: ' + response.status;
        }
      } catch (e) {
        status.className = 'status disconnected';
        status.textContent = '✗ 无法连接到后端服务: ' + e.message;
      }
    }

    function openMainPanel() {
      vscode.postMessage({ type: 'command:execute', payload: { command: 'codematrix.openMain' } });
    }

    function saveSettings() {
      const backendUrl = document.getElementById('backendUrl').value;
      const apiKey = document.getElementById('apiKey').value;
      const realApiKey = apiKey === '******' ? '' : apiKey;

      vscode.postMessage({
        type: 'settings:save',
        payload: { backendUrl, apiKey: realApiKey }
      });
    }

    // Test connection on load
    window.addEventListener('load', () => {
      testConnection();
    });
  </script>
</body>
</html>`;
  }

  async loadWebviewContent(projectId: string): Promise<void> {
    if (!this.panel) return;

    // Get the backend URL from configuration
    const config = vscode.workspace.getConfiguration('codematrix');
    const backendUrl = config.get<string>('backendUrl', 'http://localhost:3001');

    // Get the webview HTML
    const html = this.getWebviewHtml(backendUrl, projectId);
    this.panel.webview.html = html;

    const token = this.apiClient?.getAuthToken();
    setTimeout(() => {
      this.panel?.webview.postMessage({
        type: 'init',
        payload: {
          projectId,
          backendUrl,
          token,
        },
      });
      logger.info('Sent init message to webview', { projectId, backendUrl, hasToken: !!token });
    }, 500);
  }

  private getWebviewHtml(backendUrl: string, projectId: string): string {
    const distPath = this.getWebviewDistPath();
    const indexPath = distPath ? path.join(distPath, 'index.html') : null;

    let html = '';
    if (indexPath) {
      try {
        html = fs.readFileSync(indexPath, 'utf8');
        logger.info('Found webview index.html', { path: indexPath });
      } catch { /* ignore */ }
    }

    if (html && this.panel?.webview) {
      const webview = this.panel.webview;

      const distUri = vscode.Uri.file(distPath!);
      const assetsPath = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'assets')).toString();

      html = html.replace(/src="\.\/assets\//g, `src="${assetsPath}/`);
      html = html.replace(/href="\.\/assets\//g, `href="${assetsPath}/`);

      html = html.replace(/ crossorigin/g, '');

      html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');

      const cspSource = webview.cspSource;
      const csp = [
        `default-src 'none'`,
        `script-src ${cspSource} 'unsafe-inline' 'unsafe-eval'`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `connect-src ${cspSource} ${backendUrl} ws://localhost:* http://localhost:* wss://localhost:* https://*.anthropic.com`,
        `img-src ${cspSource} data: https:`,
        `font-src ${cspSource} data:`,
      ].join('; ');

      html = html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`);

      logger.info('Updated CSP for webview', { backendUrl, cspSource });

      return html;
    }

    const triedPaths = distPath || 'none found';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMatrix Workflow</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .instructions { text-align: center; max-width: 600px; margin: 40px auto; }
    .instructions h1 { font-size: 1.5em; margin-bottom: 1em; color: var(--vscode-errorForeground); }
    .instructions p { margin-bottom: 1em; line-height: 1.6; }
    pre { text-align: left; background: var(--vscode-editorWidget-background); padding: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="instructions">
    <h1>Webview UI 尚未构建</h1>
    <p>请先构建 Webview UI：</p>
    <pre>cd webview-ui && npm install && npm run build</pre>
    <p>构建完成后，关闭此面板并重新打开工作流。</p>
    <p style="font-size: 0.75em; margin-top: 20px; color: var(--vscode-descriptionForeground);">
      Extension path: ${this.context.extensionPath}<br/>
      Dist path tried: ${triedPaths}
    </p>
  </div>
</body>
</html>`;
  }

  setApiClient(apiClient: ApiClient): void {
    this.apiClient = apiClient;
  }

  getCurrentProjectId(): string | undefined {
    return this.currentProjectId;
  }

  async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    logger.info('Received message from webview', { messageType: message.type });

    switch (message.type) {
      case 'ready':
        // Webview is ready
        break;
      case 'command:execute':
        // Execute VS Code command
        if (message.payload) {
          const { command, args } = message.payload as { command: string; args?: unknown[] };
          await vscode.commands.executeCommand(command, args);
        }
        break;
      default:
        logger.warn('Unknown message type from webview', { messageType: message.type });
    }
  }

  sendMessage(type: string, payload?: unknown): void {
    if (this.panel) {
      this.panel.webview.postMessage({ type, payload });
    }
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
