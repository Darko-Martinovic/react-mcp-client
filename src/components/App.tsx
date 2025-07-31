import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Chat from "./Chat";
import LanguageSelector from "./LanguageSelector";
import WorkflowVisualization from "./WorkflowVisualization";
import { getLanguageStorageKey } from "../i18n/i18n";
import styles from "./App.module.css";

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

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showWorkflow, setShowWorkflow] = useState(false);
  const didLoadChats = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current language storage key
  const getCurrentStorageKey = () =>
    getLanguageStorageKey(LOCAL_STORAGE_KEY, i18n.language);

  // Load chats from localStorage on mount and when language changes
  useEffect(() => {
    const loadChats = () => {
      try {
        const storageKey = getCurrentStorageKey();
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          let parsed: ChatSession[] = [];
          try {
            parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
              console.warn("Invalid chat data format, starting fresh");
              parsed = [];
            }
          } catch (error) {
            console.error("Error parsing stored chats:", error);
            parsed = [];
          }
          setChats(parsed);
          if (parsed.length > 0) {
            setActiveChatId(parsed[0].id);
          } else {
            setActiveChatId(null);
          }
        } else {
          // No chats for this language, start fresh
          setChats([]);
          setActiveChatId(null);
        }
      } catch (error) {
        console.error("Error loading chats from localStorage:", error);
      }
    };

    loadChats();
  }, [i18n.language]);

  // Save chats to localStorage whenever chats change
  useEffect(() => {
    if (chats.length >= 0) {
      // Always save, even empty array
      try {
        const storageKey = getCurrentStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(chats));
      } catch (error) {
        console.error("Error saving chats to localStorage:", error);
      }
    }
  }, [chats, i18n.language]);

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
              onClick={() => setShowWorkflow(true)}
              className={styles.workflowButton}
              title={t("workflow.title", "System Workflow")}
            >
              ⚙️
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
    </div>
  );
};

export default App;
