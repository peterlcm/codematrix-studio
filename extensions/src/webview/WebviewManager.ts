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
    // Similar to openWorkflow but loads settings view
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'codematrix.settings',
        'CodeMatrix Settings',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.panel.webview.html = this.getSettingsHtml();
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

  private getSettingsHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMatrix Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .setting { margin-bottom: 20px; }
    .setting label { display: block; margin-bottom: 5px; font-weight: bold; }
    .setting input {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      color: var(--vscode-input-foreground);
    }
    h1 { margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>⚙️ CodeMatrix 设置</h1>
  <div class="setting">
    <label>后端地址</label>
    <input type="text" id="backendUrl" value="http://localhost:3001" />
  </div>
  <div class="setting">
    <label>AI API 密钥</label>
    <input type="password" id="apiKey" placeholder="你的 API 密钥..." />
  </div>
  <button onclick="saveSettings()">保存设置</button>
  <script>
    const vscode = acquireVsCodeApi();
    function saveSettings() {
      const backendUrl = document.getElementById('backendUrl').value;
      const apiKey = document.getElementById('apiKey').value;

      vscode.postMessage({
        type: 'settings:save',
        payload: { backendUrl, apiKey }
      });
    }
  </script>
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
