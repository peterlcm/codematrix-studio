import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './projects.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CreateProject() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/projects`, {
        name,
        description,
      });

      if (response.data.success) {
        const project = response.data.data;
        navigate(`/projects/${project.id}`);
      } else {
        setError(response.data.error || 'Failed to create project');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <h1>Create New Project</h1>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </header>

      <main className="page-main">
        <div className="form-container">
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Project Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Project"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project"
                rows={4}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>

          <div className="template-section">
            <h3>💡 Project Templates</h3>
            <div className="templates-grid">
              <div className="template-card">
                <h4>Web Application</h4>
                <p>Full-stack web application with React frontend and Node.js backend</p>
                <button className="btn template-btn" onClick={() => {
                  setName('New Web App');
                  setDescription('Full-stack web application');
                }}>
                  Use Template
                </button>
              </div>
              <div className="template-card">
                <h4>Mobile App</h4>
                <p>React Native mobile application</p>
                <button className="btn template-btn" onClick={() => {
                  setName('New Mobile App');
                  setDescription('React Native mobile application');
                }}>
                  Use Template
                </button>
              </div>
              <div className="template-card">
                <h4>CLI Tool</h4>
                <p>Command-line interface tool</p>
                <button className="btn template-btn" onClick={() => {
                  setName('New CLI Tool');
                  setDescription('Command-line utility tool');
                }}>
                  Use Template
                </button>
              </div>
              <div className="template-card">
                <h4>Library</h4>
                <p>Open-source library/package</p>
                <button className="btn template-btn" onClick={() => {
                  setName('New Library');
                  setDescription('Reusable library/package');
                }}>
                  Use Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
