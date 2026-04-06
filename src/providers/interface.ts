export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface AIResponse {
  text: string;
  toolCalls?: any[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'subscription' | 'api' | 'local';
  capabilities: string[];
  
  initialize(config: Record<string, any>): Promise<void>;
  generate(prompt: string, options?: Record<string, any>): Promise<AIResponse>;
  chat(messages: ChatMessage[], options?: Record<string, any>): Promise<AIResponse>;
  embed(text: string): Promise<number[]>;
}
