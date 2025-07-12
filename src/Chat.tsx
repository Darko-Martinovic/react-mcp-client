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
}

interface ChatProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  title?: string;
}

const renderTable = (data: Record<string, unknown>[], toolName?: string) => {
  if (!Array.isArray(data) || data.length === 0) return null;
  const columns = Object.keys(data[0]);
  return (
    <div style={{ margin: "8px 0" }}>
      {toolName && (
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>{toolName}</div>
      )}
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  border: "1px solid #ccc",
                  padding: "4px 8px",
                  background: "#f5f5f5",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td
                  key={col}
                  style={{ border: "1px solid #ccc", padding: "4px 8px" }}
                >
                  {String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const dataStr =
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify({ title, messages }, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}.json`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

const Chat: React.FC<ChatProps> = ({ messages, setMessages, title }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Defensive fallback: ensure messages is always an array
  const safeMessages = Array.isArray(messages) ? messages : [];

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
    if (!input.trim()) return;
    const userMsg: Message = { sender: "user", text: input };
    const baseMessages = Array.isArray(messages) ? messages : [];
    setMessages([...baseMessages, userMsg]);
    setInput("");
    setLoading(true);
    try {
      // Step 1: Fetch articles from Azure Search for RAG
      const articles = await fetchArticlesFromAzureSearch("*"); // Use "*" to get all documents
      // Step 2: Build system prompt with real data
      const systemPrompt = buildSystemPrompt(articles);
      // Step 3: Call Azure OpenAI with system prompt and user message
      const aiResponse = await askAzureOpenAI(input, systemPrompt);
      setMessages([
        ...baseMessages,
        userMsg,
        { sender: "system", text: aiResponse.aiMessage },
      ]);
      // Step 4: For each function call, call MCP server (real)
      let currentMessages = [
        ...baseMessages,
        userMsg,
        { sender: "system", text: aiResponse.aiMessage },
      ];
      for (const funcCall of aiResponse.functionCalls) {
        const result = await callMcpTool(funcCall.tool, funcCall.arguments);
        if (isSimpleTable(result.data)) {
          currentMessages = [
            ...currentMessages,
            {
              sender: "system",
              tableData: result.data,
              toolName: result.tool,
            },
          ];
          setMessages(currentMessages);
        } else {
          const prettifyPrompt = `Format the following business data for a business analyst in a clear and readable way:\n${JSON.stringify(
            result.data
          )}`;
          const prettified = await askAzureOpenAI(prettifyPrompt, systemPrompt);
          currentMessages = [
            ...currentMessages,
            {
              sender: "system",
              text: prettified.aiMessage,
            },
          ];
          setMessages(currentMessages);
        }
      }
    } catch (err) {
      setMessages([
        ...baseMessages,
        userMsg,
        { sender: "system", text: "An error occurred. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
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
        <button
          onClick={() => exportChat(safeMessages, title || "chat")}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          <span role="img" aria-label="export">
            📤
          </span>{" "}
          Export Chat
        </button>
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
              {msg.tableData ? (
                <>
                  {renderTable(msg.tableData, msg.toolName)}
                  <button
                    onClick={() =>
                      copyToClipboard(JSON.stringify(msg.tableData, null, 2))
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      right: msg.sender === "user" ? undefined : -40,
                      left: msg.sender === "user" ? -40 : undefined,
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
                </>
              ) : (
                <>
                  <span
                    style={{
                      background: msg.sender === "user" ? "#e0f7fa" : "#f1f8e9",
                      padding: "10px 18px",
                      borderRadius: 18,
                      display: "inline-block",
                      whiteSpace: "pre-wrap",
                      fontSize: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {msg.text}
                  </span>
                  <button
                    onClick={() => copyToClipboard(msg.text || "")}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: msg.sender === "user" ? undefined : -40,
                      left: msg.sender === "user" ? -40 : undefined,
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
                </>
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
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 16,
            background: "#f9f9f9",
          }}
          disabled={loading}
        />
        <button
          type="submit"
          style={{
            padding: "12px 28px",
            borderRadius: 10,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 16,
          }}
          disabled={loading}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
