// FEATURES:
// - Dual-plugin support (Supermarket SQL + Catalog MongoDB)
// - Automatic parameter extraction from natural language queries
// - Path parameter handling for FindArticleByArticleKey
// - Validation for required parameters
// - Enhanced error messages
// - MongoDB response metadata
// - Azure Search integration
// - CORS support
// - Health checks
// - Articles with ingredients support (GetArticlesWithIngredients)
//
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// Add CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Schema endpoint - proxy to backend MCP server
app.get("/api/tools/schema", async (req, res) => {
  console.log("Received request to /api/tools/schema");

  const mcpServerUrl =
    process.env.VITE_MCP_SERVER_URL || "http://localhost:5000";

  try {
    console.log("Making request to MCP server for schema...");

    // Try to get schemas from both plugins
    const schemas = {};

    // Get Supermarket plugin schema
    try {
      const supermarketRes = await axios.get(
        `${mcpServerUrl}/api/supermarket/tools/schema`
      );
      schemas.supermarket = supermarketRes.data;
      console.log("Supermarket schema retrieved successfully");
    } catch (err) {
      console.warn("Supermarket schema not available:", err.message);
    }

    // Get a catalog plugin schema (if available)
    try {
      const catalogRes = await axios.get(
        `${mcpServerUrl}/api/catalog/tools/schema`
      );
      schemas.catalog = catalogRes.data;
      console.log("Catalog schema retrieved successfully");
    } catch (err) {
      console.warn("Catalog schema not available:", err.message);
    }

    // Return combined schemas or fallback to supermarket only
    const responseData =
      Object.keys(schemas).length > 0
        ? schemas
        : schemas.supermarket || { error: "No schemas available" };

    console.log("Schema response received, sending back to client");
    res.json(responseData);
  } catch (err) {
    console.error("Error in schema proxy:", err.message);
    if (err.response) {
      console.error("MCP server error response:", err.response.data);
    }
    res.status(500).json({ error: "Schema proxy error", details: err.message });
  }
});

