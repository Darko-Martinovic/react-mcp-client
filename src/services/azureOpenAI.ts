// Azure OpenAI service layer (real integration)
// Requires .env variables:
// VITE_AOAI_ENDPOINT
// VITE_AOAI_APIKEY

import { cacheManager, generateAICacheKey } from "./cacheManager";

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AzureOpenAIResponse {
  functionCalls: FunctionCall[];
  aiMessage: string;
  tokensUsed?: TokenUsage;
  estimatedCost?: number;
  model?: string;
}

export async function askAzureOpenAI(
  userMessage: string,
  systemPrompt: string,
  chatId?: string
): Promise<AzureOpenAIResponse> {
  // Generate cache key for this AI request with chat isolation and service prefix
  const cacheKey = generateAICacheKey(userMessage, systemPrompt, chatId);
  console.log("🔑 Generated AI cache key with service prefix:", cacheKey);

  // Check cache first with semantic matching (now fixed to respect service prefixes)
  const cachedResponse = cacheManager.get<AzureOpenAIResponse>(
    cacheKey,
    userMessage
  );
  if (cachedResponse) {
    console.log(
      `🎯 Using cached AI response for: "${userMessage.substring(0, 50)}..."`
    );
    console.log("=== CACHED AI RESPONSE DEBUG ===");
    console.log("Cached Response Type:", typeof cachedResponse);
    console.log("Cached Response Keys:", Object.keys(cachedResponse || {}));
    console.log("Cached AI Message:", cachedResponse.aiMessage);
    console.log("Cached Function Calls:", cachedResponse.functionCalls);
    console.log(
      "Cached Response Full:",
      JSON.stringify(cachedResponse, null, 2)
    );
    console.log("===============================");
    return cachedResponse;
  }

  console.log(
    `🧠 Making fresh AI request for: "${userMessage.substring(0, 50)}..."`
  );

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
        name: "GetSalesByCategory",
        description:
          "Analyze sales performance grouped by product categories within a date range. Valuable for category management and merchandising decisions.",
        parameters: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "Start date for the analysis in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              description: "End date for the analysis in YYYY-MM-DD format",
            },
          },
          required: ["startDate", "endDate"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "GetSalesData",
        description:
          "Get detailed sales data including best selling products within a specified date range",
        parameters: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "Start date for the sales data in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              description: "End date for the sales data in YYYY-MM-DD format",
            },
          },
          required: ["startDate", "endDate"],
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

  // Extract token usage from Azure OpenAI response
  let tokensUsed: TokenUsage | undefined;
  let estimatedCost: number | undefined;
  const model = data.model || "gpt-4o"; // Default to gpt-4o if not specified

  if (data.usage) {
    tokensUsed = {
      prompt: data.usage.prompt_tokens || 0,
      completion: data.usage.completion_tokens || 0,
      total: data.usage.total_tokens || 0,
    };

    // Calculate estimated cost based on model pricing (per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 2.5, output: 10.0 },
      "gpt-4": { input: 30.0, output: 60.0 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    };

    const modelKey =
      Object.keys(pricing).find((key) => model.toLowerCase().includes(key)) ||
      "gpt-4o";

    const modelPricing = pricing[modelKey];
    const promptCost = (tokensUsed.prompt / 1000000) * modelPricing.input;
    const completionCost =
      (tokensUsed.completion / 1000000) * modelPricing.output;
    estimatedCost = promptCost + completionCost;

    console.log("=== TOKEN USAGE & COST ===");
    console.log("Model:", model);
    console.log("Tokens Used:", tokensUsed);
    console.log("Estimated Cost: $", estimatedCost.toFixed(6));
    console.log("=========================");
  }

  const result: AzureOpenAIResponse = {
    functionCalls,
    aiMessage,
    tokensUsed,
    estimatedCost,
    model,
  };

  console.log("=== CACHING AI RESPONSE DEBUG ===");
  console.log("Result to Cache Type:", typeof result);
  console.log("Result to Cache Keys:", Object.keys(result || {}));
  console.log("Result AI Message:", result.aiMessage);
  console.log("Result Function Calls:", result.functionCalls);
  console.log("Result Full:", JSON.stringify(result, null, 2));
  console.log("Cache Key:", cacheKey);
  console.log("================================");

  // Cache the AI response with 10 minute TTL and original user message for semantic analysis
  cacheManager.set(cacheKey, result, 10 * 60 * 1000, userMessage);
  console.log(
    `📦 Cached AI response for: "${userMessage.substring(0, 50)}..."`
  );

  return result;
}
