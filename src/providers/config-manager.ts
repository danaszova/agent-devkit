import * as fs from 'fs';
import * as path from 'path';
import { AIProvider } from './interface';
import { pluginLoader } from './plugin-loader';

export interface ProviderConfig {
  defaultProvider: string;
  providers: Record<string, Record<string, any>>;
}

export class ConfigManager {
  private config: ProviderConfig = {
    defaultProvider: 'openai',
    providers: {}
  };
  private currentProvider: AIProvider | null = null;
  private configPath: string = path.join(process.cwd(), 'agent-devkit', 'config', 'providers.json');

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(fileContent);
      }
    } catch (err) {
      console.warn('Could not load providers.json, using defaults.');
    }
  }

  public saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error('Failed to save providers.json:', err);
    }
  }

  public async getProvider(providerId?: string): Promise<AIProvider> {
    const idToLoad = providerId || this.config.defaultProvider;
    
    if (this.currentProvider && this.currentProvider.id === idToLoad) {
      return this.currentProvider;
    }

    const provider = await pluginLoader.loadProvider(idToLoad);
    const providerConfig = this.config.providers[idToLoad] || {};
    
    await provider.initialize(providerConfig);
    this.currentProvider = provider;
    
    return provider;
  }
}

export const configManager = new ConfigManager();
