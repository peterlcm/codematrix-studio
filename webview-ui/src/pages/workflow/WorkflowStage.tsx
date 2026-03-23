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
  aiContent: string | null;
  humanContent: string | null;
  workflowId: string;
  projectId: string;
}

interface GeneratedFile {
  path: string;
  content: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  children?: FileTreeNode[];
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
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const navigate = useNavigate();

  // Handle case where params are undefined
  if (!workflowId || !stageId) {
    navigate('/projects');
    return null;
  }

  const projectId = stage?.projectId;

  const loadFileTree = async () => {
    if (!projectId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/files/${projectId}/tree`);
      if (response.data.success) {
        setFileTree(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load file tree', err);
    }
  };

  const loadFileContent = async (filePath: string) => {
    if (!projectId) return;
    setLoadingFile(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/files/${projectId}/read/${filePath}`);
      if (response.data.success) {
        setSelectedFile(filePath);
        setSelectedFileContent(response.data.data.content || '');
      }
    } catch (err) {
      console.error('Failed to load file content', err);
    } finally {
      setLoadingFile(false);
    }
  };

  const closeFile = () => {
    setSelectedFile(null);
    setSelectedFileContent('');
  };

  const loadStage = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/workflows/stage/${stageId}`);
      if (response.data.success) {
        const stageData = response.data.data;
        setStage(stageData);
        // Prioritize human edits over AI generated content
        setContent(stageData.humanContent || stageData.aiContent || '');
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
    if (projectId) {
      loadFileTree();
    }
  }, [stageId, projectId]);

  const saveContent = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/v1/workflows/stage/${stageId}`, {
        content,
        status: stage?.status === 'PENDING' ? 'IN_PROGRESS' : stage?.status,
      });

      if (response.data.success) {
        const stageData = response.data.data;
        setStage(stageData);
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
      const response = await axios.post(`${API_BASE_URL}/api/v1/workflows/stage/${stageId}/approve`);
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
      // Get project name from project
      const projectResponse = await axios.get(`${API_BASE_URL}/api/v1/projects/${stage?.projectId}`);
      const projectName = projectResponse.data.data?.name || 'Project';
      let prdContent = '';
      let uiDesignContent = '';
      let codeContent = '';

      // Get content from previous stages if needed
      if (stage?.workflowId) {
        const workflowResponse = await axios.get(`${API_BASE_URL}/api/v1/workflows/${stage?.workflowId}`);
        if (workflowResponse.data.success) {
          const workflow = workflowResponse.data.data;
          const prdStage = workflow.stages?.find((s: any) => s.stageType === 'PRD_DESIGN');
          const uiStage = workflow.stages?.find((s: any) => s.stageType === 'UI_UX_DESIGN');
          const devStage = workflow.stages?.find((s: any) => s.stageType === 'DEVELOPMENT');
          prdContent = prdStage?.humanContent || prdStage?.aiContent || '';
          uiDesignContent = uiStage?.humanContent || uiStage?.aiContent || '';
          codeContent = devStage?.humanContent || devStage?.aiContent || '';
        }
      }

      let endpoint = '';
      const requestBody: any = { projectName };

      switch (stage?.stageType) {
        case 'PRD_DESIGN':
          endpoint = '/api/v1/ai/generate-prd';
          requestBody.projectDescription = content || projectName;
          requestBody.initialPrompt = content || projectName;
          break;
        case 'UI_UX_DESIGN':
          endpoint = '/api/v1/ai/generate-ui-design';
          requestBody.prdContent = prdContent;
          break;
        case 'DEVELOPMENT':
          endpoint = '/api/v1/ai/generate-code';
          requestBody.prdContent = prdContent;
          requestBody.uiDesignContent = uiDesignContent;
          break;
        case 'TESTING':
          endpoint = '/api/v1/ai/generate-tests';
          requestBody.prdContent = prdContent;
          requestBody.uiDesignContent = uiDesignContent;
          requestBody.codeContent = codeContent;
          break;
        default:
          endpoint = '/api/v1/ai/chat';
          requestBody.messages = [{ role: 'user', content: content || `Generate content for ${stage?.title}` }];
          break;
      }

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, requestBody);

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

  const renderFileTreeNode = (node: FileTreeNode, depth: number = 0) => {
    const paddingLeft = depth * 16;
    if (node.type === 'directory') {
      return (
        <div key={node.path}>
          <div
            className="file-tree-item directory"
            style={{ paddingLeft }}
          >
            <span>📁 {node.name}</span>
          </div>
          {node.children?.map(child => renderFileTreeNode(child, depth + 1))}
        </div>
      );
    }

    const getFileIcon = (ext?: string): string => {
      const icons: Record<string, string> = {
        ts: '📘', tsx: '⚛️', js: '📜', jsx: '⚛️',
        html: '🌐', css: '🎨', json: '📋', md: '📝',
        png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
      };
      return icons[ext?.toLowerCase() || ''] || '📄';
    };

    return (
      <div
        key={node.path}
        className={`file-tree-item file ${selectedFile === node.path ? 'selected' : ''}`}
        style={{ paddingLeft }}
        onClick={() => loadFileContent(node.path)}
      >
        <span>{getFileIcon(node.extension)} {node.name}</span>
        {node.extension === 'html' && (
          <button
            className="preview-btn"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${API_BASE_URL}/api/v1/files/${projectId}/preview/${node.path}`, '_blank');
            }}
            title="Preview in new tab"
          >
            👁
          </button>
        )}
      </div>
    );
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

        {/* Generated Files */}
        {fileTree.length > 0 && (
          <div className="generated-files-section">
            <h3>📁 Generated Files ({fileTree.length})</h3>
            <div className="generated-files-container">
              <div className="file-tree-panel">
                {fileTree.map(node => renderFileTreeNode(node))}
              </div>
              {selectedFile && (
                <div className="file-content-panel">
                  <div className="file-content-header">
                    <span>{selectedFile}</span>
                    <button className="btn-close" onClick={closeFile}>✕</button>
                  </div>
                  {loadingFile ? (
                    <div className="loading-container-inline">
                      <div className="spinner-sm"></div>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    <pre className="file-content">{selectedFileContent}</pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
