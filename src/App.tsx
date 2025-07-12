import React, { useState, useEffect, useRef } from "react";
import Chat from "./Chat";

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

  // Load chats from localStorage on mount
  useEffect(() => {
    if (didLoadChats.current) return;
    didLoadChats.current = true;
    // Only load chats if state is empty (prevents double-invocation from StrictMode)
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      let parsed: ChatSession[] = [];
      try {
        parsed = JSON.parse(stored);
        parsed = parsed.map((chat) => ({
          ...chat,
          messages: Array.isArray(chat.messages) ? chat.messages : [],
          title: typeof chat.title === "string" ? chat.title : "Untitled Chat",
        }));
        console.log("Loaded and migrated chats from localStorage:", parsed);
      } catch {
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
    // eslint-disable-next-line
  }, []);

  // Persist chats to localStorage on change
  useEffect(() => {
    console.log("Saving chats to localStorage:", chats);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chats));
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
      setActiveChatId(remaining[0]?.id || null);
    }
  };

  const handleEditTitle = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.target.value);
  };

  const handleTitleBlur = (id: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? { ...chat, title: editTitle.trim() || "Untitled Chat" }
          : chat
      )
    );
    setEditingId(null);
    setEditTitle("");
  };

  const handleTitleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string
  ) => {
    if (e.key === "Enter") {
      handleTitleBlur(id);
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
    // Only run when messages change
    // eslint-disable-next-line
  }, [activeChat?.messages]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar for chat archive */}
      <div
        style={{
          width: 260,
          borderRight: "1px solid #ccc",
          padding: 16,
          background: "#f9f9f9",
        }}
      >
        <button
          onClick={handleNewChat}
          style={{
            width: "100%",
            marginBottom: 16,
            padding: 8,
            borderRadius: 8,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 16,
          }}
        >
          <span role="img" aria-label="new">
            🆕
          </span>{" "}
          New Chat
        </button>
        <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 18 }}>
          Chats
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {chats.map((chat) => (
            <li
              key={chat.id}
              style={{
                marginBottom: 10,
                display: "flex",
                alignItems: "stretch",
                gap: 4,
              }}
            >
              <div
                onClick={() => handleSelectChat(chat.id)}
                style={{
                  flex: 1,
                  minWidth: 0, // Allow flex item to shrink below content size
                  padding: 8,
                  borderRadius: 8,
                  border:
                    chat.id === activeChatId
                      ? "2px solid #1976d2"
                      : "1px solid #ccc",
                  background: chat.id === activeChatId ? "#e3f2fd" : "#fff",
                  color: "#333",
                  cursor: "pointer",
                  fontWeight: chat.id === activeChatId ? "bold" : "normal",
                  fontSize: 15,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
                title={chat.title}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    minWidth: 0,
                  }}
                >
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
                      style={{
                        fontSize: 14,
                        flex: 1,
                        minWidth: 0,
                        border: "1px solid #1976d2",
                        borderRadius: 4,
                        padding: "2px 4px",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 14,
                        lineHeight: "1.2",
                      }}
                    >
                      {chat.title}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#888",
                    alignSelf: "flex-end",
                  }}
                >
                  {new Date(chat.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: "auto",
                }}
              >
                <button
                  onClick={() => handleEditTitle(chat.id, chat.title)}
                  style={{
                    background: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "4px 6px",
                    height: "auto",
                    minHeight: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Rename Chat"
                >
                  <span role="img" aria-label="edit">
                    ✏️
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteChat(chat.id)}
                  style={{
                    background: "#ffe6e6",
                    border: "1px solid #ffcccc",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "4px 6px",
                    height: "auto",
                    minHeight: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
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
      <div style={{ flex: 1 }}>
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
