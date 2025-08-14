import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Chat from "./Chat/Chat";
import LanguageSelector from "./LanguageSelector";
import WorkflowVisualization from "./WorkflowVisualization";
import SystemPromptEditor from "./SystemPromptEditor";
import { ToastContainer } from "./Toast";
import { useToast } from "../hooks/useToast";
import { getLanguageStorageKey } from "../i18n/i18n";
import { Message } from "../services/chatService";
import styles from "./App.module.css";

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const LOCAL_STORAGE_KEY = "mcpChats";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get welcome message for new language
function getWelcomeMessage(
  language: string
): { title: string; message: Message } | null {
  const welcomeMessages = {
    en: {
      title: "Welcome to MCP Client",
      message: {
        sender: "system" as const,
        text: '👋 Welcome to the MCP (Model Context Protocol) Client!\n\nThis is your English chat session. You can:\n• Ask questions about your business data\n• Query inventory, sales, and products\n• Get insights through AI-powered analysis\n\nTry asking: "Show me recent sales data" or "What products are low in stock?"',
      },
    },
    fr: {
      title: "Bienvenue dans MCP Client",
      message: {
        sender: "system" as const,
        text: '👋 Bienvenue dans le Client MCP (Model Context Protocol) !\n\nCeci est votre session de chat en français. Vous pouvez :\n• Poser des questions sur vos données commerciales\n• Consulter l\'inventaire, les ventes et les produits\n• Obtenir des insights grâce à l\'analyse IA\n\nEssayez de demander : "Montrez-moi les données de ventes récentes" ou "Quels produits sont en rupture de stock ?"',
      },
    },
    nl: {
      title: "Welkom bij MCP Client",
      message: {
        sender: "system" as const,
        text: '👋 Welkom bij de MCP (Model Context Protocol) Client!\n\nDit is uw Nederlandse chat sessie. U kunt:\n• Vragen stellen over uw bedrijfsgegevens\n• Inventaris, verkoop en producten opvragen\n• Inzichten krijgen door AI-analyse\n\nProbeer te vragen: "Toon me recente verkoopgegevens" of "Welke producten hebben weinig voorraad?"',
      },
    },
  };

  return welcomeMessages[language as keyof typeof welcomeMessages] || null;
}

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { toasts, showSuccess, showError, showWarning, showInfo, removeToast } =
    useToast();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const didLoadChats = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current language storage key
  const getCurrentStorageKey = () =>
    getLanguageStorageKey(LOCAL_STORAGE_KEY, i18n.language);

  // Debug function to check localStorage contents
  const debugLocalStorage = () => {
    console.log("🔍 LOCALSTORAGE DEBUG:");
    console.log("Current language:", i18n.language);
    console.log("Current storage key:", getCurrentStorageKey());

    // Check all possible language keys
    const languages = ["en", "fr", "nl"];
    languages.forEach((lang) => {
      const key = getLanguageStorageKey(LOCAL_STORAGE_KEY, lang);
      const data = localStorage.getItem(key);
      console.log(
        `${lang}: ${key} -> ${data ? `${data.length} chars` : "null"}`
      );
      if (data) {
        try {
          const parsed = JSON.parse(data);
          console.log(
            `  └─ ${Array.isArray(parsed) ? parsed.length : "invalid"} chats`
          );
        } catch (e) {
          console.log(`  └─ Parse error: ${e}`);
        }
      }
    });

    console.log("Current chats state:", chats.length);
    console.log("Active chat ID:", activeChatId);
  };

  // Expose debug function globally for testing
  useEffect(() => {
    (window as any).debugMCPChats = debugLocalStorage;
    return () => {
      delete (window as any).debugMCPChats;
    };
  }, [chats, activeChatId, i18n.language]);

  // Load chats from localStorage - handles both initial load and language changes
  useEffect(() => {
    const loadChats = () => {
      console.log("🔄 Loading chats - i18n status:", {
        isInitialized: i18n.isInitialized,
        language: i18n.language,
        ready: !!i18n.language,
      });

      // Wait for i18n to be ready
      if (!i18n.language || !i18n.isInitialized) {
        console.log("⏳ Waiting for i18n to be ready...");
        setTimeout(loadChats, 100);
        return;
      }

      try {
        const storageKey = getCurrentStorageKey();
        console.log("📂 Loading chats from localStorage:", {
          storageKey,
          language: i18n.language,
        });

        const stored = localStorage.getItem(storageKey);
        console.log(
          "📄 Raw stored data:",
          stored ? `${stored.length} chars` : "null"
        );

        if (stored && stored.trim()) {
          try {
            const parsed: ChatSession[] = JSON.parse(stored);

            // Validate the parsed data
            if (Array.isArray(parsed)) {
              console.log("✅ Successfully parsed chats:", {
                count: parsed.length,
                chats: parsed.map((c) => ({
                  id: c.id,
                  title: c.title,
                  messageCount: c.messages?.length || 0,
                  valid: !!(c.id && c.title && c.messages && c.createdAt),
                })),
              });

              // Filter out any invalid chats
              const validChats = parsed.filter(
                (chat) =>
                  chat.id &&
                  chat.title &&
                  Array.isArray(chat.messages) &&
                  chat.createdAt
              );

              setChats(validChats);

              if (validChats.length > 0) {
                // Check if current active chat exists in this language's chats
                const activeExists = validChats.find(
                  (chat) => chat.id === activeChatId
                );
                if (!activeExists) {
                  console.log(
                    "🎯 Setting active chat to first chat:",
                    validChats[0].id
                  );
                  setActiveChatId(validChats[0].id);
                } else {
                  console.log(
                    "🎯 Active chat exists in current language:",
                    activeChatId
                  );
                }
              } else {
                console.log("📭 No valid chats found");
                setActiveChatId(null);
              }

              return;
            } else {
              console.warn("⚠️ Parsed data is not an array:", typeof parsed);
            }
          } catch (parseError) {
            console.error("❌ Error parsing stored chats:", parseError);
            console.log(
              "🧹 Clearing corrupted localStorage for key:",
              storageKey
            );
            localStorage.removeItem(storageKey);
          }
        } else {
          console.log("🆕 No stored chats found for language:", i18n.language);
        }

        // Fallback: empty state
        setChats([]);
        setActiveChatId(null);
      } catch (error) {
        console.error("❌ Critical error loading chats:", error);
        setChats([]);
        setActiveChatId(null);
      }
    };

    // Start loading immediately
    loadChats();
  }, [i18n.language, i18n.isInitialized]);

  // Import conversation function
  const handleImportConversation = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.txt,.md";
    input.multiple = false;

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let importedChat: ChatSession | null = null;

        if (file.name.endsWith(".json")) {
          // Try to parse as JSON export
          try {
            const parsed = JSON.parse(text);
            if (
              parsed.id &&
              parsed.title &&
              parsed.messages &&
              parsed.createdAt
            ) {
              // Single chat export
              importedChat = {
                ...parsed,
                id: generateId(), // Generate new ID to avoid conflicts
              };
            } else if (
              Array.isArray(parsed) &&
              parsed.length > 0 &&
              parsed[0].id
            ) {
              // Multiple chats export - import first one
              importedChat = {
                ...parsed[0],
                id: generateId(),
              };
            }
          } catch (e) {
            console.error("❌ Error parsing JSON:", e);
          }
        } else if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
          // Convert text/markdown to chat format
          importedChat = {
            id: generateId(),
            title: `Imported: ${file.name}`,
            createdAt: new Date().toISOString(),
            messages: [
              {
                sender: "system",
                text: `� Imported from ${file.name}:\n\n${text}`,
              },
            ],
          };
        }

        if (importedChat) {
          setChats((prev) => [importedChat!, ...prev]);
          setActiveChatId(importedChat.id);
          console.log("✅ Successfully imported chat:", importedChat.title);
          showSuccess(`Successfully imported: "${importedChat.title}"`);
        } else {
          showError(
            "Could not import file. Please check the format and try again."
          );
        }
      } catch (error) {
        console.error("❌ Error importing file:", error);
        showError("Error importing file. Please try again.");
      }
    };

    input.click();
  };

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    showInfo("New chat created!");
  };

  // Manual save function
  const handleSaveChat = (chatId: string) => {
    if (!i18n.language || !i18n.isInitialized) {
      showWarning("Cannot save - system not ready. Please try again.");
      return;
    }

    try {
      const storageKey = getCurrentStorageKey();
      const chatToSave = chats.find((chat) => chat.id === chatId);

      if (!chatToSave) {
        showError("Chat not found for saving. Please try again.");
        return;
      }

      // Get existing saved chats
      let savedChats: ChatSession[] = [];
      const existingSaved = localStorage.getItem(storageKey);
      if (existingSaved) {
        try {
          savedChats = JSON.parse(existingSaved);
          if (!Array.isArray(savedChats)) savedChats = [];
        } catch (e) {
          savedChats = [];
        }
      }

      // Update or add the chat
      const existingIndex = savedChats.findIndex((chat) => chat.id === chatId);
      if (existingIndex >= 0) {
        savedChats[existingIndex] = chatToSave;
        console.log("💾 Updated existing saved chat:", chatToSave.title);
        showSuccess(`Updated "${chatToSave.title}" successfully!`);
      } else {
        savedChats.unshift(chatToSave);
        console.log("💾 Added new saved chat:", chatToSave.title);
        showSuccess(`Saved "${chatToSave.title}" successfully!`);
      }

      localStorage.setItem(storageKey, JSON.stringify(savedChats));
      console.log("✅ Chat saved successfully to localStorage");
    } catch (error) {
      console.error("❌ Error saving chat:", error);
      showError("Failed to save chat. Please try again.");
    }
  };

  const handleChatClick = (chatId: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setActiveChatId(chatId);
    }, 200);
  };

  const handleChatDoubleClick = (chatId: string, title: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setEditingId(chatId);
    setEditTitle(title);
  };

  const handleUpdateMessages = (newMessages: Message[]) => {
    if (!activeChatId) return;

    console.log("💬 Updating messages for chat:", {
      chatId: activeChatId,
      messageCount: newMessages.length,
      messages: newMessages.map((m) => ({
        sender: m.sender,
        textPreview: m.text?.substring(0, 50),
      })),
    });

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId ? { ...chat, messages: newMessages } : chat
      )
    );
  };

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) {
      const remainingChats = chats.filter((chat) => chat.id !== chatId);
      setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
    }
  };

  const handleEditTitle = (chatId: string, currentTitle: string) => {
    setEditingId(chatId);
    setEditTitle(currentTitle);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.target.value);
  };

  const handleTitleBlur = (id: string) => {
    if (editTitle.trim()) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === id ? { ...chat, title: editTitle.trim() } : chat
        )
      );
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleTitleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string
  ) => {
    if (e.key === "Enter") {
      handleTitleBlur(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditTitle("");
    }
  };

  // Update chat title to first user message if still "New Chat"
  useEffect(() => {
    setChats((prev) =>
      prev.map((chat) => {
        if (
          chat.title === "New Chat" &&
          chat.messages.length > 0 &&
          chat.messages[0].text
        ) {
          return { ...chat, title: chat.messages[0].text.slice(0, 20) };
        }
        return chat;
      })
    );
  }, [activeChat?.messages]);

  // Handle language change - will trigger useEffect to load language-specific chats
  const handleLanguageChange = (newLanguage: string) => {
    console.log(`Language changed to: ${newLanguage}`);
    // The useEffect with i18n.language dependency will handle loading the appropriate chats
  };

  return (
    <div className={styles.appContainer}>
      {/* Sidebar for chat archive */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button onClick={handleNewChat} className={styles.newChatButton}>
            <span role="img" aria-label="new">
              🆕
            </span>{" "}
            {t("app.newChat", "New Chat")}
          </button>
          <div className={styles.headerActions}>
            <button
              onClick={handleImportConversation}
              className={styles.importButton}
              title="Import Conversation"
            >
              📥
            </button>
            <button
              onClick={() => setShowWorkflow(true)}
              className={styles.workflowButton}
              title={t("workflow.title", "System Workflow")}
            >
              ⚙️
            </button>
            <button
              onClick={() => setShowSystemPrompt(true)}
              className={styles.systemPromptButton}
              title="System Configuration"
            >
              🔧
            </button>
            <LanguageSelector onLanguageChange={handleLanguageChange} />
          </div>
        </div>
        <div className={styles.sidebarTitle}>{t("app.chats", "Chats")}</div>
        <ul className={styles.chatList}>
          {chats.map((chat) => (
            <li
              key={chat.id}
              className={`${styles.chatItem} ${
                chat.id === activeChatId ? styles.active : ""
              }`}
              onClick={() => handleChatClick(chat.id)}
              onDoubleClick={() => handleChatDoubleClick(chat.id, chat.title)}
            >
              <div className={styles.chatInfo}>
                {editingId === chat.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={handleTitleChange}
                    onBlur={() => handleTitleBlur(chat.id)}
                    onKeyDown={(e) => handleTitleKeyDown(e, chat.id)}
                    className={styles.chatTitleInput}
                    autoFocus
                  />
                ) : (
                  <div className={styles.chatTitle}>{chat.title}</div>
                )}
                <div className={styles.chatDate}>
                  {new Date(chat.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className={styles.chatActions}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTitle(chat.id, chat.title);
                  }}
                  className={styles.chatActionButton}
                  title="Edit Title"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveChat(chat.id);
                  }}
                  className={styles.chatActionButton}
                  title="Save Chat to localStorage"
                >
                  💾
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChat(chat.id);
                  }}
                  className={styles.chatActionButton}
                  title="Delete Chat"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Main content area */}
      <div className={styles.mainContent}>
        {activeChat ? (
          <Chat
            messages={activeChat.messages}
            setMessages={handleUpdateMessages}
            title={activeChat.title}
            chatId={activeChat.id}
          />
        ) : (
          <div className={styles.placeholder}>
            <div>
              <div className={styles.placeholderIcon}>💬</div>
              {t(
                "app.selectChat",
                "Select a chat or create a new one to get started"
              )}
            </div>
          </div>
        )}
      </div>

      {/* Workflow Visualization Modal */}
      {showWorkflow && (
        <WorkflowVisualization
          isOpen={showWorkflow}
          onClose={() => setShowWorkflow(false)}
        />
      )}

      {/* System Prompt Editor Modal */}
      {showSystemPrompt && (
        <SystemPromptEditor
          isOpen={showSystemPrompt}
          onClose={() => setShowSystemPrompt(false)}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default App;
