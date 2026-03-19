import { useState, useEffect } from 'react';
import { useWorkflowStore, FileTreeNode } from '../../store/workflowStore';

interface FileTreePanelProps {
  projectId: string;
}

export function FileTreePanel({ projectId }: FileTreePanelProps) {
  const { fileTree, fetchFileTree, fetchFileContent, backendUrl } = useWorkflowStore();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  useEffect(() => {
    fetchFileTree(projectId);
  }, [projectId, fetchFileTree]);

  const handleFileClick = async (filePath: string, ext?: string) => {
    if (ext === 'html') {
      window.open(`${backendUrl}/api/v1/files/${projectId}/preview/` + filePath, '_blank');
      return;
    }

    setSelectedFile(filePath);
    setIsLoadingFile(true);
    const content = await fetchFileContent(projectId, filePath);
    setFileContent(content || '');
    setIsLoadingFile(false);
  };

  const handlePreviewHtml = (filePath: string) => {
    window.open(`${backendUrl}/api/v1/files/${projectId}/preview/` + filePath, '_blank');
  };

  if (fileTree.length === 0) return null;

  return (
    <div className="border-t border-vscode-editorWidget-background">
      <div className="flex items-center justify-between px-4 py-2 bg-vscode-editorWidget-background">
        <h3 className="text-sm font-semibold">生成的文件</h3>
        <button
          onClick={() => fetchFileTree(projectId)}
          className="text-xs text-vscode-editorWidget-foreground hover:text-vscode-foreground"
        >
          刷新
        </button>
      </div>

      <div className="flex" style={{ height: selectedFile ? '400px' : 'auto', maxHeight: '500px' }}>
        <div className="w-56 border-r border-vscode-editorWidget-background overflow-auto p-2">
          {fileTree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileClick={handleFileClick}
              onPreview={handlePreviewHtml}
              selectedFile={selectedFile}
            />
          ))}
        </div>

        {selectedFile && (
          <div className="flex-1 overflow-auto">
            <div className="flex items-center justify-between px-3 py-1 bg-vscode-editorWidget-background text-xs border-b border-vscode-editorWidget-background">
              <span className="font-mono">{selectedFile}</span>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-vscode-editorWidget-foreground hover:text-vscode-foreground"
              >
                关闭
              </button>
            </div>
            {isLoadingFile ? (
              <div className="p-4 text-sm text-vscode-editorWidget-foreground">加载中...</div>
            ) : (
              <pre className="p-4 text-xs font-mono overflow-auto whitespace-pre-wrap">{fileContent}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  onFileClick,
  onPreview,
  selectedFile,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick: (path: string, ext?: string) => void;
  onPreview: (path: string) => void;
  selectedFile: string | null;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  const paddingLeft = depth * 16 + 4;

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer hover:bg-vscode-list-hoverBackground text-xs"
          style={{ paddingLeft }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{isOpen ? '📂' : '📁'}</span>
          <span>{node.name}</span>
        </div>
        {isOpen && node.children?.map(child => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onFileClick={onFileClick}
            onPreview={onPreview}
            selectedFile={selectedFile}
          />
        ))}
      </div>
    );
  }

  const isHtml = node.extension === 'html';
  const isSelected = selectedFile === node.path;
  const icon = getFileIcon(node.extension);

  return (
    <div
      className={`flex items-center justify-between gap-1 py-0.5 px-1 rounded cursor-pointer text-xs group ${
        isSelected ? 'bg-vscode-list-activeSelectionBackground' : 'hover:bg-vscode-list-hoverBackground'
      }`}
      style={{ paddingLeft }}
      onClick={() => onFileClick(node.path, node.extension)}
    >
      <div className="flex items-center gap-1 truncate">
        <span>{icon}</span>
        <span className="truncate">{node.name}</span>
      </div>
      {isHtml && (
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(node.path); }}
          className="hidden group-hover:block text-xs text-vscode-button-background"
          title="在浏览器中预览"
        >
          👁
        </button>
      )}
    </div>
  );
}

function getFileIcon(ext?: string): string {
  const icons: Record<string, string> = {
    html: '🌐', css: '🎨', js: '📜', ts: '📘', tsx: '⚛️',
    json: '📋', md: '📝', svg: '🖼️', png: '🖼️', jpg: '🖼️',
  };
  return icons[ext || ''] || '📄';
}
