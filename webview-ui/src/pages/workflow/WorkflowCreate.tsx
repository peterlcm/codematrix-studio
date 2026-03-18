import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './workflow.css';

interface Template {
  id: string;
  name: string;
  description: string;
  stages: Array<{
    title: string;
    stageType: string;
  }>;
}

interface StageConfig {
  id: string;
  title: string;
  stageType: string;
  requiredApproval: boolean;
  assigneeId?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STAGE_TYPES = [
  { value: 'PRD_DESIGN', label: 'PRD Design', emoji: '📋' },
  { value: 'UI_UX_DESIGN', label: 'UI/UX Design', emoji: '🎨' },
  { value: 'DEVELOPMENT', label: 'Development', emoji: '💻' },
  { value: 'TESTING', label: 'Testing', emoji: '🧪' },
  { value: 'DEPLOYMENT', label: 'Deployment', emoji: '🚀' },
  { value: 'DOCUMENTATION', label: 'Documentation', emoji: '📚' },
];

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'standard',
    name: 'Standard Development',
    description: 'Classic 4-stage workflow for most projects',
    stages: [
      { title: 'PRD & Requirements', stageType: 'PRD_DESIGN' },
      { title: 'UI/UX Design', stageType: 'UI_UX_DESIGN' },
      { title: 'Development', stageType: 'DEVELOPMENT' },
      { title: 'Testing & QA', stageType: 'TESTING' },
    ],
  },
  {
    id: 'agile',
    name: 'Agile Development',
    description: 'Iterative development with multiple testing cycles',
    stages: [
      { title: 'Sprint Planning', stageType: 'PRD_DESIGN' },
      { title: 'UI Design', stageType: 'UI_UX_DESIGN' },
      { title: 'Development Sprint 1', stageType: 'DEVELOPMENT' },
      { title: 'Testing Sprint 1', stageType: 'TESTING' },
      { title: 'Development Sprint 2', stageType: 'DEVELOPMENT' },
      { title: 'Final Testing', stageType: 'TESTING' },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple 2-stage workflow for small projects',
    stages: [
      { title: 'Design & Planning', stageType: 'PRD_DESIGN' },
      { title: 'Development', stageType: 'DEVELOPMENT' },
    ],
  },
  {
    id: 'full-cycle',
    name: 'Full Cycle Release',
    description: 'Complete workflow including deployment and docs',
    stages: [
      { title: 'Requirements', stageType: 'PRD_DESIGN' },
      { title: 'UI Design', stageType: 'UI_UX_DESIGN' },
      { title: 'Development', stageType: 'DEVELOPMENT' },
      { title: 'Testing', stageType: 'TESTING' },
      { title: 'Deployment', stageType: 'DEPLOYMENT' },
      { title: 'Documentation', stageType: 'DOCUMENTATION' },
    ],
  },
];

