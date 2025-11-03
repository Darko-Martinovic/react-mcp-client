import { askAzureOpenAI } from "./azureOpenAI";
import { callMcpTool } from "./mcpServer";
import {
  fetchArticlesFromAzureSearch,
  fetchAzureSearchSchema,
  getSearchableFields,
  getFilterableFields,
} from "./azureSearch";
import { getSystemPromptConfig } from "../components/SystemPromptEditor";
import { isSimpleTable } from "../components/DataVisualization/DataTransformer";
import { cacheManager } from "./cacheManager";

export interface AIResponse {
  aiMessage: string;
  functionCalls?: any[];
  tokensUsed?: TokenUsage;
  estimatedCost?: number;
  model?: string;
}

export interface MCPCall {
  function: string;
  parameters: Record<string, any>;
}

export interface SearchResult {
  value: Array<{
    functionName?: string;
    name?: string;
    description?: string;
    endpoint?: string;
    httpMethod?: string;
    parameters?: string;
    category?: string;
    isActive?: boolean;
    responseType?: string;
    lastUpdated?: string;
  }>;
}

export interface MCPResponse {
  success?: boolean;
  data?: Record<string, unknown>[];
  error?: string;
  timestamp?: string;
  count?: number;
  text?: string;
  tableData?: Record<string, unknown>[];
  toolName?: string;
  summary?: string;
  jsonData?: any;
  isJsonResponse?: boolean;
  mongoMetadata?: {
    totalDocuments?: number;
    totalUniqueTypes?: number;
    isMongoDb?: boolean;
  };
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface Message {
  sender: "user" | "system";
  text?: string;
  tableData?: Record<string, unknown>[];
  jsonData?: any;
  toolName?: string;
  traceData?: {
    aiResponse?: any;
    mcpCall?: any;
    mcpResponse?: any;
    selectedTool?: any;
    parameters?: any;
    timestamp?: string;
    userInput?: string;
    error?: string;
  };
  // Token usage and cost tracking
  tokensUsed?: TokenUsage;
  estimatedCost?: number;
  model?: string;
  usedTools?: boolean;
  toolsCalled?: string[];
}

// Function to get AI intent without displaying the response
export const getAIIntent = async (
  userMessage: string,
  previousMessages: Message[],
  chatId?: string
): Promise<AIResponse> => {
  // Get system configuration first
  const systemConfig = getSystemPromptConfig();

  // Fetch schema first to understand the index structure
  const schema = await fetchAzureSearchSchema();
  console.log("=== AZURE SEARCH SCHEMA ===");
  console.log("Schema loaded:", schema);

  if (schema) {
    const searchableFields = getSearchableFields(schema);
    const filterableFields = getFilterableFields(schema);
    console.log("Searchable fields:", searchableFields);
    console.log("Filterable fields:", filterableFields);
  }
  console.log("===========================");

  // Fetch articles from Azure Search for RAG context
  const articles = await fetchArticlesFromAzureSearch("*");

  // Build enhanced system prompt with schema information
  let schemaInfo = "";
  if (schema) {
    schemaInfo = `

Index Schema Information:
- Index Name: ${schema.indexName}
- Available Fields: ${schema.fields
      .map((f) => `${f.name} (${f.type})`)
      .join(", ")}
- Searchable Fields: ${getSearchableFields(schema).join(", ")}
- Filterable Fields: ${getFilterableFields(schema).join(", ")}`;
  }

  // Build system prompt with MCP function instruction
  const baseSystemPrompt = `You are an intelligent assistant that helps users interact with MCP (Model Context Protocol) tools through Azure Search.

When users ask questions about products, inventory, sales, or business data, you should call the search_azure_cognitive function to find relevant tools and data.

Your job is to:
1. Understand the user's intent
2. Call the search_azure_cognitive function with appropriate search terms
3. The system will automatically find the best MCP tool and execute it

Query Intent Guidelines:
- For product listings/inventory: search for "products inventory" to find GetProducts or GetDetailedInventory tools
- For specific suppliers: include supplier name in search
- For specific categories: include category name in search  
- For sales data: search for "sales data" to find GetSalesData tools
- For low stock alerts: search for "low stock" to find GetLowStockProducts tool
- For general inventory/stock levels: search for "detailed inventory" to find GetDetailedInventory tool
- For revenue data: search for "revenue" to find GetTotalRevenue tool
- For category performance: search for "sales category" to find GetSalesByCategory tool
- For daily summaries: search for "daily summary" to find GetDailySummary tool
- For inventory status: search for "inventory status" to find GetInventoryStatus tool

Available MCP tools in the search index: ${articles
    .map((a: any) => a.functionName || a.name)
    .join(", ")}${schemaInfo}

Available sample tools: ${articles
    .map((a: any) => `${a.functionName}: ${a.description}`)
    .slice(0, 3)
    .join(", ")}`;

  // Add custom prompt addition if configured
  const finalSystemPrompt = systemConfig.customPromptAddition
    ? `${baseSystemPrompt}

CUSTOM INSTRUCTIONS:
${systemConfig.customPromptAddition}`
    : baseSystemPrompt;

  if (systemConfig.enableDetailedLogging) {
    console.log("=== SYSTEM PROMPT ===");
    console.log("Base prompt length:", baseSystemPrompt.length);
    console.log("Custom addition:", systemConfig.customPromptAddition);
    console.log("Final prompt length:", finalSystemPrompt.length);
    console.log("=====================");
  }

  return await askAzureOpenAI(userMessage, finalSystemPrompt, chatId);
};

// Function to parse AI response and extract MCP server call
export const parseAIResponseForMCPCall = (
  aiResponse: string
): MCPCall | null => {
  try {
    console.log("=== PARSING AI RESPONSE ===");
    console.log("Raw AI Response:", aiResponse);
    console.log("AI Response Length:", aiResponse.length);

    // Look for structured function calls in AI response
    const functionMatch = aiResponse.match(/Function:\s*([\w.]+)/i);
    const parametersMatch = aiResponse.match(/Parameters:\s*({.*?})/s);

    console.log("Function Match:", functionMatch);
    console.log("Parameters Match:", parametersMatch);

    if (functionMatch) {
      const functionName = functionMatch[1];
      let parameters: Record<string, any> = {};

      if (parametersMatch) {
        try {
          parameters = JSON.parse(parametersMatch[1]);
          console.log("Successfully parsed parameters:", parameters);
        } catch (e) {
          console.warn("Could not parse parameters:", parametersMatch[1]);
          // Try to extract query from the parameters string
          const queryMatch = parametersMatch[1].match(/"query":\s*"([^"]+)"/);
          if (queryMatch) {
            parameters = { query: queryMatch[1] };
            console.log("Extracted query from parameters:", parameters);
          }
        }
      }

      // Handle multi_tool_use.parallel function calls
      if (functionName === "multi_tool_use.parallel" && parameters.tool_uses) {
        // Extract the query from the first tool use
        const firstTool = parameters.tool_uses[0];
        if (firstTool && firstTool.parameters && firstTool.parameters.query) {
          const result: MCPCall = {
            function: "multi_tool_use",
            parameters: { query: firstTool.parameters.query },
          };
          console.log(
            "Multi-tool function call extracted successfully:",
            result
          );
          return result;
        }
      }

      const result: MCPCall = {
        function: functionName.toLowerCase(),
        parameters,
      };
      console.log("Function call extracted successfully:", result);
      return result;
    }

    // Fallback: try to infer from AI response content
    console.log("No structured function found, trying fallback...");
    const lowerResponse = aiResponse.toLowerCase();
    console.log("Lowercase response:", lowerResponse);

    // Check for search-related keywords
    if (
      lowerResponse.includes("search") ||
      lowerResponse.includes("find") ||
      lowerResponse.includes("look") ||
      lowerResponse.includes("show")
    ) {
      console.log("Found search-related keywords, extracting query...");
      const searchQuery = extractSearchQuery(aiResponse);
      console.log("Extracted search query:", searchQuery);
      if (searchQuery) {
        const fallbackResult: MCPCall = {
          function: "search",
          parameters: { query: searchQuery },
        };
        console.log("Fallback function call created:", fallbackResult);
        return fallbackResult;
      }
    }

    console.log("No MCP function call could be extracted");
    return null;
  } catch (error) {
    console.error("Error parsing AI response:", error);
    return null;
  }
};

