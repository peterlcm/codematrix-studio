import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface ParsedFile {
  filepath: string;
  language: string;
  content: string;
}

const STAGE_DIR_MAP: Record<string, string> = {
  PRD_DESIGN: 'prd',
  UI_UX_DESIGN: 'ui-design',
  DEVELOPMENT: 'src',
  TESTING: 'tests',
};

const PROJECTS_BASE = path.resolve(process.cwd(), 'projects');

export class FileWriter {
  static getProjectDir(projectId: string): string {
    return path.join(PROJECTS_BASE, projectId);
  }

  static getStageDir(projectId: string, stageType: string): string {
    const stageDir = STAGE_DIR_MAP[stageType] || 'output';
    return path.join(PROJECTS_BASE, projectId, stageDir);
  }

  static parseFiles(aiContent: string): ParsedFile[] {
    const files: ParsedFile[] = [];
    const regex = /```(\w+)?:([^\n]+)\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(aiContent)) !== null) {
      const language = match[1] || 'text';
      const filepath = match[2].trim();
      const content = match[3];

      if (filepath && content) {
        files.push({ filepath, language, content });
      }
    }

    return files;
  }

  static async writeFiles(
    projectId: string,
    stageType: string,
    aiContent: string,
  ): Promise<ParsedFile[]> {
    const stageDir = this.getStageDir(projectId, stageType);
    const parsed = this.parseFiles(aiContent);

    if (parsed.length === 0 && stageType === 'PRD_DESIGN') {
      const prdPath = path.join(stageDir, 'PRD.md');
      await this.ensureDir(path.dirname(prdPath));
      fs.writeFileSync(prdPath, aiContent, 'utf-8');
      logger.info('Wrote PRD file', { path: prdPath });
      return [{ filepath: 'PRD.md', language: 'markdown', content: aiContent }];
    }

    if (parsed.length === 0) {
      const fallbackName = stageType === 'TESTING' ? 'test-plan.md' : 'output.md';
      const fallbackPath = path.join(stageDir, fallbackName);
      await this.ensureDir(path.dirname(fallbackPath));
      fs.writeFileSync(fallbackPath, aiContent, 'utf-8');
      logger.info('Wrote fallback file', { path: fallbackPath });
      return [{ filepath: fallbackName, language: 'markdown', content: aiContent }];
    }

    for (const file of parsed) {
      const sanitized = file.filepath.replace(/\.\./g, '').replace(/^\//, '');
      const fullPath = path.join(stageDir, sanitized);
      await this.ensureDir(path.dirname(fullPath));
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      file.filepath = sanitized;
    }

    logger.info('Wrote files from AI output', {
      projectId,
      stageType,
      fileCount: parsed.length,
      files: parsed.map(f => f.filepath),
    });

    return parsed;
  }

  static async getFileTree(projectDir: string, basePath = ''): Promise<FileTreeNode[]> {
    const result: FileTreeNode[] = [];

    if (!fs.existsSync(projectDir)) return result;

    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const children = await this.getFileTree(path.join(projectDir, entry.name), relativePath);
        result.push({ name: entry.name, path: relativePath, type: 'directory', children });
      } else {
        const ext = path.extname(entry.name).slice(1);
        result.push({ name: entry.name, path: relativePath, type: 'file', extension: ext });
      }
    }

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  static readFile(projectId: string, filePath: string): string | null {
    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '');
    const fullPath = path.join(PROJECTS_BASE, projectId, sanitized);

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
    return fs.readFileSync(fullPath, 'utf-8');
  }

  static writeFile(projectId: string, filePath: string, content: string): boolean {
    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '');
    const fullPath = path.join(PROJECTS_BASE, projectId, sanitized);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    return true;
  }

  private static async ensureDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  children?: FileTreeNode[];
}
