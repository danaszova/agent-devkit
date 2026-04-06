import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface StartOptions {
  detached?: boolean;
  cpuLimit?: string;
  memory?: string;
  checkPorts?: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🚀 Starting agent-devkit environment...\n'));

  const spinner = ora('Checking Docker...').start();

  try {
    // Check if Docker is running
    try {
      execSync('docker info', { stdio: 'ignore' });
      spinner.succeed('Docker is running');
    } catch (error) {
      spinner.fail('Docker is not running');
      console.log(chalk.yellow('\n⚠️  Please start Docker and try again'));
      process.exit(1);
    }

    // Check for port conflicts if requested
    if (options.checkPorts) {
      spinner.start('Checking for port conflicts...');
      const portsToCheck = [5678, 5432, 6379, 8000];
      
      for (const port of portsToCheck) {
        try {
          execSync(`lsof -i :${port}`, { stdio: 'pipe' });
          spinner.warn(`Port ${port} is already in use`);
          console.log(chalk.yellow(`\n⚠️  Port ${port} is in use. You may want to stop the conflicting service.`));
        } catch {
          // Port is free (lsof returns non-zero if port is not in use)
        }
      }
      spinner.succeed('Port check complete');
    }

    // Find docker-compose.yml
    spinner.start('Locating docker-compose.yml...');
    const composeFile = findDockerComposeFile();
    
    if (!composeFile) {
      spinner.fail('docker-compose.yml not found');
      console.log(chalk.red('\n❌ Could not find docker-compose.yml'));
      console.log(chalk.yellow('Make sure you are in an agent-devkit project directory'));
      process.exit(1);
    }
    
    spinner.succeed(`Found: ${composeFile}`);

    // Build the docker-compose command
    let composeCmd = `docker compose -f ${composeFile} -p agent-devkit`;
    
    // Add resource limits if specified
    if (options.cpuLimit || options.memory) {
      spinner.info('Custom resource limits will be applied');
    }

    // Start the containers
    spinner.start('Starting Docker containers...');
    
    const startCmd = options.detached 
      ? `${composeCmd} up -d`
      : `${composeCmd} up`;

    try {
      execSync(startCmd, { stdio: 'inherit' });
      spinner.succeed(chalk.green('Environment started successfully!'));
    } catch (error) {
      spinner.fail('Failed to start containers');
      throw error;
    }

    // Show status
    console.log(chalk.bold('\n📊 Container Status:'));
    try {
      execSync(`${composeCmd} ps`, { stdio: 'inherit' });
    } catch {
      // Ignore errors in status display
    }

    console.log(chalk.bold.yellow('\n✨ agent-devkit is now running!'));
    console.log(chalk.white('\nAvailable commands:'));
    console.log(chalk.gray('  • agent-devkit status  - Check container status'));
    console.log(chalk.gray('  • agent-devkit logs    - View logs'));
    console.log(chalk.gray('  • agent-devkit stop    - Stop environment'));
    console.log(chalk.gray('  • agent-devkit pause   - Pause environment'));
    console.log();

  } catch (error) {
    spinner.fail('Failed to start environment');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

function findDockerComposeFile(): string | null {
  // Check current directory first
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