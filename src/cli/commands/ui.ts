import chalk from 'chalk';
import { execSync } from 'child_process';
import { startUIServer } from '../../server/ui-server';

export async function uiCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🎛️  Starting Agent DevKit Manager UI\n'));

  // Check Docker
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch {
    console.log(chalk.red('❌ Docker is not running'));
    console.log(chalk.yellow('Start Docker Desktop and try again'));
    process.exit(1);
  }

  // Open browser after a short delay
  const platform = process.platform;
  setTimeout(() => {
    try {
      const url = 'http://localhost:18790';
      if (platform === 'darwin') {
        execSync(`open "${url}"`, { stdio: 'ignore' });
      } else if (platform === 'linux') {
        execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
      } else if (platform === 'win32') {
        execSync(`start "" "${url}"`, { stdio: 'ignore' });
      }
      console.log(chalk.green('✅ Opened dashboard in browser'));
    } catch {
      console.log(chalk.gray('ℹ️  Open http://localhost:18790 manually'));
    }
  }, 1500);

  startUIServer();
}
