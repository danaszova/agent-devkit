import { execSync } from 'child_process';
import { SkillResult } from '../templates/basic-skill';
import { skillRegistry, SkillMetadata } from './registry';

export interface ExecutionOptions {
  timeoutMs?: number;
}

const CONTAINER_NAME = 'agent-devkit-openclaw';

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
      execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { stdio: 'pipe' });
    } catch {
      throw new Error(
        `OpenClaw container is not running. ` +
        `Start it with: agent-devkit start`
      );
    }

    const message = this.buildOpenClawMessage(metadata, input);

    try {
      const output = execSync(
        `docker exec ${CONTAINER_NAME} openclaw agent --session-id main --message ${JSON.stringify(message)} --json --timeout 120`,
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
