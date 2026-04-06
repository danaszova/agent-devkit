import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface StatusOptions {
  json?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  if (!options.json) {
    console.log(chalk.bold.blue('\n📊 agent-devkit Status\n'));
  }

  const spinner = ora('Checking status...').start();

  try {
    // Find docker-compose.yml
    const composeFile = findDockerComposeFile();
    
    if (!composeFile) {
      spinner.fail('docker-compose.yml not found');
      if (!options.json) {
        console.log(chalk.red('\n❌ Could not find docker-compose.yml'));
      }
      process.exit(1);
    }
    
    spinner.succeed(`Docker Compose file: ${composeFile}`);

    // Build the docker-compose command
    const composeCmd = `docker compose -f ${composeFile} -p agent-devkit`;

    // Get container status
    spinner.start('Fetching container information...');
    
    let containerInfo: any[] = [];
    
    try {
      const output = execSync(`${composeCmd} ps --format json`, { encoding: 'utf-8' });
      
      // Parse JSON output (might be multiple JSON objects, one per line)
      const lines = output.trim().split('\n').filter(line => line.trim());
      containerInfo = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(item => item !== null);
      
      spinner.succeed('Container information retrieved');
    } catch (error) {
      spinner.warn('No containers found or error retrieving status');
      containerInfo = [];
    }

    if (options.json) {
      // Output JSON format
      const status = {
        composeFile,
        containers: containerInfo,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    // Display human-readable format
    if (containerInfo.length === 0) {
      console.log(chalk.yellow('\n⚠️  No containers are running'));
      console.log(chalk.gray('Run `agent-devkit start` to start the environment'));
      return;
    }

    console.log(chalk.bold('\n🐳 Containers:\n'));
    
    for (const container of containerInfo) {
      const name = container.Name || container.Service || 'unknown';
      const state = container.State || 'unknown';
      const status = container.Status || '';
      
      let stateIcon = '❓';
      let stateColor = chalk.gray;
      
      if (state === 'running') {
        stateIcon = '✅';
        stateColor = chalk.green;
      } else if (state === 'exited') {
        stateIcon = '❌';
        stateColor = chalk.red;
      } else if (state === 'paused') {
        stateIcon = '⏸️ ';
        stateColor = chalk.yellow;
      }
      
      console.log(`${stateIcon} ${chalk.bold(name)}`);
      console.log(`   State: ${stateColor(state)}`);
      if (status) {
        console.log(`   Status: ${chalk.gray(status)}`);
      }
      console.log();
    }

    // Show resource usage
    spinner.start('Fetching resource usage...');
    try {
      const containerNames = containerInfo
        .filter(c => c.State === 'running')
        .map(c => c.Name)
        .join(' ');
      
      if (containerNames) {
        console.log(chalk.bold('💻 Resource Usage:\n'));
        execSync(`docker stats --no-stream ${containerNames}`, { stdio: 'inherit' });
        spinner.stop();
      } else {
        spinner.info('No running containers to show resource usage');
      }
    } catch (error) {
      spinner.warn('Could not retrieve resource usage');
    }

    console.log(chalk.bold('\n📋 Quick Commands:'));
    console.log(chalk.gray('  • agent-devkit logs    - View logs'));
    console.log(chalk.gray('  • agent-devkit stop    - Stop environment'));
    console.log(chalk.gray('  • agent-devkit pause   - Pause environment'));
    console.log();

  } catch (error) {
    spinner.fail('Failed to get status');
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