// MCP Tool Call endpoint - proxy to backend MCP server
app.post("/api/tool", async (req, res) => {
  console.log("Received request to /api/tool");
  console.log("Request body:", req.body);

  const { tool, arguments: args } = req.body;
  const mcpServerUrl =
    process.env.VITE_MCP_SERVER_URL || "http://localhost:5000";

  try {
    console.log(`Making request to MCP server for tool: ${tool}`);

    // Handle multi_tool_use wrapper
    if (tool === "multi_tool_use") {
      console.log("Handling multi_tool_use request");

      // Handle the new format with query parameter
      if (args && args.query) {
        console.log("Processing multi_tool_use with query:", args.query);

        // Use Azure Search to find the best tool for this query
        const searchResult = await searchForTool(args.query);

        if (searchResult && searchResult.functionName) {
          console.log(
            `Found tool: ${searchResult.functionName} for query: ${args.query}`
          );

          // Extract parameters from the original user input
          const extractedParams = extractParametersFromQuery(
            args.originalUserInput || args.query
          );

          const result = await callSingleTool(
            searchResult.functionName,
            extractedParams,
            mcpServerUrl
          );

          res.json(result);
          return;
        } else {
          throw new Error(`No suitable tool found for query: ${args.query}`);
        }
      }

      // Handle the original format with tool_uses
      if (args && args.tool_uses) {
        const results = [];

        for (const toolUse of args.tool_uses) {
          const actualTool = toolUse.recipient_name;
          const actualArgs = toolUse.parameters;

          // Extract the actual tool name (remove "functions." prefix if present)
          const cleanToolName = actualTool
            .replace(/^functions\./, "")
            .replace(/^search_azure_cognitive$/, "GetDetailedInventory");

          console.log(
            `Processing tool: ${cleanToolName} with args:`,
            actualArgs
          );

          const result = await callSingleTool(
            cleanToolName,
            actualArgs,
            mcpServerUrl
          );
          results.push(result);
        }

        res.json({
          tool: "multi_tool_use",
          data: results,
        });
        return;
      }

      throw new Error(
        "multi_tool_use requires either 'query' or 'tool_uses' parameter"
      );
    }

    // Handle single tool calls
    // If arguments are empty, try to extract parameters from various possible query sources
    let finalArgs = args;
    const hasEmptyArgs = !args || Object.keys(args).length === 0;

    if (hasEmptyArgs) {
      console.log("⚠ Empty arguments detected for tool:", tool);

      // Try to find the original query in various places
      const possibleQueries = [
        req.body.originalUserInput,
        req.body.query,
        req.body.userQuery,
        req.body.originalQuery,
        req.body.message,
        req.body.prompt,
      ];

      let queryFound = null;
      for (const possibleQuery of possibleQueries) {
        if (possibleQuery && typeof possibleQuery === "string") {
          queryFound = possibleQuery;
          console.log(`✓ Found query in request body:`, queryFound);
          break;
        }
      }

      if (queryFound) {
        console.log("Attempting parameter extraction from:", queryFound);
        finalArgs = extractParametersFromQuery(queryFound);

        if (Object.keys(finalArgs).length > 0) {
          console.log("✓ Successfully extracted parameters:", finalArgs);
        } else {
          console.log("⚠ Parameter extraction failed - no parameters found");
        }
      } else {
        console.log(
          "⚠ No query found in request body to extract parameters from"
        );
        console.log("Request body keys:", Object.keys(req.body));
        console.log(
          "HINT: Client should send one of: originalUserInput, query, userQuery, message"
        );
      }
    }

    const result = await callSingleTool(tool, finalArgs, mcpServerUrl);
    res.json(result);
  } catch (err) {
    console.error("Error in tool proxy:", err.message);
    if (err.response) {
      console.error("MCP server error response:", err.response.data);
    }

    // Enhanced error response with plugin information
    const errorResponse = {
      error: "Tool proxy error",
      details: err.message,
    };

    // Add plugin context to error
    if (tool) {
      const mongoDbTools = [
        "GetContentTypesSummary",
        "GetPricesWithoutArticle",
        "GetLatestStatistics",
        "FindArticlesByName",
        "FindArticleByArticleKey",
        "GetPluData",
        "GetArticlesWithIngredients",
      ];
      if (
        mongoDbTools.includes(tool) ||
        tool.toLowerCase().includes("catalog")
      ) {
        errorResponse.plugin = "catalog";
      } else if (
        tool.includes("Products") ||
        tool.includes("Sales") ||
        tool.includes("Inventory")
      ) {
        errorResponse.plugin = "supermarket";
      }
    }

    res.status(500).json(errorResponse);
  }
});

