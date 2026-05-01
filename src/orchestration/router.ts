import { configManager } from '../providers/config-manager';
import { skillRegistry, SkillMetadata } from './registry';

export class SkillRouter {
  /**
   * Matches a user intent to a registered skill using the configured AI provider.
   */
  public async routeIntent(intent: string): Promise<SkillMetadata | null> {
    const allSkills = skillRegistry.getAllSkills();
    if (allSkills.length === 0) {
      console.warn('No skills registered to route to.');
      return null;
    }

    try {
      const provider = await configManager.getProvider();

      const skillsContext = allSkills.map(s =>
        `- ID: ${s.id}\n  Name: ${s.name}\n  Description: ${s.description}`
      ).join('\n\n');

      const prompt = `
You are a skill routing assistant. Given a user's intent, select the most appropriate skill ID from the list of available skills.
If no skill matches, respond with "NONE".
Only respond with the exact skill ID or "NONE". Do not include any other text.

Available Skills:
${skillsContext}

User Intent: "${intent}"

Selected Skill ID:`;

      const response = await provider.generate(prompt);
      const selectedId = response.text.trim();

      if (selectedId === 'NONE') {
        return null;
      }

      const skill = skillRegistry.getSkill(selectedId) || null;
      if (skill) {
        console.log(`[Router] Local provider routed intent to: ${skill.id}`);
      }
      return skill;
    } catch (error) {
      console.error('Error in AI routing, falling back to keyword matching:', error);
      return this.fallbackKeywordRoute(intent, allSkills);
    }
  }

  private fallbackKeywordRoute(intent: string, skills: SkillMetadata[]): SkillMetadata | null {
    const lowerIntent = intent.toLowerCase();

    // Very basic keyword matching
    for (const skill of skills) {
      if (lowerIntent.includes(skill.name.toLowerCase()) ||
          lowerIntent.includes(skill.id.toLowerCase())) {
        console.log(`[Router] Keyword fallback matched: ${skill.id}`);
        return skill;
      }

      // Check words in description
      const descWords = skill.description.toLowerCase().split(' ').filter(w => w.length > 3);
      for (const word of descWords) {
        if (lowerIntent.includes(word)) {
          console.log(`[Router] Keyword fallback matched: ${skill.id}`);
          return skill;
        }
      }
    }

    return null;
  }
}

export const router = new SkillRouter();
