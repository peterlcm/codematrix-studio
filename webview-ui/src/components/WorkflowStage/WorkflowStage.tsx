import { useState, useEffect, useRef } from 'react';
import { useWorkflowStore, Stage } from '../../store/workflowStore';
import { StageContent } from './StageContent';

interface WorkflowStageProps {
  stage: Stage;
}

export function WorkflowStage({ stage }: WorkflowStageProps) {
  const { updateStageContent, isLoading } = useWorkflowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine content to display (human edited takes priority)
  const displayContent = stage.humanContent || stage.aiContent || '';

  useEffect(() => {
    setContent(displayContent);
  }, [displayContent]);

  const handleSave = async () => {
    await updateStageContent(content);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(displayContent);
    setIsEditing(false);
  };

  // Get stage-specific render component
  const getStageComponent = () => {
    switch (stage.stageType) {
      case 'PRD_DESIGN':
        return <StageContent type="prd" content={displayContent} />;
      case 'UI_UX_DESIGN':
        return <StageContent type="ui-design" content={displayContent} />;
      case 'DEVELOPMENT':
        return <StageContent type="code" content={displayContent} />;
      case 'TESTING':
        return <StageContent type="test" content={displayContent} />;
      default:
        return <StageContent type="text" content={displayContent} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stage Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-editorWidget-background">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{stage.title}</h2>
          <StatusBadge status={stage.status} />
        </div>

        <div className="flex items-center gap-2">
          {/* Regenerate button - only show for AI-generated content */}
          {(stage.status === 'READY_FOR_REVIEW' || stage.status === 'REVISION_REQUESTED') && (
            <button
              onClick={() => useWorkflowStore.getState().regenerateStage()}
              className="px-3 py-1.5 text-sm bg-vscode-editorWidget-background text-vscode-foreground rounded hover:bg-vscode-list-hoverBackground"
              disabled={isLoading}
            >
              🔄 Regenerate
            </button>
          )}

          {/* Edit button */}
          {!stage.approved && stage.status !== 'AI_PROCESSING' && (
            <>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 text-sm bg-vscode-button-background text-vscode-button-foreground rounded"
                    disabled={isLoading}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm bg-vscode-editorWidget-background text-vscode-foreground rounded hover:bg-vscode-list-hoverBackground"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm bg-vscode-editorWidget-background text-vscode-foreground rounded hover:bg-vscode-list-hoverBackground"
                >
                  ✏️ Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {stage.status === 'AI_PROCESSING' ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="spinner w-8 h-8 mb-4"></div>
            <p className="text-vscode-foreground">AI is generating content...</p>
            <p className="text-vscode-editorWidget-foreground text-sm mt-2">
              This may take a moment based on the complexity of your request.
            </p>
          </div>
        ) : isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full min-h-[400px] p-4 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded resize-none focus:outline-none focus:border-vscode-focusBorder font-mono text-sm"
            spellCheck={false}
          />
        ) : (
          getStageComponent()
        )}
      </div>

      {/* Footer */}
      {!isEditing && stage.status !== 'AI_PROCESSING' && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-vscode-editorWidget-background text-xs text-vscode-editorWidget-foreground">
          <div className="flex items-center gap-4">
            <span>Version: {stage.version}</span>
            {stage.approved && stage.approvedAt && (
              <span>Approved: {new Date(stage.approvedAt).toLocaleString()}</span>
            )}
          </div>
          {stage.status === 'READY_FOR_REVIEW' && (
            <span className="text-vscode-progressBar-background">
              👆 Review and approve to continue
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Stage['status'] }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'Pending' },
    AI_PROCESSING: { bg: 'bg-blue-900', text: 'text-blue-300', label: 'AI Processing' },
    READY_FOR_REVIEW: { bg: 'bg-yellow-900', text: 'text-yellow-300', label: 'Ready for Review' },
    REVISION_REQUESTED: { bg: 'bg-orange-900', text: 'text-orange-300', label: 'Revision Requested' },
    APPROVED: { bg: 'bg-green-900', text: 'text-green-300', label: 'Approved' },
    COMPLETED: { bg: 'bg-green-900', text: 'text-green-300', label: 'Completed' },
  };

  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span className={`px-2 py-0.5 text-xs rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}