// Helper function to call a single tool
async function callSingleTool(tool, args, mcpServerUrl) {
  console.log(`Calling single tool: ${tool} with args:`, args);

  // Map tool names to actual MCP server endpoints
  const toolEndpointMap = {
    // Supermarket SQL Server Plugin Tools
    GetProducts: "/api/supermarket/products",
    GetDetailedInventory: "/api/supermarket/inventory/detailed",
    GetInventoryStatus: "/api/supermarket/inventory/status",
    GetLowStockProducts: "/api/supermarket/products/low-stock",
    GetSalesData: "/api/supermarket/sales",
    GetTotalRevenue: "/api/supermarket/revenue",
    GetSalesByCategory: "/api/supermarket/sales/by-category",
    GetDailySummary: "/api/supermarket/sales/daily-summary",

    // Catalog MongoDB Plugin Tools
    GetContentTypesSummary: "/api/catalog/content-types",
    GetPricesWithoutArticle: "/api/catalog/prices-without-article",
    GetLatestStatistics: "/api/catalog/latest-statistics",
    FindArticlesByName: "/api/catalog/articles/search",
    FindArticleByArticleKey: "/api/catalog/articles",
    GetPluData: "/api/catalog/plu-data",
    GetArticlesWithIngredients: "/api/catalog/articles/ingredients",
    GetDocuments: "/api/catalog/documents",
    GetCollections: "/api/catalog/collections",
    SearchDocuments: "/api/catalog/search",
    AggregateData: "/api/catalog/aggregate",

    // Health Check endpoints
    CheckSupermarketHealth: "/api/supermarket/health",
    CheckCatalogHealth: "/api/catalog/health",
    CheckSystemHealth: "/health",

    // Handle search queries by mapping to appropriate tools
    search_azure_cognitive: "/api/supermarket/inventory/detailed",
  };

  const endpoint = toolEndpointMap[tool];
  if (!endpoint) {
    // If tool is not in the static map, try to infer the endpoint
    if (
      tool.toLowerCase().includes("content") ||
      tool.toLowerCase().includes("summary") ||
      tool.toLowerCase().includes("types") ||
      tool.toLowerCase().includes("statistics") ||
      tool.toLowerCase().includes("prices") ||
      tool.toLowerCase().includes("analytics") ||
      tool.toLowerCase().includes("health") ||
      tool.toLowerCase().includes("article") ||
      (tool.startsWith("Get") &&
        !tool.includes("Products") &&
        !tool.includes("Sales") &&
        !tool.includes("Revenue") &&
        !tool.includes("Inventory")) ||
      (tool.startsWith("Check") && tool.includes("Health")) ||
      tool.startsWith("Find")
    ) {
      // Attempt to construct Catalog endpoint from tool name
      const inferredEndpoint = `/api/catalog/${tool
        .toLowerCase()
        .replace(/^get/, "")
        .replace(/^find/, "")
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "")}`;
      console.log(
        `Attempting to infer Catalog endpoint for ${tool}: ${inferredEndpoint}`
      );

      // Try the inferred endpoint
      try {
        const isCatalogTool = true;
        const hasComplexArgs = args && Object.keys(args).length > 2;
        const shouldUsePost =
          isCatalogTool &&
          (hasComplexArgs || (args && args.query) || (args && args.filter));

        let mcpRes;
        if (shouldUsePost) {
          const fullUrl = `${mcpServerUrl}${inferredEndpoint}`;
          console.log(`Making inferred POST request to: ${fullUrl}`);
          mcpRes = await axios.post(fullUrl, args, {
            headers: { "Content-Type": "application/json" },
          });
        } else {
          const queryParams = new URLSearchParams();
          if (args) {
            Object.entries(args).forEach(([key, value]) => {
              if (value !== undefined && value !== null && key !== "query") {
                queryParams.append(key, value.toString());
              }
            });
          }
          const fullUrl = `${mcpServerUrl}${inferredEndpoint}${
            queryParams.toString() ? "?" + queryParams.toString() : ""
          }`;
          console.log(`Making inferred GET request to: ${fullUrl}`);
          mcpRes = await axios.get(fullUrl);
        }

        console.log(
          "Inferred endpoint worked! Response status:",
          mcpRes.status
        );

        return {
          tool,
          data: enhanceMongoDbResponse(mcpRes.data, true),
        };
      } catch (inferError) {
        console.log(`Inferred endpoint failed: ${inferError.message}`);
        // Fall through to original error
      }
    }

    throw new Error(
      `Unknown tool: ${tool}. Please add it to the toolEndpointMap or check if the MCP server supports this tool.`
    );
  }

  // Tools that don't require any parameters - clear any extracted params
  const noParameterTools = [
    "GetArticlesWithIngredients",
    "GetContentTypesSummary",
    "GetPricesWithoutArticle",
    "GetLatestStatistics",
    "GetPluData",
    "GetProducts",
    "GetSalesData",
    "GetTotalRevenue",
    "GetLowStockProducts",
    "GetSalesByCategory",
    "GetInventoryStatus",
    "GetDailySummary",
    "GetDetailedInventory",
  ];

  if (noParameterTools.includes(tool)) {
    console.log(
      `Tool ${tool} does not require parameters - clearing any extracted params`
    );
    args = {}; // Clear any incorrectly extracted parameters
  }

  // Validate required parameters for Catalog article search tools
  if (tool === "FindArticleByArticleKey") {
    if (!args || !args.articleKey) {
      throw new Error(
        "FindArticleByArticleKey requires a 'articleKey' parameter. " +
          "Please specify the article's article key (e.g., '1001', '1002'). " +
          "User query should contain a numeric identifier like 'article 1002' or 'item 1001'. " +
          "Example: { tool: 'FindArticleByArticleKey', arguments: { articleKey: '1002' } }"
      );
    }
  }

  if (tool === "FindArticlesByName") {
    if (!args || !args.name) {
      throw new Error(
        "FindArticlesByName requires a 'name' parameter. " +
          "Please specify the search term for the article name (e.g., 'cola', 'water'). " +
          "User query should contain a search term like 'articles with cola' or 'items named pepsi'. " +
          "Example: { tool: 'FindArticlesByName', arguments: { name: 'cola' } }"
      );
    }
  }

  // Special handling for path parameters
  let finalEndpoint = endpoint;
  let finalArgs = { ...args }; // Clone args to avoid mutation

  if (tool === "FindArticleByArticleKey" && args && args.articleKey) {
    finalEndpoint = `${endpoint}/${args.articleKey}`;
    // Remove articleKey from args so it's not added as a query parameter
    const { articleKey, ...remainingArgs } = finalArgs;
    finalArgs = remainingArgs;
    console.log(
      `FindArticleByArticleKey: Using path parameter articleKey=${args.articleKey}`
    );
  }

  // Determine HTTP method based on tool type and arguments
  const mongoDbTools = [
    "GetContentTypesSummary",
    "GetPricesWithoutArticle",
    "GetLatestStatistics",
    "FindArticlesByName",
    "FindArticleByArticleKey",
    "GetPluData",
    "GetArticlesWithIngredients",
    "GetDocuments",
    "GetCollections",
    "SearchDocuments",
    "AggregateData",
  ];

  const isCatalogTool =
    tool.toLowerCase().includes("catalog") || mongoDbTools.includes(tool);
  const hasComplexArgs = finalArgs && Object.keys(finalArgs).length > 2;
  const shouldUsePost =
    isCatalogTool &&
    (hasComplexArgs ||
      (finalArgs && finalArgs.query) ||
      (finalArgs && finalArgs.filter));

  console.log(
    `Tool: ${tool}, HTTP Method: ${
      shouldUsePost ? "POST" : "GET"
    }, IsCatalog: ${isCatalogTool}`
  );

  let mcpRes;

  if (shouldUsePost) {
    // Use POST for complex MongoDB queries
    const fullUrl = `${mcpServerUrl}${finalEndpoint}`;
    console.log(`Making POST request to: ${fullUrl}`);
    console.log(`POST body:`, JSON.stringify(finalArgs, null, 2));

    mcpRes = await axios.post(fullUrl, finalArgs, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else {
    // Use GET with query parameters
    const queryParams = new URLSearchParams();
    if (finalArgs) {
      Object.entries(finalArgs).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== "query") {
          queryParams.append(key, value.toString());
        }
      });
    }

    const fullUrl = `${mcpServerUrl}${finalEndpoint}${
      queryParams.toString() ? "?" + queryParams.toString() : ""
    }`;
    console.log(`Making GET request to: ${fullUrl}`);
    mcpRes = await axios.get(fullUrl);
  }

  console.log("MCP server tool response status:", mcpRes.status);

  return {
    tool,
    data: enhanceMongoDbResponse(mcpRes.data, isCatalogTool),
  };
}

