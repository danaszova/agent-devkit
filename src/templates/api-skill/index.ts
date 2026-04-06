import { Skill, SkillContext, SkillResult } from '../basic-skill';

export class APISkill implements Skill {
  name = 'api-skill';
  description = 'A template skill for integrating with external APIs';
  version = '1.0.0';

  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    try {
      // 1. Validate Input
      // 2. Form Request
      // 3. Await API Response
      const mockResponse = { endpoint: 'https://api.example.com', status: 200, json: { result: 'API Call OK' } };
      
      return { success: true, data: mockResponse.json };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
