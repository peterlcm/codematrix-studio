import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './projects.css';

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  archivedAt: string | null;
  teamCount?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/projects`);
      if (response.data.success) {
        setProjects(response.data);
      } else {
        setError(response.data.error || 'Failed to load projects');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const filteredProjects = projects.filter(
    p => showArchived || !p.archivedAt
  );

  const handleLogout = () => {
    localStorage.removeItem('codematrix-token');
    localStorage.removeItem('codematrix-user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/auth/login');
  };

  const openProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const createNewProject = () => {
    navigate('/projects/create');
  };

  const currentUser = JSON.parse(localStorage.getItem('codematrix-user') || '{}');

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="header-content">
          <h1>CodeMatrix Studio</h1>
          <div className="header-actions">
            <span className="user-info">{currentUser.name || currentUser.email}</span>
            <button onClick={createNewProject} className="btn btn-primary">
              + New Project
            </button>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="page-main">
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading projects...</p>
          </div>
        ) : (
          <>
            <div className="projects-header">
              <h2>My Projects ({filteredProjects.length})</h2>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                <span>Show archived</span>
              </label>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <h3>No projects yet</h3>
                <p>Create your first project to start AI-assisted development</p>
                <button onClick={createNewProject} className="btn btn-primary">
                  Create First Project
                </button>
              </div>
            ) : (
              <div className="projects-grid">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`project-card ${project.archivedAt ? 'archived' : ''}`}
                    onClick={() => openProject(project.id)}
                  >
                    <div className="project-header">
                      <h3>{project.name}</h3>
                      {project.archivedAt && (
                        <span className="badge archived-badge">Archived</span>
                      )}
                    </div>
                    {project.description && (
                      <p className="project-description">{project.description}</p>
                    )}
                    <div className="project-footer">
                      <span className="owner-info">
                        👤 {project.owner.name || project.owner.email}
                      </span>
                      <span className="created-date">
                        📅 {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
