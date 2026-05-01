import axios from 'axios';
import { SkillResult } from '../templates/basic-skill';
import { skillRegistry, SkillMetadata } from './registry';

export interface ExecutionOptions {
  timeoutMs?: number;
}

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || 'http://localhost:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

export class SkillExecutor {
  /**
   * Safely executes a registered skill given its ID and inputs.
   */
  public async executeSkill(skillId: string, input: any, options: ExecutionOptions = {}): Promise<SkillResult> {
    const metadata = skillRegistry.getSkill(skillId);

    if (!metadata) {
      return { success: false, error: `Skill not found: ${skillId}` };
    }

    try {
      console.log(`[Executor] Executing ${skillId} on provider ${metadata.provider}...`);

      const timeoutMs = options.timeoutMs || 60000;

      const executePromise = this.routeExecution(metadata, input);
      const timeoutPromise = new Promise<SkillResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Skill execution timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      return await Promise.race([executePromise, timeoutPromise]);
    } catch (err: any) {
      console.error(`[Executor] Error executing skill ${skillId}:`, err);
      return { success: false, error: err.message };
    }
  }

  private async routeExecution(metadata: SkillMetadata, input: any): Promise<SkillResult> {
    switch (metadata.provider) {
      case 'local':
        return this.executeLocalSkill(metadata, input);
      case 'openclaw':
        return this.executeOpenClawSkill(metadata, input);
      case 'hermes':
        return this.executeHermesSkill(metadata, input);
      default:
        throw new Error(`Unsupported provider: ${metadata.provider}`);
    }
  }

  private async executeLocalSkill(metadata: SkillMetadata, input: any): Promise<SkillResult> {
    // Dynamic import for local skill instances
    let skillInstance: any;
    try {
      if (metadata.id === 'local.weather') {
        const { WeatherSkill } = await import('../../examples/weather/index');
        skillInstance = new WeatherSkill();
      } else if (metadata.id === 'local.calculator') {
        const { CalculatorSkill } = await import('../../examples/calculator/index');
        skillInstance = new CalculatorSkill();
      } else if (metadata.id === 'local.web-search') {
        const { WebSearchSkill } = await import('../../examples/web-search/index');
        skillInstance = new WebSearchSkill();
      } else if (metadata.id === 'local.email-cleaner') {
        const { EmailCleanerSkill } = await import('../../examples/email-cleaner/index');
        skillInstance = new EmailCleanerSkill();
      } else {
        throw new Error(`Local skill implementation not found for: ${metadata.id}`);
      }

      return await skillInstance.execute(input, { provider: 'local', user: 'system' });
    } catch (error: any) {
      throw new Error(`Failed to execute local skill: ${error.message}`);
    }
  }

  private async executeOpenClawSkill(metadata: SkillMetadata, input: any): Promise<SkillResult> {
    // Verify OpenClaw is reachable before attempting execution
    try {
      await axios.get(`${OPENCLAW_BASE_URL}/api/status`, { timeout: 3000 });
    } catch (err: any) {
      throw new Error(
        `OpenClaw is not running at ${OPENCLAW_BASE_URL}. ` +
        `Start it with: agent-devkit start`
      );
    }

    const message = this.buildOpenClawMessage(metadata, input);

    try {
      const response = await axios.post(
        `${OPENCLAW_BASE_URL}/api/sessions/main/messages`,
        { message },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(OPENCLAW_TOKEN ? { Authorization: `Bearer ${OPENCLAW_TOKEN}` } : {})
          },
          timeout: 60000
        }
      );

      const data = response.data;

      return {
        success: true,
        data: {
          response: data.response || data.text || data,
          session: data.session || 'main',
          model: data.model,
          tokens: data.tokens,
          skillId: metadata.id
        }
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new Error(
            'OpenClaw authentication failed. ' +
            'Set OPENCLAW_TOKEN environment variable or run `openclaw config set gateway.token <token>` inside the container.'
          );
        }
        if (status === 404) {
          throw new Error(
            'OpenClaw message endpoint not found (404). ' +
            'The gateway may still be initializing or the API route has changed.'
          );
        }
        if (status >= 500) {
          throw new Error(`OpenClaw gateway error (${status}): ${error.response.data?.message || 'Internal server error'}`);
        }
        throw new Error(`OpenClaw request failed (${status}): ${error.response.data?.message || error.message}`);
      }

      if (error.code === 'ECONNREFUSED') {
        throw new Error('OpenClaw connection refused. Container may have stopped.');
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new Error('OpenClaw request timed out. The agent may be busy or the LLM provider is slow.');
      }

      throw new Error(`OpenClaw execution failed: ${error.message}`);
    }
  }

  private buildOpenClawMessage(metadata: SkillMetadata, input: any): string {
    const inputDesc = typeof input === 'string' ? input : JSON.stringify(input);

    const skillActions: Record<string, string> = {
      'openclaw.browser': 'Browse the web and extract information',
      'openclaw.bash': 'Execute a shell command and return the output'
    };

    const action = skillActions[metadata.id] || metadata.description || 'Perform the requested task';

    return `${action}. Input: ${inputDesc}`;
  }

  private async executeHermesSkill(metadata: SkillMetadata, input: any): Promise<SkillResult> {
    // Hermes integration intentionally mocked while we focus on OpenClaw
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            result: `Hermes integration not yet implemented. Skill: ${metadata.id}`,
            inputReceived: input
          }
        });
      }, 600);
    });
  }
}

export const executor = new SkillExecutor();
