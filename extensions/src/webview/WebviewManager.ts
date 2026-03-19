import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MessageBus, MessageHandler } from './MessageBus';
import { logger } from '../utils/logger';

export class WebviewManager implements MessageHandler {
  private context: vscode.ExtensionContext;
  private panel: vscode.WebviewPanel | undefined;
  private messageBus: MessageBus;
  private currentProjectId: string | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.messageBus = new MessageBus(this);

    // Register handler for messages from webview
    this.messageBus.on('openProject', async (data) => {
      this.currentProjectId = data.projectId;
    });

    this.messageBus.on('authenticated', async (data) => {
      // Handle auth responses
      logger.info('Authentication response received', { data });
    });
  }

  async openWorkflow(projectId: string): Promise<void> {
    this.currentProjectId = projectId;

    // Create or show the webview panel
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'codematrix.workflow',
        'CodeMatrix Workflow',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
            vscode.Uri.file(path.join(this.context.extensionPath, '..', 'webview-ui', 'dist')),
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

    // Load the webview content
    await this.loadWebviewContent(projectId);
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

    // Send initial project data after a short delay to ensure webview is ready
    setTimeout(() => {
      this.panel?.webview.postMessage({
        type: 'init',
        payload: {
          projectId,
          backendUrl,
        },
      });
      logger.info('Sent init message to webview', { projectId, backendUrl });
    }, 500);
  }

  private getWebviewHtml(backendUrl: string, projectId: string): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const possiblePaths = [
      path.join(workspaceRoot, 'webview-ui', 'dist', 'index.html'),
      path.join(workspaceRoot, '..', 'webview-ui', 'dist', 'index.html'),
      path.join(this.context.extensionPath, '..', 'webview-ui', 'dist', 'index.html'),
      path.join(this.context.extensionPath, '..', '..', 'webview-ui', 'dist', 'index.html'),
    ];

    let html = '';

    for (const builtIndexPath of possiblePaths) {
      try {
        if (fs.existsSync(builtIndexPath)) {
          html = fs.readFileSync(builtIndexPath, 'utf8');
          logger.info('Found webview index.html', { path: builtIndexPath });
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    if (html) {
      // Convert relative asset paths to VS Code webview URIs
      const webview = this.panel?.webview;
      if (webview) {
        const assetsUri = vscode.Uri.joinPath(
          vscode.Uri.file(path.join(this.context.extensionPath, '..', 'webview-ui', 'dist')),
          'assets'
        );
        const assetsPath = webview.asWebviewUri(assetsUri).toString();
        html = html.replace(/src="\.\/assets\//g, `src="${assetsPath}/`);
        html = html.replace(/href="\.\/assets\//g, `href="${assetsPath}/`);
      }

      // Update CSP to allow VS Code webview - use backendUrl directly
      const csp = `default-src 'self' https://*.vscode-cdn.net 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vscode-cdn.net; style-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vscode-cdn.net; connect-src 'self' ${backendUrl} ws://localhost:* http://localhost:* wss://localhost:* https://*.anthropic.com; img-src 'self' data: https:; font-src 'self' data:;`;

      // Remove old CSP meta and add new one
      html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');

      // Insert new CSP right after <head>
      html = html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`);

      logger.info('Updated CSP for webview', { backendUrl });

      return html;
    } else {
      // For debugging, show all paths tried
      const pathsList = possiblePaths.join('<br/> - ');
      // If built index.html not found, show instructions
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${backendUrl} ws://localhost:* http://localhost:*;">
  <title>CodeMatrix Workflow</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .error {
      color: var(--vscode-errorForeground);
      text-align: center;
      padding: 20px;
    }
    .instructions {
      text-align: center;
      color: var(--vscode-editor-foreground);
      max-width: 600px;
      margin: 0 auto;
    }
    .instructions h1 { font-size: 1.5em; margin-bottom: 1em; color: var(--vscode-errorForeground); }
    .instructions p { margin-bottom: 1em; line-height: 1.6; }
    .instructions code {
      background: var(--vscode-editorWidget-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="instructions">
    <h1>⚠️ Webview UI not built</h1>
    <p>Please build the webview UI before opening:</p>
    <pre style="text-align: left; background: var(--vscode-editorWidget-background); padding: 10px; border-radius: 4px;">cd webview-ui && pnpm install && pnpm build</pre>
    <p>After building, close this panel and reopen the workflow.</p>
    <hr style="margin: 20px 0; border-color: var(--vscode-editorWidget-background);">
    <p style="font-size: 0.8em;">Debug - Tried paths:</p>
    <pre style="font-size: 0.6em; text-align: left; word-break: break-all;"> - ${pathsList}</pre>
  </div>
</body>
</html>`;
    }
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
  <h1>⚙️ CodeMatrix Settings</h1>
  <div class="setting">
    <label>Backend URL</label>
    <input type="text" id="backendUrl" value="http://localhost:3001" />
  </div>
  <div class="setting">
    <label>Anthropic API Key</label>
    <input type="password" id="apiKey" placeholder="sk-ant-..." />
  </div>
  <button onclick="saveSettings()">Save Settings</button>
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