// Helper function to enhance MongoDB responses with metadata
function enhanceMongoDbResponse(responseData, isCatalogTool) {
  if (!isCatalogTool || !responseData) {
    return responseData;
  }

  console.log("Detected Catalog/MongoDB tool response, adding metadata");

  // If response has MongoDB characteristics, preserve the structure
  if (responseData.data && Array.isArray(responseData.data)) {
    // Calculate additional metadata for MongoDB responses
    const documents = responseData.data;
    const totalDocuments = documents.length;

    // Count unique document structures/types
    const uniqueTypes = new Set();
    documents.forEach((doc) => {
      if (doc && typeof doc === "object") {
        const keys = Object.keys(doc).sort().join(",");
        uniqueTypes.add(keys);
      }
    });

    const enhanced = {
      ...responseData,
      totalDocuments: totalDocuments,
      totalUniqueTypes: uniqueTypes.size,
      isMongoDb: true,
    };

    console.log(
      `MongoDB response enhanced: ${totalDocuments} documents, ${uniqueTypes.size} unique types`
    );
    return enhanced;
  } else if (
    responseData &&
    typeof responseData === "object" &&
    !Array.isArray(responseData)
  ) {
    // Handle single document or complex object responses
    console.log("Detected complex MongoDB document response");
    return {
      ...responseData,
      isMongoDb: true,
      responseType: "document",
    };
  }

  return responseData;
}

