import { useEffect, useState, useRef } from 'react';
import { useWorkflowStore, Workflow, Stage, User } from './store/workflowStore';
import { WorkflowStage } from './components/WorkflowStage/WorkflowStage';
import { ReviewPanel } from './components/ReviewPanel/ReviewPanel';
import { Collaboration } from './components/Collaboration/Collaboration';
import { UserPresence } from './components/Collaboration/UserPresence';

declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
    _vscodeApi?: ReturnType<Window['acquireVsCodeApi']>;
  }
}

function getVsCodeApi() {
  if (!window._vscodeApi) {
    window._vscodeApi = window.acquireVsCodeApi();
  }
  return window._vscodeApi;
}

export default function App() {
  const { loadWorkflow, createWorkflow, currentStage, workflow, isLoading, error, setBackendUrl } = useWorkflowStore();
  const [showReview, setShowReview] = useState(true);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [backendUrl, setBackendUrlState] = useState('http://localhost:3001');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const vscode = getVsCodeApi();
    console.log('[Webview] App initialized, got VSCode API');

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as { type: string; payload?: unknown };
      console.log('[Webview] Received message:', message.type);

      switch (message.type) {
        case 'init': {
          const initPayload = message.payload as { projectId: string; backendUrl: string; token?: string };
          console.log('[Webview] init:', initPayload.projectId, initPayload.backendUrl, 'token:', initPayload.token ? 'present' : 'missing');
          setProjectId(initPayload.projectId);
          setBackendUrlState(initPayload.backendUrl);
          setBackendUrl(initPayload.backendUrl);
          if (initPayload.token) {
            useWorkflowStore.getState().setAuthToken(initPayload.token);
          }
          loadWorkflow(initPayload.projectId);
          break;
        }
        case 'workflow:load':
          useWorkflowStore.getState().setWorkflow(message.payload as Workflow);
          break;
        case 'stage:load':
          useWorkflowStore.getState().setCurrentStage(message.payload as Stage);
          break;
        case 'auth:status': {
          const authPayload = message.payload as { authenticated: boolean; user?: User };
          useWorkflowStore.getState().setAuthStatus(authPayload.authenticated, { user: authPayload.user! });
          break;
        }
        case 'error':
          useWorkflowStore.getState().setError((message.payload as { message: string }).message);
          break;
        default:
          console.log('[Webview] Unknown message type:', message.type);
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [loadWorkflow, setBackendUrl]);

  if (isLoading && !workflow) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-background">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-vscode-foreground">正在加载工作流...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-background">
        <div className="text-center p-8">
          <h2 className="text-xl text-vscode-errorForeground mb-4">出错了</h2>
          <p className="text-vscode-foreground mb-4">{error}</p>
          {projectId && (
            <button
              onClick={() => loadWorkflow(projectId)}
              className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded"
            >
              重试
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!workflow || !currentStage) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-background">
        <div className="text-center p-8 max-w-lg w-full">
          <h2 className="text-xl text-vscode-foreground mb-2">尚未创建工作流</h2>
          <p className="text-vscode-foreground opacity-70 mb-6">
            启动工作流，开始 AI 辅助开发流水线：
            需求设计 → UI/UX 设计 → 开发实现 → 测试验证
          </p>
          <div className="text-left mb-4">
            <label className="block text-sm text-vscode-foreground mb-1">
              项目描述（可选）
            </label>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="描述你想要构建的产品...例如：'一个带用户认证、拖拽任务看板和实时协作功能的待办事项应用'"
              rows={4}
              className="w-full px-3 py-2 rounded text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border focus:outline-none focus:border-vscode-focusBorder resize-none"
            />
          </div>
          <button
            onClick={() => {
              if (projectId) {
                createWorkflow(projectId, promptInput || undefined);
              }
            }}
            disabled={!projectId || isLoading}
            className="px-6 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:opacity-90 disabled:opacity-50 text-sm font-medium"
          >
            {isLoading ? '启动中...' : '启动工作流'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-vscode-background text-vscode-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-vscode-editorWidget-background">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">CodeMatrix Studio</h1>
          <span className="text-vscode-editorWidget-foreground">/</span>
          <span className="text-vscode-foreground">{workflow.projectName || '项目'}</span>
        </div>
        <UserPresence />
      </header>

      {/* Stage Navigation */}
      <nav className="flex gap-2 px-4 py-2 border-b border-vscode-editorWidget-background overflow-x-auto">
        {workflow.stages.map((stage) => (
          <button
            key={stage.id}
            onClick={() => useWorkflowStore.getState().selectStage(stage.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors ${
              currentStage.id === stage.id
                ? 'bg-vscode-button-background text-vscode-button-foreground'
                : stage.status === 'APPROVED'
                ? 'bg-green-900/30 text-green-400'
                : 'bg-vscode-editorWidget-background text-vscode-foreground hover:bg-vscode-list-hoverBackground'
            }`}
          >
            <span className="text-xs">{stage.stageType === 'PRD_DESIGN' ? '📋' :
              stage.stageType === 'UI_UX_DESIGN' ? '🎨' :
              stage.stageType === 'DEVELOPMENT' ? '💻' : '🧪'}</span>
            <span>{stage.title}</span>
            {stage.status === 'AI_PROCESSING' && <span className="spinner w-3 h-3"></span>}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Workflow Stage Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <WorkflowStage stage={currentStage} />
        </div>

        {/* Sidebar - Review & Collaboration */}
        <div className="w-80 border-l border-vscode-editorWidget-background flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-vscode-editorWidget-background">
            <button
              onClick={() => { setShowReview(true); setShowCollaboration(false); }}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                showReview
                  ? 'border-b-2 border-vscode-button-background text-vscode-button-foreground'
                  : 'text-vscode-editorWidget-foreground hover:text-vscode-foreground'
              }`}
            >
              审核
            </button>
            <button
              onClick={() => { setShowReview(false); setShowCollaboration(true); }}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                showCollaboration
                  ? 'border-b-2 border-vscode-button-background text-vscode-button-foreground'
                  : 'text-vscode-editorWidget-foreground hover:text-vscode-foreground'
              }`}
            >
              协作
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-auto">
            {showReview && <ReviewPanel stage={currentStage} />}
            {showCollaboration && <Collaboration stage={currentStage} />}
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-1 border-t border-vscode-editorWidget-background text-xs text-vscode-editorWidget-foreground">
        <div className="flex items-center gap-4">
          <span>状态：{currentStage.status}</span>
          <span>版本：{currentStage.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>后端：{backendUrl}</span>
        </div>
      </footer>
    </div>
  );
}