export default function WorkflowCreate() {
  const { id: projectId } = useParams<{ id: string }>();
  const [step, setStep] = useState<'template' | 'configure'>('template');
  const [loading, setLoading] = useState(false);
  const [existingWorkflow, setExistingWorkflow] = useState<any>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [workflowName, setWorkflowName] = useState('Main Workflow');

  useEffect(() => {
    if (projectId) {
      checkExistingWorkflow();
    }
  }, [projectId]);

  const checkExistingWorkflow = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/workflows/project/${projectId}`);
      if (response.data.success && response.data.data) {
        setExistingWorkflow(response.data.data);
      }
    } catch (err) {
      // No existing workflow is fine
    }
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    const initialStages: StageConfig[] = template.stages.map((s, index) => ({
      id: `stage-${index}`,
      title: s.title,
      stageType: s.stageType,
      requiredApproval: true,
    }));
    setStages(initialStages);
    setStep('configure');
  };

  const addStage = () => {
    const newStage: StageConfig = {
      id: `stage-${Date.now()}`,
      title: '',
      stageType: 'DEVELOPMENT',
      requiredApproval: true,
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (index: number) => {
    const newStages = [...stages];
    newStages.splice(index, 1);
    setStages(newStages);
  };

  const updateStage = (index: number, updates: Partial<StageConfig>) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], ...updates };
    setStages(newStages);
  };

  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const newStages = [...stages];
    [newStages[index], newStages[index - 1]] = [newStages[index - 1], newStages[index]];
    setStages(newStages);
  };

  const moveStageDown = (index: number) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
    setStages(newStages);
  };

  const handleCreate = async () => {
    if (!projectId) {
      setError('Project ID is required');
      return;
    }

    if (!workflowName.trim()) {
      setError('Workflow name is required');
      return;
    }

    if (stages.length === 0) {
      setError('At least one stage is required');
      return;
    }

    const invalidStage = stages.find(s => !s.title.trim());
    if (invalidStage) {
      setError('All stages must have a title');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/workflows`, {
        projectId,
        name: workflowName,
        stages: stages.map(s => ({
          title: s.title,
          stageType: s.stageType,
          requiredApproval: s.requiredApproval,
          assigneeId: s.assigneeId || null,
        })),
      });

      if (response.data.success) {
        navigate(`/projects/${projectId}`);
      } else {
        setError(response.data.error || 'Failed to create workflow');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const getStageTypeInfo = (type: string) => {
    return STAGE_TYPES.find(t => t.value === type) || STAGE_TYPES[2];
  };

  if (existingWorkflow) {
    return (
      <div className="page-container">
        <header className="page-header">
          <div className="header-content">
            <h1>Workflow Already Exists</h1>
            <button onClick={() => navigate(`/projects/${projectId}`)} className="btn btn-secondary">
              ← Back to Project
            </button>
          </div>
        </header>
        <main className="page-main">
          <div className="info-box warning">
            <h4>⚠️ Workflow already exists for this project</h4>
            <p>A workflow is already configured. You can delete it first if you want to create a new one.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-content">
          <h1>Create Workflow</h1>
          <button onClick={() => navigate(`/projects/${projectId}`)} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </header>

      <main className="page-main">
        {error && <div className="error-message">{error}</div>}

        {step === 'template' && (
          <div className="template-selection">
            <h2>Choose a Template</h2>
            <p className="subtitle">Start with a pre-built workflow template or create from scratch</p>

            <div className="templates-grid">
              {DEFAULT_TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  className="template-card"
                  onClick={() => selectTemplate(template)}
                >
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <div className="stage-preview">
                    {template.stages.map((stage, idx) => {
                      const info = getStageTypeInfo(stage.stageType);
                      return (
                        <span key={idx} className="stage-preview-item">
                          {info.emoji} {info.label}
                        </span>
                      );
                    })}
                  </div>
                  <button className="btn btn-primary">Use Template</button>
                </div>
              ))}

              <div
                className="template-card blank"
                onClick={() => {
                  setSelectedTemplate(null);
                  setStages([]);
                  setStep('configure');
                }}
              >
                <h3>Blank Workflow</h3>
                <p>Create a custom workflow from scratch</p>
                <div className="stage-preview">
                  <span className="stage-preview-item">No stages yet</span>
                </div>
                <button className="btn btn-secondary">Start Blank</button>
              </div>
            </div>
          </div>
        )}

        {step === 'configure' && (
          <div className="workflow-config">
            <div className="config-header">
              <h2>Configure Workflow</h2>
              <button onClick={() => setStep('template')} className="btn btn-secondary btn-sm">
                ← Back to Templates
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="workflowName">Workflow Name</label>
              <input
                type="text"
                id="workflowName"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Main Development Workflow"
                required
              />
            </div>

            <div className="stages-config">
              <div className="stages-header">
                <h3>Workflow Stages ({stages.length})</h3>
                <button onClick={addStage} className="btn btn-primary btn-sm">
                  + Add Stage
                </button>
              </div>

              {stages.length === 0 && (
                <div className="empty-states">
                  <p>No stages added yet. Click "Add Stage" to get started.</p>
                </div>
              )}

              {stages.map((stage, index) => {
                const info = getStageTypeInfo(stage.stageType);
                return (
                  <div key={stage.id} className="stage-config-card">
                    <div className="stage-config-header">
                      <span className="stage-order">{index + 1}</span>
                      <span className="stage-type-badge">
                        {info.emoji} {info.label}
                      </span>
                      <div className="stage-actions">
                        <button
                          onClick={() => moveStageUp(index)}
                          disabled={index === 0}
                          className="btn-icon"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveStageDown(index)}
                          disabled={index === stages.length - 1}
                          className="btn-icon"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeStage(index)}
                          className="btn-icon delete"
                          title="Remove stage"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="stage-config-body">
                      <div className="form-row">
                        <div className="form-group flex-1">
                          <label>Stage Title</label>
                          <input
                            type="text"
                            value={stage.title}
                            onChange={(e) => updateStage(index, { title: e.target.value })}
                            placeholder="e.g., Design User Interface"
                          />
                        </div>

                        <div className="form-group flex-1">
                          <label>Stage Type</label>
                          <select
                            value={stage.stageType}
                            onChange={(e) => updateStage(index, { stageType: e.target.value })}
                          >
                            {STAGE_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.emoji} {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-row">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={stage.requiredApproval}
                            onChange={(e) =>
                              updateStage(index, { requiredApproval: e.target.checked })
                            }
                          />
                          <span>Require approval to proceed to next stage</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="config-actions">
              <button
                onClick={() => navigate(`/projects/${projectId!}`)}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || stages.length === 0}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
