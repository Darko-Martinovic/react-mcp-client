// Please rename this file to search-proxy.cjs and run with: node search-proxy.cjs
//
// UPDATES FOR MONGODB/GKAPI SUPPORT:
// - Added GkApi MongoDB tool endpoints to toolEndpointMap
// - Enhanced response handling with MongoDB metadata (totalDocuments, totalUniqueTypes, isMongoDb)
// - Support for POST requests for complex MongoDB queries
// - Multi-plugin schema endpoint support (Supermarket + GkApi)
// - Complex document response handling
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

    // Get GkApi plugin schema (if available)
    try {
      const gkapiRes = await axios.get(
        `${mcpServerUrl}/api/gkapi/tools/schema`
      );
      schemas.gkapi = gkapiRes.data;
      console.log("GkApi schema retrieved successfully");
    } catch (err) {
      console.warn("GkApi schema not available:", err.message);
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
    const result = await callSingleTool(tool, args, mcpServerUrl);
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
        "GetPricesWithoutBaseItem",
        "GetLatestStatistics",
      ];
      if (mongoDbTools.includes(tool) || tool.toLowerCase().includes("gkapi")) {
        errorResponse.plugin = "gkapi";
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

    // GkApi MongoDB Plugin Tools
    GetContentTypesSummary: "/api/gkapi/content-types",
    GetPricesWithoutBaseItem: "/api/gkapi/prices-without-base-item",
    GetLatestStatistics: "/api/gkapi/latest-statistics",
    GetDocuments: "/api/gkapi/documents",
    GetCollections: "/api/gkapi/collections",
    SearchDocuments: "/api/gkapi/search",
    AggregateData: "/api/gkapi/aggregate",

    // Health Check endpoints
    CheckSupermarketHealth: "/api/supermarket/health",
    CheckGkApiHealth: "/api/gkapi/health",
    CheckSystemHealth: "/health",

    // Example additional MongoDB tools - update these based on your actual GkApi plugin endpoints:
    GkApiGetDocuments: "/api/gkapi/documents",
    GkApiSearchDocuments: "/api/gkapi/search",
    GkApiGetCollections: "/api/gkapi/collections",
    GkApiAggregateData: "/api/gkapi/aggregate",

    // Handle search queries by mapping to appropriate tools
    search_azure_cognitive: "/api/supermarket/inventory/detailed",
  };

  const endpoint = toolEndpointMap[tool];
  if (!endpoint) {
    // If tool is not in the static map, try to infer the endpoint
    // Check if this might be a GkApi tool based on naming patterns
    if (
      tool.toLowerCase().includes("content") ||
      tool.toLowerCase().includes("summary") ||
      tool.toLowerCase().includes("types") ||
      tool.toLowerCase().includes("statistics") ||
      tool.toLowerCase().includes("prices") ||
      tool.toLowerCase().includes("analytics") ||
      tool.toLowerCase().includes("health") ||
      (tool.startsWith("Get") &&
        !tool.includes("Products") &&
        !tool.includes("Sales") &&
        !tool.includes("Revenue") &&
        !tool.includes("Inventory")) ||
      (tool.startsWith("Check") && tool.includes("Health"))
    ) {
      // Attempt to construct GkApi endpoint from tool name
      const inferredEndpoint = `/api/gkapi/${tool
        .toLowerCase()
        .replace(/^get/, "")
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "")}`;
      console.log(
        `Attempting to infer GkApi endpoint for ${tool}: ${inferredEndpoint}`
      );

      // Try the inferred endpoint
      try {
        const isGkApiTool = true;
        const hasComplexArgs = args && Object.keys(args).length > 2;
        const shouldUsePost =
          isGkApiTool &&
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

        // Handle MongoDB response
        let responseData = mcpRes.data;
        if (responseData) {
          if (responseData.data && Array.isArray(responseData.data)) {
            const documents = responseData.data;
            const totalDocuments = documents.length;
            const uniqueTypes = new Set();
            documents.forEach((doc) => {
              if (doc && typeof doc === "object") {
                const keys = Object.keys(doc).sort().join(",");
                uniqueTypes.add(keys);
              }
            });
            responseData = {
              ...responseData,
              totalDocuments: totalDocuments,
              totalUniqueTypes: uniqueTypes.size,
              isMongoDb: true,
            };
          } else if (
            responseData &&
            typeof responseData === "object" &&
            !Array.isArray(responseData)
          ) {
            responseData = {
              ...responseData,
              isMongoDb: true,
              responseType: "document",
            };
          }
        }

        return {
          tool,
          data: responseData,
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

  // Determine HTTP method based on tool type and arguments
  const mongoDbTools = [
    "GetContentTypesSummary",
    "GetPricesWithoutBaseItem",
    "GetLatestStatistics",
    "GetDocuments",
    "GetCollections",
    "SearchDocuments",
    "AggregateData",
  ];
  const healthCheckTools = [
    "CheckSupermarketHealth",
    "CheckGkApiHealth",
    "CheckSystemHealth",
  ];
  const isGkApiTool =
    tool.toLowerCase().includes("gkapi") || mongoDbTools.includes(tool);
  const isHealthCheck = healthCheckTools.includes(tool);
  const hasComplexArgs = args && Object.keys(args).length > 2;
  const shouldUsePost =
    isGkApiTool &&
    (hasComplexArgs || (args && args.query) || (args && args.filter));

  console.log(
    `Tool: ${tool}, HTTP Method: ${
      shouldUsePost ? "POST" : "GET"
    }, IsGkApi: ${isGkApiTool}`
  );

  let mcpRes;

  if (shouldUsePost) {
    // Use POST for complex MongoDB queries
    const fullUrl = `${mcpServerUrl}${endpoint}`;
    console.log(`Making POST request to: ${fullUrl}`);
    console.log(`POST body:`, JSON.stringify(args, null, 2));

    mcpRes = await axios.post(fullUrl, args, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else {
    // Use GET with query parameters (original behavior)
    const queryParams = new URLSearchParams();
    if (args) {
      Object.entries(args).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== "query") {
          queryParams.append(key, value.toString());
        }
      });
    }

    const fullUrl = `${mcpServerUrl}${endpoint}${
      queryParams.toString() ? "?" + queryParams.toString() : ""
    }`;
    console.log(`Making GET request to: ${fullUrl}`);
    mcpRes = await axios.get(fullUrl);
  }
  console.log("MCP server tool response status:", mcpRes.status);

  // Enhanced response handling for MongoDB/GkApi responses
  let responseData = mcpRes.data;

  // Check if this is a MongoDB/GkApi response and add metadata
  if (isGkApiTool && responseData) {
    console.log("Detected GkApi/MongoDB tool response, adding metadata");

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

      responseData = {
        ...responseData,
        totalDocuments: totalDocuments,
        totalUniqueTypes: uniqueTypes.size,
        isMongoDb: true,
      };

      console.log(
        `MongoDB response enhanced: ${totalDocuments} documents, ${uniqueTypes.size} unique types`
      );
    } else if (
      responseData &&
      typeof responseData === "object" &&
      !Array.isArray(responseData)
    ) {
      // Handle single document or complex object responses
      console.log("Detected complex MongoDB document response");
      responseData = {
        ...responseData,
        isMongoDb: true,
        responseType: "document",
      };
    }
  }

  return {
    tool,
    data: responseData,
  };
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

    // Enhanced debugging for category filtering issues
    console.log("=== AZURE SEARCH DEBUG ===");
    console.log("Search query:", query);
    console.log(
      "Raw Azure Search response structure:",
      JSON.stringify(data, null, 2)
    );
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
        console.log(`Plugin: ${tool.pluginName || "N/A"}`); // NEW!
        console.log(`Endpoint: ${tool.endpoint || "N/A"}`);
        console.log(`HTTP Method: ${tool.httpMethod || "N/A"}`);
        console.log(`Category: ${tool.category || "N/A"}`);
        console.log(
          `Is Active: ${tool.isActive !== undefined ? tool.isActive : "N/A"}`
        );
        if (tool.parameters) {
          console.log(`Parameters: ${tool.parameters.substring(0, 200)}...`);
        }

        // Check for category-related tools
        const isCategoryTool =
          (tool.functionName &&
            (tool.functionName.toLowerCase().includes("category") ||
              tool.functionName.toLowerCase().includes("filter") ||
              tool.functionName.toLowerCase().includes("bycategory"))) ||
          (tool.description &&
            (tool.description.toLowerCase().includes("category") ||
              tool.description.toLowerCase().includes("filter by")));

        // Check for GkApi tools
        const isGkApiTool =
          tool.pluginName?.toLowerCase().includes("gkapi") ||
          tool.endpoint?.includes("/gkapi/");

        if (isCategoryTool) {
          console.log(`*** CATEGORY TOOL DETECTED ***`);
        }

        if (isGkApiTool) {
          console.log(`*** GKAPI ANALYTICS TOOL DETECTED ***`);
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
    query.toLowerCase().includes("gk") ||
    query.toLowerCase().includes("mongodb") ||
    query.toLowerCase().includes("prices") ||
    query.toLowerCase().includes("summary");

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
      // Prefer GkApi tools for analytics queries
      if (isAnalyticsQuery) {
        const gkapiTool = searchData.value.find(
          (tool) =>
            tool.pluginName?.toLowerCase().includes("gkapi") ||
            tool.endpoint?.includes("/gkapi/")
        );
        if (gkapiTool) {
          console.log(
            `Selected GkApi tool for analytics query: ${
              gkapiTool.functionName || gkapiTool.name
            }`
          );
          return gkapiTool;
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

// Helper function to extract parameters from query
function extractParametersFromQuery(query) {
  const params = {};
  const lowerQuery = query.toLowerCase();

  // For inventory queries, we typically don't need special parameters
  // but we can add logic here for other query types

  console.log(`Extracted parameters for query "${query}":`, params);
  return params;
}

const PORT = process.env.PORT || 5002;
app.listen(PORT, () =>
  console.log(`Proxy running on http://localhost:${PORT}`)
);
