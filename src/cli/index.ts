#!/usr/bin/env node

import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
import { statusCommand } from './commands/status';
import { logsCommand } from './commands/logs';
import { pauseCommand } from './commands/pause';
import { resumeCommand } from './commands/resume';
import { registerSkillsCommands } from './commands/skills';
import { dashboardCommand } from './commands/dashboard';
import { uiCommand } from './commands/ui';

const VERSION = '0.1.0';

const program = new Command()
  .name('agent-devkit')
  .description('Secure Docker-based development environment for AI agents')
  .version(VERSION);

// Init command
program
  .command('init')
  .description('Initialize a new agent project')
  .option('-n, --name <name>', 'Agent name')
  .option('-f, --framework <framework>', 'AI framework (openclaw, hermes, custom)', 'openclaw')
  .option('-p, --provider <provider>', 'AI provider (claude, openai, deepseek, local)', 'claude')
  .action(initCommand);

// Start command
program
  .command('start')
  .description('Start the agent development environment')
  .option('-d, --detached', 'Run in detached mode')
  .option('--cpu-limit <cores>', 'CPU limit', '22')
  .option('--memory <memory>', 'Memory limit (e.g., 4g)', '4g')
  .option('--check-ports', 'Check for port conflicts')
  .action(startCommand);

// Stop command
program
  .command('stop')
  .description('Stop the agent development environment')
  .option('-c, --clean', 'Clean up containers and volumes')
  .option('-f, --force', 'Force stop')
  .option('--graceful <seconds>', 'Graceful shutdown timeout', '30')
  .action(stopCommand);

// Pause command
program
  .command('pause')
  .description('Pause the agent environment (preserve state)')
  .action(pauseCommand);

// Resume command
program
  .command('resume')
  .description('Resume a paused agent environment')
  .action(resumeCommand);

// Status command
program
  .command('status')
  .description('Show status of agent environment')
  .option('-j, --json', 'Output as JSON')
  .action(statusCommand);

// Logs command
program
  .command('logs')
  .description('View agent logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .option('--agent <name>', 'Show logs for specific agent')
  .action(logsCommand);

// Skills commands
registerSkillsCommands(program);

// Dashboard command
program
  .command('dashboard')
  .description('Open the OpenClaw web dashboard in your browser')
  .action(dashboardCommand);

// UI Manager command
program
  .command('ui')
  .description('Open the Agent DevKit Manager UI in your browser')
  .action(uiCommand);

// Parse arguments
program.parse(process.argv);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red(`Unhandled Rejection at ${promise}: ${reason}`));
  process.exit(1);
});