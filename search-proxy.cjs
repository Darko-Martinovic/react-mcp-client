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
