import { Skill, SkillContext, SkillResult } from '../../src/templates/basic-skill';

export class WeatherSkill implements Skill {
  name = 'weather';
  description = 'Provides current weather information for a given location';
  version = '1.0.0';

  async execute(input: { location: string }, context: SkillContext): Promise<SkillResult> {
    try {
      if (!input || !input.location) {
        throw new Error('Location is required');
      }
      
      // Mock implementation
      const mockWeather = {
        location: input.location,
        temperature: '22°C',
        condition: 'Sunny',
        humidity: '45%'
      };
      
      return { success: true, data: mockWeather };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
