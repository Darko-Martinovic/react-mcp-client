import { Message } from "../services/chatService";

export type ChatType = "conversation" | "data-analysis" | "tool-usage";

export type SharePermission = "read" | "comment" | "edit";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  permission: SharePermission;
  joinedAt: string;
  lastActive?: string;
}

export interface ChatComment {
  id: string;
  authorId: string;
  authorName: string;
  messageId?: string; // If commenting on specific message
  content: string;
  createdAt: string;
  updatedAt?: string;
  isResolved: boolean;
  parentCommentId?: string; // For threaded comments
}

export interface ShareLink {
  id: string;
  chatId: string;
  permission: SharePermission;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
  accessCount: number;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: Collaborator[];
  sharedChats: string[]; // Chat IDs
  createdAt: string;
  settings: {
    defaultPermission: SharePermission;
    allowGuestAccess: boolean;
    requireApproval: boolean;
  };
}

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
  // Collaboration properties
  isShared?: boolean;
  collaborators?: Collaborator[];
  comments?: ChatComment[];
  shareLinks?: ShareLink[];
  workspaceId?: string;
  ownerId?: string;
  permissions?: SharePermission;
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
