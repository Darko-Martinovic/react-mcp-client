import { useState, useCallback, useEffect } from "react";
import {
  ChatSession,
  Collaborator,
  SharePermission,
  ShareLink,
  ChatComment,
} from "../types/chat";
import { useToast } from "./useToast";

// Mock user data - in a real app this would come from authentication
const getCurrentUser = () => ({
  id: "user-" + Date.now(),
  name: "Current User",
  email: "user@example.com",
});

export const useCollaboration = () => {
  const [sharedChats, setSharedChats] = useState<ChatSession[]>([]);
  const [activeShareLinks, setActiveShareLinks] = useState<ShareLink[]>([]);
  const { showSuccess, showError, showInfo } = useToast();

  // Load shared chats from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("mcpSharedChats");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSharedChats(parsed);
      } catch (e) {
        console.warn("Failed to load shared chats");
      }
    }

    const storedLinks = localStorage.getItem("mcpShareLinks");
    if (storedLinks) {
      try {
        const parsed = JSON.parse(storedLinks);
        setActiveShareLinks(parsed);
      } catch (e) {
        console.warn("Failed to load share links");
      }
    }
  }, []);

  // Save to localStorage
  const saveSharedChats = useCallback((chats: ChatSession[]) => {
    localStorage.setItem("mcpSharedChats", JSON.stringify(chats));
    setSharedChats(chats);
  }, []);

  const saveShareLinks = useCallback((links: ShareLink[]) => {
    localStorage.setItem("mcpShareLinks", JSON.stringify(links));
    setActiveShareLinks(links);
  }, []);

  // Create a shareable link for a chat
  const createShareLink = useCallback(
    (
      chatId: string,
      permission: SharePermission = "read",
      expiresInDays?: number
    ): string => {
      const currentUser = getCurrentUser();
      const shareId =
        "share-" +
        Date.now().toString(36) +
        Math.random().toString(36).substr(2);

      const shareLink: ShareLink = {
        id: shareId,
        chatId,
        permission,
        expiresAt: expiresInDays
          ? new Date(
              Date.now() + expiresInDays * 24 * 60 * 60 * 1000
            ).toISOString()
          : undefined,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        isActive: true,
        accessCount: 0,
      };

      const updatedLinks = [...activeShareLinks, shareLink];
      saveShareLinks(updatedLinks);

      const shareUrl = `${window.location.origin}/shared/${shareId}`;
      showSuccess(`Share link created! Link copied to clipboard.`);

      // Copy to clipboard
      navigator.clipboard.writeText(shareUrl).catch(() => {
        showInfo(`Share link: ${shareUrl}`);
      });

      return shareUrl;
    },
    [activeShareLinks, saveShareLinks, showSuccess, showInfo]
  );

  // Add collaborator to a chat
  const addCollaborator = useCallback(
    (chatId: string, email: string, permission: SharePermission = "read") => {
      const currentUser = getCurrentUser();

      const collaborator: Collaborator = {
        id: "collab-" + Date.now().toString(36),
        name: email.split("@")[0], // Simple name extraction
        email,
        permission,
        joinedAt: new Date().toISOString(),
      };

      const updatedChats = sharedChats.map((chat) => {
        if (chat.id === chatId) {
          const existingCollaborators = chat.collaborators || [];
          if (existingCollaborators.some((c) => c.email === email)) {
            showError("User is already a collaborator");
            return chat;
          }

          return {
            ...chat,
            isShared: true,
            collaborators: [...existingCollaborators, collaborator],
            updatedAt: new Date().toISOString(),
          };
        }
        return chat;
      });

      saveSharedChats(updatedChats);
      showSuccess(`Added ${email} as ${permission} collaborator`);
    },
    [sharedChats, saveSharedChats, showSuccess, showError]
  );

  // Remove collaborator
  const removeCollaborator = useCallback(
    (chatId: string, collaboratorId: string) => {
      const updatedChats = sharedChats.map((chat) => {
        if (chat.id === chatId) {
          const updatedCollaborators = (chat.collaborators || []).filter(
            (c) => c.id !== collaboratorId
          );
          return {
            ...chat,
            collaborators: updatedCollaborators,
            isShared: updatedCollaborators.length > 0,
            updatedAt: new Date().toISOString(),
          };
        }
        return chat;
      });

      saveSharedChats(updatedChats);
      showSuccess("Collaborator removed");
    },
    [sharedChats, saveSharedChats, showSuccess]
  );

  // Update collaborator permission
  const updateCollaboratorPermission = useCallback(
    (
      chatId: string,
      collaboratorId: string,
      newPermission: SharePermission
    ) => {
      const updatedChats = sharedChats.map((chat) => {
        if (chat.id === chatId) {
          const updatedCollaborators = (chat.collaborators || []).map((c) =>
            c.id === collaboratorId ? { ...c, permission: newPermission } : c
          );
          return {
            ...chat,
            collaborators: updatedCollaborators,
            updatedAt: new Date().toISOString(),
          };
        }
        return chat;
      });

      saveSharedChats(updatedChats);
      showSuccess("Permission updated");
    },
    [sharedChats, saveSharedChats, showSuccess]
  );

  // Add comment to chat
  const addComment = useCallback(
    (
      chatId: string,
      content: string,
      messageId?: string,
      parentCommentId?: string
    ) => {
      const currentUser = getCurrentUser();

      const comment: ChatComment = {
        id: "comment-" + Date.now().toString(36),
        authorId: currentUser.id,
        authorName: currentUser.name,
        messageId,
        content,
        createdAt: new Date().toISOString(),
        isResolved: false,
        parentCommentId,
      };

      const updatedChats = sharedChats.map((chat) => {
        if (chat.id === chatId) {
          const existingComments = chat.comments || [];
          return {
            ...chat,
            comments: [...existingComments, comment],
            updatedAt: new Date().toISOString(),
          };
        }
        return chat;
      });

      saveSharedChats(updatedChats);
      showSuccess("Comment added");
      return comment.id;
    },
    [sharedChats, saveSharedChats, showSuccess]
  );

  // Resolve/unresolve comment
  const toggleCommentResolution = useCallback(
    (chatId: string, commentId: string) => {
      const updatedChats = sharedChats.map((chat) => {
        if (chat.id === chatId) {
          const updatedComments = (chat.comments || []).map((c) =>
            c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
          );
          return {
            ...chat,
            comments: updatedComments,
            updatedAt: new Date().toISOString(),
          };
        }
        return chat;
      });

      saveSharedChats(updatedChats);
    },
    [sharedChats, saveSharedChats]
  );

  // Get chat by share link
  const getChatByShareLink = useCallback(
    (shareId: string): ChatSession | null => {
      const shareLink = activeShareLinks.find(
        (link) => link.id === shareId && link.isActive
      );
      if (!shareLink) return null;

      // Check if link is expired
      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        return null;
      }

      // Increment access count
      const updatedLinks = activeShareLinks.map((link) =>
        link.id === shareId
          ? { ...link, accessCount: link.accessCount + 1 }
          : link
      );
      saveShareLinks(updatedLinks);

      return sharedChats.find((chat) => chat.id === shareLink.chatId) || null;
    },
    [activeShareLinks, sharedChats, saveShareLinks]
  );

  // Revoke share link
  const revokeShareLink = useCallback(
    (shareId: string) => {
      const updatedLinks = activeShareLinks.map((link) =>
        link.id === shareId ? { ...link, isActive: false } : link
      );
      saveShareLinks(updatedLinks);
      showSuccess("Share link revoked");
    },
    [activeShareLinks, saveShareLinks, showSuccess]
  );

  return {
    // State
    sharedChats,
    activeShareLinks,

    // Share management
    createShareLink,
    revokeShareLink,
    getChatByShareLink,

    // Collaborator management
    addCollaborator,
    removeCollaborator,
    updateCollaboratorPermission,

    // Comment management
    addComment,
    toggleCommentResolution,

    // Utilities
    saveSharedChats,
  };
};
