// MCP Server service layer (real integration)
// Requires .env variable:
// VITE_MCP_SERVER_URL

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

  return await response.json();
}
