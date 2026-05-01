import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { discoveryService } from '../../orchestration/discovery';
import { skillRegistry } from '../../orchestration/registry';
import { executor } from '../../orchestration/executor';
import { router } from '../../orchestration/router';

const CONTAINER_NAME = 'agent-devkit-openclaw';

export function registerSkillsCommands(program: Command) {
  const skillsCmd = program
    .command('skills')
    .description('Manage and interact with agent skills');

  skillsCmd
    .command('list')
    .description('List all available skills from registered providers')
    .action(async () => {
      console.log('Discovering skills...');
      await discoveryService.discoverSkills();

      const skills = skillRegistry.getAllSkills();
      console.log(`\nFound ${skills.length} skills:\n`);

      const openclaw = skills.filter(s => s.provider === 'openclaw');
      const hermes = skills.filter(s => s.provider === 'hermes');
      const local = skills.filter(s => s.provider === 'local');

      if (openclaw.length > 0) {
        console.log('🦞 OpenClaw Skills:');
        openclaw.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
        console.log('');
      }

      if (hermes.length > 0) {
        console.log('⚕️ Hermes Skills:');
        hermes.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
        console.log('');
      }

      if (local.length > 0) {
        console.log('💻 Local Skills:');
        local.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
        console.log('');
      }
    });

  skillsCmd
    .command('execute <skillId>')
    .description('Execute a specific skill')
    .option('-i, --input <json>', 'JSON input for the skill', '{}')
    .action(async (skillId, options) => {
      await discoveryService.discoverSkills();

      console.log(`Executing skill: ${skillId}...`);

      let inputObj = {};
      try {
        inputObj = JSON.parse(options.input);
      } catch (e) {
        console.error('Invalid JSON input provided.');
        process.exit(1);
      }

      const result = await executor.executeSkill(skillId, inputObj);

      console.log('\n--- Result ---');
      console.log(JSON.stringify(result, null, 2));
    });

  skillsCmd
    .command('route <intent>')
    .description('Route an intent to a skill and optionally execute it')
    .option('-e, --execute', 'Execute the matched skill', false)
    .option('-i, --input <json>', 'Input JSON if executing', '{}')
    .action(async (intent, options) => {
      await discoveryService.discoverSkills();

      console.log(`Routing intent: "${intent}"...`);
      const matchedSkill = await router.routeIntent(intent);

      if (!matchedSkill) {
        console.log('No matching skill found.');
        return;
      }

      console.log(`\nMatched Skill: ${matchedSkill.name} (${matchedSkill.id})`);
      console.log(`Provider: ${matchedSkill.provider}`);
      console.log(`Description: ${matchedSkill.description}`);

      if (options.execute) {
        console.log(`\nExecuting with input: ${options.input}`);
        let inputObj = {};
        try {
          inputObj = JSON.parse(options.input);
        } catch (e) {}

        const result = await executor.executeSkill(matchedSkill.id, inputObj);
        console.log('\n--- Result ---');
        console.log(JSON.stringify(result, null, 2));
      }
    });

  skillsCmd
    .command('chain <skillIds...>')
    .description('Execute multiple skills in sequence (output of A becomes input of B)')
    .option('-i, --input <json>', 'Initial JSON input for the first skill', '{}')
    .action(async (skillIds, options) => {
      await discoveryService.discoverSkills();

      let currentInput = {};
      try {
        currentInput = JSON.parse(options.input);
      } catch (e) {
        console.error('Invalid initial JSON input provided.');
        process.exit(1);
      }

      console.log(`Starting skill chain: ${skillIds.join(' -> ')}`);

      for (let i = 0; i < skillIds.length; i++) {
        const skillId = skillIds[i];
        console.log(`\n[Step ${i + 1}/${skillIds.length}] Executing: ${skillId}`);
        console.log(`Input: ${JSON.stringify(currentInput)}`);

        const result = await executor.executeSkill(skillId, currentInput);

        if (!result.success) {
          console.error(`\n❌ Chain failed at step ${i + 1} (${skillId}): ${result.error}`);
          process.exit(1);
        }

        console.log(`✅ Success`);

        // Use result data as input for the next skill (wrap it if it's not an object)
        if (result.data) {
          if (typeof result.data === 'object' && !Array.isArray(result.data)) {
            currentInput = result.data;
          } else {
            currentInput = { previousResult: result.data };
          }
        } else {
          currentInput = {};
        }
      }

      console.log('\n--- Final Chain Result ---');
      console.log(JSON.stringify(currentInput, null, 2));
    });

  // ─────────────────────────────────────────────────────────────
  // OpenClaw skill management commands
  // ─────────────────────────────────────────────────────────────

  skillsCmd
    .command('search <query>')
    .description('Search ClawHub for OpenClaw skills')
    .action(async (query) => {
      if (!isOpenClawRunning()) {
        console.log(chalk.red('❌ OpenClaw container is not running'));
        console.log(chalk.yellow('Start it with: agent-devkit start'));
        process.exit(1);
      }

      console.log(chalk.blue(`🔍 Searching ClawHub for "${query}"...\n`));
      try {
        execSync(`docker exec ${CONTAINER_NAME} openclaw skills search "${query}"`, {
          stdio: 'inherit'
        });
      } catch (error) {
        console.error(chalk.red('\n❌ Search failed'));
        process.exit(1);
      }
    });

  skillsCmd
    .command('install <skill>')
    .description('Install a skill from ClawHub into the OpenClaw container')
    .action(async (skill) => {
      if (!isOpenClawRunning()) {
        console.log(chalk.red('❌ OpenClaw container is not running'));
        console.log(chalk.yellow('Start it with: agent-devkit start'));
        process.exit(1);
      }

      console.log(chalk.blue(`⬇️  Installing "${skill}" from ClawHub...\n`));
      try {
        execSync(`docker exec ${CONTAINER_NAME} openclaw skills install "${skill}"`, {
          stdio: 'inherit'
        });
        console.log(chalk.green(`\n✅ "${skill}" installed successfully`));
        console.log(chalk.gray('Run `agent-devkit skills list` to see all available skills'));
      } catch (error) {
        console.error(chalk.red(`\n❌ Failed to install "${skill}"`));
        console.log(chalk.yellow('\nTips:'));
        console.log(chalk.gray('  • Check the skill name spelling'));
        console.log(chalk.gray('  • Search first: agent-devkit skills search <keyword>'));
        console.log(chalk.gray('  • Some skills require confirmation for high-risk actions'));
        process.exit(1);
      }
    });

  skillsCmd
    .command('installed')
    .description('List skills currently installed in OpenClaw')
    .action(async () => {
      if (!isOpenClawRunning()) {
        console.log(chalk.red('❌ OpenClaw container is not running'));
        console.log(chalk.yellow('Start it with: agent-devkit start'));
        process.exit(1);
      }

      console.log(chalk.blue('📦 Installed OpenClaw skills\n'));

      try {
        const output = execSync(
          `docker exec ${CONTAINER_NAME} openclaw skills list --json`,
          { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 }
        );

        const data = JSON.parse(output);
        const skills = data.skills || [];
        const installed = skills.filter((s: any) => s.source !== 'openclaw-bundled');

        if (installed.length > 0) {
          installed.forEach((skill: any) => {
            const name = skill.name || 'Unnamed';
            const desc = skill.description || '';
            const status = skill.eligible ? '✓' : '△';
            console.log(chalk.bold(`  ${status} ${name}`));
            if (desc) console.log(chalk.gray(`    ${desc}`));
          });
          console.log(chalk.gray(`\nTotal: ${installed.length} installed skill(s)`));
        } else {
          console.log(chalk.yellow('No custom skills installed yet.'));
        }
      } catch (error: any) {
        console.log(chalk.yellow('Could not retrieve installed skills list.'));
        if (error.stderr) console.log(chalk.gray(error.stderr));
      }
    });

  skillsCmd
    .command('setup-email-cleaner')
    .description('Interactive setup for the daily Gmail inbox cleaner')
    .action(async () => {
      console.log(chalk.bold.blue('\n📧 Gmail Inbox Cleaner Setup\n'));

      if (!isOpenClawRunning()) {
        console.log(chalk.red('❌ OpenClaw container is not running'));
        console.log(chalk.yellow('Start it with: agent-devkit start'));
        process.exit(1);
      }

      // Verify skill source files exist on host
      const fs = require('fs');
      const path = require('path');
      const scriptPath = path.join(process.cwd(), 'examples/email-cleaner/clean_inbox.py');
      const skillMdPath = path.join(process.cwd(), 'examples/email-cleaner/SKILL.md');

      if (!fs.existsSync(scriptPath) || !fs.existsSync(skillMdPath)) {
        console.log(chalk.red('❌ Skill source files not found'));
        console.log(chalk.gray('Expected: examples/email-cleaner/clean_inbox.py'));
        console.log(chalk.gray('Expected: examples/email-cleaner/SKILL.md'));
        process.exit(1);
      }

      // Prompt for Gmail credentials
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'gmailUser',
          message: 'Gmail address:',
          validate: (input: string) => input.includes('@') || 'Enter a valid email address'
        },
        {
          type: 'password',
          name: 'appPassword',
          message: 'Gmail App Password (16 chars with spaces):',
          validate: (input: string) => input.replace(/\s/g, '').length >= 16 || 'App password should be 16 characters'
        },
        {
          type: 'input',
          name: 'schedule',
          message: 'Cron schedule (default: daily at 9:00 AM):',
          default: '0 9 * * *'
        }
      ]);

      // Deploy skill files into container
      console.log(chalk.blue('\nDeploying skill into OpenClaw container...'));
      try {
        execSync(
          `docker exec ${CONTAINER_NAME} mkdir -p /home/node/.openclaw/workspace/skills/inbox-cleaner`,
          { stdio: 'pipe' }
        );
        execSync(
          `docker cp "${scriptPath}" ${CONTAINER_NAME}:/home/node/.openclaw/workspace/skills/inbox-cleaner/`,
          { stdio: 'pipe' }
        );
        execSync(
          `docker cp "${skillMdPath}" ${CONTAINER_NAME}:/home/node/.openclaw/workspace/skills/inbox-cleaner/`,
          { stdio: 'pipe' }
        );
        execSync(
          `docker exec ${CONTAINER_NAME} chmod +x /home/node/.openclaw/workspace/skills/inbox-cleaner/clean_inbox.py`,
          { stdio: 'pipe' }
        );
        console.log(chalk.green('✅ Skill files deployed'));
      } catch (error: any) {
        console.error(chalk.red('❌ Failed to deploy skill files'));
        if (error.stderr) console.log(chalk.gray(error.stderr));
        process.exit(1);
      }

      // Store credentials in container .env file
      console.log(chalk.blue('Configuring credentials...'));
      try {
        const envContent = `GMAIL_USER=${answers.gmailUser}\nGMAIL_APP_PASSWORD=${answers.appPassword}\n`;
        execSync(
          `docker exec ${CONTAINER_NAME} bash -c 'cat > /home/node/.openclaw/.env <<EOF\n${envContent}EOF'`,
          { stdio: 'pipe' }
        );
        execSync(
          `docker exec ${CONTAINER_NAME} chmod 600 /home/node/.openclaw/.env`,
          { stdio: 'pipe' }
        );
        console.log(chalk.green('✅ Credentials configured securely in container'));
      } catch (error: any) {
        console.error(chalk.red('❌ Failed to set credentials'));
        if (error.stderr) console.log(chalk.gray(error.stderr));
        process.exit(1);
      }

      // Schedule via OpenClaw cron CLI
      console.log(chalk.blue('Scheduling daily cleanup...'));
      try {
        execSync(
          `docker exec ${CONTAINER_NAME} openclaw cron add ` +
          `--name inbox-cleaner ` +
          `--cron "${answers.schedule}" ` +
          `--message "Run bash: source /home/node/.openclaw/.env && python3 /home/node/.openclaw/workspace/skills/inbox-cleaner/clean_inbox.py" ` +
          `--session main`,
          { stdio: 'pipe', timeout: 15000 }
        );
        console.log(chalk.green(`✅ Scheduled for "${answers.schedule}"`));
      } catch (error: any) {
        console.warn(chalk.yellow('\n⚠️  Could not auto-schedule via OpenClaw cron'));
        if (error.stderr) console.log(chalk.gray(error.stderr));
        console.log(chalk.white('\nManual scheduling options:'));
        console.log(chalk.gray('  Option A - Add to your host crontab:'));
        console.log(chalk.gray(`    ${answers.schedule} docker exec ${CONTAINER_NAME} bash -c 'source /home/node/.openclaw/.env && python3 /home/node/.openclaw/workspace/skills/inbox-cleaner/clean_inbox.py'`));
        console.log(chalk.gray('  Option B - Use OpenClaw dashboard chat:'));
        console.log(chalk.gray('    "Schedule a daily cron job to run my inbox cleaner"'));
      }

      console.log(chalk.bold.green('\n🎉 Inbox cleaner is ready!'));
      console.log(chalk.white('Your agent will clean promotions, ads, solicitations, and spam daily.'));
      console.log(chalk.gray('\nTo run manually right now:'));
      console.log(chalk.gray(`  ./dist/src/cli/index.js skills execute local.email-cleaner`));
      console.log(chalk.gray('\nTo open the dashboard and chat with your agent:'));
      console.log(chalk.gray(`  ./dist/src/cli/index.js dashboard`));
      console.log();
    });
}

function isOpenClawRunning(): boolean {
  try {
    execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
