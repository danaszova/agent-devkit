import { Skill, SkillContext, SkillResult } from '../basic-skill';

export class DatabaseSkill implements Skill {
  name = 'database-skill';
  description = 'A template skill for database access and queries';
  version = '1.0.0';

  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    try {
      // 1. Connect to DB
      // 2. Execute Query
      // 3. Format result
      const mockDbResponse = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      
      return { success: true, data: mockDbResponse };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
