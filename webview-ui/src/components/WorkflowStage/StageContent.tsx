import { useMemo } from 'react';

interface StageContentProps {
  type: 'prd' | 'ui-design' | 'code' | 'test' | 'text';
  content: string;
}

// Simple markdown-like rendering for content display
export function StageContent({ type, content }: StageContentProps) {
  const renderContent = useMemo(() => {
    if (!content) {
      return <p className="text-vscode-editorWidget-foreground italic">尚未生成内容。</p>;
    }

    // For code, use pre/code formatting
    if (type === 'code' || type === 'test') {
      return (
        <pre className="bg-vscode-editorWidget-background p-4 rounded overflow-auto text-sm font-mono">
          <code>{content}</code>
        </pre>
      );
    }

    // For text content, do basic markdown rendering
    return <MarkdownRenderer content={content} />;
  }, [content, type]);

  return (
    <div className="markdown-content">
      {renderContent}
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown-like parser
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let inList = false;
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' = 'ul';

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} className="ml-6 mb-4">
          {listItems.map((item, i) => (
            <li key={i} className="mb-1">{item}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-vscode-editorWidget-background p-4 rounded overflow-auto text-sm font-mono mb-4">
            <code>{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      const classes = {
        1: 'text-2xl font-bold mb-4',
        2: 'text-xl font-bold mb-3',
        3: 'text-lg font-semibold mb-2',
        4: 'text-base font-semibold mb-2',
        5: 'text-sm font-semibold mb-1',
        6: 'text-sm font-semibold mb-1',
      }[level] || '';
      elements.push(<HeadingTag key={index} className={classes}>{text}</HeadingTag>);
      return;
    }

    // Bold
    if (line.match(/^\*\*(.+)\*\*$/)) {
      flushList();
      const text = line.replace(/^\*\*(.+)\*\*$/, '$1');
      elements.push(<p key={index} className="font-bold mb-2">{text}</p>);
      return;
    }

    // Lists
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

    if (unorderedMatch) {
      if (!inList || listType !== 'ul') {
        flushList();
        inList = true;
        listType = 'ul';
      }
      listItems.push(unorderedMatch[1]);
      return;
    }

    if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        inList = true;
        listType = 'ol';
      }
      listItems.push(orderedMatch[1]);
      return;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      flushList();
      elements.push(<hr key={index} className="my-4 border-vscode-editorWidget-background" />);
      return;
    }

    // Tables (simple implementation)
    const tableMatch = line.match(/^\|(.+)\|$/);
    if (tableMatch && line.includes('|---')) {
      // Skip the separator line
      return;
    }
    if (tableMatch) {
      flushList();
      const cells = tableMatch[1].split('|').map(c => c.trim());
      // For simplicity, treat as a row - a full table implementation would need state
      elements.push(
        <div key={index} className="flex border-b border-vscode-editorWidget-background">
          {cells.map((cell, i) => (
            <div key={i} className="flex-1 p-2">{cell}</div>
          ))}
        </div>
      );
      return;
    }

    // Code inline
    if (line.includes('`')) {
      flushList();
      const parts = line.split(/(`[^`]+`)/);
      elements.push(
        <p key={index} className="mb-2">
          {parts.map((part, i) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={i} className="bg-vscode-editorWidget-background px-1 rounded">{part.slice(1, -1)}</code>;
            }
            return part;
          })}
        </p>
      );
      return;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(<p key={index} className="mb-2">{line}</p>);
  });

  flushList();

  return <>{elements}</>;
}