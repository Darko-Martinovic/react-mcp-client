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

  return (
    <div
      style={{
        margin: "16px 0",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        background: "#fff",
      }}
    >
      {toolName && (
        <div
          style={{
            fontWeight: "600",
            marginBottom: "12px",
            color: "#2e7d32",
            fontSize: "16px",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          📊 {toolName} Results
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: "600px",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
              }}
            >
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    border: "none",
                    padding: "16px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#495057",
                    fontSize: "13px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    borderBottom: "2px solid #dee2e6",
                  }}
                >
                  {getColumnHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  background: idx % 2 === 0 ? "#ffffff" : "#f8f9fa",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e3f2fd";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    idx % 2 === 0 ? "#ffffff" : "#f8f9fa";
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    style={{
                      border: "none",
                      padding: "12px",
                      borderBottom: "1px solid #e9ecef",
                      color: "#495057",
                      verticalAlign: "middle",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: col.toLowerCase().includes("name")
                          ? "500"
                          : "400",
                        color:
                          col.toLowerCase().includes("price") ||
                          col.toLowerCase().includes("amount")
                            ? "#28a745"
                            : col.toLowerCase().includes("stock") &&
                              Number(row[col]) < 30
                            ? "#dc3545"
                            : col.toLowerCase().includes("id")
                            ? "#6c757d"
                            : "#495057",
                      }}
                    >
                      {formatCellValue(row[col])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "12px 16px",
          background: "#f8f9fa",
          borderTop: "1px solid #e9ecef",
          color: "#6c757d",
          fontSize: "13px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
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
  ) => {
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
      .map((a) => a.functionName || a.name)
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
      .map((a) => `${a.functionName}: ${a.description}`)
      .slice(0, 3)
      .join(", ")}`;

    return await askAzureOpenAI(userMessage, systemPrompt);
  };

  // Function to parse AI response and extract MCP server call
  const parseAIResponseForMCPCall = (aiResponse: string) => {
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
        let parameters = {};

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

        const result = {
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
          const fallbackResult = {
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

  // Function to call actual MCP server on port 5000
  const callMCPServer = async (mcpCall: {
    function: string;
    parameters: any;
  }): Promise<any> => {
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

    const searchData = await searchResponse.json();
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

      let supplierMatch = null;
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

        const mcpData = await mcpResponse.json();
        console.log("Real MCP Server response:", mcpData);

        return formatStructuredMCPResponse(
          mcpData,
          selectedTool.functionName,
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

        const mcpData = await mcpResponse.json();
        console.log("Real MCP Server response:", mcpData);

        return formatStructuredMCPResponse(
          mcpData,
          selectedTool.functionName,
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

  // Function to format real MCP server response (actual data)
  const formatRealMCPResponse = (
    data: any,
    toolName: string,
    parameters?: any
  ): string => {
    console.log("Formatting real MCP response:", data);

    if (data.error) {
      return `Error from MCP server: ${data.error}`;
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
          return `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** No data found${
            parameters?.supplier ? ` for supplier "${parameters.supplier}"` : ""
          }${
            parameters?.category ? ` in category "${parameters.category}"` : ""
          }\n⏰ **Timestamp:** ${data.timestamp || "N/A"}\n🔢 **Count:** ${
            data.count || 0
          }`;
        }

        let response = `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Results (${
          data.count || tableData.length
        }):**\n\n`;

        // Format as a simple table
        const firstItem = tableData[0];
        const headers = Object.keys(firstItem);

        // Add headers
        response += headers.join(" | ") + "\n";
        response += headers.map(() => "---").join(" | ") + "\n";

        // Add rows (limit to first 10)
        tableData.slice(0, 10).forEach((item: any) => {
          response +=
            headers.map((header) => String(item[header] || "")).join(" | ") +
            "\n";
        });

        if (tableData.length > 10) {
          response += `\n... and ${tableData.length - 10} more result(s)`;
        }

        if (data.timestamp) {
          response += `\n\n⏰ **Timestamp:** ${data.timestamp}`;
        }

        return response;
      } else if (data.success) {
        return `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** ${JSON.stringify(
          data,
          null,
          2
        )}`;
      } else {
        return `❌ **${toolName}** execution failed${paramInfo}\n\n📊 **Result:** ${JSON.stringify(
          data,
          null,
          2
        )}`;
      }
    }

    // Check if it's a table/array response (fallback)
    if (Array.isArray(data) || (data.data && Array.isArray(data.data))) {
      const tableData = Array.isArray(data) ? data : data.data;

      if (tableData.length === 0) {
        return `📊 **${toolName} Results:** No data found${paramInfo}`;
      }

      let response = `📊 **${toolName} Results:**${paramInfo}\n\n`;

      // Format as a simple table
      const firstItem = tableData[0];
      const headers = Object.keys(firstItem);

      // Add headers
      response += headers.join(" | ") + "\n";
      response += headers.map(() => "---").join(" | ") + "\n";

      // Add rows (limit to first 10)
      tableData.slice(0, 10).forEach((item: any) => {
        response +=
          headers.map((header) => String(item[header] || "")).join(" | ") +
          "\n";
      });

      if (tableData.length > 10) {
        response += `\n... and ${tableData.length - 10} more result(s)`;
      }

      return response;
    }

    // Handle other response types
    if (typeof data === "object") {
      return `📊 **${toolName} Results:**${paramInfo}\n\n${JSON.stringify(
        data,
        null,
        2
      )}`;
    }

    return `📊 **${toolName} Results:**${paramInfo}\n\n${String(data)}`;
  };

  // Function to format MCP server response
  const formatMCPResponse = (data: any): string => {
    console.log("Formatting MCP response:", data);

    if (data.value && Array.isArray(data.value)) {
      const results = data.value.slice(0, 8); // Show top 8 results

      if (results.length === 0) {
        return "No MCP tools or functions found for your search.";
      }

      let response = `Found ${data.value.length} MCP tool(s):\n\n`;

      results.forEach((item: any, index: number) => {
        // Try different field names that might contain the function/tool name
        const name =
          item.functionName ||
          item.name ||
          item.title ||
          item.toolName ||
          `Tool ${index + 1}`;
        const description =
          item.description ||
          item.summary ||
          item.content ||
          "No description available";
        const category = item.category || item.type || "";

        response += `**${name}**`;
        if (category) {
          response += ` (${category})`;
        }
        response += `\n${description}\n\n`;
      });

      if (data.value.length > results.length) {
        response += `... and ${
          data.value.length - results.length
        } more result(s)`;
      }

      return response;
    }

    // Handle other response formats
    if (data.error) {
      return `Error from MCP server: ${data.error}`;
    }

    // Default formatting for unknown response structure
    return `MCP Server Response:\n\n${JSON.stringify(data, null, 2)}`;
  };

  // Function to return structured data for better table rendering
  const formatStructuredMCPResponse = (
    data: any,
    toolName: string,
    parameters?: any
  ) => {
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        background: "#f5f7fa",
      }}
    >
      {/* Export Chat Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "8px 24px 0 24px",
        }}
      >
        <div
          ref={exportMenuRef}
          style={{ position: "relative", display: "inline-block" }}
        >
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "none",
              background: "#1976d2",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 14,
              marginBottom: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span role="img" aria-label="export">
              📤
            </span>
            Export Chat
            <span style={{ marginLeft: 4 }}>▼</span>
          </button>

          {showExportMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 1000,
                minWidth: 180,
              }}
            >
              <button
                onClick={() => {
                  exportChat(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                📋 JSON Format
              </button>
              <button
                onClick={() => {
                  exportChatAsText(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                📄 Text Format
              </button>
              <button
                onClick={() => {
                  exportChatAsMarkdown(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 14,
                  fontFamily: "Inter, system-ui, sans-serif",
                  borderRadius: "0 0 8px 8px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                📝 Markdown Format
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 0 16px 0",
          width: "100%",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {safeMessages.length === 0 && (
            <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
              No messages yet.
            </div>
          )}
          {safeMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                textAlign: msg.sender === "user" ? "right" : "left",
                margin: "12px 0",
                position: "relative",
              }}
            >
              {/* Message label */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: msg.sender === "user" ? "#006064" : "#2e7d32",
                  marginBottom: 4,
                  fontFamily: "Inter, system-ui, sans-serif",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {msg.sender === "user" ? "You" : "AI"}
              </div>
              {msg.tableData ? (
                <>
                  {renderTable(msg.tableData, msg.toolName)}
                  {/* Copy button for table data */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "8px",
                      justifyContent:
                        msg.sender === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{ position: "relative", display: "inline-block" }}
                    >
                      <button
                        onClick={() =>
                          copyToClipboardWithFeedback(
                            JSON.stringify(msg.tableData, null, 2),
                            `table-${idx}`
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 18,
                        }}
                        title="Copy Table"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === `table-${idx}` && (
                        <div
                          style={{
                            position: "absolute",
                            top: -35,
                            right: 0,
                            background: "#4caf50",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "500",
                            whiteSpace: "nowrap",
                            zIndex: 1000,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                        >
                          Copied!
                        </div>
                      )}
                    </div>
                    
                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          cursor: "pointer",
                          color: "#666",
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: "12px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                          style={{ marginRight: "6px" }}
                        />
                        Show Trace Call
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span
                    className={`chat-message ${msg.sender}`}
                    style={{
                      background: msg.sender === "user" ? "#e0f7fa" : "#f1f8e9",
                      padding: "12px 20px",
                      borderRadius: 20,
                      display: "inline-block",
                      whiteSpace: "pre-wrap",
                      fontSize: 15,
                      lineHeight: "1.5",
                      fontWeight: msg.sender === "user" ? 500 : 400,
                      letterSpacing: "-0.01em",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      border:
                        msg.sender === "user"
                          ? "1px solid #b3e5fc"
                          : "1px solid #e8f5e8",
                      color: msg.sender === "user" ? "#006064" : "#2e7d32",
                      maxWidth: "85%",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.text}
                  </span>
                  {/* Copy button for text messages */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "8px",
                      justifyContent:
                        msg.sender === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{ position: "relative", display: "inline-block" }}
                    >
                      <button
                        onClick={() =>
                          copyToClipboardWithFeedback(
                            msg.text || "",
                            `text-${idx}`
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 18,
                        }}
                        title="Copy Message"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === `text-${idx}` && (
                        <div
                          style={{
                            position: "absolute",
                            top: -35,
                            right: 0,
                            background: "#4caf50",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "500",
                            whiteSpace: "nowrap",
                            zIndex: 1000,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                        >
                          Copied!
                        </div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          color: "#666",
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: "12px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                          style={{ marginRight: "6px" }}
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
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "12px",
                      backgroundColor: "#f8f9fa",
                      border: "1px solid #e9ecef",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      maxHeight: "300px",
                      overflowY: "auto",
                      lineHeight: "1.4",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: "8px",
                        fontWeight: "bold",
                        color: "#495057",
                      }}
                    >
                      Trace Information
                    </div>

                    <div style={{ marginBottom: "6px" }}>
                      <strong>Timestamp:</strong> {msg.traceData.timestamp}
                    </div>

                    {msg.traceData.userInput && (
                      <div style={{ marginBottom: "6px" }}>
                        <strong>User Input:</strong> {msg.traceData.userInput}
                      </div>
                    )}

                    {msg.traceData.selectedTool && (
                      <div style={{ marginBottom: "6px" }}>
                        <strong>Selected Tool:</strong>{" "}
                        {msg.traceData.selectedTool}
                      </div>
                    )}

                    {msg.traceData.parameters &&
                      Object.keys(msg.traceData.parameters).length > 0 && (
                        <div style={{ marginBottom: "6px" }}>
                          <strong>Parameters:</strong>
                          <pre
                            style={{
                              margin: "4px 0",
                              padding: "4px",
                              backgroundColor: "#ffffff",
                              border: "1px solid #dee2e6",
                              borderRadius: "3px",
                            }}
                          >
                            {JSON.stringify(msg.traceData.parameters, null, 2)}
                          </pre>
                        </div>
                      )}

                    {msg.traceData.aiResponse && (
                      <div style={{ marginBottom: "6px" }}>
                        <strong>AI Response:</strong>
                        <pre
                          style={{
                            margin: "4px 0",
                            padding: "4px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #dee2e6",
                            borderRadius: "3px",
                          }}
                        >
                          {JSON.stringify(msg.traceData.aiResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpCall && (
                      <div style={{ marginBottom: "6px" }}>
                        <strong>MCP Call:</strong>
                        <pre
                          style={{
                            margin: "4px 0",
                            padding: "4px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #dee2e6",
                            borderRadius: "3px",
                          }}
                        >
                          {JSON.stringify(msg.traceData.mcpCall, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpResponse && (
                      <div style={{ marginBottom: "6px" }}>
                        <strong>MCP Response:</strong>
                        <pre
                          style={{
                            margin: "4px 0",
                            padding: "4px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #dee2e6",
                            borderRadius: "3px",
                          }}
                        >
                          {JSON.stringify(msg.traceData.mcpResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.error && (
                      <div style={{ marginBottom: "6px", color: "#dc3545" }}>
                        <strong>Error:</strong> {msg.traceData.error}
                      </div>
                    )}
                  </div>
                )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {loading && (
          <div style={{ color: "#888", textAlign: "center", marginTop: 20 }}>
            Processing...
          </div>
        )}
      </div>
      {/* Input area */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          gap: 8,
          padding: "16px 24px",
          borderTop: "1px solid #ddd",
          background: "#fff",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="chat-input"
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #e1e4e8",
            fontSize: 15,
            background: "#ffffff",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            lineHeight: "1.4",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
          disabled={loading}
          onFocus={(e) => {
            e.target.style.borderColor = "#1976d2";
            e.target.style.boxShadow = "0 0 0 3px rgba(25, 118, 210, 0.1)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#e1e4e8";
            e.target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
          }}
        />
        <button
          type="submit"
          style={{
            padding: "14px 32px",
            borderRadius: 12,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "-0.01em",
            cursor: "pointer",
            transition: "background-color 0.2s ease, transform 0.1s ease",
            boxShadow: "0 2px 8px rgba(25, 118, 210, 0.3)",
          }}
          disabled={loading}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {loading ? "Processing..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default Chat;