// Function to extract search query from text
export const extractSearchQuery = (text: string): string => {
  // Look for quoted search terms
  const quotedMatch = text.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];

  // Look for search terms after common keywords
  const searchPatterns = [
    /(?:search|find|look|show).*?(?:for|about)\s+(.+?)(?:\.|$)/i,
    /(?:what|which).*?(?:kind|type|sort).*?(?:of|are)\s+(.+?)(?:\.|$)/i,
    /(?:tools?|functions?|items?).*?(?:about|for|on)\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of searchPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]
        .trim()
        .replace(/[^\w\s]/g, "")
        .trim();
    }
  }

  // Extract key terms (fallback)
  const words = text
    .split(" ")
    .filter(
      (word) =>
        word.length > 3 &&
        ![
          "the",
          "and",
          "for",
          "with",
          "that",
          "this",
          "what",
          "which",
          "kind",
          "type",
        ].includes(word.toLowerCase())
    )
    .map((word) => word.replace(/[^\w]/g, ""));

  return words.slice(0, 3).join(" ").trim() || "*";
};

// Function to call MCP server via proxy (port 5002 → port 9090)
export const callMCPServer = async (
  mcpCall: MCPCall,
  chatId?: string
): Promise<MCPResponse> => {
  console.log("🔴 CALLMCPSERVER FUNCTION ENTRY POINT 🔴");
  console.log("MCP Call received:", JSON.stringify(mcpCall, null, 2));
  console.log("🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴");

  console.log("Calling MCP Server via proxy:", mcpCall);
  console.log("Chat ID for cache isolation:", chatId);

  // TEMPORARY: Disable cache clearing to see caching behavior
  // console.log("🧹 Clearing all cache to eliminate corruption");
  // cacheManager.clear();  // Get schema information for enhanced debugging
  const schema = await fetchAzureSearchSchema();
  if (schema) {
    console.log("=== SCHEMA VALIDATION ===");
    console.log("Index Name:", schema.indexName);
    console.log(
      "Available Fields:",
      schema.fields.map((f) => f.name)
    );
    console.log("========================");
  }

  console.log("🔍 About to make search request to /api/search");
  console.log("Search query:", mcpCall.parameters.query || "*");

  // First, get the available tools from Azure Search to find the right tool name and endpoint
  const searchResponse = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: mcpCall.parameters.query || "*" }),
  });

  console.log("🔍 Search response status:", searchResponse.status);
  console.log("🔍 Search response ok:", searchResponse.ok);

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error("❌ Search failed with detailed error:", errorText);
    throw new Error(
      `Search failed with ${searchResponse.status}: ${errorText}`
    );
  }

  const searchData: SearchResult = await searchResponse.json();
  console.log("Search results for tool lookup:", searchData);

  // Extract the best matching tool and its endpoint
  let selectedTool = null;
  if (searchData.value && searchData.value.length > 0) {
    selectedTool =
      searchData.value.find((tool) => tool.functionName && tool.endpoint) ||
      searchData.value[0];
  }

  if (!selectedTool || !selectedTool.endpoint) {
    const errorMsg = !selectedTool
      ? "No matching MCP tool found for your request."
      : `Selected tool "${selectedTool.functionName}" is missing endpoint information.`;
    console.error("Tool selection failed:", errorMsg);
    return { text: errorMsg };
  }

  console.log("Selected tool for MCP call:", {
    functionName: selectedTool.functionName,
    endpoint: selectedTool.endpoint,
    httpMethod: selectedTool.httpMethod,
    description: selectedTool.description?.substring(0, 100) + "...",
  });

  try {
    const toolName = selectedTool.functionName || "UnknownTool";
    const extractedParams = extractParametersDirectly(
      mcpCall.parameters.originalUserInput || mcpCall.parameters.query || ""
    );
    const finalParameters = { ...mcpCall.parameters, ...extractedParams };

    // Store original user input for semantic caching
    const originalUserInput =
      mcpCall.parameters.originalUserInput || mcpCall.parameters.query || "";

    console.log("=== CALLING MCP TOOL DEBUG ===");
    console.log("Tool Name:", toolName);
    console.log("Final Parameters:", finalParameters);
    console.log("Original User Input:", originalUserInput);
    console.log("===============================");

    // Remove the 'query' and 'originalUserInput' parameters as they're not needed for the actual MCP call
    delete finalParameters.query;
    delete finalParameters.originalUserInput;

    const mcpData = await callMcpTool(
      toolName,
      finalParameters,
      originalUserInput,
      chatId
    );

    console.log("=== MCP DATA DEBUG ===");
    console.log("Raw MCP Data:", JSON.stringify(mcpData, null, 2));
    console.log("Tool Name:", toolName);
    console.log("MCP Data Type:", typeof mcpData);
    console.log("MCP Data Keys:", Object.keys(mcpData || {}));
    console.log("======================");

    // Extract the actual data from the MCP response wrapper
    let actualData: any = mcpData;
    if (mcpData && mcpData.data && typeof mcpData.data === "object") {
      actualData = mcpData.data;
    }

    console.log("=== ACTUAL DATA DEBUG ===");
    console.log("Actual Data:", JSON.stringify(actualData, null, 2));
    console.log("========================");

    const formattedResponse = formatStructuredMCPResponse(
      actualData,
      selectedTool.functionName || "Unknown Tool",
      finalParameters,
      mcpCall.parameters.originalUserInput || mcpCall.parameters.query
    );

    console.log("=== FORMATTED RESPONSE DEBUG ===");
    console.log(
      "Formatted Response:",
      JSON.stringify(formattedResponse, null, 2)
    );
    console.log("================================");

    return formattedResponse;
  } catch (mcpError) {
    console.error("Error calling MCP server via proxy:", mcpError);
    return {
      text: `Error connecting to MCP server: ${
        mcpError instanceof Error ? mcpError.message : String(mcpError)
      }. Available tool: ${selectedTool.functionName} - ${
        selectedTool.description
      }`,
    };
  }
};

