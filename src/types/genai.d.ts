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
        };
      }): Promise<{ text?: string }>;
    };
  }
}
