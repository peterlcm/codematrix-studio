import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './workflow.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

interface WorkflowStage {
  id: string;
  title: string;
  stageType: string;
  status: string;
  approved: boolean;
  requiredApproval: boolean;
  content: string | null;
  workflowId: string;
  projectId: string;
}

const STAGE_NAME: Record<string, string> = {
  'PRD_DESIGN': 'PRD Design',
  'UI_UX_DESIGN': 'UI/UX Design',
  'DEVELOPMENT': 'Development',
  'TESTING': 'Testing',
  'DEPLOYMENT': 'Deployment',
  'DOCUMENTATION': 'Documentation',
};

export default function WorkflowStage() {
  const { id: workflowId, stageId } = useParams<{ id: string; stageId: string }>();
  const [stage, setStage] = useState<WorkflowStage | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const loadStage = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/workflows/stages/${stageId}`);
      if (response.data.success) {
        setStage(response.data.data);
        setContent(response.data.data.content || '');
      } else {
        setError(response.data.error || 'Failed to load stage');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load stage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStage();
  }, [stageId]);

  const saveContent = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/v1/workflows/stages/${stageId}`, {
        content,
        status: stage?.status === 'PENDING' ? 'IN_PROGRESS' : stage?.status,
      });

      if (response.data.success) {
        setStage(response.data.data);
        setSuccess('Content saved successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.error || 'Failed to save content');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const approveStage = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/workflows/stages/${stageId}/approve`);
      if (response.data.success) {
        setSuccess('Stage approved! Moving to next stage.');
        setTimeout(() => {
          navigate(`/workflow/${workflowId}`);
        }, 2000);
      } else {
        setError(response.data.error || 'Failed to approve stage');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve stage');
    } finally {
      setSaving(false);
    }
  };

  const generateWithAI = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/ai/generate-stage`, {
        projectId: stage?.projectId,
        stageId: stage?.id,
        stageType: stage?.stageType,
        prompt: content || `Generate content for ${stage?.title}`,
      });

      if (response.data.success) {
        setContent(response.data.data.content);
        setSuccess('AI content generated successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.error || 'Failed to generate AI content');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate AI content');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading stage...</p>
        </div>
      </div>
    );
  }

  if (!stage) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h3>Stage not found</h3>
          <button onClick={() => navigate(`/workflow/${workflowId}`)} className="btn btn-primary">
            Back to Workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>{stage.title}</h1>
            <p className="subtitle">
              {STAGE_NAME[stage.stageType]} •
              <span className={`status-badge ${stage.status.toLowerCase()}`}>
                {stage.status.replace('_', ' ')}
              </span>
            </p>
          </div>
          <button onClick={() => navigate(`/workflow/${workflowId}`)} className="btn btn-secondary">
            ← Back to Workflow
          </button>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="stage-editor">
          <div className="editor-toolbar">
            <span className="toolbar-title">Stage Content (Markdown supported)</span>
            <button
              onClick={generateWithAI}
              disabled={saving}
              className="btn btn-secondary btn-sm"
            >
              🤖 {saving ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Start writing your ${STAGE_NAME[stage.stageType]} content here...\n\nMarkdown is supported. You can use AI to help generate content by clicking the "Generate with AI" button above.`}
            className="content-editor"
          />
        </div>

        <div className="stage-actions">
          <button
            onClick={() => navigate(`/workflow/${workflowId}`)}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={saveContent}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {stage.requiredApproval && !stage.approved && (
            <button
              onClick={approveStage}
              disabled={saving || !content.trim()}
              className="btn btn-success"
            >
              {saving ? 'Processing...' : '✅ Approve & Continue'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
