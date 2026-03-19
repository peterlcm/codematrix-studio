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

请使用结构良好的 Markdown 格式，内容要具体且详尽。`,
  UI_DESIGN: `你是一位资深 UI/UX 设计师，正在撰写详细的设计规范文档。

项目名称：{{projectName}}

产品需求文档（参考）：
{{prdContent}}

基于以上 PRD，请用中文撰写一份全面的 UI/UX 设计规范，包含：
1. **设计原则** - 核心设计理念
2. **布局结构** - 页面层级、导航体系
3. **组件库** - 可复用 UI 组件及其状态
4. **视觉设计** - 配色方案、字体排版、间距规范
5. **交互流程** - 用户流程和关键交互描述
6. **线框图/原型** - 基于文本的页面布局描述
7. **响应式设计** - 移动端、平板、桌面端的适配方案
8. **无障碍设计** - WCAG 合规、键盘导航
9. **动效规范** - 过渡动画和微交互

请使用 Markdown 格式，分章节清晰列出。`,
  CODE: `你是一位资深全栈开发工程师，正在实现一个完整的项目。

项目名称：{{projectName}}

产品需求：
{{prdContent}}

UI/UX 设计规范：
{{uiDesignContent}}

请用中文注释，生成完整的全栈实现代码，包括：

**项目结构**
- 文件和目录组织

**前端**（React + TypeScript）
- 主应用组件和路由
- 关键组件及 Props 接口定义
- 状态管理方案
- API 服务层

**后端**（Node.js/Express + TypeScript）
- API 路由和控制器
- 数据模型和数据库 Schema
- 业务逻辑服务

**共享部分**
- TypeScript 类型/接口定义
- 工具函数

提供完整、可运行的代码。复杂部分用中文注释说明。遵循最佳实践。`,
  TESTS: `你是一位资深 QA 工程师，正在编写全面的测试方案。

项目名称：{{projectName}}

产品需求：
{{prdContent}}

UI/UX 设计：
{{uiDesignContent}}

待测试代码：
{{codeContent}}

请用中文撰写并生成完整的测试套件，包括：

1. **测试策略** - 测试方法和优先级
2. **单元测试** - 组件和函数测试
3. **集成测试** - API 和工作流测试
4. **端到端测试** - 用户旅程测试
5. **测试数据** - Mock 数据和 Fixtures
6. **覆盖率目标** - 目标覆盖率百分比

使用 {{testFramework}} 或最合适的测试框架。提供可运行的测试代码。`,
};

const SYSTEM_PROMPT = '你是一位专业的软件开发助手。请使用中文生成全面、详尽、实用的内容。所有文档和注释都使用中文。';

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
