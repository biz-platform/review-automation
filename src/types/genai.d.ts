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
          /** Structured output */
          responseMimeType?: string;
          responseJsonSchema?: unknown;
          thinkingConfig?: {
            thinkingBudget?: number;
            includeThoughts?: boolean;
          };
        };
      }): Promise<{
        text?: string;
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          finishReason?: string;
        }>;
      }>;
      generateContentStream(params: {
        model: string;
        contents: string;
        config?: {
          systemInstruction?: string;
          maxOutputTokens?: number;
          responseMimeType?: string;
          responseJsonSchema?: unknown;
          thinkingConfig?: {
            thinkingBudget?: number;
            includeThoughts?: boolean;
          };
        };
      }): Promise<AsyncIterable<{ text?: string }>> | AsyncIterable<{ text?: string }>;
    };
  }
}
