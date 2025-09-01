import React, {
  useState,
  FormEvent,
  ChangeEvent,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n/i18n";
import styles from "./Chat.module.css";
import {
  fetchArticlesFromAzureSearch,
  fetchAzureSearchSchema,
  getSearchableFields,
  getFilterableFields,
} from "../../services/azureSearch";
import { getSystemPromptConfig } from "../SystemPromptEditor";
import EmojiPicker from "../EmojiPicker";
import QuestionPicker from "../QuestionPicker";
import SpeechToText from "../SpeechToText";
import { DataVisualization } from "../DataVisualization";
import { isSimpleTable } from "../DataVisualization/DataTransformer";
import {
  exportChat,
  exportChatAsText,
  exportChatAsMarkdown,
  copyToClipboard,
} from "../../utils/exporters";
import {
  Message,
  getAIIntent,
  parseAIResponseForMCPCall,
  callMCPServer,
} from "../../services/chatService";

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
  const [visibleTraces, setVisibleTraces] = useState<Set<number>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  const toggleTraceVisibility = (messageIndex: number) => {
    const newVisibleTraces = new Set(visibleTraces);
    if (newVisibleTraces.has(messageIndex)) {
      newVisibleTraces.delete(messageIndex);
    } else {
      newVisibleTraces.add(messageIndex);
    }
    setVisibleTraces(newVisibleTraces);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleQuestionSelect = (question: string) => {
    setInput(question);
    setShowQuestionPicker(false);
    inputRef.current?.focus();
  };

  const handleTranscriptUpdate = (transcript: string) => {
    // Only update input if it's empty or we're replacing speech content
    // Don't update if we're currently loading (message was just sent)
    if (!loading && (!input.trim() || input === lastSpeechTranscript.current)) {
      // Ensure first letter is capitalized
      const capitalizedTranscript =
        transcript.charAt(0).toUpperCase() + transcript.slice(1);
      setInput(capitalizedTranscript);
      lastSpeechTranscript.current = capitalizedTranscript;
    }
    inputRef.current?.focus();
  };

  return (
    <div className={styles.chatContainer}>
      {/* Header with App Title and Export Button */}
      <div className={styles.exportSection}>
        <div className={styles.appTitle}>
          <h1 className={styles.appTitleText}>
            {t("app.title") || "SmartQuery"}
          </h1>
          <span className={styles.appSubtitle}>
            {t("app.subtitle") || "AI-Powered Data Intelligence"}
          </span>
        </div>
        <div ref={exportMenuRef} className={styles.exportMenuContainer}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className={styles.exportButton}
          >
            <span role="img" aria-label="export">
              📤
            </span>
            {t("export.button") || "Export"}
            <span style={{ marginLeft: 4 }}>▼</span>
          </button>

          {showExportMenu && (
            <div className={styles.exportDropdown}>
              <button
                onClick={() => {
                  exportChat(messages, title || "chat");
                  setShowExportMenu(false);
                }}
                className={styles.exportOption}
              >
                📋 {t("export.json") || "JSON"}
              </button>
              <button
                onClick={() => {
                  exportChatAsText(messages, title || "chat");
                  setShowExportMenu(false);
                }}
                className={styles.exportOption}
              >
                📄 {t("export.text") || "Text"}
              </button>
              <button
                onClick={() => {
                  exportChatAsMarkdown(messages, title || "chat");
                  setShowExportMenu(false);
                }}
                className={styles.exportOption}
              >
                📝 {t("export.markdown") || "Markdown"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className={styles.messagesContainer}>
        <div className={styles.messagesWrapper}>
          {messages.length === 0 && (
            <div className={styles.emptyMessages}>
              {t("app.noMessages") || "No messages yet..."}
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.messageItem} ${
                msg.sender === "user"
                  ? styles.messageItemUser
                  : styles.messageItemSystem
              }`}
            >
              {/* Message label */}
              <div
                className={`${styles.messageLabel} ${
                  msg.sender === "user"
                    ? styles.messageLabelUser
                    : styles.messageLabelSystem
                }`}
              >
                {msg.sender === "user"
                  ? t("app.you") || "You"
                  : t("app.ai") || "AI"}
              </div>

              {msg.tableData ? (
                <>
                  {/* Show summary text above the table if it exists */}
                  {msg.text && (
                    <span
                      className={`${styles.messageBubble} ${
                        msg.sender === "user"
                          ? styles.messageBubbleUser
                          : styles.messageBubbleSystem
                      }`}
                      style={{ marginBottom: "10px", display: "block" }}
                    >
                      {msg.text}
                    </span>
                  )}

                  <DataVisualization
                    data={msg.tableData}
                    toolName={msg.toolName}
                    query={msg.traceData?.userInput}
                    t={t}
                  />

                  {/* Copy button for table data */}
                  <div
                    className={`${styles.messageActions} ${
                      msg.sender === "user"
                        ? styles.messageActionsUser
                        : styles.messageActionsSystem
                    }`}
                  >
                    <div className={styles.copyButtonContainer}>
                      <button
                        onClick={() =>
                          handleCopyMessage(
                            JSON.stringify(msg.tableData, null, 2),
                            idx
                          )
                        }
                        className={styles.copyButton}
                        title="Copy Table"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === String(idx) && (
                        <div className={styles.copyTooltip}>
                          {t("table.copied") || "Copied!"}
                        </div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label className={styles.traceToggle}>
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                        />
                        {t("trace.showTrace") || "Show Trace Call"}
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span
                    className={`${styles.messageBubble} ${
                      msg.sender === "user"
                        ? styles.messageBubbleUser
                        : styles.messageBubbleSystem
                    }`}
                  >
                    {msg.text}
                  </span>
                  {/* Copy button for text messages */}
                  <div
                    className={`${styles.messageActions} ${
                      msg.sender === "user"
                        ? styles.messageActionsUser
                        : styles.messageActionsSystem
                    }`}
                  >
                    <div className={styles.copyButtonContainer}>
                      <button
                        onClick={() => handleCopyMessage(msg.text || "", idx)}
                        className={styles.copyButton}
                        title="Copy Message"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === String(idx) && (
                        <div className={styles.copyTooltip}>Copied!</div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label className={styles.traceToggle}>
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                        />
                        {t("trace.showTrace") || "Show Trace Call"}
                      </label>
                    )}
                  </div>
                </>
              )}

              {/* Trace details panel - only show when checkbox is checked */}
              {msg.sender === "system" &&
                msg.traceData &&
                visibleTraces.has(idx) && (
                  <div className={styles.tracePanel}>
                    <div className={styles.traceTitle}>
                      <span>Trace Information</span>
                      <div className={styles.copyButtonContainer}>
                        <button
                          onClick={() => {
                            const traceText = JSON.stringify(
                              msg.traceData,
                              null,
                              2
                            );
                            handleCopyMessage(traceText, idx);
                          }}
                          className={styles.copyButton}
                          title="Copy Trace Data"
                        >
                          <span role="img" aria-label="copy">
                            📋
                          </span>
                        </button>
                        {copiedMessageId === String(idx) && (
                          <div className={styles.copyTooltip}>Copied!</div>
                        )}
                      </div>
                    </div>

                    <div className={styles.traceItem}>
                      <strong>Timestamp:</strong> {msg.traceData.timestamp}
                    </div>

                    {msg.traceData.userInput && (
                      <div className={styles.traceItem}>
                        <strong>User Input:</strong> {msg.traceData.userInput}
                      </div>
                    )}

                    {msg.traceData.selectedTool && (
                      <div className={styles.traceItem}>
                        <strong>Selected Tool:</strong>{" "}
                        {msg.traceData.selectedTool}
                      </div>
                    )}

                    {msg.traceData.parameters &&
                      Object.keys(msg.traceData.parameters).length > 0 && (
                        <div className={styles.traceItem}>
                          <strong>Parameters:</strong>
                          <pre className={styles.traceCode}>
                            {JSON.stringify(msg.traceData.parameters, null, 2)}
                          </pre>
                        </div>
                      )}

                    {msg.traceData.aiResponse && (
                      <div className={styles.traceItem}>
                        <strong>AI Response:</strong>
                        <pre className={styles.traceCode}>
                          {JSON.stringify(msg.traceData.aiResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpCall && (
                      <div className={styles.traceItem}>
                        <strong>MCP Call:</strong>
                        <pre className={styles.traceCode}>
                          {JSON.stringify(msg.traceData.mcpCall, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpResponse && (
                      <div className={styles.traceItem}>
                        <strong>MCP Response:</strong>
                        <pre className={styles.traceCode}>
                          {JSON.stringify(msg.traceData.mcpResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.error && (
                      <div
                        className={`${styles.traceItem} ${styles.traceItemError}`}
                      >
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
          <button
            type="button"
            className={styles.questionButton}
            onClick={() => setShowQuestionPicker(!showQuestionPicker)}
            disabled={loading}
            title="Standard questions"
          >
            ❓
          </button>
          <button
            type="button"
            className={styles.emojiButton}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={loading}
            title="Add emoji"
          >
            😀
          </button>
          <SpeechToText
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

        {/* Question Picker */}
        {showQuestionPicker && (
          <QuestionPicker
            onQuestionSelect={handleQuestionSelect}
            onClose={() => setShowQuestionPicker(false)}
          />
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Chat;
