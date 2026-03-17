import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';

// Prompt templates for each stage
const PROMPT_TEMPLATES = {
  PRD: `You are a senior product manager creating a comprehensive Product Requirements Document (PRD).

Project Name: {{projectName}}

{{#if projectDescription}}
Project Description: {{projectDescription}}
{{/if}}

{{#if initialPrompt}}
Initial Requirements: {{initialPrompt}}
{{/if}}

Create a detailed PRD with the following sections:
1. **Executive Summary** - Brief overview of the project
2. **Problem Statement** - What problem are we solving?
3. **Target Users** - Who are the users? Define user personas
4. **Functional Requirements** - Detailed feature list with user stories
5. **Non-Functional Requirements** - Performance, security, scalability needs
6. **User Interface Requirements** - General UI/UX expectations
7. **Technical Constraints** - Tech stack limitations, integrations
8. **Success Metrics** - How do we measure success?

Format your response as a well-structured markdown document. Be specific and detailed.`,
  UI_DESIGN: `You are a senior UI/UX designer creating a detailed design specification.

Project Name: {{projectName}}

Product Requirements Document (Reference):
{{prdContent}}

Based on the PRD, create a comprehensive UI/UX design specification including:
1. **Design Principles** - Core design philosophy
2. **Layout Structure** - Page hierarchy, navigation
3. **Component Library** - Reusable UI components with states
4. **Visual Design** - Color palette, typography, spacing
5. **Interaction Flows** - User flows and key interactions
6. **Wireframes/Mockups** - Text-based wireframe descriptions
7. **Responsive Design** - Mobile, tablet, desktop considerations
8. **Accessibility** - WCAG compliance, keyboard navigation
9. **Animation Specifications** - Transitions, micro-interactions

Format as markdown with clear sections and bullet points.`,
  CODE: `You are a senior full-stack developer implementing a complete project.

Project Name: {{projectName}}

Product Requirements:
{{prdContent}}

UI/UX Design Specification:
{{uiDesignContent}}

Generate a complete full-stack implementation with:

**Project Structure**
- File and folder organization

**Frontend** (React + TypeScript)
- Main App component and routing
- Key components with props interfaces
- State management setup
- API service layer

**Backend** (Node.js/Express + TypeScript)
- API routes and controllers
- Data models and database schema
- Business logic services

**Shared**
- TypeScript types/interfaces
- Utility functions

Provide complete, working code. Include comments explaining complex parts. Use best practices.`,
  TESTS: `You are a senior QA engineer creating comprehensive tests.

Project Name: {{projectName}}

Product Requirements:
{{prdContent}}

UI/UX Design:
{{uiDesignContent}}

Code to Test:
{{codeContent}}

Generate a complete test suite including:

1. **Test Strategy** - Testing approach and priorities
2. **Unit Tests** - Component and function tests
3. **Integration Tests** - API and workflow tests
4. **E2E Tests** - User journey tests
5. **Test Data** - Mock data and fixtures
6. **Coverage Goals** - Target coverage percentage

Use {{testFramework}} or the most appropriate framework for this project. Provide working test code.`,
};

export class AIGateway {
  private anthropic: Anthropic;
  private defaultModel = 'claude-sonnet-4-20250514';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.warn('ANTHROPIC_API_KEY not set - AI features will not work');
    }
    this.anthropic = new Anthropic({
      apiKey: apiKey || 'dummy-key',
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

    return this.callAnthropic(prompt);
  }

  async generateUIDesign(params: {
    prdContent: string;
    projectName: string;
  }): Promise<string> {
    const prompt = this.renderTemplate(PROMPT_TEMPLATES.UI_DESIGN, {
      projectName: params.projectName,
      prdContent: params.prdContent,
    });

    return this.callAnthropic(prompt);
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

    return this.callAnthropic(prompt);
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

    return this.callAnthropic(prompt);
  }

  async chat(params: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    temperature?: number;
  }): Promise<{ content: string; tokensUsed?: number }> {
    try {
      const response = await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: 4096,
        temperature: params.temperature ?? 0.7,
        system: params.systemPrompt || 'You are a helpful AI assistant.',
        messages: params.messages as Anthropic.MessageParam[],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return {
        content: content.text,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      logger.error({ error }, 'Anthropic chat failed');
      throw error;
    }
  }

  async getStatus(): Promise<{ provider: string; model: string; available: boolean }> {
    try {
      // Simple test to check if API key is valid
      await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return {
        provider: 'anthropic',
        model: this.defaultModel,
        available: true,
      };
    } catch (error) {
      logger.warn({ error }, 'Anthropic API not available');
      return {
        provider: 'anthropic',
        model: this.defaultModel,
        available: false,
      };
    }
  }

  private async callAnthropic(prompt: string): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: 8192,
        temperature: 0.7,
        system: 'You are a professional software development assistant. Generate comprehensive, detailed, and practical content.',
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      logger.info({ tokens: response.usage }, 'AI request completed');
      return content.text;
    } catch (error) {
      logger.error({ error }, 'Anthropic API call failed');
      throw error;
    }
  }

  private renderTemplate(template: string, variables: Record<string, string | undefined>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
    }

    // Handle conditionals {{#if key}}...{{/if}}
    result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_match, key, content) => {
      return variables[key] ? content : '';
    });

    return result;
  }
}