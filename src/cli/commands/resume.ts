import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function resumeCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n▶️  Resuming agent-devkit environment...\n'));

  const spinner = ora('Locating docker-compose.yml...').start();

  try {
    // Find docker-compose.yml
    const composeFile = findDockerComposeFile();
    
    if (!composeFile) {
      spinner.fail('docker-compose.yml not found');
      console.log(chalk.red('\n❌ Could not find docker-compose.yml'));
      console.log(chalk.yellow('Make sure you are in an agent-devkit project directory'));
      process.exit(1);
    }
    
    spinner.succeed(`Found: ${composeFile}`);

    // Build the docker-compose command
    const composeCmd = `docker compose -f ${composeFile} -p agent-devkit`;

    // Check if containers exist
    spinner.start('Checking containers...');
    try {
      const output = execSync(`${composeCmd} ps -a -q`, { encoding: 'utf-8' });
      if (!output.trim()) {
        spinner.info('No containers found');
        console.log(chalk.yellow('\n⚠️  No agent-devkit containers found'));
        console.log(chalk.gray('Run `agent-devkit start` to start the environment'));
        return;
      }
      spinner.succeed('Found containers');
    } catch (error) {
      spinner.fail('Could not check container status');
      process.exit(1);
    }

    // Resume paused containers
    spinner.start('Resuming containers...');
    try {
      execSync(`${composeCmd} unpause`, { stdio: 'pipe' });
      spinner.succeed(chalk.green('Containers resumed successfully'));
    } catch (error) {
      spinner.warn('No paused containers found, starting containers instead...');
      
      // If unpause fails, try starting containers
      try {
        execSync(`${composeCmd} start`, { stdio: 'pipe' });
        spinner.succeed(chalk.green('Containers started successfully'));
      } catch (startError) {
        spinner.fail('Failed to resume or start containers');
        throw startError;
      }
    }

    // Show status
    console.log(chalk.bold('\n📊 Container Status:'));
    try {
      execSync(`${composeCmd} ps`, { stdio: 'inherit' });
    } catch {
      // Ignore errors in status display
    }

    console.log(chalk.bold.green('\n✅ Environment resumed'));
    console.log(chalk.gray('Run `agent-devkit logs` to view logs'));
    console.log(chalk.gray('Run `agent-devkit status` to check status'));
    console.log();

  } catch (error) {
    spinner.fail('Failed to resume environment');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

function findDockerComposeFile(): string | null {
  const currentDir = process.cwd();
  const locations = [
    path.join(currentDir, 'docker-compose.yml'),
    path.join(currentDir, 'docker-compose.yaml'),
    path.join(currentDir, '..', 'docker-compose.yml'),
    path.join(currentDir, '..', 'docker-compose.yaml'),
  ];

  for (const location of locations) {
    if (fs.existsSync(location)) {
      return location;
    }
  }

  return null;
}