import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';

export type AIProvider = 'anthropic' | 'openai-compatible';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

const FILE_OUTPUT_INSTRUCTION = `

【重要】输出格式要求：
请将每个文件的内容用以下格式输出，每个文件一个代码块：

\`\`\`语言:文件路径
文件内容
\`\`\`

例如：
\`\`\`html:index.html
<!DOCTYPE html>...
\`\`\`

\`\`\`css:styles/main.css
body { ... }
\`\`\`

每个代码块的第一行必须是 \`\`\`语言:文件路径 格式，文件路径使用相对路径。`;

const PROMPT_TEMPLATES = {
  PRD: `你是一位资深产品经理，正在撰写一份详尽的产品需求文档（PRD）。

项目名称：{{projectName}}

{{#if projectDescription}}
项目描述：{{projectDescription}}
{{/if}}

{{#if initialPrompt}}
初始需求：{{initialPrompt}}
{{/if}}

请用中文撰写一份详细的 PRD 文档，包含以下章节：
1. **执行摘要** - 项目概述
2. **问题陈述** - 我们要解决什么问题？
3. **目标用户** - 用户画像和角色定义
4. **功能需求** - 详细的功能列表与用户故事
5. **非功能需求** - 性能、安全性、可扩展性要求
6. **用户界面需求** - UI/UX 的总体预期
7. **技术约束** - 技术栈限制和集成需求
8. **成功指标** - 如何衡量项目是否成功？

请使用结构良好的 Markdown 格式，内容要具体且详尽。
输出为一个文件，格式如下：
\`\`\`markdown:PRD.md
（PRD文档完整内容）
\`\`\``,
  UI_DESIGN: `你是一位资深 UI/UX 设计师和前端工程师。

项目名称：{{projectName}}

产品需求文档（参考）：
{{prdContent}}

基于以上 PRD，请直接生成**可在浏览器中打开预览的 HTML+CSS 界面原型**。

要求：
1. 生成一个 index.html 作为主入口/首页原型
2. 为每个主要页面生成独立的 HTML 文件（如 login.html、dashboard.html、detail.html 等）
3. 生成一个 styles.css 作为统一样式表
4. HTML 中使用中文标签和示例数据
5. 样式要现代美观，使用 CSS Flexbox/Grid 布局
6. 页面间通过链接相互跳转
7. 每个页面要包含完整的页面结构（导航栏、主内容区、页脚等）
8. 使用 CSS 变量定义主题色，方便后续调整

${FILE_OUTPUT_INSTRUCTION}

示例输出格式：
\`\`\`html:index.html
<!DOCTYPE html>
<html lang="zh-CN">...
\`\`\`

\`\`\`css:styles.css
:root { --primary: #4f46e5; }...
\`\`\`

\`\`\`html:pages/login.html
<!DOCTYPE html>...
\`\`\``,
  CODE: `你是一位资深全栈开发工程师，正在实现一个完整的项目。

项目名称：{{projectName}}

产品需求：
{{prdContent}}

UI/UX 设计规范：
{{uiDesignContent}}

请生成完整的、可运行的全栈项目代码。每个源文件独立输出。

技术栈要求：
- 前端：React 18 + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- 使用中文注释

需要生成的文件包括但不限于：
1. package.json（前端和后端各一个）
2. 前端：App.tsx、路由配置、各页面组件、API 服务层、类型定义
3. 后端：server.ts、路由文件、控制器、数据模型、中间件
4. 共享类型定义
5. 配置文件（tsconfig.json、vite.config.ts 等）

${FILE_OUTPUT_INSTRUCTION}

示例输出格式：
\`\`\`json:frontend/package.json
{ "name": "..." }
\`\`\`

\`\`\`typescript:frontend/src/App.tsx
import React from 'react';...
\`\`\`

\`\`\`typescript:backend/src/server.ts
import express from 'express';...
\`\`\``,
  TESTS: `你是一位资深 QA 工程师，正在编写全面的测试方案和测试脚本。

项目名称：{{projectName}}

产品需求：
{{prdContent}}

UI/UX 设计：
{{uiDesignContent}}

待测试代码：
{{codeContent}}

请生成以下内容：
1. 一份测试计划文档（test-plan.md），包含测试策略、测试范围、优先级
2. 完整的单元测试脚本文件（使用 {{testFramework}}）
3. API 集成测试脚本
4. 端到端测试脚本
5. 测试数据和 Mock 文件
6. jest.config.ts 或测试配置文件

每个测试文件独立输出。使用中文注释说明测试意图。

${FILE_OUTPUT_INSTRUCTION}

示例输出格式：
\`\`\`markdown:test-plan.md
# 测试计划...
\`\`\`

\`\`\`typescript:__tests__/components/App.test.tsx
import { render } from '@testing-library/react';...
\`\`\`

\`\`\`typescript:__tests__/api/users.test.ts
import request from 'supertest';...
\`\`\``,
};

