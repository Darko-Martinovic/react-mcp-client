// MCP Server service layer (real integration)
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
  args: Record<string, unknown>
): Promise<McpToolResult> {
  // Generate cache key for this tool call
  const cacheKey = generateMcpCacheKey(tool, args);

  // Check cache first
  const cachedResult = cacheManager.get<McpToolResult>(cacheKey);
  if (cachedResult) {
    console.log(`🎯 Using cached result for ${tool}`);
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

  // Cache the result with tool-specific TTL
  const ttl = getTTLForTool(tool);
  cacheManager.set(cacheKey, result, ttl);

  console.log(`📦 Cached result for ${tool} (TTL: ${ttl}ms)`);

  return result;
}
