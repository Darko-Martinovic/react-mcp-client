// MCP Server service layer (handles Model Context Protocol integration)
// Requires .env variable:
// VITE_MCP_SERVER_URL

import {
  cacheManager,
  generateMcpCacheKey,
  getTTLForTool,
} from "./cacheManager";

export interface McpToolCall {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  tool: string;
  data: Record<string, unknown>[];
}

export async function callMcpTool(
  tool: string,
  args: Record<string, unknown>,
  originalUserInput?: string,
  chatId?: string
): Promise<McpToolResult> {
  // Generate cache key for this tool call with chat isolation and service prefix
  const cacheKey = generateMcpCacheKey(tool, args, chatId);
  console.log("🔑 Generated MCP cache key with service prefix:", cacheKey);

  // Check cache first with semantic matching (now fixed to respect service prefixes)
  const cachedResult = cacheManager.get<McpToolResult>(
    cacheKey,
    originalUserInput
  );
  if (cachedResult) {
    console.log(`🎯 Using cached result for ${tool}`);
    console.log("=== CACHED MCP RESULT DEBUG ===");
    console.log("Cached Result Type:", typeof cachedResult);
    console.log("Cached Result Keys:", Object.keys(cachedResult || {}));
    console.log("Cached Result Full:", JSON.stringify(cachedResult, null, 2));
    console.log("==============================");
    return cachedResult;
  }

  console.log(`🌐 Making fresh API call for ${tool}`);

  // Use relative URL so Vite proxy can handle it
  const response = await fetch(`/api/tool`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, arguments: args }),
  });

  if (!response.ok) {
    throw new Error(
      `MCP server API error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();

  console.log("=== MCP SERVER RAW RESPONSE DEBUG ===");
  console.log("Raw Response Type:", typeof result);
  console.log("Raw Response Keys:", Object.keys(result || {}));
  console.log("Raw Response Full:", JSON.stringify(result, null, 2));
  console.log("====================================");

  // Cache the result with tool-specific TTL and original query for semantic analysis
  const ttl = getTTLForTool(tool);
  cacheManager.set(cacheKey, result, ttl, originalUserInput);

  console.log(
    `📦 Cached result for ${tool} (TTL: ${ttl}ms)${
      originalUserInput ? ` [Query: "${originalUserInput}"]` : ""
    }`
  );

  return result;
}
