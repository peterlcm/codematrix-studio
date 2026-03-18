import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ai.css';

interface AIModelConfig {
  modelId: string;
  name: string;
  description: string;
  enabled: boolean;
  supportsStreaming: boolean;
  maxTokens: number;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string;
  createdAt: string;
}

interface AIConfig {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
  customApiKey: string;
  customBaseUrl: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

const AVAILABLE_MODELS: AIModelConfig[] = [
  {
    modelId: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Highest quality, best reasoning and complex tasks',
    enabled: true,
    supportsStreaming: true,
    maxTokens: 200000,
  },
  {
    modelId: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Balanced performance and quality',
    enabled: true,
    supportsStreaming: true,
    maxTokens: 200000,
  },
  {
    modelId: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: 'Fastest, for quick responses and simple tasks',
    enabled: true,
    supportsStreaming: true,
    maxTokens: 100000,
  },
];

export default function AISettingsPage() {
  const [config, setConfig] = useState<AIConfig>({
    defaultModel: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 4096,
    enableStreaming: true,
    customApiKey: '',
    customBaseUrl: '',
  });
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'models' | 'prompts'>('models');
  const navigate = useNavigate();

  const loadSettings = async () => {
    try {
      const [configRes, templatesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/ai/settings`),
        axios.get(`${API_BASE_URL}/api/v1/ai/prompts`),
      ]);

      if (configRes.data.success) {
        setConfig(configRes.data.data);
      }
      if (templatesRes.data.success) {
        setTemplates(templatesRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load AI settings');
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
      const response = await axios.patch(`${API_BASE_URL}/api/v1/ai/settings`, config);
      if (response.data.success) {
        setSuccess('AI settings saved successfully');
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

  const testConnection = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/ai/test-connection`, {
        apiKey: config.customApiKey,
        baseUrl: config.customBaseUrl,
      });

      if (response.data.success) {
        setSuccess('Connection test successful! 🎉');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.error || 'Connection test failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Connection test failed');
    } finally {
      setSaving(false);
    }
  };

  const getModelById = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.modelId === modelId);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading AI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <h1>AI Configuration</h1>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="ai-settings-container">
          <div className="ai-tabs">
            <button
              className={`ai-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
              onClick={() => setActiveTab('models')}
            >
              🤖 Model Configuration
            </button>
            <button
              className={`ai-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompts')}
            >
              📝 Prompt Templates
            </button>
          </div>

          {activeTab === 'models' && (
            <div className="ai-tab-content">
              <div className="section">
                <h2>Default Model</h2>
                <p className="section-description">
                  Select which AI model to use by default for all generations
                </p>

                <div className="models-grid">
                  {AVAILABLE_MODELS.map((model) => (
                    <div
                      key={model.modelId}
                      className={`model-card ${config.defaultModel === model.modelId ? 'selected' : ''}`}
                      onClick={() => setConfig({ ...config, defaultModel: model.modelId })}
                    >
                      <div className="model-selector">
                        <input
                          type="radio"
                          name="defaultModel"
                          checked={config.defaultModel === model.modelId}
                          onChange={() => setConfig({ ...config, defaultModel: model.modelId })}
                        />
                      </div>
                      <div className="model-info">
                        <h3>{model.name}</h3>
                        <p>{model.description}</p>
                        <div className="model-meta">
                          <span className="badge">Max {model.maxTokens.toLocaleString()} tokens</span>
                          {model.supportsStreaming && <span className="badge">Streaming</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section">
                <h2>Generation Parameters</h2>
                <p className="section-description">
                  Fine-tune how the AI generates content
                </p>

                <div className="form-group">
                  <label htmlFor="temperature">
                    Temperature: {config.temperature}
                  </label>
                  <input
                    type="range"
                    id="temperature"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) =>
                      setConfig({ ...config, temperature: parseFloat(e.target.value) })
                    }
                  />
                  <div className="range-labels">
                    <span>More Precise</span>
                    <span>More Creative</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="maxTokens">Max Tokens: {config.maxTokens}</label>
                  <input
                    type="number"
                    id="maxTokens"
                    min="256"
                    max={getModelById(config.defaultModel)?.maxTokens || 200000}
                    step="256"
                    value={config.maxTokens}
                    onChange={(e) =>
                      setConfig({ ...config, maxTokens: parseInt(e.target.value) })
                    }
                  />
                  <p className="hint">
                    Maximum number of tokens the AI can generate in a single response
                  </p>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.enableStreaming}
                      onChange={(e) =>
                        setConfig({ ...config, enableStreaming: e.target.checked })
                      }
                    />
                    <span>Enable Response Streaming</span>
                  </label>
                  <p className="hint">
                    Show responses as they're generated instead of waiting for completion
                  </p>
                </div>
              </div>

              <div className="section">
                <h2>Custom API Configuration</h2>
                <p className="section-description">
                  Use your own Anthropic API key for direct API access
                </p>

                <div className="form-group">
                  <label htmlFor="customApiKey">Anthropic API Key</label>
                  <input
                    type="password"
                    id="customApiKey"
                    value={config.customApiKey}
                    onChange={(e) => setConfig({ ...config, customApiKey: e.target.value })}
                    placeholder="sk-ant-..."
                  />
                  <p className="hint">
                    Your API key is stored securely in your account and used for all AI requests
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="customBaseUrl">Custom Base URL (optional)</label>
                  <input
                    type="url"
                    id="customBaseUrl"
                    value={config.customBaseUrl}
                    onChange={(e) => setConfig({ ...config, customBaseUrl: e.target.value })}
                    placeholder="https://api.anthropic.com"
                  />
                  <p className="hint">
                    Override the default Anthropic API endpoint (for proxies or custom deployments)
                  </p>
                </div>

                <div className="form-actions">
                  <button
                    onClick={testConnection}
                    disabled={saving || !config.customApiKey}
                    className="btn btn-secondary"
                  >
                    {saving ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>

              <div className="settings-footer">
                <button
                  onClick={() => navigate(-1)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save AI Settings'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="ai-tab-content">
              <div className="section">
                <div className="prompts-header">
                  <h2>Prompt Templates</h2>
                  <button className="btn btn-primary btn-sm">+ New Template</button>
                </div>
                <p className="section-description">
                  Manage reusable prompt templates for common AI tasks
                </p>

                {templates.length === 0 ? (
                  <div className="empty-state">
                    <p>No prompt templates yet. Create your first template to get started.</p>
                  </div>
                ) : (
                  <div className="templates-list">
                    {templates.map((template) => (
                      <div key={template.id} className="prompt-template-card">
                        <div className="template-header">
                          <div>
                            <h3>{template.name}</h3>
                            <span className="category-badge">{template.category}</span>
                          </div>
                          <div className="template-actions">
                            <button className="btn-icon" title="Edit">✏️</button>
                            <button className="btn-icon delete" title="Delete">🗑️</button>
                          </div>
                        </div>
                        <p className="template-description">{template.description}</p>
                        <div className="template-preview">
                          <code>{template.prompt.slice(0, 150)}...</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
