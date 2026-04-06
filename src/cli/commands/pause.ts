import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function pauseCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n⏸️  Pausing agent-devkit environment...\n'));

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

    // Check if containers are running
    spinner.start('Checking containers...');
    try {
      const output = execSync(`${composeCmd} ps -q`, { encoding: 'utf-8' });
      if (!output.trim()) {
        spinner.info('No containers are running');
        console.log(chalk.yellow('\n⚠️  No agent-devkit containers are currently running'));
        return;
      }
      spinner.succeed('Found running containers');
    } catch (error) {
      spinner.fail('Could not check container status');
      process.exit(1);
    }

    // Pause containers
    spinner.start('Pausing containers...');
    try {
      execSync(`${composeCmd} pause`, { stdio: 'pipe' });
      spinner.succeed(chalk.green('Containers paused successfully'));
    } catch (error) {
      spinner.fail('Failed to pause containers');
      throw error;
    }

    console.log(chalk.bold.yellow('\n⏸️  Environment paused'));
    console.log(chalk.gray('All containers have been paused. State has been preserved.'));
    console.log(chalk.gray('Run `agent-devkit resume` to continue'));
    console.log();

  } catch (error) {
    spinner.fail('Failed to pause environment');
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