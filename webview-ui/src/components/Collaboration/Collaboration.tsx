import { useState, useEffect, useRef } from 'react';
import { useWorkflowStore, Stage } from '../../store/workflowStore';

interface CollaborationProps {
  stage: Stage;
}

export function Collaboration({ stage }: CollaborationProps) {
  const { addComment } = useWorkflowStore();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const comments = stage.comments || [];

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment(newComment.trim());
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-vscode-editorWidget-background">
        <h3 className="text-lg font-semibold">Comments</h3>
        <p className="text-sm text-vscode-editorWidget-foreground">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-vscode-editorWidget-foreground">No comments yet</p>
            <p className="text-sm text-vscode-editorWidget-foreground mt-1">
              Be the first to leave feedback!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmitComment} className="p-4 border-t border-vscode-editorWidget-background">
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 h-20 p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded resize-none text-sm"
            disabled={isSubmitting}
          />
        </div>
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="px-4 py-1.5 bg-vscode-button-background text-vscode-button-foreground rounded text-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface CommentItemProps {
  comment: {
    id: string;
    author: { id: string; name: string | null; email: string; avatarUrl: string | null };
    content: string;
    createdAt: string;
    threadId: string | null;
    position: { line: number; column: number } | null;
  };
}

function CommentItem({ comment }: CommentItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const authorName = comment.author.name || comment.author.email.split('@')[0];
  const timeAgo = getTimeAgo(new Date(comment.createdAt));

  return (
    <div className="bg-vscode-editorWidget-background rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-vscode-button-background flex items-center justify-center text-xs">
            <span className="text-vscode-button-foreground">
              {(authorName || 'U')[0].toUpperCase()}
            </span>
          </div>
          <span className="font-medium text-sm">{authorName}</span>
        </div>
        <div className="flex items-center gap-2">
          {comment.position && (
            <span className="text-xs text-vscode-editorWidget-foreground">
              Line {comment.position.line}
            </span>
          )}
          <span className="text-xs text-vscode-editorWidget-foreground">{timeAgo}</span>
        </div>
      </div>

      {/* Content */}
      <div className="text-sm">
        {comment.content}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-2 pt-2 border-t border-vscode-editor-background">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-vscode-editorWidget-foreground hover:text-vscode-foreground"
        >
          {isExpanded ? 'Hide' : 'Show'} thread
        </button>
        <button className="text-xs text-vscode-editorWidget-foreground hover:text-vscode-foreground">
          Reply
        </button>
      </div>
    </div>
  );
}

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString();
}