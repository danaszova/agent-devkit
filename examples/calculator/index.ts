import { Skill, SkillContext, SkillResult } from '../../src/templates/basic-skill';

export class CalculatorSkill implements Skill {
  name = 'calculator';
  description = 'Performs basic mathematical calculations';
  version = '1.0.0';

  async execute(input: { expression: string }, context: SkillContext): Promise<SkillResult> {
    try {
      if (!input || !input.expression) {
        throw new Error('Expression is required');
      }
      
      // Extremely basic mock for evaluation
      // IMPORTANT: In a real app, DO NOT use eval(). Use a proper math expression parser.
      // We are just simulating behavior for the devkit framework here.
      const sanitized = input.expression.replace(/[^0-9+\-*/(). ]/g, '');
      const result = eval(sanitized);
      
      return { success: true, data: { result } };
    } catch (error: any) {
      return { success: false, error: 'Failed to evaluate expression: ' + error.message };
    }
  }
}
