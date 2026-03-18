import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './workflow.css';

interface Stage {
  id: string;
  title: string;
  stageType: string;
  status: string;
  approved: boolean;
  requiredApproval: boolean;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  currentStage: string;
  projectId: string;
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STAGE_EMOJI: Record<string, string> = {
  'PRD_DESIGN': '📋',
  'UI_UX_DESIGN': '🎨',
  'DEVELOPMENT': '💻',
  'TESTING': '🧪',
  'DEPLOYMENT': '🚀',
  'DOCUMENTATION': '📚',
};

const STAGE_NAME: Record<string, string> = {
  'PRD_DESIGN': 'PRD Design',
  'UI_UX_DESIGN': 'UI/UX Design',
  'DEVELOPMENT': 'Development',
  'TESTING': 'Testing',
  'DEPLOYMENT': 'Deployment',
  'DOCUMENTATION': 'Documentation',
};

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadWorkflow = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/workflows/${id}`);
      if (response.data.success) {
        setWorkflow(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load workflow');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, [id]);

  const openStage = (stageId: string) => {
    navigate(`/workflow/${id}/stage/${stageId}`);
  };

  const getStageStatusClass = (stage: Stage) => {
    if (stage.status === 'COMPLETED') return 'completed';
    if (stage.status === 'IN_PROGRESS') return 'in-progress';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h3>Workflow not found</h3>
          <button onClick={() => navigate('/projects')} className="btn btn-primary">
            Back to Projects
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
            <h1>{workflow.name}</h1>
            <p className="subtitle">
              Status: <span className={`status-badge ${workflow.status.toLowerCase()}`}>
                {workflow.status}
              </span>
            </p>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate(`/projects/${workflow.projectId}`)} className="btn btn-secondary">
              ← Back to Project
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}

        <div className="workflow-timeline">
          {workflow.stages.map((stage, index) => (
            <div
              key={stage.id}
              className={`timeline-item ${getStageStatusClass(stage)}`}
              onClick={() => openStage(stage.id)}
            >
              <div className="timeline-marker">
                <span className="marker-icon">{STAGE_EMOJI[stage.stageType] || '📋'}</span>
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <div>
                    <h3>{index + 1}. {stage.title}</h3>
                    <p className="stage-type">{STAGE_NAME[stage.stageType]}</p>
                  </div>
                  <span className={`status-badge small ${stage.status.toLowerCase()}`}>
                    {stage.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="timeline-footer">
                  <div className="stage-info">
                    {stage.requiredApproval && (
                      <span className="badge">
                        {stage.approved ? '✅ Approved' : '⏳ Pending Approval'}
                      </span>
                    )}
                    {stage.content && (
                      <span className="badge">📝 Has content</span>
                    )}
                  </div>
                  <button className="btn btn-primary btn-sm">
                    {stage.status === 'IN_PROGRESS' ? 'Continue Editing' : 'View Stage'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
