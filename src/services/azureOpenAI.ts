// Azure OpenAI service layer (stub)

export interface FunctionCall {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface AzureOpenAIResponse {
  functionCalls: FunctionCall[];
  aiMessage: string;
}

export async function askAzureOpenAI(userMessage: string): Promise<AzureOpenAIResponse> {
  // Mocked response simulating Azure OpenAI function call output
  return {
    functionCalls: [
      {
        tool: 'getBusinessData',
        arguments: { query: userMessage },
      },
    ],
    aiMessage: `I will use the 'getBusinessData' tool to answer your question: "${userMessage}"`,
  };
} 