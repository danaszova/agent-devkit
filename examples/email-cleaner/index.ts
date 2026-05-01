import { Skill, SkillContext, SkillResult } from '../../src/templates/basic-skill';
import { execSync } from 'child_process';

const CONTAINER_NAME = 'agent-devkit-openclaw';
const SKILL_PATH = '/home/node/.openclaw/workspace/skills/inbox-cleaner/clean_inbox.py';

export class EmailCleanerSkill implements Skill {
  name = 'email-cleaner';
  description = 'Cleans Gmail inbox of promotions, ads, solicitations, and spam daily';
  version = '1.0.0';

  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    try {
      // Verify OpenClaw container is running
      execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { stdio: 'pipe' });

      // Run the Python script inside the OpenClaw container
      const output = execSync(
        `docker exec ${CONTAINER_NAME} python3 ${SKILL_PATH}`,
        {
          encoding: 'utf-8',
          timeout: 120000,
          stdio: 'pipe'
        }
      );

      return { success: true, data: { report: output.trim().split('\n') } };
    } catch (error: any) {
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      const message = stderr || stdout || error.message || 'Unknown error';

      return {
        success: false,
        error: `Email cleanup failed. ${message}\n\nMake sure:\n` +
               `  1. OpenClaw is running: agent-devkit start\n` +
               `  2. GMAIL_USER and GMAIL_APP_PASSWORD are set in the container\n` +
               `  3. The skill script is installed: agent-devkit skills install-email-cleaner`
      };
    }
  }
}
