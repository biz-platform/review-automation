declare module "@google/genai" {
  export class GoogleGenAI {
    constructor(options: { apiKey: string });
    models: {
      generateContent(params: {
        model: string;
        contents: string;
        config?: {
          systemInstruction?: string;
          maxOutputTokens?: number;
          thinkingConfig?: { thinkingBudget?: number };
        };
      }): Promise<{ text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>;
      generateContentStream(params: {
        model: string;
        contents: string;
        config?: {
          systemInstruction?: string;
          maxOutputTokens?: number;
          thinkingConfig?: { thinkingBudget?: number };
        };
      }): Promise<AsyncIterable<{ text?: string }>> | AsyncIterable<{ text?: string }>;
    };
  }
}
