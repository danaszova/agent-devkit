import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

interface InitOptions {
  name?: string;
  framework?: string;
  provider?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🚀 agent-devkit initialization\n'));

  // If no options provided, prompt for them
  if (!options.name || !options.framework || !options.provider) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent project name:',
        default: options.name || 'my-agent',
        validate: (input: string) => {
          if (input.length < 3) return 'Name must be at least 3 characters';
          if (!/^[a-z0-9-]+$/.test(input)) return 'Name must be lowercase with hyphens only';
          return true;
        },
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Select AI framework:',
        choices: ['openclaw', 'hermes', 'custom'],
        default: options.framework || 'openclaw',
      },
      {
        type: 'list',
        name: 'provider',
        message: 'Select AI provider:',
        choices: ['claude', 'openai', 'deepseek', 'local'],
        default: options.provider || 'claude',
      },
    ]);

    options = { ...options, ...answers };
  }

  const spinner = ora('Initializing agent project...').start();

  try {
    const projectDir = path.join(process.cwd(), options.name!);

    // Check if directory already exists
    if (fs.existsSync(projectDir)) {
      spinner.fail(`Directory ${options.name} already exists`);
      return;
    }

    // Create project directory structure
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'config'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'logs'), { recursive: true });

    // Create config file
    const config = {
      name: options.name,
      framework: options.framework,
      provider: options.provider,
      version: '0.1.0',
      created: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(projectDir, 'config', 'agent.json'),
      JSON.stringify(config, null, 2)
    );

    // Create .env template
    const envTemplate = `# AI Provider API Keys - uncomment and fill in the one you want to use
# CLAUDE_API_KEY=your_claude_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
# OPENROUTER_API_KEY=your_openrouter_api_key_here
# DEEPSEEK_API_KEY=your_deepseek_api_key_here
# KIMI_CODE_API_KEY=your_kimi_code_api_key_here
# MOONSHOT_API_KEY=your_moonshot_api_key_here
# ZAI_API_KEY=your_zai_api_key_here
# GLM_API_KEY=your_glm_api_key_here
# QWEN_API_KEY=your_qwen_api_key_here
# QWEN_CODE_API_KEY=your_qwen_code_api_key_here

# Gmail Inbox Cleaner (optional - set after running setup-email-cleaner)
# GMAIL_USER=your.email@gmail.com
# GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# OpenClaw Gateway (optional)
# OPENCLAW_TOKEN=your_gateway_token_here
# OPENCLAW_BASE_URL=http://localhost:18789

# Database
POSTGRES_PASSWORD=changeme

# Agent Configuration
AGENT_NAME=${options.name}
AI_PROVIDER=${options.provider}
`;

    fs.writeFileSync(path.join(projectDir, '.env.example'), envTemplate);

    // Create README
    const readme = `# ${options.name}

AI Agent project created with agent-devkit

## Framework: ${options.framework}
## Provider: ${options.provider}

## Getting Started

1. Copy \`.env.example\` to \`.env\` and add your API keys
2. Run \`agent-devkit start\` to start development
3. Develop your skills in the \`skills/\` directory
4. Check logs with \`agent-devkit logs\`

## Commands

- \`agent-devkit start\` - Start development environment
- \`agent-devkit stop\` - Stop environment
- \`agent-devkit status\` - Check status
- \`agent-devkit logs\` - View logs

For more information, visit: https://github.com/ai-studio-labs/agent-devkit
`;

    fs.writeFileSync(path.join(projectDir, 'README.md'), readme);

    spinner.succeed(chalk.green('Project initialized successfully!'));

    console.log(chalk.bold('\n📁 Project structure created:'));
    console.log(chalk.gray(`  ${options.name}/`));
    console.log(chalk.gray(`  ├── skills/`));
    console.log(chalk.gray(`  ├── config/`));
    console.log(chalk.gray(`  ├── logs/`));
    console.log(chalk.gray(`  ├── .env.example`));
    console.log(chalk.gray(`  └── README.md`));

    console.log(chalk.bold.yellow('\n⚡ Next steps:'));
    console.log(chalk.white(`  1. cd ${options.name}`));
    console.log(chalk.white(`  2. cp .env.example .env`));
    console.log(chalk.white(`  3. Edit .env with your API keys`));
    console.log(chalk.white(`  4. agent-devkit start`));
    console.log();
  } catch (error) {
    spinner.fail('Failed to initialize project');
    console.error(chalk.red(error));
    process.exit(1);
  }
}