const SYSTEM_PROMPT = '你是一位专业的软件开发助手。请使用中文生成全面、详尽、实用的内容。所有文档和注释都使用中文。请严格按照用户要求的文件输出格式（```语言:文件路径）来组织输出，确保每个文件都在独立的代码块中。';

function loadConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || 'anthropic') as AIProvider;

  if (provider === 'openai-compatible') {
    return {
      provider,
      apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-4o',
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8192', 10),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    };
  }

  return {
    provider: 'anthropic',
    apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8192', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  };
}

export class AIGateway {
  private config: AIConfig;
  private anthropic: Anthropic | null = null;

  constructor() {
    this.config = loadConfig();

    if (!this.config.apiKey) {
      logger.warn(`AI_API_KEY not set for provider "${this.config.provider}" - AI features will not work`);
    }

    if (this.config.provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey: this.config.apiKey || 'dummy-key' });
    }

    logger.info('AI Gateway initialized', {
      provider: this.config.provider,
      model: this.config.model,
      baseUrl: this.config.baseUrl || '(default)',
    });
  }

  async generatePRD(params: {
    projectName: string;
    projectDescription?: string;
    initialPrompt?: string;
  }): Promise<string> {
    const prompt = this.renderTemplate(PROMPT_TEMPLATES.PRD, {
      projectName: params.projectName,
      projectDescription: params.projectDescription,
      initialPrompt: params.initialPrompt,
    });
    return this.complete(prompt);
  }

  async generateUIDesign(params: {
    prdContent: string;
    projectName: string;
  }): Promise<string> {
    const prompt = this.renderTemplate(PROMPT_TEMPLATES.UI_DESIGN, {
      projectName: params.projectName,
      prdContent: params.prdContent,
    });
    return this.complete(prompt);
  }

  async generateCode(params: {
    prdContent: string;
    uiDesignContent: string;
    projectName: string;
    language?: string;
  }): Promise<string> {
    const prompt = this.renderTemplate(PROMPT_TEMPLATES.CODE, {
      projectName: params.projectName,
      prdContent: params.prdContent,
      uiDesignContent: params.uiDesignContent,
    });
    return this.complete(prompt);
  }

  async generateTests(params: {
    prdContent: string;
    uiDesignContent: string;
    codeContent: string;
    projectName: string;
    testFramework?: string;
  }): Promise<string> {
    const prompt = this.renderTemplate(PROMPT_TEMPLATES.TESTS, {
      projectName: params.projectName,
      prdContent: params.prdContent,
      uiDesignContent: params.uiDesignContent,
      codeContent: params.codeContent,
      testFramework: params.testFramework || 'Jest + React Testing Library',
    });
    return this.complete(prompt);
  }

  async chat(params: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    temperature?: number;
  }): Promise<{ content: string; tokensUsed?: number }> {
    const systemPrompt = params.systemPrompt || 'You are a helpful AI assistant.';
    const temperature = params.temperature ?? this.config.temperature ?? 0.7;

    if (this.config.provider === 'anthropic') {
      return this.chatAnthropic(params.messages, systemPrompt, temperature);
    }
    return this.chatOpenAICompatible(params.messages, systemPrompt, temperature, 4096);
  }

  async getStatus(): Promise<{ provider: string; model: string; available: boolean; baseUrl?: string }> {
    try {
      if (this.config.provider === 'anthropic') {
        await this.anthropic!.messages.create({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        });
      } else {
        const res = await fetch(`${this.config.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      return { provider: this.config.provider, model: this.config.model, available: true, baseUrl: this.config.baseUrl };
    } catch (error) {
      logger.warn('AI API not available', { error: String(error), provider: this.config.provider });
      return { provider: this.config.provider, model: this.config.model, available: false, baseUrl: this.config.baseUrl };
    }
  }

  private async complete(prompt: string): Promise<string> {
    if (this.config.provider === 'anthropic') {
      return this.completeAnthropic(prompt);
    }
    return this.completeOpenAICompatible(prompt);
  }

  async *completeStream(prompt: string): AsyncGenerator<string, void, unknown> {
    if (this.config.provider === 'anthropic') {
      yield* this.streamAnthropic(prompt);
    } else {
      yield* this.streamOpenAICompatible(prompt);
    }
  }

  private async *streamAnthropic(prompt: string): AsyncGenerator<string, void, unknown> {
    const stream = this.anthropic!.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 8192,
      temperature: this.config.temperature ?? 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && (event.delta as any).type === 'text_delta') {
        yield (event.delta as any).text;
      }
    }
  }

  private async *streamOpenAICompatible(prompt: string): AsyncGenerator<string, void, unknown> {
    const body = {
      model: this.config.model,
      max_tokens: this.config.maxTokens || 8192,
      temperature: this.config.temperature ?? 0.7,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    };

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* skip malformed chunks */ }
      }
    }
  }

  renderPrompt(stageType: string, variables: Record<string, string | undefined>): string {
    const templateMap: Record<string, string> = {
      PRD_DESIGN: PROMPT_TEMPLATES.PRD,
      UI_UX_DESIGN: PROMPT_TEMPLATES.UI_DESIGN,
      DEVELOPMENT: PROMPT_TEMPLATES.CODE,
      TESTING: PROMPT_TEMPLATES.TESTS,
    };
    const template = templateMap[stageType];
    if (!template) throw new Error(`Unknown stage type: ${stageType}`);
    return this.renderTemplate(template, variables);
  }

  private async completeAnthropic(prompt: string): Promise<string> {
    try {
      const response = await this.anthropic!.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 8192,
        temperature: this.config.temperature ?? 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type from Anthropic');
      logger.info('AI request completed', { provider: 'anthropic', tokens: response.usage });
      return content.text;
    } catch (error) {
      logger.error('Anthropic API call failed', { error: String(error) });
      throw error;
    }
  }

  private async completeOpenAICompatible(prompt: string): Promise<string> {
    try {
      const body = {
        model: this.config.model,
        max_tokens: this.config.maxTokens || 8192,
        temperature: this.config.temperature ?? 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      };

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI-compatible API error (${response.status}): ${errText}`);
      }

      const result = await response.json();
      const text = result.choices?.[0]?.message?.content;
      if (!text) throw new Error('No content in API response');

      const usage = result.usage;
      logger.info('AI request completed', {
        provider: this.config.provider,
        model: this.config.model,
        tokens: usage ? { input: usage.prompt_tokens, output: usage.completion_tokens } : undefined,
      });
      return text;
    } catch (error) {
      logger.error('OpenAI-compatible API call failed', { error: String(error), baseUrl: this.config.baseUrl });
      throw error;
    }
  }

  private async chatAnthropic(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature: number,
  ): Promise<{ content: string; tokensUsed?: number }> {
    try {
      const response = await this.anthropic!.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        temperature,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
      });
      const content = response.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type');
      return { content: content.text, tokensUsed: response.usage.input_tokens + response.usage.output_tokens };
    } catch (error) {
      logger.error('Anthropic chat failed', { error: String(error) });
      throw error;
    }
  }

  private async chatOpenAICompatible(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature: number,
    maxTokens: number,
  ): Promise<{ content: string; tokensUsed?: number }> {
    try {
      const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ model: this.config.model, max_tokens: maxTokens, temperature, messages: allMessages }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error (${response.status}): ${errText}`);
      }

      const result = await response.json();
      const text = result.choices?.[0]?.message?.content;
      if (!text) throw new Error('No content in API response');
      const usage = result.usage;
      return { content: text, tokensUsed: usage ? usage.prompt_tokens + usage.completion_tokens : undefined };
    } catch (error) {
      logger.error('OpenAI-compatible chat failed', { error: String(error) });
      throw error;
    }
  }

  private renderTemplate(template: string, variables: Record<string, string | undefined>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
    }
    result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_match, key, content) => {
      return variables[key] ? content : '';
    });
    return result;
  }
}
