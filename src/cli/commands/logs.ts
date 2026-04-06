import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface LogsOptions {
  follow?: boolean;
  lines?: string;
  agent?: string;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  console.log(chalk.bold.blue('\n📋 agent-devkit Logs\n'));

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
        spinner.warn('No containers are running');
        console.log(chalk.yellow('\n⚠️  No agent-devkit containers are currently running'));
        console.log(chalk.gray('Run `agent-devkit start` to start the environment'));
        return;
      }
      spinner.succeed('Containers are running');
    } catch (error) {
      spinner.fail('Could not check container status');
      process.exit(1);
    }

    spinner.stop();

    // Build logs command
    let logsCmd = composeCmd + ' logs';
    
    if (options.follow) {
      logsCmd += ' -f';
    }
    
    if (options.lines) {
      logsCmd += ` --tail ${options.lines}`;
    } else {
      logsCmd += ' --tail 100';
    }
    
    if (options.agent) {
      logsCmd += ` ${options.agent}`;
    }

    console.log(chalk.gray(`Running: ${logsCmd}\n`));
    console.log(chalk.bold('📝 Logs:\n'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log();

    // If following, use spawn for live output
    if (options.follow) {
      const [cmd, ...args] = logsCmd.split(' ');
      const logsProcess = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
      });

      logsProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.log(chalk.red(`\n❌ Logs command exited with code ${code}`));
        }
      });

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\n⚠️  Stopping log stream...'));
        logsProcess.kill('SIGTERM');
        process.exit(0);
      });
    } else {
      // For non-follow, just execute and display
      try {
        execSync(logsCmd, { stdio: 'inherit' });
      } catch (error) {
        console.log(chalk.red('\n❌ Failed to retrieve logs'));
        process.exit(1);
      }
    }

  } catch (error) {
    spinner.fail('Failed to retrieve logs');
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