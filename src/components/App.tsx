import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Chat from "./Chat/Chat";
import ChatPreview from "./ChatPreview/ChatPreview";
import ShareDialog from "./ShareDialog/ShareDialog";
import TeamWorkspaceManager from "./TeamWorkspace/TeamWorkspace";
import LanguageSelector from "./LanguageSelector";
import ThemeToggle from "./ThemeToggle";
import WorkflowVisualization from "./WorkflowVisualization";
import SystemPromptEditor from "./SystemPromptEditor";
import { ToastContainer } from "./Toast";
import { useToast } from "../hooks/useToast";
import { useChatCategories } from "../hooks/useChatCategories";
import { useCollaboration } from "../hooks/useCollaboration";
import { useTeamWorkspace } from "../hooks/useTeamWorkspace";
import { getLanguageStorageKey } from "../i18n/i18n";
import { Message } from "../services/chatService";
import { ChatSession } from "../types/chat";
import styles from "./App.module.css";

const LOCAL_STORAGE_KEY = "mcpChats";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper function to create a new ChatSession with all required properties
function createNewChatSession(
  overrides: Partial<ChatSession> = {}
): ChatSession {
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    isStarred: false,
    messageCount: 0,
    hasDataExports: false,
    hasCharts: false,
    isShared: false,
    collaborators: [],
    comments: [],
    shareLinks: [],
    ...overrides,
  };
}

