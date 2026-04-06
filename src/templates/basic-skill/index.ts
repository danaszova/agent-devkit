export interface SkillContext {
  provider: any;
  user: string;
}

export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface Skill {
  name: string;
  description: string;
  version: string;
  execute(input: any, context: SkillContext): Promise<SkillResult>;
}

export class BasicSkill implements Skill {
  name = 'basic-skill';
  description = 'A basic template skill';
  version = '1.0.0';

  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    try {
      // Implement logic here
      return { success: true, data: { message: `Basic skill executed with input: ${JSON.stringify(input)}` } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
