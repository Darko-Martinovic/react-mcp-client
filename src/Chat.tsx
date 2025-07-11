import React, { useState, FormEvent, ChangeEvent } from "react";
import { askAzureOpenAI } from "./services/azureOpenAI";
import { callMcpTool } from "./services/mcpServer";

interface Message {
  sender: "user" | "system";
  text: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { sender: "user" as const, text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);
    try {
      // Step 1: Ask Azure OpenAI (mocked)
      const aiResponse = await askAzureOpenAI(input);
      setMessages((msgs) => [
        ...msgs,
        { sender: "system", text: aiResponse.aiMessage },
      ]);
      // Step 2: For each function call, call MCP server (mocked)
      for (const funcCall of aiResponse.functionCalls) {
        const result = await callMcpTool(funcCall.tool, funcCall.arguments);
        setMessages((msgs) => [
          ...msgs,
          {
            sender: "system",
            text: `Tool: ${result.tool}\nResult: ${JSON.stringify(
              result.data,
              null,
              2
            )}`,
          },
        ]);
      }
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        { sender: "system", text: "An error occurred. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "2rem auto",
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ minHeight: 200, marginBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: "#888" }}>No messages yet.</div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              margin: "8px 0",
            }}
          >
            <span
              style={{
                background: msg.sender === "user" ? "#e0f7fa" : "#f1f8e9",
                padding: "6px 12px",
                borderRadius: 16,
                display: "inline-block",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
        {loading && <div style={{ color: "#888" }}>Processing...</div>}
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
          disabled={loading}
        />
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#1976d2",
            color: "#fff",
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
