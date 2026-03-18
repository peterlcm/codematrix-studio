import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './projects.css';

interface ProjectSettings {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadProject = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/projects/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);
        setName(data.name);
        setDescription(data.description || '');
      } else {
        setError(response.data.error || 'Failed to load project');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/v1/projects/${id}`, {
        name,
        description,
      });

      if (response.data.success) {
        navigate(`/projects/${id}`);
      } else {
        setError(response.data.error || 'Failed to update project');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
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
          <h1>Project Settings</h1>
          <button onClick={() => navigate(`/projects/${id}`)} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSave} className="form-container">
          <div className="form-group">
            <label htmlFor="name">Project Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(`/projects/${id}`)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <div className="section danger-zone">
          <h3 className="danger-title">Danger Zone</h3>
          <div className="danger-item">
            <div>
              <h4>Delete Project</h4>
              <p>Permanently delete this project and all associated data. This action cannot be undone.</p>
            </div>
            <button className="btn btn-danger">Delete Project</button>
          </div>
        </div>
      </main>
    </div>
  );
}
