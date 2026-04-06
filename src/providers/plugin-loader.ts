import { AIProvider } from './interface';

export class PluginLoader {
  private providers: Map<string, AIProvider> = new Map();

  /**
   * Dynamically loads a provider by its ID.
   */
  public async loadProvider(providerId: string): Promise<AIProvider> {
    if (this.providers.has(providerId)) {
      return this.providers.get(providerId)!;
    }

    try {
      // In a real implementation, we would dynamically import or read from a plugin directory.
      // For this implementation, we map known provider IDs to their modules.
      const module = await import(`./${providerId}/index.js`);
      
      const ProviderClass = module.default;
      const providerInstance = new ProviderClass();
      
      this.providers.set(providerId, providerInstance);
      return providerInstance;
    } catch (error) {
      throw new Error(`Failed to load provider plugin '${providerId}': ${error}`);
    }
  }

  /**
   * Returns all loaded providers.
   */
  public getLoadedProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }
}

export const pluginLoader = new PluginLoader();