// Direct parameter extraction function
export const extractParametersDirectly = (
  query: string
): Record<string, any> => {
  const today = new Date();
  const currentDate = today.toISOString().split("T")[0];
  const lowerQuery = query.toLowerCase();

  const params: Record<string, any> = {};

  // Extract numeric thresholds for stock level queries
  const thresholdPatterns = [
    /(?:under|below|less than|fewer than)\s+(\d+)/i,
    /(\d+)\s+(?:units?|items?|or less|or fewer)/i,
    /stock.*?(?:under|below|less than|fewer than)\s+(\d+)/i,
    /(?:under|below|less than|fewer than)\s+(\d+).*?(?:units?|items?)/i,
  ];

  for (const pattern of thresholdPatterns) {
    const match = query.match(pattern);
    if (match) {
      const threshold = parseInt(match[1]);
      if (!isNaN(threshold) && threshold > 0) {
        params.threshold = threshold;
        break;
      }
    }
  }

  // Extract supplier information
  const supplierPatterns = [
    /from\s+([A-Z][^.?]*(?:Co\.|Corp\.|Inc\.|Ltd\.|LLC|Company))/i,
    /supplier\s+([A-Z][^.?]*(?:Co\.|Corp\.|Inc\.|Ltd\.|LLC|Company))/i,
    /([A-Z][A-Za-z\s]*(?:Co\.|Corp\.|Inc\.|Ltd\.|LLC|Company))/g,
  ];

  for (const pattern of supplierPatterns) {
    const match = query.match(pattern);
    if (match) {
      const supplier = match[1] || match[0];
      if (supplier && supplier.length > 3) {
        params.supplier = supplier.trim();
        break;
      }
    }
  }

  // Extract category information
  const categoryKeywords = [
    "dairy",
    "meat",
    "fruits",
    "vegetables",
    "beverages",
    "bakery",
  ];
  for (const category of categoryKeywords) {
    if (
      lowerQuery.includes(category) &&
      !lowerQuery.includes(category + " co")
    ) {
      params.category = category.charAt(0).toUpperCase() + category.slice(1);
      break;
    }
  }

  // Calculate date ranges based on common phrases
  if (lowerQuery.includes("last month") || lowerQuery.includes("past month")) {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    params.startDate = startDate;
    params.endDate = currentDate;
  }

  if (lowerQuery.includes("last week") || lowerQuery.includes("past week")) {
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    params.startDate = startDate;
    params.endDate = currentDate;
  }

  // Handle "recent" queries - default to last 30 days (multilingual)
  if (
    (lowerQuery.includes("recent") ||
      lowerQuery.includes("récent") ||
      lowerQuery.includes("dernier") ||
      lowerQuery.includes("recente") ||
      lowerQuery.includes("laatste")) &&
    (lowerQuery.includes("sales") ||
      lowerQuery.includes("selling") ||
      lowerQuery.includes("sold") ||
      lowerQuery.includes("ventes") ||
      lowerQuery.includes("vente") ||
      lowerQuery.includes("vendus") ||
      lowerQuery.includes("verkoop") ||
      lowerQuery.includes("verkopen") ||
      lowerQuery.includes("verkocht"))
  ) {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    console.log(
      `Detected "recent sales" query - applying default 30-day range: ${startDate} to ${currentDate}`
    );
    params.startDate = startDate;
    params.endDate = currentDate;
  }

  // Check for "last X days" pattern (multilingual)
  const daysMatch = lowerQuery.match(
    /last (\d+) days?|dernier[s]? (\d+) jours?|laatste (\d+) dagen?/
  );
  if (daysMatch) {
    const numDays = parseInt(daysMatch[1] || daysMatch[2] || daysMatch[3]);
    const startDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    params.startDate = startDate;
    params.endDate = currentDate;
  }

  // Default date range for sales queries when no specific timeframe is mentioned (multilingual)
  if (
    !params.startDate &&
    !params.endDate &&
    (lowerQuery.includes("sales") ||
      lowerQuery.includes("selling") ||
      lowerQuery.includes("best selling") ||
      lowerQuery.includes("top selling") ||
      lowerQuery.includes("revenue") ||
      lowerQuery.includes("sold") ||
      // French keywords
      lowerQuery.includes("ventes") ||
      lowerQuery.includes("vente") ||
      lowerQuery.includes("catégories") ||
      lowerQuery.includes("categories") ||
      lowerQuery.includes("performance") ||
      lowerQuery.includes("vendus") ||
      lowerQuery.includes("meilleures ventes") ||
      lowerQuery.includes("meilleurs produits") ||
      // Dutch keywords
      lowerQuery.includes("verkoop") ||
      lowerQuery.includes("verkopen") ||
      lowerQuery.includes("verkocht") ||
      lowerQuery.includes("categorieën") ||
      lowerQuery.includes("categorie") ||
      lowerQuery.includes("presteren") ||
      lowerQuery.includes("prestatie") ||
      lowerQuery.includes("productcategorieën") ||
      lowerQuery.includes("productcategorie"))
  ) {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    console.log(
      `Sales query without explicit date range - applying default 30-day range: ${startDate} to ${currentDate}`
    );
    params.startDate = startDate;
    params.endDate = currentDate;
  }

  console.log("Final extracted parameters:", params);
  return params;
};

