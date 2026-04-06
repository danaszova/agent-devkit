import { AIProvider, AIResponse, ChatMessage } from '../interface';

export default class ClaudeProvider implements AIProvider {
  id = 'claude';
  name = 'Anthropic Claude';
  type = 'api' as const;
  capabilities = ['chat', 'reasoning', 'coding'];
  private apiKey: string = '';

  async initialize(config: Record<string, any>): Promise<void> {
    this.apiKey = config.apiKey || process.env.CLAUDE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Claude API key not found. Using mock mode.');
    }
  }

  async generate(prompt: string, options?: Record<string, any>): Promise<AIResponse> {
    if (!this.apiKey) {
      return { text: `[MOCK CLAUDE] Response to: ${prompt}` };
    }
    
    // In a real implementation, make API request to Anthropic
    return {
      text: `[REAL CLAUDE - Unimplemented] Received: ${prompt}`
    };
  }

  async chat(messages: ChatMessage[], options?: Record<string, any>): Promise<AIResponse> {
    if (!this.apiKey) {
      return { text: `[MOCK CLAUDE] Received ${messages.length} messages.` };
    }

    // Real API integration would go here
    return {
      text: `[REAL CLAUDE - Unimplemented] Received ${messages.length} messages.`
    };
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('Embeddings not supported natively by standard Claude models yet.');
  }
}
