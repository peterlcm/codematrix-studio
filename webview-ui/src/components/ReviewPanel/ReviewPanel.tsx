import { useState } from 'react';
import { useWorkflowStore, Stage } from '../../store/workflowStore';

interface ReviewPanelProps {
  stage: Stage;
}

export function ReviewPanel({ stage }: ReviewPanelProps) {
  const { approveStage, regenerateStage, isLoading } = useWorkflowStore();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = stage.status === 'READY_FOR_REVIEW' || stage.status === 'REVISION_REQUESTED';
  const canRequestRevision = canApprove;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approveStage(true, feedback || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!feedback.trim()) {
      return; // Require feedback for revision requests
    }
    setIsSubmitting(true);
    try {
      await approveStage(false, feedback);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Review & Approval</h3>

      {/* Diff View */}
      {stage.aiContent && stage.humanContent && stage.humanContent !== stage.aiContent && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 text-vscode-editorWidget-foreground">
            Changes Made
          </h4>
          <div className="bg-vscode-editorWidget-background rounded p-3 text-sm">
            <DiffView oldText={stage.aiContent} newText={stage.humanContent} />
          </div>
        </div>
      )}

      {/* Approval Status */}
      {stage.approved ? (
        <div className="bg-green-900/30 border border-green-700 rounded p-4 mb-4">
          <div className="flex items-center gap-2 text-green-400">
            <span>✓</span>
            <span className="font-medium">Approved</span>
          </div>
          {stage.approvedAt && (
            <p className="text-sm text-green-400/70 mt-1">
              {new Date(stage.approvedAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : canApprove ? (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded p-4 mb-4">
          <p className="text-sm text-yellow-400">
            This stage is ready for your review. Approve to continue to the next stage, or request revisions.
          </p>
        </div>
      ) : null}

      {/* Action Buttons */}
      {canApprove && (
        <div className="space-y-4">
          {/* Feedback Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Feedback {canRequestRevision && <span className="text-vscode-errorForeground">*</span>}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                canRequestRevision
                  ? 'Describe what needs to be changed...'
                  : 'Add optional feedback...'
              }
              className="w-full h-24 p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded resize-none text-sm"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Approving...' : '✓ Approve'}
            </button>
            <button
              onClick={handleRequestRevision}
              disabled={isSubmitting || !feedback.trim()}
              className="flex-1 px-4 py-2 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : '↩ Request Revision'}
            </button>
          </div>
        </div>
      )}

      {/* Regenerate Button */}
      {canApprove && (
        <div className="mt-4 pt-4 border-t border-vscode-editorWidget-background">
          <button
            onClick={regenerateStage}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-vscode-editorWidget-background text-vscode-foreground rounded hover:bg-vscode-list-hoverBackground text-sm"
          >
            🔄 Regenerate with AI
          </button>
          <p className="text-xs text-vscode-editorWidget-foreground mt-2">
            Use this to regenerate the content with a different approach or additional context.
          </p>
        </div>
      )}

      {/* Stage Info */}
      <div className="mt-6 pt-4 border-t border-vscode-editorWidget-background">
        <h4 className="text-sm font-medium mb-2">Stage Information</h4>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between">
            <dt className="text-vscode-editorWidget-foreground">Type:</dt>
            <dd>{stage.stageType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-vscode-editorWidget-foreground">Status:</dt>
            <dd>{stage.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-vscode-editorWidget-foreground">Version:</dt>
            <dd>{stage.version}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// Simple diff viewer component
function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const maxLines = Math.max(oldLines.length, newLines.length);
  const diffLines: JSX.Element[] = [];

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      diffLines.push(
        <div key={i} className="flex">
          <span className="w-6 text-right pr-2 text-vscode-editorWidget-foreground">{i + 1}</span>
          <span className="flex-1">{oldLine || ' '}</span>
        </div>
      );
    } else {
      if (oldLine !== undefined) {
        diffLines.push(
          <div key={`old-${i}`} className="flex bg-red-900/30">
            <span className="w-6 text-right pr-2 text-vscode-editorWidget-foreground">-</span>
            <span className="flex-1 text-red-400 line-through">{oldLine}</span>
          </div>
        );
      }
      if (newLine !== undefined) {
        diffLines.push(
          <div key={`new-${i}`} className="flex bg-green-900/30">
            <span className="w-6 text-right pr-2 text-vscode-editorWidget-foreground">+</span>
            <span className="flex-1 text-green-400">{newLine}</span>
          </div>
        );
      }
    }
  }

  return <div className="font-mono text-xs overflow-auto max-h-64">{diffLines}</div>;
}