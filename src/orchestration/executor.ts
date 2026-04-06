import { SkillResult } from '../templates/basic-skill';
import { skillRegistry, SkillMetadata } from './registry';

export interface ExecutionOptions {
  timeoutMs?: number;
}

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

      const timeoutMs = options.timeoutMs || 10000;
      
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
      } else {
        throw new Error(`Local skill implementation not found for: ${metadata.id}`);
      }

      return await skillInstance.execute(input, { provider: 'local', user: 'system' });
    } catch (error: any) {
      throw new Error(`Failed to execute local skill: ${error.message}`);
    }
  }

  private async executeOpenClawSkill(metadata: SkillMetadata, input: any): Promise<SkillResult> {
    // Simulated API call to OpenClaw container (e.g. POST http://localhost:18789/execute)
    // Normally this would be a real fetch() call
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            result: `Successfully mocked OpenClaw execution for ${metadata.id}`,
            inputReceived: input
          }
        });
      }, 500);
    });
  }

  private async executeHermesSkill(metadata: SkillMetadata, input: any): Promise<SkillResult> {
    // Simulated CLI/API call to Hermes container
    // Normally this would be an exec() call or HTTP POST
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            result: `Successfully mocked Hermes execution for ${metadata.id}`,
            inputReceived: input
          }
        });
      }, 600);
    });
  }
}

export const executor = new SkillExecutor();
