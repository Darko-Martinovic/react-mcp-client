// Please rename this file to search-proxy.cjs and run with: node search-proxy.cjs
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
    process.env.VITE_MCP_SERVER_URL || "http://localhost:9090";

  try {
    console.log("Making request to MCP server for schema...");
    // Use the correct MCP server schema endpoint
    const mcpRes = await axios.get(
      `${mcpServerUrl}/api/supermarket/tools/schema`
    );
    console.log("MCP server schema response status:", mcpRes.status);
    const data = mcpRes.data;
    console.log("Schema response received, sending back to client");
    res.json(data);
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
    process.env.VITE_MCP_SERVER_URL || "http://localhost:9090";

  try {
    console.log(`Making request to MCP server for tool: ${tool}`);

    // Handle multi_tool_use wrapper
    if (tool === "multi_tool_use" && args && args.tool_uses) {
      console.log("Handling multi_tool_use request");
      const results = [];

      for (const toolUse of args.tool_uses) {
        const actualTool = toolUse.recipient_name;
        const actualArgs = toolUse.parameters;

        // Extract the actual tool name (remove "functions." prefix if present)
        const cleanToolName = actualTool
          .replace(/^functions\./, "")
          .replace(/^search_azure_cognitive$/, "GetDetailedInventory");

        console.log(`Processing tool: ${cleanToolName} with args:`, actualArgs);

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

    // Handle single tool calls
    const result = await callSingleTool(tool, args, mcpServerUrl);
    res.json(result);
  } catch (err) {
    console.error("Error in tool proxy:", err.message);
    if (err.response) {
      console.error("MCP server error response:", err.response.data);
    }
    res.status(500).json({ error: "Tool proxy error", details: err.message });
  }
});

// Helper function to call a single tool
async function callSingleTool(tool, args, mcpServerUrl) {
  console.log(`Calling single tool: ${tool} with args:`, args);

  // Map tool names to actual MCP server endpoints
  const toolEndpointMap = {
    GetProducts: "/api/supermarket/products",
    GetDetailedInventory: "/api/supermarket/inventory/detailed",
    GetInventoryStatus: "/api/supermarket/inventory/status",
    GetLowStockProducts: "/api/supermarket/products/low-stock",
    GetSalesData: "/api/supermarket/sales",
    GetTotalRevenue: "/api/supermarket/revenue",
    GetSalesByCategory: "/api/supermarket/sales/by-category",
    GetDailySummary: "/api/supermarket/sales/daily-summary",
    // Handle search queries by mapping to appropriate tools
    search_azure_cognitive: "/api/supermarket/inventory/detailed",
  };

  const endpoint = toolEndpointMap[tool];
  if (!endpoint) {
    throw new Error(`Unknown tool: ${tool}`);
  }

  // Build query parameters from arguments
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
  console.log(`Calling MCP server: ${fullUrl}`);

  const mcpRes = await axios.get(fullUrl);
  console.log("MCP server tool response status:", mcpRes.status);

  return {
    tool,
    data: mcpRes.data,
  };
}

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

        if (isCategoryTool) {
          console.log(`*** CATEGORY TOOL DETECTED ***`);
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

const PORT = process.env.PORT || 5002;
app.listen(PORT, () =>
  console.log(`Proxy running on http://localhost:${PORT}`)
);
