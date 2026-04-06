import { Command } from 'commander';
import { discoveryService } from '../../orchestration/discovery';
import { skillRegistry } from '../../orchestration/registry';
import { executor } from '../../orchestration/executor';
import { router } from '../../orchestration/router';

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
        console.log(`\n[Step ${i+1}/${skillIds.length}] Executing: ${skillId}`);
        console.log(`Input: ${JSON.stringify(currentInput)}`);
        
        const result = await executor.executeSkill(skillId, currentInput);
        
        if (!result.success) {
          console.error(`\n❌ Chain failed at step ${i+1} (${skillId}): ${result.error}`);
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
}
