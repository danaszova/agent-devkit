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

const CONTAINER_NAME = 'agent-devkit-openclaw';

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
      const portsToCheck = [18789, 5678, 5432, 6379, 8000];

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
    const composeCmd = `docker compose -f ${composeFile} -p agent-devkit`;

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

    // Auto-configure OpenClaw when running detached
    if (options.detached) {
      await setupOpenClaw(spinner);
    } else {
      console.log(chalk.gray('\nℹ️  Running in foreground mode. Auto-configuration is skipped.'));
      console.log(chalk.gray('   Use `agent-devkit start -d` for automatic OpenClaw setup.'));
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

/**
 * Automatically configures OpenClaw if it exists in the compose stack.
 * Handles both fresh onboarding and re-configuring an existing install
 * to use the available API key (e.g., DeepSeek).
 */
async function setupOpenClaw(spinner: ora.Ora): Promise<void> {
  // Check if OpenClaw container is part of this stack
  try {
    execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { stdio: 'pipe' });
  } catch {
    // Container doesn't exist — OpenClaw not in this compose file
    return;
  }

  // Give the container a moment to initialize
  spinner.start('Waiting for OpenClaw container to initialize...');
  await sleep(4000);

  // Fix workspace permissions (the volume may have root-owned files from previous runs)
  spinner.start('Fixing OpenClaw workspace permissions...');
  try {
    execSync(`docker exec --user root ${CONTAINER_NAME} chown -R node:node /home/node/.openclaw/workspace`, {
      stdio: 'pipe'
    });
    spinner.succeed('Workspace permissions fixed');
  } catch {
    spinner.warn('Could not fix workspace permissions (may not be needed)');
  }

  const configPath = '/home/node/.openclaw/openclaw.json';

  // Check if OpenClaw is already configured
  let isOnboarded = false;
  try {
    execSync(`docker exec ${CONTAINER_NAME} test -f ${configPath}`, { stdio: 'ignore' });
    isOnboarded = true;
  } catch {
    // Not yet configured
  }

  if (!isOnboarded) {
    await onboardOpenClaw(spinner);
  } else {
    await configureOpenClawModel(spinner);
  }

  // Wait for the gateway to become responsive
  await waitForOpenClawGateway(spinner);
}

/**
 * Runs first-time onboarding for a fresh OpenClaw container.
 */
async function onboardOpenClaw(spinner: ora.Ora): Promise<void> {
  // Determine which provider key is available
  const claudeKey = process.env.CLAUDE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const kimiKey = process.env.KIMI_CODE_API_KEY || process.env.MOONSHOT_API_KEY;
  const zaiKey = process.env.ZAI_API_KEY || process.env.GLM_API_KEY;
  const qwenKey = process.env.QWEN_API_KEY || process.env.QWEN_CODE_API_KEY;

  const hasKey = claudeKey || openaiKey || openrouterKey || deepseekKey || kimiKey || zaiKey || qwenKey;

  if (!hasKey) {
    spinner.warn('OpenClaw found but no API key detected');
    console.log(chalk.yellow('\n⚠️  To auto-onboard OpenClaw, set one of these environment variables:'));
    console.log(chalk.gray('   • CLAUDE_API_KEY'));
    console.log(chalk.gray('   • OPENAI_API_KEY'));
    console.log(chalk.gray('   • OPENROUTER_API_KEY'));
    console.log(chalk.gray('   • DEEPSEEK_API_KEY'));
    console.log(chalk.gray('   • KIMI_CODE_API_KEY (or MOONSHOT_API_KEY)'));
    console.log(chalk.gray('   • ZAI_API_KEY (or GLM_API_KEY)'));
    console.log(chalk.gray('   • QWEN_API_KEY (or QWEN_CODE_API_KEY)'));
    console.log(chalk.yellow('\n   Or onboard manually with:'));
    console.log(chalk.gray(`   docker exec -it ${CONTAINER_NAME} openclaw onboard`));
    return;
  }

  // Build the non-interactive onboarding command
  let onboardCmd = 'openclaw onboard --non-interactive --accept-risk --flow quickstart --gateway-port 18789';

  if (claudeKey) {
    onboardCmd += ` --auth-choice apiKey --anthropic-api-key "${claudeKey}"`;
  } else if (openaiKey) {
    onboardCmd += ` --auth-choice openai-api-key --openai-api-key "${openaiKey}"`;
  } else if (openrouterKey) {
    onboardCmd += ` --auth-choice apiKey --token-provider openrouter --token "${openrouterKey}"`;
  } else if (deepseekKey) {
    onboardCmd += ` --auth-choice deepseek-api-key --deepseek-api-key "${deepseekKey}"`;
  } else if (kimiKey) {
    const authChoice = process.env.KIMI_CODE_API_KEY ? 'kimi-code-api-key' : 'moonshot-api-key';
    const flagName = process.env.KIMI_CODE_API_KEY ? 'kimi-code-api-key' : 'moonshot-api-key';
    onboardCmd += ` --auth-choice ${authChoice} --${flagName} "${kimiKey}"`;
  } else if (zaiKey) {
    onboardCmd += ` --auth-choice zai-api-key --zai-api-key "${zaiKey}"`;
  } else if (qwenKey) {
    onboardCmd += ` --auth-choice qwen-api-key --qwen-api-key "${qwenKey}"`;
  }

  // Run onboarding inside the container
  spinner.start('Running OpenClaw onboarding...');
  try {
    execSync(`docker exec ${CONTAINER_NAME} ${onboardCmd}`, {
      stdio: 'pipe',
      timeout: 120000,
      encoding: 'utf-8'
    });
    spinner.succeed('OpenClaw onboarded successfully');
  } catch (error: any) {
    spinner.fail('OpenClaw onboarding failed');
    if (error.stderr) {
      console.log(chalk.gray(error.stderr));
    }
    console.log(chalk.yellow('\nYou can onboard manually with:'));
    console.log(chalk.gray(`  docker exec -it ${CONTAINER_NAME} openclaw onboard`));
  }
}

