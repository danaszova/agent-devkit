import chalk from 'chalk';
import { execSync } from 'child_process';

const CONTAINER_NAME = 'agent-devkit-openclaw';
const BASE_URL = process.env.OPENCLAW_BASE_URL || 'http://localhost:18789';

export async function dashboardCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🦞 Opening OpenClaw Dashboard\n'));

  // Verify the container is running
  try {
    execSync(`docker ps -q -f name=${CONTAINER_NAME}`, { stdio: 'pipe' });
  } catch {
    console.log(chalk.red('❌ OpenClaw container is not running'));
    console.log(chalk.yellow('Start it with: agent-devkit start'));
    process.exit(1);
  }

  // Retrieve the gateway auth token from inside the container
  let token = '';
  try {
    token = execSync(
      `docker exec ${CONTAINER_NAME} openclaw config get gateway.auth.token`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
  } catch {
    console.log(chalk.yellow('⚠️  Could not retrieve gateway token'));
  }

  // Build dashboard URL. OpenClaw uses a hash-token fragment.
  const url = token ? `${BASE_URL}/#token=${token}` : BASE_URL;

  console.log(chalk.white('Dashboard URL:'));
  console.log(chalk.cyan.underline(url));
  console.log();

  // Attempt to open the user's default browser
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'linux') {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else {
      throw new Error('Unsupported platform');
    }
    console.log(chalk.green('✅ Opened in your default browser'));
  } catch {
    console.log(chalk.gray('ℹ️  Copy the URL above into your browser'));
  }

  console.log();
}