// Helper function to ensure imported chat has all required properties
function normalizeImportedChat(partialChat: any): ChatSession {
  return {
    id: partialChat.id || generateId(),
    title: partialChat.title || "Imported Chat",
    messages: partialChat.messages || [],
    createdAt: partialChat.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: partialChat.tags || [],
    isStarred: partialChat.isStarred || false,
    messageCount: partialChat.messageCount || partialChat.messages?.length || 0,
    hasDataExports: partialChat.hasDataExports || false,
    hasCharts: partialChat.hasCharts || false,
    category: partialChat.category,
    chatType: partialChat.chatType,
    lastActivity: partialChat.lastActivity,
  };
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
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showTeamWorkspace, setShowTeamWorkspace] = useState(false);
  const [chatToShare, setChatToShare] = useState<ChatSession | null>(null);
  const didLoadChats = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Collaboration hooks
  const collaboration = useCollaboration();
  const teamWorkspace = useTeamWorkspace();

  // Get current language storage key
  const getCurrentStorageKey = () =>
    getLanguageStorageKey(LOCAL_STORAGE_KEY, i18n.language);

  // Auto-save chats to localStorage
  const saveChatsToStorage = (chatsToSave: ChatSession[]) => {
    if (!i18n.language || !i18n.isInitialized) {
      console.log("⏳ Cannot auto-save - i18n not ready");
      return;
    }

    try {
      const storageKey = getCurrentStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(chatsToSave));
      console.log("💾 Auto-saved chats to localStorage:", {
        key: storageKey,
        count: chatsToSave.length,
      });
    } catch (error) {
      console.error("❌ Error auto-saving chats:", error);
    }
  };

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

              // Filter out any invalid chats and normalize them
              const validChats = parsed
                .filter(
                  (chat) =>
                    chat.id &&
                    chat.title &&
                    Array.isArray(chat.messages) &&
                    chat.createdAt
                )
                .map((chat) => normalizeImportedChat(chat));

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
              importedChat = normalizeImportedChat({
                ...parsed,
                id: generateId(), // Generate new ID to avoid conflicts
              });
            } else if (
              Array.isArray(parsed) &&
              parsed.length > 0 &&
              parsed[0].id
            ) {
              // Multiple chats export - import first one
              importedChat = normalizeImportedChat({
                ...parsed[0],
                id: generateId(),
              });
            }
          } catch (e) {
            console.error("❌ Error parsing JSON:", e);
          }
        } else if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
          // Convert text/markdown to chat format
          importedChat = createNewChatSession({
            title: `Imported: ${file.name}`,
            messages: [
              {
                sender: "system",
                text: `📎 Imported from ${file.name}:\n\n${text}`,
              },
            ],
          });
        }

        if (importedChat) {
          const updatedChats = [importedChat, ...chats];
          setChats(updatedChats);
          setActiveChatId(importedChat.id);

          // Auto-save the imported chat
          saveChatsToStorage(updatedChats);

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
    const newChat = createNewChatSession();

    const updatedChats = [newChat, ...chats];
    setChats(updatedChats);
    setActiveChatId(newChat.id);

    // Auto-save the new chat
    saveChatsToStorage(updatedChats);

    showInfo("New chat created!");
  }; // Manual save function (now mainly for user feedback, since auto-save is enabled)
  const handleSaveChat = (chatId: string) => {
    if (!i18n.language || !i18n.isInitialized) {
      showWarning("Cannot save - system not ready. Please try again.");
      return;
    }

    try {
      const chatToSave = chats.find((chat) => chat.id === chatId);

      if (!chatToSave) {
        showError("Chat not found for saving. Please try again.");
        return;
      }

      // Use the auto-save function
      saveChatsToStorage(chats);

      console.log("💾 Manual save triggered for chat:", chatToSave.title);
      showSuccess(`"${chatToSave.title}" is saved (auto-save is enabled)!`);
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

    const updatedChats = chats.map((chat) =>
      chat.id === activeChatId
        ? {
            ...chat,
            messages: newMessages,
            updatedAt: new Date().toISOString(),
            messageCount: newMessages.length,
            hasDataExports: newMessages.some(
              (m) => m.tableData && m.tableData.length > 0
            ),
            hasCharts: newMessages.some(
              (m) =>
                m.tableData &&
                m.tableData.length > 0 &&
                m.traceData?.mcpResponse?.data
            ),
            lastActivity: new Date().toISOString(),
          }
        : chat
    );

    setChats(updatedChats);

    // Auto-save after message updates
    saveChatsToStorage(updatedChats);
  };

  const handleDeleteChat = (chatId: string) => {
    const chatToDelete = chats.find((chat) => chat.id === chatId);
    const updatedChats = chats.filter((chat) => chat.id !== chatId);

    setChats(updatedChats);

    // Auto-save after deletion
    saveChatsToStorage(updatedChats);

    if (activeChatId === chatId) {
      setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    }

    if (chatToDelete) {
      showInfo(`Deleted "${chatToDelete.title}" successfully!`);
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
      const updatedChats = chats.map((chat) =>
        chat.id === id ? { ...chat, title: editTitle.trim() } : chat
      );
      setChats(updatedChats);

      // Auto-save after title change
      saveChatsToStorage(updatedChats);

      showInfo("Chat title updated!");
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
    const updatedChats = chats.map((chat) => {
      if (
        chat.title === "New Chat" &&
        chat.messages.length > 0 &&
        chat.messages[0].text
      ) {
        return { ...chat, title: chat.messages[0].text.slice(0, 50) };
      }
      return chat;
    });

    // Only update if there were actual changes
    const hasChanges = updatedChats.some(
      (chat, index) => chat.title !== chats[index]?.title
    );

    if (hasChanges) {
      setChats(updatedChats);
      // Auto-save after auto-title updates
      saveChatsToStorage(updatedChats);
    }
  }, [activeChat?.messages]);

  // Handle language change - will trigger useEffect to load language-specific chats
  const handleLanguageChange = (newLanguage: string) => {
    console.log(`Language changed to: ${newLanguage}`);
    // The useEffect with i18n.language dependency will handle loading the appropriate chats
  };

  // Handle starring/favoriting chats
  const handleStarChat = (chatId: string) => {
    const updatedChats = chats.map((chat) =>
      chat.id === chatId ? { ...chat, isStarred: !chat.isStarred } : chat
    );
    setChats(updatedChats);
    saveChatsToStorage(updatedChats);

    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      showInfo(
        chat.isStarred ? "Removed from favorites" : "Added to favorites"
      );
    }
  };

  // Handle categorizing chats
  const handleCategorizeChat = (chatId: string, category: string) => {
    const updatedChats = chats.map((chat) =>
      chat.id === chatId ? { ...chat, category: category || undefined } : chat
    );
    setChats(updatedChats);
    saveChatsToStorage(updatedChats);

    showInfo(category ? `Categorized as "${category}"` : "Category removed");
  };

  // Handle sharing chats
  const handleShareChat = (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      setChatToShare(chat);
      setShowShareDialog(true);
    }
  };

  // Handle chat updates from share dialog
  const handleChatUpdate = (updatedChat: ChatSession) => {
    const updatedChats = chats.map((chat) =>
      chat.id === updatedChat.id ? updatedChat : chat
    );
    setChats(updatedChats);
    saveChatsToStorage(updatedChats);
  };

  // Handle sharing chat to workspace
  const handleShareChatToWorkspace = (chatId: string, workspaceId: string) => {
    teamWorkspace.shareChatToWorkspace(workspaceId, chatId);

    // Update the chat to mark it as shared to workspace
    const updatedChats = chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            workspaceId,
            isShared: true,
            updatedAt: new Date().toISOString(),
          }
        : chat
    );
    setChats(updatedChats);
    saveChatsToStorage(updatedChats);
  };

  return (
    <div className={styles.appContainer}>
      {/* Sidebar for chat archive */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.topRow}>
            <button
              onClick={handleNewChat}
              className={`${styles.newChatButton} newChatButton`}
            >
              <span role="img" aria-label="new">
                🆕
              </span>{" "}
              {t("app.newChat", "New Chat")}
            </button>
            <LanguageSelector onLanguageChange={handleLanguageChange} />
          </div>
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
            <button
              onClick={() => setShowTeamWorkspace(true)}
              className={styles.systemPromptButton}
              title="Team Workspaces"
            >
              👥
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className={styles.sidebarTitle}>{t("app.chats", "Chats")}</div>
        <div className={styles.chatList}>
          {chats.map((chat) => (
            <ChatPreview
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              isEditing={editingId === chat.id}
              onSelect={handleChatClick}
              onDoubleClick={handleChatDoubleClick}
              onStar={handleStarChat}
              onCategorize={handleCategorizeChat}
              onDelete={handleDeleteChat}
              onSave={handleSaveChat}
              onEditTitle={handleEditTitle}
              onShare={handleShareChat}
              editTitle={editTitle}
              onTitleChange={handleTitleChange}
              onTitleBlur={handleTitleBlur}
              onTitleKeyDown={handleTitleKeyDown}
            />
          ))}
        </div>
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

      {/* Share Dialog Modal */}
      {showShareDialog && chatToShare && (
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => {
            setShowShareDialog(false);
            setChatToShare(null);
          }}
          chat={chatToShare}
          onChatUpdate={handleChatUpdate}
        />
      )}

      {/* Team Workspace Manager Modal */}
      {showTeamWorkspace && (
        <TeamWorkspaceManager
          isOpen={showTeamWorkspace}
          onClose={() => setShowTeamWorkspace(false)}
          allChats={chats}
          onShareChatToWorkspace={handleShareChatToWorkspace}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default App;
