import * as vscode from 'vscode';
import * as path from 'path';
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
      logger.info({ data }, 'Authentication response received');
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

    // Send initial project data
    this.panel.webview.postMessage({
      type: 'init',
      payload: {
        projectId,
        backendUrl,
      },
    });
  }

  private getWebviewHtml(backendUrl: string, projectId: string): string {
    // Use a placeholder that will be loaded from the built webview
    // In production, this would point to the actual webview build
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
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      flex-direction: column;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--vscode-editorWidget-background);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
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
    .instructions h1 { font-size: 1.5em; margin-bottom: 1em; }
    .instructions p { margin-bottom: 1em; line-height: 1.6; }
    .instructions code {
      background: var(--vscode-editorWidget-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .instructions .steps {
      text-align: left;
      background: var(--vscode-editorWidget-background);
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .instructions .step {
      margin: 10px 0;
      display: flex;
      align-items: center;
    }
    .instructions .step-number {
      background: var(--vscode-button-background);
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 10px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="instructions">
    <h1>🔄 CodeMatrix Studio</h1>
    <p>AI+Human Collaborative Software Development Platform</p>

    <div class="steps">
      <div class="step">
        <span class="step-number">1</span>
        <span>Ensure backend is running: <code>cd backend && pnpm dev</code></span>
      </div>
      <div class="step">
        <span class="step-number">2</span>
        <span>Build webview UI: <code>cd webview-ui && pnpm build</code></span>
      </div>
      <div class="step">
        <span class="step-number">3</span>
        <span>Run <code>pnpm install:all</code> to install dependencies</code></span>
      </div>
    </div>

    <p>After completing setup, use <code>CodeMatrix: Initialize New Project</code> to start.</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const projectId = "${projectId}";
    const backendUrl = "${backendUrl}";

    // Send init message
    window.addEventListener('DOMContentLoaded', () => {
      vscode.postMessage({ type: 'ready', payload: { projectId, backendUrl } });
    });
  </script>
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
    logger.info({ messageType: message.type }, 'Received message from webview');

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
        logger.warn({ messageType: message.type }, 'Unknown message type from webview');
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