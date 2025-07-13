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
    const mcpRes = await axios.get(`${mcpServerUrl}/api/tools/schema`);
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
