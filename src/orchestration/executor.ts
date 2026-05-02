import { execSync } from 'child_process';
import { SkillResult } from '../templates/basic-skill';
import { skillRegistry, SkillMetadata } from './registry';

export interface ExecutionOptions {
  timeoutMs?: number;
}

const OPENCLAW_CONTAINER = 'agent-devkit-openclaw';
const HERMES_API_URL = process.env.HERMES_API_URL || 'http://localhost:8642';
const HERMES_API_KEY = process.env.HERMES_API_KEY || 'hermes-devkit-key';

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

      const timeoutMs = options.timeoutMs || 120000;

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
    // Verify OpenClaw container is running
    try {
      execSync(`docker ps -q -f name=${OPENCLAW_CONTAINER}`, { stdio: 'pipe' });
    } catch {
      throw new Error(
        `OpenClaw container is not running. ` +
        `Start it with: agent-devkit start`
      );
    }

    const message = this.buildOpenClawMessage(metadata, input);

    try {
      const output = execSync(
        `docker exec ${OPENCLAW_CONTAINER} openclaw agent --session-id main --message ${JSON.stringify(message)} --json --timeout 120`,
        {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 130000
        }
      );

      const data = JSON.parse(output);

      if (data.status !== 'ok') {
        throw new Error(`OpenClaw agent returned status: ${data.status}. Summary: ${data.summary || 'unknown'}`);
      }

      // Extract response text from payloads
      const payloads = data.result?.payloads || [];
      const responseText = payloads.map((p: any) => p.text || '').join('\n');

      return {
        success: true,
        data: {
          response: responseText,
          runId: data.runId,
          summary: data.summary,
          provider: data.result?.meta?.executionTrace?.winnerProvider,
          model: data.result?.meta?.executionTrace?.winnerModel,
          skillId: metadata.id
        }
      };
    } catch (error: any) {
      if (error.stderr) {
        const stderr = error.stderr.toString();
        if (stderr.includes('No API key found')) {
          throw new Error(
            'OpenClaw has no API key configured for the selected provider. ' +
            'Run `agent-devkit start` to auto-configure with your environment key, ' +
            'or set it manually inside the container.'
          );
        }
        if (stderr.includes('ECONNREFUSED') || stderr.includes('GatewayClientRequestError')) {
          throw new Error('OpenClaw gateway error. The container may still be initializing.');
        }
        throw new Error(`OpenClaw execution failed: ${stderr}`);
      }
      if (error.message?.includes('timed out')) {
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
    const inputDesc = typeof input === 'string' ? input : JSON.stringify(input);

    const skillActions: Record<string, string> = {
      'hermes.chat': 'Respond to the user\'s message',
      'hermes.browser': 'Browse the web and extract information',
      'hermes.terminal': 'Execute a shell command and return the output',
      'hermes.search': 'Search the web for information'
    };

    const action = skillActions[metadata.id] || metadata.description || 'Perform the requested task';
    const message = `${action}. Input: ${inputDesc}`;

    try {
      const output = execSync(
        `curl -s -X POST ${HERMES_API_URL}/v1/chat/completions ` +
        `-H "Authorization: Bearer ${HERMES_API_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d ${JSON.stringify(JSON.stringify({
          model: 'hermes-agent',
          messages: [{ role: 'user', content: message }],
          stream: false
        }))}`,
        {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 120000
        }
      );

      const data = JSON.parse(output);

      if (data.error) {
        throw new Error(`Hermes API error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        data: {
          response: content,
          model: data.model,
          usage: data.usage,
          skillId: metadata.id
        }
      };
    } catch (error: any) {
      if (error.stderr) {
        throw new Error(`Hermes execution failed: ${error.stderr}`);
      }
      if (error.message?.includes('timed out')) {
        throw new Error('Hermes request timed out. The agent may be busy or the LLM provider is slow.');
      }
      throw new Error(`Hermes execution failed: ${error.message}`);
    }
  }
}

export const executor = new SkillExecutor();