// Function to return structured data for better table rendering
export const formatStructuredMCPResponse = (
  data: any,
  toolName: string,
  parameters?: Record<string, any>,
  originalQuery?: string
): MCPResponse => {
  console.log("=== FORMAT STRUCTURED MCP RESPONSE DEBUG ===");
  console.log("Data type:", typeof data);
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Tool Name:", toolName);
  console.log("Parameters:", parameters);
  console.log("===========================================");

  if (data.error) {
    return { text: `Error from MCP server: ${data.error}` };
  }

  // Build parameter info for display
  let paramInfo = "";
  if (parameters) {
    const relevantParams = Object.entries(parameters)
      .filter(([key, value]) => key !== "query" && value)
      .map(([key, value]) => {
        if (key === "startDate" || key === "endDate") {
          const date = new Date(value as string);
          return `${key}: ${date.toLocaleDateString()} (${value})`;
        }
        return `${key}: ${value}`;
      })
      .join(", ");

    if (relevantParams) {
      paramInfo = `\n🔍 **Applied Filters:** ${relevantParams}`;
    }
  }

  // Detect if this is a MongoDB/ThirdApi response
  const isMongoResponse =
    toolName?.toLowerCase().includes("thirdapi") ||
    data.totalDocuments !== undefined ||
    data.totalUniqueTypes !== undefined;

  // Handle successful responses with data array
  if (data.success !== undefined) {
    if (data.data && Array.isArray(data.data)) {
      const tableData = data.data;

      if (tableData.length === 0) {
        return {
          text: `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** No data found`,
        };
      }

      // For MongoDB responses, include additional metadata
      let mongoMetadata = {};
      if (isMongoResponse) {
        mongoMetadata = {
          totalDocuments: data.totalDocuments,
          totalUniqueTypes: data.totalUniqueTypes,
          isMongoDb: true,
        };
      }

      return {
        tableData,
        toolName,
        mongoMetadata,
        timestamp: data.timestamp,
        count: data.count || tableData.length,
      };
    } else if (data.success) {
      // Non-array successful response - likely a single document or complex object
      return {
        jsonData: data,
        toolName,
        timestamp: data.timestamp,
        isJsonResponse: true,
      };
    } else {
      return {
        text: `❌ **${toolName}** execution failed${paramInfo}\n\n📊 **Result:** ${JSON.stringify(
          data,
          null,
          2
        )}`,
      };
    }
  }

  // Check if it's a table/array response (fallback)
  if (Array.isArray(data) || (data.data && Array.isArray(data.data))) {
    const tableData = Array.isArray(data) ? data : data.data;

    if (tableData.length === 0) {
      return {
        text: `📊 **${toolName} Results:** No data found${paramInfo}`,
      };
    }

    return {
      tableData,
      toolName,
    };
  }

  // Handle complex objects that should be displayed as JSON
  if (typeof data === "object" && data !== null) {
    return {
      jsonData: data,
      toolName,
      isJsonResponse: true,
    };
  }

  return {
    text: `📊 **${toolName} Results:**${paramInfo}\n\n${String(data)}`,
  };
};
