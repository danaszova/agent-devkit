import axios from 'axios';
import { skillRegistry } from './registry';

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || 'http://localhost:18789';
const OPENCLAW_TIMEOUT = parseInt(process.env.OPENCLAW_TIMEOUT || '5000', 10);

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

      // Load from Local examples (mocking local filesystem discovery)
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
    try {
      const statusRes = await axios.get(`${OPENCLAW_BASE_URL}/api/status`, {
        timeout: OPENCLAW_TIMEOUT
      });

      if (statusRes.data?.status === 'ok') {
        this.openclawAvailable = true;
        console.log(
          `[Discovery] OpenClaw connected (v${statusRes.data.version || 'unknown'}, uptime: ${statusRes.data.uptime || 'N/A'})`
        );

        try {
          const skillsRes = await axios.get(`${OPENCLAW_BASE_URL}/api/skills`, {
            timeout: OPENCLAW_TIMEOUT
          });

          const skills = skillsRes.data;
          if (Array.isArray(skills) && skills.length > 0) {
            skills.forEach((skill: any) => {
              skillRegistry.register({
                id: `openclaw.${skill.id || skill.name}`,
                name: skill.name || skill.id || 'Unnamed Skill',
                description: skill.description || 'OpenClaw managed skill',
                provider: 'openclaw',
                parameters: skill.parameters || skill.config || {}
              });
            });
          } else {
            // OpenClaw is alive but returned no skills — register fallback placeholders
            this.registerFallbackOpenClawSkills();
          }
        } catch (skillsErr: any) {
          console.warn('[Discovery] OpenClaw is up, but /api/skills failed:', skillsErr.message);
          this.registerFallbackOpenClawSkills();
        }
      } else {
        this.openclawAvailable = false;
        console.warn('[Discovery] OpenClaw status endpoint returned unexpected response');
      }
    } catch (error: any) {
      this.openclawAvailable = false;
      if (error.code === 'ECONNREFUSED') {
        console.warn(
          `[Discovery] OpenClaw is not running at ${OPENCLAW_BASE_URL}. ` +
          'Start it with: agent-devkit start'
        );
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.warn('[Discovery] OpenClaw connection timed out — container may still be starting');
      } else {
        console.warn('[Discovery] OpenClaw discovery error:', error.message);
      }
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
