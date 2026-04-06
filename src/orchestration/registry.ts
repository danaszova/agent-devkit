export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  provider: 'openclaw' | 'hermes' | 'local';
  parameters?: Record<string, any>;
}

export class SkillRegistry {
  private skills: Map<string, SkillMetadata> = new Map();

  public register(skill: SkillMetadata): void {
    this.skills.set(skill.id, skill);
  }

  public getSkill(id: string): SkillMetadata | undefined {
    return this.skills.get(id);
  }

  public getAllSkills(): SkillMetadata[] {
    return Array.from(this.skills.values());
  }

  public clear(): void {
    this.skills.clear();
  }

  public findByName(name: string): SkillMetadata[] {
    return this.getAllSkills().filter(s => s.name.toLowerCase().includes(name.toLowerCase()));
  }
}

export const skillRegistry = new SkillRegistry();
