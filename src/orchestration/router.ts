import axios from 'axios';
import { configManager } from '../providers/config-manager';
import { skillRegistry, SkillMetadata } from './registry';

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || 'http://localhost:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

export class SkillRouter {
  /**
   * Matches a user intent to a registered skill using the best available AI provider.
   * Prefers OpenClaw when it's running, otherwise falls back to the configured provider.
   */
  public async routeIntent(intent: string): Promise<SkillMetadata | null> {
    const allSkills = skillRegistry.getAllSkills();
    if (allSkills.length === 0) {
      console.warn('No skills registered to route to.');
      return null;
    }

    // 1. Try OpenClaw routing first (it's a real agent with tool awareness)
    try {
      const openclawResult = await this.routeViaOpenClaw(intent, allSkills);
      if (openclawResult) {
        console.log(`[Router] OpenClaw routed intent to: ${openclawResult.id}`);
        return openclawResult;
      }
    } catch (err: any) {
      console.log('[Router] OpenClaw routing unavailable, falling back to local provider...');
    }

    // 2. Fall back to the framework's configured AI provider
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

  /**
   * Uses OpenClaw as the routing brain. This is powerful because OpenClaw
   * understands its own tools (browser, bash, etc.) and can decide whether
   * to handle a task itself or delegate to a local skill.
   */
  private async routeViaOpenClaw(intent: string, skills: SkillMetadata[]): Promise<SkillMetadata | null> {
    // Quick health check — if OpenClaw isn't up, bail immediately
    try {
      await axios.get(`${OPENCLAW_BASE_URL}/api/status`, { timeout: 3000 });
    } catch {
      return null;
    }

    const skillsContext = skills.map(s =>
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

    const response = await axios.post(
      `${OPENCLAW_BASE_URL}/api/sessions/main/messages`,
      { message: prompt },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(OPENCLAW_TOKEN ? { Authorization: `Bearer ${OPENCLAW_TOKEN}` } : {})
        },
        timeout: 30000
      }
    );

    const text = response.data?.response || response.data?.text || '';
    const selectedId = text.trim();

    if (selectedId === 'NONE' || !selectedId) {
      return null;
    }

    return skillRegistry.getSkill(selectedId) || null;
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
