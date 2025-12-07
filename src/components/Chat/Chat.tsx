import React, { useState, FormEvent, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Chat.module.css";
import {
  fetchArticlesFromAzureSearch,
  fetchAzureSearchSchema,
  getSearchableFields,
  getFilterableFields,
} from "../../services/azureSearch";
import { getSystemPromptConfig } from "../SystemPromptEditor";
import { copyToClipboard } from "../../utils/exporters";
import {
  Message,
  getAIIntent,
  parseAIResponseForMCPCall,
  callMCPServer,
} from "../../services/chatService";
import { ChatHeader } from "./ChatHeader";
import { MessageItem } from "./MessageItem";
import { ChatInput } from "./ChatInput";
import SpeechToTextSimple from "../SpeechToText/SpeechToTextSimple";

interface ChatProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  title: string;
  chatId: string;
}

const buildSystemPrompt = (articles: string[]) => `
You are an MCP (Model Context Protocol) assistant. Use the provided MCP tool information to answer the user's question.

Available MCP Tools and Functions:
${articles.map((a, i) => `${i + 1}. ${a}`).join("\n")}

When the user asks about available tools, functions, or capabilities, refer to this list. If the user asks about something not in this list, let them know it's not available.
`;

const Chat: React.FC<ChatProps> = ({
  messages,
  setMessages,
  title,
  chatId,
}) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [clearSpeechTrigger, setClearSpeechTrigger] = useState(0);
  const [stopSpeechTrigger, setStopSpeechTrigger] = useState(0);
  const [systemConfig, setSystemConfig] = useState(() =>
    getSystemPromptConfig()
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastSpeechTranscript = useRef<string>("");

  // Listen for system prompt config changes
  useEffect(() => {
    const handleConfigChange = (event: CustomEvent) => {
      setSystemConfig(event.detail);
    };

    window.addEventListener(
      "systemPromptConfigChanged",
      handleConfigChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "systemPromptConfigChanged",
        handleConfigChange as EventListener
      );
    };
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showExportMenu]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Send clicked, input:", input);
    if (!input.trim() || loading) return;

    const userMsg: Message = { sender: "user", text: input };
    const baseMessages = Array.isArray(messages) ? messages : [];
    setMessages([...baseMessages, userMsg]);

    // Stop speech recognition and clear everything
    setStopSpeechTrigger((prev) => prev + 1); // Force stop listening
    setInput(""); // Clear input field immediately
    setClearSpeechTrigger((prev) => prev + 1); // Trigger speech transcript clear
    lastSpeechTranscript.current = ""; // Reset speech tracking

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
        schema: null,
      };

      // Check if user is asking about schema or capabilities
      const isSchemaQuery =
        input.toLowerCase().includes("schema") ||
        input.toLowerCase().includes("index") ||
        input.toLowerCase().includes("what tools") ||
        input.toLowerCase().includes("available tools") ||
        input.toLowerCase().includes("capabilities");

      if (isSchemaQuery) {
        // Fetch and display schema information
        const schema = await fetchAzureSearchSchema();
        traceData.schema = schema;

        if (schema) {
          const searchableFields = getSearchableFields(schema);
          const filterableFields = getFilterableFields(schema);

          const schemaInfo = `🔧 **Azure Search Index Schema**

**Index Name:** ${schema.indexName}

**Available Fields:**
${schema.fields
  .map(
    (field) =>
      `• **${field.name}** (${field.type})${field.key ? " 🔑" : ""}${
        field.searchable ? " 🔍" : ""
      }${field.filterable ? " 🏷️" : ""}${field.sortable ? " ↕️" : ""}`
  )
  .join("\n")}

**Field Legend:**
🔑 Key field | 🔍 Searchable | 🏷️ Filterable | ↕️ Sortable

**Searchable Fields:** ${searchableFields.join(", ")}
**Filterable Fields:** ${filterableFields.join(", ")}

**Total Fields:** ${schema.fields.length}
**Last Updated:** ${new Date().toLocaleString()}`;

          setMessages([
            ...baseMessages,
            userMsg,
            {
              sender: "system",
              text: schemaInfo,
              traceData: traceData,
            },
          ]);
          return;
        } else {
          setMessages([
            ...baseMessages,
            userMsg,
            {
              sender: "system",
              text: "❌ Could not retrieve Azure Search index schema. The schema endpoint may not be available.",
              traceData: traceData,
            },
          ]);
          return;
        }
      }

      // Step 1: Get AI intent
      const aiResponse = await getAIIntent(input, baseMessages, chatId);
      traceData.aiResponse = {
        aiMessage: aiResponse.aiMessage,
        functionCalls: aiResponse.functionCalls,
      };

      console.log("=== AI RESPONSE DEBUG ===");
      console.log("Full AI Response Object:", aiResponse);
      console.log("AI Message Content:", aiResponse.aiMessage);
      console.log("AI Function Calls:", aiResponse.functionCalls);
      console.log("========================");

      // Check if AI generated function calls
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        console.log("=== PROCESSING FUNCTION CALLS ===");

        // Find search_azure_cognitive function call
        const searchCall = aiResponse.functionCalls.find(
          (call: any) => call.name === "search_azure_cognitive"
        );

        if (searchCall && searchCall.arguments?.query) {
          console.log("Found search_azure_cognitive call:", searchCall);

          // Create MCP call from function call, including original user input for parameter extraction
          const mcpCall = {
            function: "multi_tool_use",
            parameters: {
              query: searchCall.arguments.query,
              originalUserInput: input,
            },
          };

          traceData.mcpCall = mcpCall;
          traceData.selectedTool = mcpCall.function;
          traceData.parameters = mcpCall.parameters;

          console.log("Generated MCP call from function call:", mcpCall);

          // Execute the MCP call
          try {
            const mcpResponse = await callMCPServer(mcpCall, chatId);
            traceData.mcpResponse = mcpResponse;

            // Handle the response
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
                  tokensUsed: aiResponse.tokensUsed,
                  estimatedCost: aiResponse.estimatedCost,
                  model: aiResponse.model,
                  usedTools: true,
                  toolsCalled: mcpResponse.toolName
                    ? [mcpResponse.toolName]
                    : [],
                },
              ]);
            } else if (
              typeof mcpResponse === "object" &&
              mcpResponse.jsonData
            ) {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text: mcpResponse.summary,
                  jsonData: mcpResponse.jsonData,
                  toolName: mcpResponse.toolName,
                  traceData: traceData,
                  tokensUsed: aiResponse.tokensUsed,
                  estimatedCost: aiResponse.estimatedCost,
                  model: aiResponse.model,
                  usedTools: true,
                  toolsCalled: mcpResponse.toolName
                    ? [mcpResponse.toolName]
                    : [],
                },
              ]);
            } else if (typeof mcpResponse === "object" && mcpResponse.text) {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text: mcpResponse.text,
                  traceData: traceData,
                  tokensUsed: aiResponse.tokensUsed,
                  estimatedCost: aiResponse.estimatedCost,
                  model: aiResponse.model,
                  usedTools: true,
                  toolsCalled: [],
                },
              ]);
            } else {
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
                  tokensUsed: aiResponse.tokensUsed,
                  estimatedCost: aiResponse.estimatedCost,
                  model: aiResponse.model,
                  usedTools: true,
                  toolsCalled: [],
                },
              ]);
            }
            return;
          } catch (mcpError) {
            console.error("MCP Server Error:", mcpError);
            traceData.error =
              mcpError instanceof Error ? mcpError.message : String(mcpError);
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: "Sorry, I couldn't process your request through the MCP server. Please try again.",
                traceData: traceData,
                tokensUsed: aiResponse.tokensUsed,
                estimatedCost: aiResponse.estimatedCost,
                model: aiResponse.model,
              },
            ]);
            return;
          }
        }
        console.log("=================================");
      }

      // Step 2: Parse AI response to extract MCP server call (fallback)
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
          const mcpResponse = await callMCPServer(mcpCall, chatId);
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
          } else if (typeof mcpResponse === "object" && mcpResponse.jsonData) {
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: mcpResponse.summary,
                jsonData: mcpResponse.jsonData,
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
          traceData.error =
            mcpError instanceof Error ? mcpError.message : String(mcpError);
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
        { sender: "system", text: t("app.error") },
      ]);
    } finally {
      setLoading(false);
      // Keep focus on input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleCopyMessage = async (messageText: string, messageId: number) => {
    try {
      await copyToClipboard(messageText);
      setCopiedMessageId(String(messageId));
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleTranscriptUpdate = (transcript: string) => {
    // Simple: just update the input if not loading and transcript is not empty
    if (!loading && transcript.trim()) {
      setInput(transcript.trim());
      lastSpeechTranscript.current = transcript.trim();
    }
    inputRef.current?.focus();
  };

  return (
    <div className={styles.chatContainer}>
      {/* Header with App Title and Export Button */}
      <ChatHeader messages={messages} title={title} />

      {/* Message list */}
      <div className={styles.messagesContainer}>
        <div className={styles.messagesWrapper}>
          {messages.length === 0 && (
            <div className={styles.emptyMessages}>
              {t("app.noMessages") || "No messages yet..."}
            </div>
          )}
          {messages.map((msg, idx) => (
            <MessageItem
              key={idx}
              message={msg}
              messageIndex={idx}
              copiedMessageId={copiedMessageId}
              onCopy={handleCopyMessage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
        {loading && (
          <div className={styles.loadingMessage}>
            {t("app.processing") || "Processing..."}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={t("app.placeholder") || "Type your message..."}
            className={styles.chatInput}
            disabled={loading}
          />
          <SpeechToTextSimple
            onTranscriptUpdate={handleTranscriptUpdate}
            language="en-US" // Always use English for better business term recognition
            isDisabled={loading}
            clearTrigger={clearSpeechTrigger}
            stopTrigger={stopSpeechTrigger}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={loading}
          >
            {loading
              ? t("app.processing") || "Processing..."
              : t("app.send") || "Send"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
