import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './dashboard.css';

interface ProjectProgress {
  projectId: string;
  projectName: string;
  totalStages: number;
  completedStages: number;
  progress: number;
  status: string;
}

interface AIUsage {
  totalRequests: number;
  totalTokens: number;
  requestsByModel: Record<string, number>;
  monthlyRequests: Array<{
    date: string;
    requests: number;
    tokens: number;
  }>;
}

interface TeamStats {
  totalMembers: number;
  activeProjects: number;
  recentActivity: Array<{
    user: string;
    action: string;
    project: string;
    timestamp: string;
  }>;
}

interface DashboardData {
  projects: {
    total: number;
    active: number;
    archived: number;
    progress: ProjectProgress[];
  };
  ai: AIUsage;
  team: TeamStats;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadDashboard = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/analytics/dashboard`);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'var(--danger-color)';
    if (progress < 70) return 'var(--warning-color)';
    return 'var(--success-color)';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h3>Failed to load dashboard</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/projects')} className="btn btn-primary">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <h1>Analytics Dashboard</h1>
          <button onClick={() => navigate('/projects')} className="btn btn-secondary">
            ← Back to Projects
          </button>
        </div>
      </header>

      <main className="page-main dashboard-main">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📁</div>
            <div className="stat-info">
              <div className="stat-value">{data.projects.total}</div>
              <div className="stat-label">Total Projects</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">▶️</div>
            <div className="stat-info">
              <div className="stat-value">{data.projects.active}</div>
              <div className="stat-label">Active Projects</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🤖</div>
            <div className="stat-info">
              <div className="stat-value">{data.ai.totalRequests.toLocaleString()}</div>
              <div className="stat-label">AI Requests</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <div className="stat-value">{data.team.totalMembers}</div>
              <div className="stat-label">Team Members</div>
            </div>
          </div>
        </div>

        {/* Project Progress */}
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>Project Progress</h2>
            <div className="project-progress-list">
              {data.projects.progress.length === 0 ? (
                <div className="empty-small">No active projects</div>
              ) : (
                data.projects.progress.slice(0, 5).map((project) => (
                  <div key={project.projectId} className="project-progress-item">
                    <div className="progress-header">
                      <span className="project-name">{project.projectName}</span>
                      <span className="progress-percentage">{project.progress}%</span>
                    </div>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${project.progress}%`,
                          backgroundColor: getProgressColor(project.progress),
                        }}
                      />
                    </div>
                    <div className="progress-footer">
                      <span>
                        {project.completedStages} / {project.totalStages} stages completed
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              className="btn btn-primary btn-block mt-3"
              onClick={() => navigate('/projects')}
            >
              View All Projects
            </button>
          </div>

          {/* AI Usage Statistics */}
          <div className="dashboard-card">
            <h2>AI Usage</h2>
            <div className="ai-usage">
              <div className="usage-stat">
                <span className="usage-label">Total Tokens</span>
                <span className="usage-value">{data.ai.totalTokens.toLocaleString()}</span>
              </div>
              <h3>Requests by Model</h3>
              <div className="model-usage">
                {Object.entries(data.ai.requestsByModel).map(([model, count]) => (
                  <div key={model} className="model-usage-item">
                    <span>{model.replace('claude-', '')}</span>
                    <div className="model-bar-container">
                      <div
                        className="model-bar"
                        style={{
                          width: `${(count / data.ai.totalRequests) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="model-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-block mt-3"
              onClick={() => navigate('/settings/ai')}
            >
              Configure AI Settings
            </button>
          </div>

          {/* Recent Activity */}
          <div className="dashboard-card full-width">
            <h2>Recent Team Activity</h2>
            <div className="activity-list">
              {data.team.recentActivity.length === 0 ? (
                <div className="empty-small">No recent activity</div>
              ) : (
                data.team.recentActivity.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <span className="activity-user">{activity.user}</span>
                      <span className="activity-action">{activity.action}</span>
                      <span className="activity-project">in {activity.project}</span>
                    </div>
                    <span className="activity-time">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Monthly AI Usage Chart (placeholder) */}
          <div className="dashboard-card full-width">
            <h2>Monthly AI Usage Trend</h2>
            <div className="chart-placeholder">
              {data.ai.monthlyRequests.length === 0 ? (
                <div className="empty-small">No usage data available</div>
              ) : (
                <div className="bar-chart">
                  {data.ai.monthlyRequests.map((month) => (
                    <div key={month.date} className="chart-bar-container">
                      <div
                        className="chart-bar"
                        style={{
                          height: `${Math.max(
                            5,
                            (month.requests / Math.max(...data.ai.monthlyRequests.map(m => m.requests))) * 100
                          )}%`,
                        }}
                      />
                      <div className="chart-label">{month.date.split('-')[1]}</div>
                      <div className="chart-value">{month.requests}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
