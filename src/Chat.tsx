import React, {
  useState,
  FormEvent,
  ChangeEvent,
  useRef,
  useEffect,
} from "react";
import { askAzureOpenAI } from "./services/azureOpenAI";
import { callMcpTool } from "./services/mcpServer";
import { fetchArticlesFromAzureSearch } from "./services/azureSearch";
import "./Chat.css";

interface Message {
  sender: "user" | "system";
  text?: string;
  tableData?: Record<string, unknown>[];
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
}

interface ChatProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  title?: string;
}

interface AIResponse {
  aiMessage: string;
  functionCalls?: any[];
}

interface MCPCall {
  function: string;
  parameters: Record<string, any>;
}

interface SearchResult {
  value: Array<{
    functionName?: string;
    name?: string;
    description?: string;
    endpoint?: string;
    httpMethod?: string;
  }>;
}

interface MCPResponse {
  success?: boolean;
  data?: Record<string, unknown>[];
  error?: string;
  timestamp?: string;
  count?: number;
  text?: string;
  tableData?: Record<string, unknown>[];
  toolName?: string;
  summary?: string;
}

const renderTable = (data: Record<string, unknown>[], toolName?: string) => {
  if (!Array.isArray(data) || data.length === 0) return null;
  const columns = Object.keys(data[0]);

  // Function to format cell values
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      // Format currency if it looks like a price
      if (value % 1 !== 0 && value < 1000) {
        return `$${value.toFixed(2)}`;
      }
      return value.toLocaleString();
    }
    if (
      typeof value === "string" &&
      value.includes("T") &&
      value.includes("Z")
    ) {
      // Format ISO date strings
      try {
        const date = new Date(value);
        return (
          date.toLocaleDateString() +
          " " +
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  // Function to get column header display name
  const getColumnHeader = (col: string): string => {
    const headerMap: Record<string, string> = {
      productId: "ID",
      productName: "Product Name",
      stockQuantity: "Stock",
      unitPrice: "Unit Price",
      totalAmount: "Total",
      saleDate: "Sale Date",
      saleId: "Sale ID",
    };
    return headerMap[col] || col.charAt(0).toUpperCase() + col.slice(1);
  };

  // Function to get cell content class based on column type and value
  const getCellContentClass = (col: string, value: unknown): string => {
    let className = "cell-content";

    if (col.toLowerCase().includes("name")) {
      className += " cell-content--name";
    } else if (
      col.toLowerCase().includes("price") ||
      col.toLowerCase().includes("amount")
    ) {
      className += " cell-content--price";
    } else if (col.toLowerCase().includes("stock") && Number(value) < 30) {
      className += " cell-content--low-stock";
    } else if (col.toLowerCase().includes("id")) {
      className += " cell-content--id";
    }

    return className;
  };

  return (
    <div className="table-container">
      {toolName && <div className="table-title">📊 {toolName} Results</div>}
      <div className="table-wrapper">
        <table className="data-table">
          <thead className="table-header">
            <tr>
              {columns.map((col) => (
                <th key={col} className="table-header-cell">
                  {getColumnHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className={`table-row ${
                  idx % 2 === 0 ? "table-row--even" : "table-row--odd"
                }`}
              >
                {columns.map((col) => (
                  <td key={col} className="table-cell">
                    <span className={getCellContentClass(col, row[col])}>
                      {formatCellValue(row[col])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        📋 Showing {data.length} result{data.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

function isSimpleTable(data: unknown): data is Record<string, unknown>[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    !Array.isArray(data[0])
  );
}

const buildSystemPrompt = (articles: string[]) => `
You are an MCP (Model Context Protocol) assistant. Use the provided MCP tool information to answer the user's question.

Available MCP Tools and Functions:
${articles.map((a, i) => `${i + 1}. ${a}`).join("\n")}

When the user asks about available tools, functions, or capabilities, refer to this list. If the user asks about something not in this list, let them know it's not available.
`;

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    // Optionally show a toast/notification
  });
};

const exportChat = (messages: Message[], title: string) => {
  // Transform messages with better role names and formatting
  const transformedMessages = messages.map((msg) => {
    let role = "Unknown";
    let displayName = "Unknown";

    switch (msg.sender) {
      case "user":
        role = "user";
        displayName = "You";
        break;
      case "system":
        role = "assistant";
        displayName = "AI Assistant";
        break;
      default:
        role = msg.sender;
        displayName = msg.sender;
    }

    return {
      role,
      displayName,
      content:
        msg.text ||
        (msg.tableData ? `[Table Data: ${msg.toolName}]` : "[No content]"),
      timestamp: new Date().toISOString(),
      ...(msg.tableData && {
        tableData: msg.tableData,
        toolName: msg.toolName,
      }),
    };
  });

  // Create enhanced export data
  const exportData = {
    chatTitle: title,
    exportedAt: new Date().toISOString(),
    messageCount: transformedMessages.length,
    participants: ["You", "AI Assistant"],
    messages: transformedMessages,
  };

  const dataStr =
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}_export.json`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

// Export as readable text format
const exportChatAsText = (messages: Message[], title: string) => {
  const header = `Chat Export: ${title}\nExported: ${new Date().toLocaleString()}\n${"=".repeat(
    50
  )}\n\n`;

  const textContent = messages
    .map((msg) => {
      const sender = msg.sender === "user" ? "You" : "AI Assistant";
      const timestamp = new Date().toLocaleTimeString();
      const content =
        msg.text ||
        (msg.tableData ? `[Table Data: ${msg.toolName}]` : "[No content]");

      return `[${timestamp}] ${sender}:\n${content}\n`;
    })
    .join("\n");

  const fullText = header + textContent;

  const dataStr =
    "data:text/plain;charset=utf-8," + encodeURIComponent(fullText);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}_export.txt`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

// Export as Markdown format
const exportChatAsMarkdown = (messages: Message[], title: string) => {
  const header = `# ${title}\n\n**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;

  const markdownContent = messages
    .map((msg) => {
      const sender = msg.sender === "user" ? "**You**" : "**AI Assistant**";
      const content =
        msg.text ||
        (msg.tableData ? `*[Table Data: ${msg.toolName}]*` : "*[No content]*");

      return `${sender}: ${content}\n`;
    })
    .join("\n");

  const fullMarkdown = header + markdownContent;

  const dataStr =
    "data:text/markdown;charset=utf-8," + encodeURIComponent(fullMarkdown);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}_export.md`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

const Chat: React.FC<ChatProps> = ({ messages, setMessages, title }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [visibleTraces, setVisibleTraces] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    }

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showExportMenu]);

  // Defensive fallback: ensure messages is always an array
  const safeMessages = Array.isArray(messages) ? messages : [];

  // Function to copy text and show visual feedback
  const copyToClipboardWithFeedback = (text: string, messageId: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedMessageId(messageId);
        // Hide the message after 2 seconds
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  // Function to toggle trace visibility
  const toggleTraceVisibility = (messageIndex: number) => {
    const newVisibleTraces = new Set(visibleTraces);
    if (newVisibleTraces.has(messageIndex)) {
      newVisibleTraces.delete(messageIndex);
    } else {
      newVisibleTraces.add(messageIndex);
    }
    setVisibleTraces(newVisibleTraces);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Send clicked, input:", input);
    if (!input.trim() || loading) return;

    const userMsg: Message = { sender: "user", text: input };
    const baseMessages = Array.isArray(messages) ? messages : [];
    setMessages([...baseMessages, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Initialize trace data
      const traceData: any = {
        timestamp: new Date().toISOString(),
        userInput: input,
        aiResponse: null,
        mcpCall: null,
        mcpResponse: null,
        selectedTool: null,
        parameters: {},
      };

      // Step 1: Get AI intent (but don't display AI response)
      const aiResponse = await getAIIntent(input, baseMessages);
      traceData.aiResponse = {
        aiMessage: aiResponse.aiMessage,
        functionCalls: aiResponse.functionCalls,
      };

      console.log("=== AI RESPONSE DEBUG ===");
      console.log("Full AI Response Object:", aiResponse);
      console.log("AI Message Content:", aiResponse.aiMessage);
      console.log("AI Function Calls:", aiResponse.functionCalls);
      console.log("========================");

      // Step 2: Parse AI response to extract MCP server call
      const mcpCall = parseAIResponseForMCPCall(aiResponse.aiMessage);
      traceData.mcpCall = mcpCall;
      traceData.selectedTool = mcpCall?.function;
      traceData.parameters = mcpCall?.parameters || {};

      console.log("=== MCP CALL EXTRACTION ===");
      console.log("Extracted MCP Call:", mcpCall);
      console.log("==========================");

      if (mcpCall) {
        // Step 3: Call MCP server directly instead of showing AI response
        try {
          const mcpResponse = await callMCPServer(mcpCall);
          traceData.mcpResponse = mcpResponse;

          // Check if the response contains table data
          if (typeof mcpResponse === "object" && mcpResponse.tableData) {
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: mcpResponse.summary,
                tableData: mcpResponse.tableData,
                toolName: mcpResponse.toolName,
                traceData: traceData,
              },
            ]);
          } else if (typeof mcpResponse === "object" && mcpResponse.text) {
            // Handle structured response with text property
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: mcpResponse.text,
                traceData: traceData,
              },
            ]);
          } else {
            // Handle string response
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text:
                  typeof mcpResponse === "string"
                    ? mcpResponse
                    : JSON.stringify(mcpResponse),
                traceData: traceData,
              },
            ]);
          }
        } catch (mcpError) {
          console.error("MCP Server Error:", mcpError);
          traceData.error = mcpError.toString();
          setMessages([
            ...baseMessages,
            userMsg,
            {
              sender: "system",
              text: "Sorry, I couldn't process your request through the MCP server. Please try again.",
              traceData: traceData,
            },
          ]);
        }
      } else {
        // No MCP call needed, use AI response as fallback
        setMessages([
          ...baseMessages,
          userMsg,
          { sender: "system", text: aiResponse.aiMessage },
        ]);
      }
    } catch (err) {
      console.error("Error processing request:", err);
      setMessages([
        ...baseMessages,
        userMsg,
        { sender: "system", text: "An error occurred. Please try again." },
      ]);
    } finally {
      setLoading(false);
      // Keep focus on input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  // Function to get AI intent without displaying the response
  const getAIIntent = async (
    userMessage: string,
    previousMessages: Message[]
  ): Promise<AIResponse> => {
    // Fetch articles from Azure Search for RAG context
    const articles = await fetchArticlesFromAzureSearch("*");

    // Build system prompt with MCP function instruction
    const systemPrompt = `You are an intelligent assistant that helps users interact with MCP (Model Context Protocol) tools.

CRITICAL: You MUST respond in this EXACT structured format:

Function: search
Parameters: {"query": "search_terms"}
Reasoning: Brief explanation

DO NOT provide any other response format. DO NOT format results or explain tools. Just provide the structured function call.

Available MCP tools in the search index: ${articles
      .map((a: any) => a.functionName || a.name)
      .join(", ")}

Your ONLY job is to:
1. Understand the user's intent
2. Return the structured function call format above
3. Extract appropriate search terms for the Parameters based on intent

Query Intent Guidelines:
- For product listings/inventory: use "products" or "inventory"
- For specific suppliers: include supplier name in search
- For specific categories: include category name in search  
- For sales data: use "sales" or "sales data"
- For low stock alerts: use "low stock" or "stock"
- For detailed inventory: use "detailed inventory"

Examples:
User: "What kind of tools do we have?"
Function: search
Parameters: {"query": "tools"}
Reasoning: User wants to search for available tools

User: "Show me all dairy products"
Function: search  
Parameters: {"query": "products dairy"}
Reasoning: User wants to search for dairy products in inventory

User: "What products do we get from Fresh Dairy Co.?"
Function: search
Parameters: {"query": "products Fresh Dairy Co."}
Reasoning: User wants products from specific supplier

User: "Show me sales from last week"
Function: search
Parameters: {"query": "sales data"}
Reasoning: User wants sales information

User: "What products are low in stock?"
Function: search
Parameters: {"query": "low stock products"}
Reasoning: User wants low stock information

REMEMBER: Always respond with the structured format. Never format or display the actual results - that will be handled separately.

Available sample tools: ${articles
      .map((a: any) => `${a.functionName}: ${a.description}`)
      .slice(0, 3)
      .join(", ")}`;

    return await askAzureOpenAI(userMessage, systemPrompt);
  };

  // Function to parse AI response and extract MCP server call
  const parseAIResponseForMCPCall = (aiResponse: string): MCPCall | null => {
    try {
      console.log("=== PARSING AI RESPONSE ===");
      console.log("Raw AI Response:", aiResponse);
      console.log("AI Response Length:", aiResponse.length);

      // Look for structured function calls in AI response
      const functionMatch = aiResponse.match(/Function:\s*(\w+)/i);
      const parametersMatch = aiResponse.match(/Parameters:\s*({.*?})/s);

      console.log("Function Match:", functionMatch);
      console.log("Parameters Match:", parametersMatch);

      if (functionMatch) {
        const functionName = functionMatch[1].toLowerCase();
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

        const result: MCPCall = {
          function: functionName,
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

  // Function to call actual MCP server on port 5000
  const callMCPServer = async (mcpCall: MCPCall): Promise<MCPResponse> => {
    console.log("Calling actual MCP Server on port 5000:", mcpCall);

    // First, get the available tools from Azure Search to find the right tool name and endpoint
    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mcpCall.parameters.query || "*" }),
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed with ${searchResponse.status}`);
    }

    const searchData: SearchResult = await searchResponse.json();
    console.log("Search results for tool lookup:", searchData);

    // Extract the best matching tool and its endpoint
    let selectedTool = null;
    if (searchData.value && searchData.value.length > 0) {
      // Use the highest scoring result
      selectedTool = searchData.value[0];
      console.log("Selected tool to call:", selectedTool);
    }

    if (!selectedTool || !selectedTool.endpoint) {
      return { text: "No matching MCP tool found for your request." };
    }

    // Get MCP server URL from environment
    const mcpServerUrl =
      import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:5000";
    const fullEndpoint = `${mcpServerUrl}${selectedTool.endpoint}`;

    console.log(
      `Calling MCP server endpoint: ${selectedTool.httpMethod} ${fullEndpoint}`
    );

    // Now call the actual MCP server endpoint
    try {
      const requestOptions: RequestInit = {
        method: selectedTool.httpMethod || "GET",
        headers: { "Content-Type": "application/json" },
      };

      // Prepare the parameters by extracting meaningful search terms from the original query
      const enrichedParameters = { ...mcpCall.parameters };

      // Extract specific entities like supplier names, categories, etc. from the query
      const originalQuery = mcpCall.parameters.query || "";
      console.log("Analyzing query for entities:", originalQuery);

      // Extract supplier names (improved pattern to capture company names more accurately)
      const supplierPatterns = [
        /(?:from|by)\s+([A-Z][a-zA-Z\s]*(?:Co\.|Corp\.|Inc\.|LLC|Company|Dairy|Farm|Foods))/,
        /([A-Z][a-zA-Z\s]*(?:Co\.|Corp\.|Inc\.|LLC|Company|Dairy|Farm|Foods))/,
      ];

      let supplierMatch: RegExpMatchArray | null = null;
      for (const pattern of supplierPatterns) {
        supplierMatch = originalQuery.match(pattern);
        if (supplierMatch) break;
      }

      if (supplierMatch) {
        enrichedParameters.supplier = supplierMatch[1].trim();
        console.log("Extracted supplier:", enrichedParameters.supplier);
      }

      // Extract product categories
      const categoryMatch = originalQuery.match(
        /\b(dairy|meat|vegetables|fruits|beverages|bread|snacks|frozen|organic|bakery|grains)\b/i
      );
      if (categoryMatch) {
        // Capitalize first letter to match the server's expected format
        enrichedParameters.category =
          categoryMatch[1].charAt(0).toUpperCase() +
          categoryMatch[1].slice(1).toLowerCase();
        console.log("Extracted category:", enrichedParameters.category);
      }

      // Extract date ranges for sales and time-based queries
      const datePatterns = [
        /last\s+(\d+)\s+(days?|weeks?|months?)/i,
        /past\s+(\d+)\s+(days?|weeks?|months?)/i,
        /(\d+)\s+(days?|weeks?|months?)\s+ago/i,
        /today/i,
        /yesterday/i,
        /this\s+(week|month|year)/i,
      ];

      let dateFound = false;
      for (const pattern of datePatterns) {
        const dateMatch = originalQuery.match(pattern);
        if (dateMatch) {
          dateFound = true;
          const now = new Date();
          let startDate = new Date();

          if (pattern.source.includes("today")) {
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            );
            enrichedParameters.startDate = startDate
              .toISOString()
              .split("T")[0];
            enrichedParameters.endDate = now.toISOString().split("T")[0];
          } else if (pattern.source.includes("yesterday")) {
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - 1
            );
            enrichedParameters.startDate = startDate
              .toISOString()
              .split("T")[0];
            enrichedParameters.endDate = startDate.toISOString().split("T")[0];
          } else if (dateMatch[1]) {
            const number = parseInt(dateMatch[1]);
            const unit = dateMatch[2].toLowerCase();

            if (unit.startsWith("day")) {
              startDate = new Date(
                now.getTime() - number * 24 * 60 * 60 * 1000
              );
            } else if (unit.startsWith("week")) {
              startDate = new Date(
                now.getTime() - number * 7 * 24 * 60 * 60 * 1000
              );
            } else if (unit.startsWith("month")) {
              startDate = new Date(
                now.getFullYear(),
                now.getMonth() - number,
                now.getDate()
              );
            }

            enrichedParameters.startDate = startDate
              .toISOString()
              .split("T")[0];
            enrichedParameters.endDate = now.toISOString().split("T")[0];
          }

          console.log(
            "Extracted date range:",
            enrichedParameters.startDate,
            "to",
            enrichedParameters.endDate
          );
          break;
        }
      }

      // For sales queries without explicit dates, default to last 7 days
      if (originalQuery.toLowerCase().includes("sales") && !dateFound) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        enrichedParameters.startDate = weekAgo.toISOString().split("T")[0];
        enrichedParameters.endDate = now.toISOString().split("T")[0];
        console.log(
          "Default sales date range applied:",
          enrichedParameters.startDate,
          "to",
          enrichedParameters.endDate
        );
      }

      // Add query parameters for GET requests or body for POST requests
      if (selectedTool.httpMethod === "POST") {
        requestOptions.body = JSON.stringify(enrichedParameters);

        const mcpResponse = await fetch(fullEndpoint, requestOptions);

        if (!mcpResponse.ok) {
          console.error(`MCP Server responded with ${mcpResponse.status}`);
          return {
            text: `Error calling ${selectedTool.functionName}: HTTP ${mcpResponse.status}. Tool description: ${selectedTool.description}`,
          };
        }

        const mcpData: MCPResponse = await mcpResponse.json();
        console.log("Real MCP Server response:", mcpData);

        return formatStructuredMCPResponse(
          mcpData,
          selectedTool.functionName || "Unknown Tool",
          enrichedParameters
        );
      } else {
        // For GET requests, add query parameters to URL
        const url = new URL(fullEndpoint);
        Object.entries(enrichedParameters).forEach(([key, value]) => {
          if (value && key !== "query") {
            url.searchParams.append(key, String(value));
          }
        });
        const finalUrl = url.toString();
        console.log("Final GET URL with parameters:", finalUrl);

        const mcpResponse = await fetch(finalUrl, requestOptions);

        if (!mcpResponse.ok) {
          console.error(`MCP Server responded with ${mcpResponse.status}`);
          return {
            text: `Error calling ${selectedTool.functionName}: HTTP ${mcpResponse.status}. Tool description: ${selectedTool.description}`,
          };
        }

        const mcpData: MCPResponse = await mcpResponse.json();
        console.log("Real MCP Server response:", mcpData);

        return formatStructuredMCPResponse(
          mcpData,
          selectedTool.functionName || "Unknown Tool",
          enrichedParameters
        );
      }
    } catch (mcpError) {
      console.error("Error calling real MCP server:", mcpError);
      console.log("Falling back to tool description");
      return {
        text: `Error connecting to MCP server: ${
          mcpError instanceof Error ? mcpError.message : String(mcpError)
        }. Available tool: ${selectedTool.functionName} - ${
          selectedTool.description
        }`,
      };
    }
  };

  // Function to return structured data for better table rendering
  const formatStructuredMCPResponse = (
    data: any,
    toolName: string,
    parameters?: Record<string, any>
  ): MCPResponse => {
    console.log("Formatting structured MCP response:", data);

    if (data.error) {
      return { text: `Error from MCP server: ${data.error}` };
    }

    // Build parameter info for display
    let paramInfo = "";
    if (parameters) {
      const relevantParams = Object.entries(parameters)
        .filter(([key, value]) => key !== "query" && value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      if (relevantParams) {
        paramInfo = `\n🔍 **Filters:** ${relevantParams}`;
      }
    }

    // Handle successful responses with data array
    if (data.success !== undefined) {
      if (data.data && Array.isArray(data.data)) {
        const tableData = data.data;

        if (tableData.length === 0) {
          return {
            text: `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** No data found${
              parameters?.supplier
                ? ` for supplier "${parameters.supplier}"`
                : ""
            }${
              parameters?.category
                ? ` in category "${parameters.category}"`
                : ""
            }\n⏰ **Timestamp:** ${data.timestamp || "N/A"}\n🔢 **Count:** ${
              data.count || 0
            }`,
          };
        }

        let summary = `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Results (${
          data.count || tableData.length
        }):**`;

        if (data.timestamp) {
          summary += `\n⏰ **Timestamp:** ${data.timestamp}`;
        }

        return {
          summary,
          tableData,
          toolName,
        };
      } else if (data.success) {
        return {
          text: `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** ${JSON.stringify(
            data,
            null,
            2
          )}`,
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

      let summary = `📊 **${toolName} Results:**${paramInfo}`;

      return {
        summary,
        tableData,
        toolName,
      };
    }

    // Handle other response types
    if (typeof data === "object") {
      return {
        text: `📊 **${toolName} Results:**${paramInfo}\n\n${JSON.stringify(
          data,
          null,
          2
        )}`,
      };
    }

    return {
      text: `📊 **${toolName} Results:**${paramInfo}\n\n${String(data)}`,
    };
  };

  // Function to extract search query from text
  const extractSearchQuery = (text: string): string => {
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

  return (
    <div className="chat-container">
      {/* Export Chat Button */}
      <div className="export-section">
        <div ref={exportMenuRef} className="export-menu-container">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="export-button"
          >
            <span role="img" aria-label="export">
              📤
            </span>
            Export Chat
            <span style={{ marginLeft: 4 }}>▼</span>
          </button>

          {showExportMenu && (
            <div className="export-dropdown">
              <button
                onClick={() => {
                  exportChat(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                className="export-option"
              >
                📋 JSON Format
              </button>
              <button
                onClick={() => {
                  exportChatAsText(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                className="export-option"
              >
                📄 Text Format
              </button>
              <button
                onClick={() => {
                  exportChatAsMarkdown(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                className="export-option"
              >
                📝 Markdown Format
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className="messages-container">
        <div className="messages-wrapper">
          {safeMessages.length === 0 && (
            <div className="empty-messages">No messages yet.</div>
          )}
          {safeMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`message-item ${
                msg.sender === "user"
                  ? "message-item--user"
                  : "message-item--system"
              }`}
            >
              {/* Message label */}
              <div
                className={`message-label ${
                  msg.sender === "user"
                    ? "message-label--user"
                    : "message-label--system"
                }`}
              >
                {msg.sender === "user" ? "You" : "AI"}
              </div>

              {msg.tableData ? (
                <>
                  {renderTable(msg.tableData, msg.toolName)}
                  {/* Copy button for table data */}
                  <div
                    className={`message-actions ${
                      msg.sender === "user"
                        ? "message-actions--user"
                        : "message-actions--system"
                    }`}
                  >
                    <div className="copy-button-container">
                      <button
                        onClick={() =>
                          copyToClipboardWithFeedback(
                            JSON.stringify(msg.tableData, null, 2),
                            `table-${idx}`
                          )
                        }
                        className="copy-button"
                        title="Copy Table"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === `table-${idx}` && (
                        <div className="copy-tooltip">Copied!</div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label className="trace-toggle">
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                        />
                        Show Trace Call
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span
                    className={`message-bubble ${
                      msg.sender === "user"
                        ? "message-bubble--user"
                        : "message-bubble--system"
                    }`}
                  >
                    {msg.text}
                  </span>
                  {/* Copy button for text messages */}
                  <div
                    className={`message-actions ${
                      msg.sender === "user"
                        ? "message-actions--user"
                        : "message-actions--system"
                    }`}
                  >
                    <div className="copy-button-container">
                      <button
                        onClick={() =>
                          copyToClipboardWithFeedback(
                            msg.text || "",
                            `text-${idx}`
                          )
                        }
                        className="copy-button"
                        title="Copy Message"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === `text-${idx}` && (
                        <div className="copy-tooltip">Copied!</div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label className="trace-toggle">
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                        />
                        Show Trace Call
                      </label>
                    )}
                  </div>
                </>
              )}

              {/* Trace details panel - only show when checkbox is checked */}
              {msg.sender === "system" &&
                msg.traceData &&
                visibleTraces.has(idx) && (
                  <div className="trace-panel">
                    <div className="trace-title">Trace Information</div>

                    <div className="trace-item">
                      <strong>Timestamp:</strong> {msg.traceData.timestamp}
                    </div>

                    {msg.traceData.userInput && (
                      <div className="trace-item">
                        <strong>User Input:</strong> {msg.traceData.userInput}
                      </div>
                    )}

                    {msg.traceData.selectedTool && (
                      <div className="trace-item">
                        <strong>Selected Tool:</strong>{" "}
                        {msg.traceData.selectedTool}
                      </div>
                    )}

                    {msg.traceData.parameters &&
                      Object.keys(msg.traceData.parameters).length > 0 && (
                        <div className="trace-item">
                          <strong>Parameters:</strong>
                          <pre className="trace-code">
                            {JSON.stringify(msg.traceData.parameters, null, 2)}
                          </pre>
                        </div>
                      )}

                    {msg.traceData.aiResponse && (
                      <div className="trace-item">
                        <strong>AI Response:</strong>
                        <pre className="trace-code">
                          {JSON.stringify(msg.traceData.aiResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpCall && (
                      <div className="trace-item">
                        <strong>MCP Call:</strong>
                        <pre className="trace-code">
                          {JSON.stringify(msg.traceData.mcpCall, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpResponse && (
                      <div className="trace-item">
                        <strong>MCP Response:</strong>
                        <pre className="trace-code">
                          {JSON.stringify(msg.traceData.mcpResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.error && (
                      <div className="trace-item trace-item--error">
                        <strong>Error:</strong> {msg.traceData.error}
                      </div>
                    )}
                  </div>
                )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {loading && <div className="loading-message">Processing...</div>}
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="input-form">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="chat-input"
          disabled={loading}
        />
        <button type="submit" className="send-button" disabled={loading}>
          {loading ? "Processing..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default Chat;
