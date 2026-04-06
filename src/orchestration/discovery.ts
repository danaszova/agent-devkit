import { skillRegistry } from './registry';

export class SkillDiscoveryService {
  private lastRefresh: Date | null = null;
  
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
  }

  private async queryOpenClaw(): Promise<void> {
    try {
      // In a real implementation: fetch('http://localhost:18789/skills')
      // For MVP, we mock the discovery from OpenClaw
      skillRegistry.register({
        id: 'openclaw.browser',
        name: 'Browser Navigation',
        description: 'Navigate websites and extract DOM elements',
        provider: 'openclaw'
      });
      skillRegistry.register({
        id: 'openclaw.bash',
        name: 'Bash Execution',
        description: 'Execute shell scripts in isolated environment',
        provider: 'openclaw'
      });
    } catch (error) {
      console.warn('Failed to discover OpenClaw skills:', error);
    }
  }

  private async queryHermes(): Promise<void> {
    try {
      // In a real implementation: fetch('http://localhost:8000/skills') or invoke CLI `hermes skills list --json`
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

  public getLastRefreshTime(): Date | null {
    return this.lastRefresh;
  }
}

export const discoveryService = new SkillDiscoveryService();
