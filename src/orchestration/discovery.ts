import { execSync } from 'child_process';
import { skillRegistry } from './registry';

const CONTAINER_NAME = 'agent-devkit-openclaw';

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

      // Query Hermes (skipped for now — focus is OpenClaw)
      // await this.queryHermes();

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
      execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { stdio: 'pipe' });
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
        `docker exec ${CONTAINER_NAME} openclaw skills list --json`,
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
      // Register fallback placeholders so the registry isn't empty
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
    // Intentionally left mocked — Hermes integration is out of scope for this pass.
    try {
      skillRegistry.register({
        id: 'hermes.whatsapp_bridge',
        name: 'WhatsApp Bridge',
        description: 'Send and receive WhatsApp messages',
        provider: 'hermes'
      });
      skillRegistry.register({
        id: 'hermes.calendar',
        name: 'Calendar Management',
        description: 'Read and write calendar events',
        provider: 'hermes'
      });
    } catch (error) {
      console.warn('Failed to discover Hermes skills:', error);
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
