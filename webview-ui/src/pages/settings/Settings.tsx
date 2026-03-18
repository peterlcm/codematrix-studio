import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './settings.css';

type Tab = 'user' | 'notifications' | 'ai' | 'api';

interface UserSettings {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface NotificationSettings {
  emailNotifications: boolean;
  workflowUpdates: boolean;
  teamInvites: boolean;
  aiCompletion: boolean;
}

interface AISettings {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
}

interface ApiSettings {
  customEndpoint: string;
  apiKey: string;
  timeout: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('user');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const [userSettings, setUserSettings] = useState<UserSettings>({
    name: '',
    email: '',
    avatarUrl: null,
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    workflowUpdates: true,
    teamInvites: true,
    aiCompletion: true,
  });

  const [aiSettings, setAISettings] = useState<AISettings>({
    defaultModel: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 4096,
    enableStreaming: true,
  });

  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    customEndpoint: '',
    apiKey: '',
    timeout: 30,
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/users/settings`);
      if (response.data.success) {
        const data = response.data.data;
        if (data.user) setUserSettings(data.user);
        if (data.notifications) setNotificationSettings(data.notifications);
        if (data.ai) setAISettings(data.ai);
        if (data.api) setApiSettings(data.api);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/v1/users/settings`, {
        user: userSettings,
        notifications: notificationSettings,
        ai: aiSettings,
        api: apiSettings,
      });

      if (response.data.success) {
        setSuccess('Settings saved successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/users/password`, {
        password: newPassword,
      });

      if (response.data.success) {
        setSuccess('Password updated successfully');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.error || 'Failed to update password');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update password');
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

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <h1>Settings</h1>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="settings-container">
          <nav className="settings-sidebar">
            <button
              className={`tab-btn ${activeTab === 'user' ? 'active' : ''}`}
              onClick={() => setActiveTab('user')}
            >
              👤 User Settings
            </button>
            <button
              className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              🔔 Notifications
            </button>
            <button
              className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              🤖 AI Settings
            </button>
            <button
              className={`tab-btn ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
            >
              🔑 API Settings
            </button>
          </nav>

          <div className="settings-content">
            {activeTab === 'user' && (
              <div className="tab-content">
                <h2>User Settings</h2>

                <div className="form-group">
                  <label htmlFor="name">Display Name</label>
                  <input
                    type="text"
                    id="name"
                    value={userSettings.name || ''}
                    onChange={(e) => setUserSettings({ ...userSettings, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={userSettings.email}
                    onChange={(e) => setUserSettings({ ...userSettings, email: e.target.value })}
                    disabled
                  />
                  <small>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label htmlFor="avatarUrl">Avatar URL (optional)</label>
                  <input
                    type="url"
                    id="avatarUrl"
                    value={userSettings.avatarUrl || ''}
                    onChange={(e) => setUserSettings({ ...userSettings, avatarUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="section-divider"></div>

                <h3>Change Password</h3>
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={saving || !newPassword || !confirmPassword}
                  className="btn btn-secondary"
                >
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="tab-content">
                <h2>Notification Settings</h2>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          emailNotifications: e.target.checked,
                        })
                      }
                    />
                    <span>Email Notifications</span>
                  </label>
                  <p className="setting-description">
                    Receive important notifications via email
                  </p>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.workflowUpdates}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          workflowUpdates: e.target.checked,
                        })
                      }
                    />
                    <span>Workflow Updates</span>
                  </label>
                  <p className="setting-description">
                    Get notified when workflow stages change
                  </p>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.teamInvites}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          teamInvites: e.target.checked,
                        })
                      }
                    />
                    <span>Team Invites</span>
                  </label>
                  <p className="setting-description">
                    Notify when you're invited to join a project
                  </p>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.aiCompletion}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          aiCompletion: e.target.checked,
                        })
                      }
                    />
                    <span>AI Completion Notifications</span>
                  </label>
                  <p className="setting-description">
                    Notify when AI generation completes
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="tab-content">
                <h2>AI Settings</h2>

                <div className="form-group">
                  <label htmlFor="defaultModel">Default AI Model</label>
                  <select
                    id="defaultModel"
                    value={aiSettings.defaultModel}
                    onChange={(e) => setAISettings({ ...aiSettings, defaultModel: e.target.value })}
                  >
                    <option value="claude-opus-4-6">Claude Opus 4.6 (Best quality)</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Balanced)</option>
                    <option value="claude-haiku-4-5">Claude Haiku 4.5 (Fastest)</option>
                  </select>
                  <p className="setting-description">
                    Choose which model to use by default for AI generation
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="temperature">Temperature: {aiSettings.temperature}</label>
                  <input
                    type="range"
                    id="temperature"
                    min="0"
                    max="1"
                    step="0.1"
                    value={aiSettings.temperature}
                    onChange={(e) =>
                      setAISettings({ ...aiSettings, temperature: parseFloat(e.target.value) })
                    }
                  />
                  <div className="range-labels">
                    <span>More Deterministic</span>
                    <span>More Creative</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="maxTokens">Max Tokens</label>
                  <input
                    type="number"
                    id="maxTokens"
                    min="1024"
                    max="100000"
                    step="256"
                    value={aiSettings.maxTokens}
                    onChange={(e) =>
                      setAISettings({ ...aiSettings, maxTokens: parseInt(e.target.value) })
                    }
                  />
                  <p className="setting-description">
                    Maximum number of tokens the AI can generate in a single response
                  </p>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={aiSettings.enableStreaming}
                      onChange={(e) =>
                        setAISettings({ ...aiSettings, enableStreaming: e.target.checked })
                      }
                    />
                    <span>Enable Streaming</span>
                  </label>
                  <p className="setting-description">
                    Stream AI responses incrementally instead of waiting for completion
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="tab-content">
                <h2>API Settings</h2>

                <div className="form-group">
                  <label htmlFor="customEndpoint">Custom API Endpoint (optional)</label>
                  <input
                    type="url"
                    id="customEndpoint"
                    value={apiSettings.customEndpoint}
                    onChange={(e) =>
                      setApiSettings({ ...apiSettings, customEndpoint: e.target.value })
                    }
                    placeholder="https://your-api-server.com"
                  />
                  <p className="setting-description">
                    Leave empty to use the default endpoint
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="apiKey">API Key (optional)</label>
                  <input
                    type="password"
                    id="apiKey"
                    value={apiSettings.apiKey}
                    onChange={(e) => setApiSettings({ ...apiSettings, apiKey: e.target.value })}
                    placeholder="Enter your API key"
                  />
                  <p className="setting-description">
                    Your personal API key for direct Anthropic API access
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="timeout">Request Timeout (seconds)</label>
                  <input
                    type="number"
                    id="timeout"
                    min="5"
                    max="120"
                    value={apiSettings.timeout}
                    onChange={(e) =>
                      setApiSettings({ ...apiSettings, timeout: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="info-box">
                  <h4>ℹ️ About API Keys</h4>
                  <p>
                    If you provide your own API key, all AI requests will be billed to your account.
                    This gives you access to your own quota and allows for higher usage limits.
                    Your API key is stored securely and never shared with anyone.
                  </p>
                </div>
              </div>
            )}

            <div className="settings-actions">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
