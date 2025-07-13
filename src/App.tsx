import React, { useState, useEffect, useRef } from "react";
import Chat from "./Chat";
import "./App.css";

interface Message {
  sender: "user" | "system";
  text?: string;
  tableData?: Record<string, unknown>[];
  toolName?: string;
}

interface ChatSession {
  id: string;
  createdAt: string;
  messages: Message[];
  title: string;
}

const LOCAL_STORAGE_KEY = "mcpChats";

function generateId() {
  return Date.now().toString();
}

const App: React.FC = () => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const didLoadChats = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load chats from localStorage on mount
  useEffect(() => {
    if (didLoadChats.current) return;
    didLoadChats.current = true;

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        let parsed: ChatSession[] = [];
        try {
          parsed = JSON.parse(stored);
          parsed = parsed.map((chat) => ({
            ...chat,
            messages: Array.isArray(chat.messages) ? chat.messages : [],
            title:
              typeof chat.title === "string" ? chat.title : "Untitled Chat",
          }));
          console.log("Loaded and migrated chats from localStorage:", parsed);
        } catch (parseError) {
          console.error("Error parsing stored chats:", parseError);
          parsed = [];
        }

        if (parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
        } else {
          const newChat: ChatSession = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            messages: [],
            title: "New Chat",
          };
          setChats([newChat]);
          setActiveChatId(newChat.id);
        }
      } else {
        const newChat: ChatSession = {
          id: generateId(),
          createdAt: new Date().toISOString(),
          messages: [],
          title: "New Chat",
        };
        setChats([newChat]);
        setActiveChatId(newChat.id);
      }
    } catch (error) {
      console.error("Error loading chats from localStorage:", error);
      // Fallback: create a new chat
      const newChat: ChatSession = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        messages: [],
        title: "New Chat",
      };
      setChats([newChat]);
      setActiveChatId(newChat.id);
    }
  }, []);

  // Persist chats to localStorage on change
  useEffect(() => {
    try {
      console.log("Saving chats to localStorage:", chats);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("Error saving chats to localStorage:", error);
    }
  }, [chats]);

  const activeChat = chats.find((c) => c.id === activeChatId);

  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      messages: [],
      title: "New Chat",
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
  };

  const handleUpdateMessages = (messages: Message[]) => {
    console.log("handleUpdateMessages called for chat", activeChatId, messages);
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId ? { ...chat, messages } : chat
      )
    );
  };

  const handleDeleteChat = (id: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
    if (activeChatId === id) {
      // If deleting the active chat, switch to the next available chat
      const remaining = chats.filter((chat) => chat.id !== id);
      setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleEditTitle = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  // Handle single click with delay to avoid conflict with double-click
  const handleChatClick = (id: string) => {
    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // Set a timeout to handle the single click after a short delay
    clickTimeoutRef.current = setTimeout(() => {
      handleSelectChat(id);
    }, 200); // 200ms delay
  };

  const handleChatDoubleClick = (id: string, title: string) => {
    // Clear the single click timeout since we're doing a double click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    handleEditTitle(id, title);
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

  return (
    <div className="app-container">
      {/* Sidebar for chat archive */}
      <div className="sidebar">
        <button onClick={handleNewChat} className="new-chat-button">
          <span role="img" aria-label="new">
            🆕
          </span>{" "}
          New Chat
        </button>
        <div className="sidebar-title">Chats</div>
        <ul className="chat-list">
          {chats.map((chat) => (
            <li key={chat.id} className="chat-list-item">
              <div
                onClick={() => handleChatClick(chat.id)}
                onDoubleClick={() => handleChatDoubleClick(chat.id, chat.title)}
                className={`chat-item ${
                  chat.id === activeChatId ? "chat-item--active" : ""
                }`}
                title={`${chat.title} (Double-click to edit)`}
              >
                <div className="chat-item-header">
                  <span role="img" aria-label="chat">
                    💬
                  </span>
                  {editingId === chat.id ? (
                    <input
                      value={editTitle}
                      onChange={handleTitleChange}
                      onBlur={() => handleTitleBlur(chat.id)}
                      onKeyDown={(e) => handleTitleKeyDown(e, chat.id)}
                      autoFocus
                      placeholder="Enter chat title"
                      className="chat-title-input"
                    />
                  ) : (
                    <span className="chat-item-title">{chat.title}</span>
                  )}
                </div>
                <span className="chat-item-date">
                  {new Date(chat.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="chat-actions">
                <button
                  onClick={() => handleEditTitle(chat.id, chat.title)}
                  className="action-button"
                  title="Rename Chat"
                >
                  <span role="img" aria-label="edit">
                    ✏️
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteChat(chat.id)}
                  className="action-button action-button--delete"
                  title="Delete Chat"
                >
                  <span role="img" aria-label="delete">
                    🗑️
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {/* Main chat area */}
      <div className="main-chat-area">
        {activeChat && (
          <Chat
            messages={activeChat.messages}
            setMessages={handleUpdateMessages}
            title={activeChat.title}
          />
        )}
      </div>
    </div>
  );
};

export default App;
