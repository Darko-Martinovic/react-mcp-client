// Azure OpenAI service layer (real integration)
// Requires .env variables:
// VITE_AOAI_ENDPOINT
// VITE_AOAI_APIKEY

export interface FunctionCall {
  name: string;
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

  // Define available tools/functions
  const tools = [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The location to get weather for",
            },
          },
          required: ["location"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_azure_cognitive",
        description:
          "Search Azure Cognitive Search for information about products, inventory, or business data",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant information",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_azure_search_schema",
        description:
          "Get the schema of the Azure Search index to understand available fields",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_searchable_fields",
        description:
          "Get fields that can be searched in the Azure Search index",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_filterable_fields",
        description:
          "Get fields that can be filtered in the Azure Search index",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
  ];

  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    tools: tools,
    tool_choice: "auto", // Allow the model to choose whether to call functions
    max_tokens: 1500,
    temperature: 0.7,
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

  // Handle tool calls in the standard Azure OpenAI format
  if (data.choices?.[0]?.message?.tool_calls) {
    functionCalls = data.choices[0].message.tool_calls.map((toolCall: any) => ({
      name: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments || "{}"),
    }));
  }
  // Fallback: check for legacy function_call_plan format
  else if (data.choices?.[0]?.message?.function_call_plan) {
    try {
      functionCalls = JSON.parse(data.choices[0].message.function_call_plan);
    } catch {
      // fallback: no function calls
    }
  }

  return {
    functionCalls,
    aiMessage,
  };
}
