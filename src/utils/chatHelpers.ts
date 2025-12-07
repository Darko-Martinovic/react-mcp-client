import { ChatSession } from "../../types/chat";

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function createNewChatSession(
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

export function normalizeImportedChat(partialChat: any): ChatSession {
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