// Health check endpoint for the proxy itself
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "search-proxy",
    timestamp: new Date().toISOString(),
    mcpServerUrl: process.env.VITE_MCP_SERVER_URL || "http://localhost:5000",
  });
});

// Azure Search endpoint - proxy to Azure Cognitive Search
app.post("/api/search", async (req, res) => {
  console.log("Received request to /api/search");
  console.log("Request body:", req.body);

  const { query } = req.body;
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const apiKey = process.env.AZURE_SEARCH_APIKEY;
  const indexName = process.env.AZURE_SEARCH_INDEX || "articles";

  console.log("Azure Search config:", {
    endpoint,
    indexName,
    hasApiKey: !!apiKey,
  });

  try {
    console.log("Making request to Azure Search...");
    const azureRes = await axios.post(
      `${endpoint}/indexes/${indexName}/docs/search?api-version=2021-04-30-Preview`,
      { search: query, top: 10 },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );
    console.log("Azure Search response status:", azureRes.status);
    const data = azureRes.data;

    // Enhanced debugging
    console.log("=== AZURE SEARCH DEBUG ===");
    console.log("Search query:", query);
    console.log("Number of results:", data.value?.length || 0);

    if (data.value && data.value.length > 0) {
      console.log("Available tools found:");
      data.value.forEach((tool, index) => {
        console.log(`\n--- Tool ${index + 1} ---`);
        console.log(
          `Function Name: ${tool.functionName || tool.name || "N/A"}`
        );
        console.log(
          `Description: ${tool.description?.substring(0, 150) || "N/A"}...`
        );
        console.log(`Plugin: ${tool.pluginName || tool.category || "N/A"}`);
        console.log(`Endpoint: ${tool.endpoint || "N/A"}`);
        if (tool.parameters) {
          console.log(`Parameters: ${tool.parameters.substring(0, 200)}...`);
        }
      });
    } else {
      console.log("No tools found in Azure Search response!");
    }
    console.log("=== END AZURE SEARCH DEBUG ===");

    console.log("Azure Search response received, sending back to client");
    res.json(data);
  } catch (err) {
    console.error("Error in Azure Search proxy:", err.message);
    if (err.response) {
      console.error("Azure Search error response:", err.response.data);
    }
    res
      .status(500)
      .json({ error: "Azure Search proxy error", details: err.message });
  }
});

