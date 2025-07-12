// Azure OpenAI service layer (real integration)
// Requires .env variables:
// VITE_AOAI_ENDPOINT
// VITE_AOAI_APIKEY

export interface FunctionCall {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface AzureOpenAIResponse {
  functionCalls: FunctionCall[];
  aiMessage: string;
}

export async function askAzureOpenAI(
  userMessage: string,
  systemPrompt: string
): Promise<AzureOpenAIResponse> {
  const endpoint = import.meta.env.VITE_AOAI_ENDPOINT;
  const apiKey = import.meta.env.VITE_AOAI_APIKEY;
  if (!endpoint || !apiKey) {
    throw new Error(
      "Azure OpenAI endpoint or API key not set in environment variables."
    );
  }

  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    // Add model, max_tokens, temperature, etc. as needed
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Azure OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  const aiMessage =
    data.choices?.[0]?.message?.content || "No response from AI.";
  let functionCalls: FunctionCall[] = [];
  try {
    if (data.choices?.[0]?.message?.function_call_plan) {
      functionCalls = JSON.parse(data.choices[0].message.function_call_plan);
    }
  } catch {
    // fallback: no function calls
  }

  return {
    functionCalls,
    aiMessage,
  };
}
