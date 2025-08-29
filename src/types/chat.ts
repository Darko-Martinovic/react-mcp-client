import { Message } from "../services/chatService";

export type ChatType = "conversation" | "data-analysis" | "tool-usage";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt?: string;
  category?: string;
  tags: string[];
  isStarred: boolean;
  chatType?: ChatType;
  lastActivity?: string;
  messageCount: number;
  hasDataExports: boolean;
  hasCharts: boolean;
}

export interface ChatMetadata {
  chatType: ChatType;
  lastUserMessage?: Message;
  lastAIMessage?: Message;
  hasDataExports: boolean;
  hasCharts: boolean;
  toolsUsed: string[];
  keyTopics: string[];
  messagePreview: string;
}

export interface ChatStats {
  messageCount: number;
  toolsUsedCount: number;
  hasDataExports: boolean;
  hasCharts: boolean;
  lastActivity: string;
}
