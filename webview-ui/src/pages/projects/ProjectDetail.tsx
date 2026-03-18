import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './projects.css';

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner: {
    id: string;
    email: string;
    name: string | null;
  };
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  team: Array<{
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
}

interface Workflow {
  id: string;
  currentStage: string;
  status: string;
  stages: Array<{
    id: string;
    stageType: string;
    status: string;
    title: string;
    approved: boolean;
  }>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STAGE_EMOJI: Record<string, string> = {
  'PRD_DESIGN': '📋',
  'UI_UX_DESIGN': '🎨',
  'DEVELOPMENT': '💻',
  'TESTING': '🧪',
};

const STAGE_NAME: Record<string, string> = {
  'PRD_DESIGN': 'PRD Design',
  'UI_UX_DESIGN': 'UI/UX Design',
  'DEVELOPMENT': 'Development',
  'TESTING': 'Testing',
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadProject = async () => {
    try {
      const [projectRes, workflowRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/projects/${id}`),
        axios.get(`${API_BASE_URL}/api/v1/workflows/project/${id}`),
      ]);

      if (projectRes.data.success) {
        setProject(projectRes.data.data);
      } else {
        setError(projectRes.data.error || 'Failed to load project');
      }

      if (workflowRes.data.success) {
        setWorkflow(workflowRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleArchive = async () => {
    if (!project) return;
    const action = project.archivedAt ? 'unarchive' : 'archive';
    try {
      await axios.post(`${API_BASE_URL}/api/v1/projects/${id}/${action}`);
      loadProject();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} project`);
    }
  };

  const openWorkflowStage = (stageId: string) => {
    navigate(`/workflow/${id}/stage/${stageId}`);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h3>Project not found</h3>
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
            <h1>{project.name}</h1>
            <p className="project-subtitle">
              {project.description}
            </p>
          </div>
          <div className="header-actions">
            <button
              onClick={() => navigate(`/projects/${id}/settings`)}
              className="btn btn-secondary"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={handleArchive}
              className={`btn ${project.archivedAt ? 'btn-success' : 'btn-danger'}`}
            >
              {project.archivedAt ? '📂 Unarchive' : '🗄️ Archive'}
            </button>
            <button onClick={() => navigate('/projects')} className="btn btn-secondary">
              ← Back
            </button>
          </div>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}

        {/* Project Info */}
        <div className="project-info-card">
          <div className="info-row">
            <span className="info-label">Owner:</span>
            <span>{project.owner.name || project.owner.email}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Created:</span>
            <span>{new Date(project.createdAt).toLocaleString()}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Status:</span>
            <span className={project.archivedAt ? 'text-yellow' : 'text-green'}>
              {project.archivedAt ? 'Archived' : 'Active'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Team Size:</span>
            <span>{project.team.length + 1} members</span>
          </div>
        </div>

        {/* Team Members */}
        <div className="section">
          <h3>👥 Team ({project.team.length + 1})</h3>
          <div className="team-list">
            <div className="team-member">
              <span className="member-role owner">OWNER</span>
              <span className="member-name">{project.owner.name || project.owner.email}</span>
            </div>
            {project.team.map((member) => (
              <div key={member.id} className="team-member">
                <span className={`member-role ${member.role.toLowerCase()}`}>{member.role}</span>
                <span className="member-name">{member.user.name || member.user.email}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Stages */}
        <div className="section">
          <h3>⚙️ Workflow</h3>
          {workflow ? (
            <div className="stages-list">
              {workflow.stages.map((stage) => (
                <div
                  key={stage.id}
                  className={`stage-card ${stage.status.toLowerCase()} ${stage.approved ? 'approved' : ''}`}
                  onClick={() => openWorkflowStage(stage.id)}
                >
                  <div className="stage-header">
                    <span className="stage-icon">{STAGE_EMOJI[stage.stageType]}</span>
                    <div>
                      <h4>{stage.title}</h4>
                      <span className="stage-type">{STAGE_NAME[stage.stageType]}</span>
                    </div>
                  </div>
                  <span className={`stage-status ${stage.status.toLowerCase()}`}>
                    {stage.status}
                  </span>
                </div>
              ))}
              <button
                className="btn btn-primary btn-block"
                onClick={() => navigate(`/workflow/${id}`)}
              >
                Open Full Workflow
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <p>No workflow found. Create a workflow to start development.</p>
              <button className="btn btn-primary">Create Workflow</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