/**
 * Configures an already-onboarded OpenClaw instance to use the available
 * provider API key by setting the default agent model.
 */
async function configureOpenClawModel(spinner: ora.Ora): Promise<void> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const claudeKey = process.env.CLAUDE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const kimiKey = process.env.KIMI_CODE_API_KEY || process.env.MOONSHOT_API_KEY;

  // Determine which provider to use (priority order)
  let model: string | null = null;
  if (deepseekKey) model = 'deepseek/deepseek-chat';
  else if (claudeKey) model = 'anthropic/claude-sonnet-4-20250514';
  else if (openaiKey) model = 'openai/gpt-4o';
  else if (openrouterKey) model = 'openrouter/openai/gpt-4o';
  else if (kimiKey) model = 'moonshot/moonshot-v1-8k';

  if (!model) {
    spinner.warn('OpenClaw is onboarded but no recognized API key is set');
    return;
  }

  // Check current default model
  let currentModel = '';
  try {
    const output = execSync(
      `docker exec ${CONTAINER_NAME} openclaw infer model auth status`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 30000 }
    );
    const status = JSON.parse(output);
    currentModel = status.defaultModel || '';
  } catch {
    // Couldn't read status, proceed anyway
  }

  if (currentModel && !currentModel.startsWith('openai/')) {
    // Already configured for a non-OpenAI provider, assume it's fine
    spinner.succeed(`OpenClaw already configured for ${currentModel}`);
    return;
  }

  spinner.start(`Configuring OpenClaw to use ${model}...`);
  try {
    execSync(
      `docker exec ${CONTAINER_NAME} openclaw config set agents.defaults.model "${model}"`,
      { stdio: 'pipe', timeout: 10000 }
    );
    spinner.succeed(`OpenClaw model set to ${model}`);

    // Restart the container to apply the new model config
    spinner.start('Restarting OpenClaw gateway...');
    execSync(`docker restart ${CONTAINER_NAME}`, { stdio: 'pipe' });
    await sleep(6000);
    spinner.succeed('OpenClaw gateway restarted');
  } catch (error: any) {
    spinner.fail('Failed to configure OpenClaw model');
    if (error.stderr) console.log(chalk.gray(error.stderr));
  }
}

/**
 * Polls the OpenClaw gateway health endpoint until it responds or times out.
 */
async function waitForOpenClawGateway(spinner: ora.Ora, maxAttempts = 30): Promise<void> {
  spinner.start('Waiting for OpenClaw gateway to be ready...');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = execSync('curl -sf http://localhost:18789/healthz', {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: 'pipe'
      });
      const data = JSON.parse(output);
      if (data.ok === true) {
        spinner.succeed('OpenClaw gateway ready');
        return;
      }
    } catch {
      // Gateway not ready yet
    }
    await sleep(2000);
  }

  spinner.warn('OpenClaw gateway did not become healthy in time');
  console.log(chalk.yellow('\n⚠️  The container is running but the gateway may still be starting.'));
  console.log(chalk.gray('   Check logs with: agent-devkit logs --agent openclaw'));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
