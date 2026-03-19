import { useState, useEffect, useRef } from 'react';
import { useWorkflowStore, Stage } from '../../store/workflowStore';
import { StageContent } from './StageContent';

const STAGE_ORDER = ['PRD_DESIGN', 'UI_UX_DESIGN', 'DEVELOPMENT', 'TESTING'];

interface WorkflowStageProps {
  stage: Stage;
}

export function WorkflowStage({ stage }: WorkflowStageProps) {
  const { updateStageContent, generateStage, workflow, isLoading, isGenerating, streamingContent } = useWorkflowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const streamEndRef = useRef<HTMLDivElement>(null);

  const displayContent = stage.humanContent || stage.aiContent || '';

  useEffect(() => {
    setContent(displayContent);
  }, [displayContent]);

  useEffect(() => {
    if (isGenerating && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingContent, isGenerating]);

  const handleSave = async () => {
    await updateStageContent(content);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(displayContent);
    setIsEditing(false);
  };

  const handleGenerate = () => {
    generateStage(stage.id);
  };

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

  const currentIndex = STAGE_ORDER.indexOf(stage.stageType);
  const previousStageApproved = currentIndex === 0 || (
    workflow?.stages.some(s => s.stageType === STAGE_ORDER[currentIndex - 1] && s.approved) ?? false
  );

  const canGenerate = !isGenerating && !stage.approved && previousStageApproved &&
    (stage.status === 'PENDING' || stage.status === 'READY_FOR_REVIEW' || stage.status === 'REVISION_REQUESTED');

  const waitingForPrevious = !previousStageApproved && !stage.approved && stage.status === 'PENDING';
  const previousStageName = currentIndex > 0
    ? workflow?.stages.find(s => s.stageType === STAGE_ORDER[currentIndex - 1])?.title || ''
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Stage Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-editorWidget-background">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{stage.title}</h2>
          <StatusBadge status={isGenerating && stage.status === 'AI_PROCESSING' ? 'AI_PROCESSING' : stage.status} />
        </div>

        <div className="flex items-center gap-2">
          {canGenerate && (
            <button
              onClick={handleGenerate}
              className="px-3 py-1.5 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:opacity-90"
              disabled={isLoading}
            >
              {displayContent ? '🔄 重新生成' : '🤖 AI 生成'}
            </button>
          )}

          {!stage.approved && !isGenerating && stage.status !== 'PENDING' && (
            <>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 text-sm bg-vscode-button-background text-vscode-button-foreground rounded"
                    disabled={isLoading}
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-sm bg-vscode-editorWidget-background text-vscode-foreground rounded hover:bg-vscode-list-hoverBackground"
                  >
                    取消
                  </button>
                </>
              ) : displayContent ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm bg-vscode-editorWidget-background text-vscode-foreground rounded hover:bg-vscode-list-hoverBackground"
                >
                  ✏️ 编辑
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {isGenerating && stage.status === 'AI_PROCESSING' ? (
          <div className="font-mono text-sm whitespace-pre-wrap text-vscode-foreground">
            <div className="flex items-center gap-2 mb-3 text-vscode-progressBar-background">
              <div className="spinner w-4 h-4"></div>
              <span className="text-sm font-medium">AI 正在生成中...</span>
            </div>
            {streamingContent ? (
              <>
                <StageContent type="text" content={streamingContent} />
                <div ref={streamEndRef} />
              </>
            ) : (
              <p className="text-vscode-editorWidget-foreground text-sm">
                等待 AI 响应...
              </p>
            )}
          </div>
        ) : stage.status === 'PENDING' && !displayContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-4xl mb-4">
              {stage.stageType === 'PRD_DESIGN' ? '📋' :
               stage.stageType === 'UI_UX_DESIGN' ? '🎨' :
               stage.stageType === 'DEVELOPMENT' ? '💻' : '🧪'}
            </p>
            <h3 className="text-lg font-medium text-vscode-foreground mb-2">{stage.title}</h3>
            {waitingForPrevious ? (
              <p className="text-vscode-editorWidget-foreground mb-4 max-w-md">
                请先完成并确认上一环节「{previousStageName}」后，才能开始本环节的 AI 生成。
              </p>
            ) : (
              <>
                <p className="text-vscode-editorWidget-foreground mb-4 max-w-md">
                  点击「AI 生成」让 AI 创建本环节的内容，或点击「编辑」手动撰写。
                </p>
                <button
                  onClick={handleGenerate}
                  className="px-6 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:opacity-90 text-sm font-medium"
                >
                  🤖 AI 生成
                </button>
              </>
            )}
          </div>
        ) : isEditing ? (
          <textarea
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
      {!isEditing && !isGenerating && stage.status !== 'PENDING' && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-vscode-editorWidget-background text-xs text-vscode-editorWidget-foreground">
          <div className="flex items-center gap-4">
            <span>版本：{stage.version}</span>
            {stage.approved && stage.approvedAt && (
              <span>确认于：{new Date(stage.approvedAt).toLocaleString()}</span>
            )}
          </div>
          {stage.status === 'READY_FOR_REVIEW' && (
            <span className="text-vscode-progressBar-background">
              请审核并确认本环节成果，确认后即可进入下一环节
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Stage['status'] }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-gray-700', text: 'text-gray-300', label: '待处理' },
    AI_PROCESSING: { bg: 'bg-blue-900', text: 'text-blue-300', label: 'AI 生成中...' },
    READY_FOR_REVIEW: { bg: 'bg-yellow-900', text: 'text-yellow-300', label: '待审核' },
    REVISION_REQUESTED: { bg: 'bg-orange-900', text: 'text-orange-300', label: '需要修改' },
    APPROVED: { bg: 'bg-green-900', text: 'text-green-300', label: '已确认' },
    COMPLETED: { bg: 'bg-green-900', text: 'text-green-300', label: '已完成' },
  };

  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span className={`px-2 py-0.5 text-xs rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
