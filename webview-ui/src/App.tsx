import { useEffect, useState } from 'react';
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
  }
}

export default function App() {
  const { loadWorkflow, currentStage, workflow, isLoading, error, setBackendUrl } = useWorkflowStore();
  const [showReview, setShowReview] = useState(true);
  const [showCollaboration, setShowCollaboration] = useState(false);
  const [backendUrl, setBackendUrlState] = useState('http://localhost:3001');
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Get VS Code API
    const vscode = window.acquireVsCodeApi();

    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as { type: string; payload?: unknown };

      console.log('[Webview] Received message:', message.type);

      switch (message.type) {
        case 'init':
          const initPayload = message.payload as { projectId: string; backendUrl: string };
          setProjectId(initPayload.projectId);
          setBackendUrlState(initPayload.backendUrl);
          setBackendUrl(initPayload.backendUrl);
          loadWorkflow(initPayload.projectId);
          break;
        case 'workflow:load':
          useWorkflowStore.getState().setWorkflow(message.payload as Workflow);
          break;
        case 'stage:load':
          useWorkflowStore.getState().setCurrentStage(message.payload as Stage);
          break;
        case 'auth:status':
          useWorkflowStore.getState().setAuthStatus(
            (message.payload as { authenticated: boolean }).authenticated,
            { user: (message.payload as { user?: User }).user }
          );
          break;
        case 'error':
          useWorkflowStore.getState().setError((message.payload as { message: string }).message);
          break;
        default:
          console.log('[Webview] Unknown message type:', message.type);
      }
    };

    window.addEventListener('message', handleMessage);

    // Send ready message
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [loadWorkflow, setBackendUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-background">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-vscode-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-background">
        <div className="text-center p-8">
          <h2 className="text-xl text-vscode-errorForeground mb-4">Error</h2>
          <p className="text-vscode-foreground mb-4">{error}</p>
          {projectId && (
            <button
              onClick={() => loadWorkflow(projectId)}
              className="px-4 py-2 bg-vscode-button-background text-vscode-button-foreground rounded"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!workflow || !currentStage) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-background">
        <div className="text-center p-8">
          <h2 className="text-xl text-vscode-foreground mb-4">No Workflow</h2>
          <p className="text-vscode-foreground mb-4">
            Start a workflow to see the stages here.
          </p>
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
          <span className="text-vscode-foreground">{workflow.projectName || 'Project'}</span>
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
              Review
            </button>
            <button
              onClick={() => { setShowCollaboration(false); setShowCollaboration(true); }}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                showCollaboration
                  ? 'border-b-2 border-vscode-button-background text-vscode-button-foreground'
                  : 'text-vscode-editorWidget-foreground hover:text-vscode-foreground'
              }`}
            >
              Collaborate
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
          <span>Status: {currentStage.status}</span>
          <span>Version: {currentStage.version}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Backend: {backendUrl}</span>
        </div>
      </footer>
    </div>
  );
}