// Helper function to search for the best tool using Azure Search
async function searchForTool(query) {
  console.log(`Searching for tool with query: ${query}`);

  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const apiKey = process.env.AZURE_SEARCH_APIKEY;
  const indexName = process.env.AZURE_SEARCH_INDEX || "articles";

  // Detect analytics queries for plugin preference
  const isAnalyticsQuery =
    query.toLowerCase().includes("analytics") ||
    query.toLowerCase().includes("statistics") ||
    query.toLowerCase().includes("content") ||
    query.toLowerCase().includes("catalog") ||
    query.toLowerCase().includes("mongodb") ||
    query.toLowerCase().includes("prices") ||
    query.toLowerCase().includes("summary") ||
    query.toLowerCase().includes("ingredient");

  try {
    const azureRes = await axios.post(
      `${endpoint}/indexes/${indexName}/docs/search?api-version=2021-04-30-Preview`,
      {
        search: query,
        top: 5,
        filter: "isActive eq true", // Only active tools
        orderby: "pluginName,functionName", // Order by plugin
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    console.log("Azure Search response status:", azureRes.status);
    const searchData = azureRes.data;

    if (searchData.value && searchData.value.length > 0) {
      // Prefer Catalog tools for analytics queries
      if (isAnalyticsQuery) {
        const catalogTool = searchData.value.find(
          (tool) =>
            tool.pluginName?.toLowerCase().includes("catalog") ||
            tool.category?.toLowerCase().includes("catalog") ||
            tool.endpoint?.includes("/catalog/")
        );
        if (catalogTool) {
          console.log(
            `Selected Catalog tool for analytics query: ${
              catalogTool.functionName || catalogTool.name
            }`
          );
          return catalogTool;
        }
      }

      // Find the best matching tool
      const bestTool =
        searchData.value.find((tool) => tool.functionName && tool.endpoint) ||
        searchData.value[0];

      console.log(`Selected tool: ${bestTool.functionName || bestTool.name}`);
      return bestTool;
    }

    return null;
  } catch (error) {
    console.error("Error searching for tool:", error.message);
    return null;
  }
}

// Helper function to extract parameters from natural language query
function extractParametersFromQuery(query) {
  if (!query || typeof query !== "string") {
    console.log("No valid query provided for parameter extraction");
    return {};
  }

  const params = {};
  console.log(`Attempting to extract parameters from: "${query}"`);

  // Extract article key from queries like "article 1002" or "item 1001"
  const articleKeyPatterns = [
    /(?:article|item|product|key|id|number|code)\s+(\d+)/i,
    /#(\d+)/,
    /\b(\d{4,})\b/, // 4+ digit numbers standalone
  ];

  for (const pattern of articleKeyPatterns) {
    const match = query.match(pattern);
    if (match) {
      params.articleKey = match[1] || match[2];
      console.log(`✓ Extracted articleKey: ${params.articleKey}`);
      break;
    }
  }

  // Extract name search terms from queries
  const namePatterns = [
    // Pattern 1: "articles with COLA", "items named PEPSI"
    /(?:named?|called?)\s+['""]?([a-z0-9\s]+)['""]?/i,
    // Pattern 2: "containing COLA in name", "with PEPSI"
    /(?:with|containing?).*?['""]?([a-z0-9\s]+)['""]?.*?(?:in|name)/i,
    // Pattern 3: "search for COLA", "find with PEPSI"
    /(?:search|find|show|get).*?(?:for|with)\s+['""]?([a-z0-9\s]+)['""]?/i,
    // Pattern 4: "has COLA in", "contains PEPSI"
    /(?:have|has|contains?)\s+['""]?([a-z0-9\s]+)['""]?\s+in/i,
    // Pattern 5: Quoted strings "COLA"
    /['""]([a-z0-9\s]+)['""]/,
    // Pattern 6: NEW - Simple pattern "search articles COLA", "find articles COLA"
    /(?:search|find|show|get|list|display)\s+(?:articles?|items?|products?)\s+([a-z0-9\s]+)/i,
    // Pattern 7: NEW - Last word after "articles" as fallback
    /articles?\s+([a-z0-9]+)$/i,
  ];

  for (const pattern of namePatterns) {
    const match = query.match(pattern);
    if (match && match[1] && !params.articleKey) {
      // Don't extract name if we already have articleKey
      const extractedName = match[1].trim();
      // Skip if extracted name is too generic or a verb
      const skipWords = [
        "with",
        "containing",
        "named",
        "called",
        "by",
        "that",
        "contain",
        "in",
        "their",
        "the",
      ];
      if (extractedName && !skipWords.includes(extractedName.toLowerCase())) {
        params.name = extractedName;
        console.log(`✓ Extracted name: ${params.name}`);
        break;
      }
    }
  }

  if (Object.keys(params).length === 0) {
    console.log("⚠ No parameters could be extracted from the query");
  }

  console.log(`Final extracted parameters:`, params);
  return params;
}

// Start server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`MCP Tool Proxy Server Running`);
  console.log(`=================================`);
  console.log(`Port: ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(
    `MCP Server: ${process.env.VITE_MCP_SERVER_URL || "http://localhost:5000"}`
  );
  console.log(`=================================`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /health              - Proxy health check`);
  console.log(`  GET  /api/tools/schema    - Get MCP tools schema`);
  console.log(`  POST /api/tool            - Call MCP tool`);
  console.log(`  POST /api/search          - Azure Search proxy`);
  console.log(`=================================`);
});
