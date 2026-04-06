import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface StopOptions {
  clean?: boolean;
  force?: boolean;
  graceful?: string;
}

export async function stopCommand(options: StopOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🛑 Stopping agent-devkit environment...\n'));

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
    spinner.start('Checking container status...');
    try {
      const output = execSync(`${composeCmd} ps -q`, { encoding: 'utf-8' });
      if (!output.trim()) {
        spinner.info('No containers are running');
        console.log(chalk.yellow('\n⚠️  No agent-devkit containers are currently running'));
        return;
      }
      spinner.succeed('Found running containers');
    } catch (error) {
      spinner.warn('Could not check container status');
    }

    // Stop containers
    spinner.start('Stopping containers...');
    
    const timeout = options.graceful ? parseInt(options.graceful) : 30;
    const stopCmd = options.force 
      ? `${composeCmd} kill`
      : `${composeCmd} stop -t ${timeout}`;

    try {
      execSync(stopCmd, { stdio: options.force ? 'inherit' : 'pipe' });
      spinner.succeed(chalk.green('Containers stopped successfully'));
    } catch (error) {
      spinner.fail('Failed to stop containers');
      throw error;
    }

    // Remove containers if requested
    if (options.clean) {
      spinner.start('Removing containers...');
      try {
        execSync(`${composeCmd} down`, { stdio: 'pipe' });
        spinner.succeed('Containers removed');
      } catch (error) {
        spinner.warn('Could not remove containers');
      }

      // Remove volumes if clean is specified
      spinner.start('Cleaning up volumes...');
      try {
        execSync(`${composeCmd} down -v`, { stdio: 'pipe' });
        spinner.succeed('Volumes cleaned up');
      } catch (error) {
        spinner.warn('Could not clean up volumes');
      }
    }

    console.log(chalk.bold.green('\n✅ agent-devkit environment stopped'));
    
    if (options.clean) {
      console.log(chalk.gray('All containers and volumes have been removed'));
    } else {
      console.log(chalk.gray('Containers stopped. Data has been preserved.'));
      console.log(chalk.gray('Run `agent-devkit start` to resume'));
    }
    console.log();

  } catch (error) {
    spinner.fail('Failed to stop environment');
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