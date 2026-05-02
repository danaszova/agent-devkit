import { execSync } from 'child_process';
import { skillRegistry } from './registry';

const OPENCLAW_CONTAINER = 'agent-devkit-openclaw';
const HERMES_CONTAINER = 'agent-devkit-hermes';
const HERMES_API_URL = process.env.HERMES_API_URL || 'http://localhost:8642';
const HERMES_API_KEY = process.env.HERMES_API_KEY || 'hermes-devkit-key';

export class SkillDiscoveryService {
  private lastRefresh: Date | null = null;
  private openclawAvailable: boolean = false;

  constructor() {}

  /**
   * Queries configured containers to discover skills and populate the registry.
   */
  public async discoverSkills(): Promise<void> {
    try {
      skillRegistry.clear();

      // Load local examples
      this.registerLocalSkills();

      // Query OpenClaw
      await this.queryOpenClaw();

      // Query Hermes
      await this.queryHermes();

      this.lastRefresh = new Date();
    } catch (err) {
      console.error('Skill discovery failed:', err);
    }
  }

  private registerLocalSkills(): void {
    skillRegistry.register({
      id: 'local.weather',
      name: 'WeatherSkill',
      description: 'Provides current weather information for a given location',
      provider: 'local'
    });

    skillRegistry.register({
      id: 'local.calculator',
      name: 'CalculatorSkill',
      description: 'Performs basic mathematical calculations',
      provider: 'local'
    });

    skillRegistry.register({
      id: 'local.web-search',
      name: 'WebSearchSkill',
      description: 'Performs a search query to retrieve web results',
      provider: 'local'
    });

    skillRegistry.register({
      id: 'local.email-cleaner',
      name: 'EmailCleaner',
      description: 'Cleans Gmail inbox of promotions, ads, solicitations, and spam',
      provider: 'local'
    });
  }

  private async queryOpenClaw(): Promise<void> {
    // Check if container is running
    try {
      execSync(`docker ps -q -f name=${OPENCLAW_CONTAINER}`, { stdio: 'pipe' });
    } catch {
      this.openclawAvailable = false;
      console.warn(
        '[Discovery] OpenClaw container is not running. ' +
        'Start it with: agent-devkit start'
      );
      return;
    }

    try {
      const output = execSync(
        `docker exec ${OPENCLAW_CONTAINER} openclaw skills list --json`,
        {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 15000
        }
      );

      const data = JSON.parse(output);
      const skills = data.skills || [];

      if (skills.length > 0) {
        this.openclawAvailable = true;
        let readyCount = 0;

        skills.forEach((skill: any) => {
          // Only register skills that are eligible (have required binaries/env)
          // and not explicitly disabled
          if (skill.eligible && !skill.disabled) {
            readyCount++;
            skillRegistry.register({
              id: `openclaw.${skill.name}`,
              name: skill.name,
              description: skill.description || 'OpenClaw managed skill',
              provider: 'openclaw',
              parameters: {
                emoji: skill.emoji,
                source: skill.source,
                homepage: skill.homepage
              }
            });
          }
        });

        console.log(
          `[Discovery] OpenClaw connected (${readyCount}/${skills.length} skills ready)`
        );
      } else {
        this.openclawAvailable = true;
        console.log('[Discovery] OpenClaw connected (no skills found)');
        this.registerFallbackOpenClawSkills();
      }
    } catch (error: any) {
      this.openclawAvailable = false;
      if (error.stderr?.includes('not running') || error.message?.includes('No such container')) {
        console.warn(
          '[Discovery] OpenClaw container is not running. ' +
          'Start it with: agent-devkit start'
        );
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.warn('[Discovery] OpenClaw skills list timed out');
      } else {
        console.warn('[Discovery] OpenClaw discovery error:', error.message);
      }
      this.registerFallbackOpenClawSkills();
    }
  }

  private registerFallbackOpenClawSkills(): void {
    skillRegistry.register({
      id: 'openclaw.browser',
      name: 'Browser Navigation',
      description: 'Navigate websites and extract DOM elements via OpenClaw',
      provider: 'openclaw'
    });
    skillRegistry.register({
      id: 'openclaw.bash',
      name: 'Bash Execution',
      description: 'Execute shell scripts in OpenClaw sandbox',
      provider: 'openclaw'
    });
  }

  private async queryHermes(): Promise<void> {
    try {
      execSync(`docker ps -q -f name=${HERMES_CONTAINER}`, { stdio: 'pipe' });
    } catch {
      return;
    }

    try {
      const output = execSync(
        `curl -sf ${HERMES_API_URL}/v1/health`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }
      );
      const health = JSON.parse(output);
      if (health.status === 'ok') {
        console.log('[Discovery] Hermes connected');
        skillRegistry.register({
          id: 'hermes.chat',
          name: 'Hermes Chat',
          description: 'General-purpose conversational agent via Hermes (DeepSeek-powered)',
          provider: 'hermes'
        });
        skillRegistry.register({
          id: 'hermes.browser',
          name: 'Hermes Browser',
          description: 'Web browsing and data extraction via Hermes agent tools',
          provider: 'hermes'
        });
        skillRegistry.register({
          id: 'hermes.terminal',
          name: 'Hermes Terminal',
          description: 'Execute shell commands in isolated environments via Hermes',
          provider: 'hermes'
        });
        skillRegistry.register({
          id: 'hermes.search',
          name: 'Hermes Search',
          description: 'Web search and content retrieval via Hermes',
          provider: 'hermes'
        });
      }
    } catch (error: any) {
      console.warn('[Discovery] Hermes discovery error:', error.message);
    }
  }

  public isOpenClawAvailable(): boolean {
    return this.openclawAvailable;
  }

  public getLastRefreshTime(): Date | null {
    return this.lastRefresh;
  }
}

export const discoveryService = new SkillDiscoveryService();
