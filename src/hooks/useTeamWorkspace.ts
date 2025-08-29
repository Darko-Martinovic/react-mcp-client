import { useState, useCallback, useEffect } from "react";
import {
  TeamWorkspace,
  Collaborator,
  SharePermission,
  ChatSession,
} from "../types/chat";
import { useToast } from "./useToast";

// Mock current user - in real app this would come from auth
const getCurrentUser = () => ({
  id: "user-" + Date.now(),
  name: "Current User",
  email: "user@example.com",
});

export const useTeamWorkspace = () => {
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<TeamWorkspace | null>(
    null
  );
  const { showSuccess, showError, showInfo } = useToast();

  // Load workspaces from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("mcpTeamWorkspaces");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setWorkspaces(parsed);

        // Set first workspace as active if none selected
        if (parsed.length > 0 && !activeWorkspace) {
          setActiveWorkspace(parsed[0]);
        }
      } catch (e) {
        console.warn("Failed to load team workspaces");
      }
    }
  }, [activeWorkspace]);

  // Save workspaces to localStorage
  const saveWorkspaces = useCallback((updatedWorkspaces: TeamWorkspace[]) => {
    localStorage.setItem(
      "mcpTeamWorkspaces",
      JSON.stringify(updatedWorkspaces)
    );
    setWorkspaces(updatedWorkspaces);
  }, []);

  // Create new workspace
  const createWorkspace = useCallback(
    (
      name: string,
      description?: string,
      defaultPermission: SharePermission = "read"
    ) => {
      const currentUser = getCurrentUser();

      const workspace: TeamWorkspace = {
        id: "workspace-" + Date.now().toString(36),
        name,
        description,
        ownerId: currentUser.id,
        members: [
          {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            permission: "edit" as SharePermission,
            joinedAt: new Date().toISOString(),
          },
        ],
        sharedChats: [],
        createdAt: new Date().toISOString(),
        settings: {
          defaultPermission,
          allowGuestAccess: true,
          requireApproval: false,
        },
      };

      const updatedWorkspaces = [...workspaces, workspace];
      saveWorkspaces(updatedWorkspaces);
      setActiveWorkspace(workspace);

      showSuccess(`Workspace "${name}" created successfully!`);
      return workspace;
    },
    [workspaces, saveWorkspaces, showSuccess]
  );

  // Delete workspace
  const deleteWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return;

      const currentUser = getCurrentUser();
      if (workspace.ownerId !== currentUser.id) {
        showError("Only workspace owner can delete the workspace");
        return;
      }

      const updatedWorkspaces = workspaces.filter((w) => w.id !== workspaceId);
      saveWorkspaces(updatedWorkspaces);

      // If deleted workspace was active, switch to first available or null
      if (activeWorkspace?.id === workspaceId) {
        setActiveWorkspace(
          updatedWorkspaces.length > 0 ? updatedWorkspaces[0] : null
        );
      }

      showSuccess(`Workspace "${workspace.name}" deleted`);
    },
    [workspaces, saveWorkspaces, activeWorkspace, showSuccess, showError]
  );

  // Add member to workspace
  const addMemberToWorkspace = useCallback(
    (
      workspaceId: string,
      email: string,
      permission: SharePermission = "read"
    ) => {
      const updatedWorkspaces = workspaces.map((workspace) => {
        if (workspace.id === workspaceId) {
          // Check if member already exists
          if (workspace.members.some((m) => m.email === email)) {
            showError("User is already a member of this workspace");
            return workspace;
          }

          const newMember: Collaborator = {
            id: "member-" + Date.now().toString(36),
            name: email.split("@")[0],
            email,
            permission,
            joinedAt: new Date().toISOString(),
          };

          return {
            ...workspace,
            members: [...workspace.members, newMember],
          };
        }
        return workspace;
      });

      saveWorkspaces(updatedWorkspaces);

      // Update active workspace if it was modified
      if (activeWorkspace?.id === workspaceId) {
        const updatedActiveWorkspace = updatedWorkspaces.find(
          (w) => w.id === workspaceId
        );
        if (updatedActiveWorkspace) {
          setActiveWorkspace(updatedActiveWorkspace);
        }
      }

      showSuccess(`Added ${email} to workspace`);
    },
    [workspaces, saveWorkspaces, activeWorkspace, showSuccess, showError]
  );

  // Remove member from workspace
  const removeMemberFromWorkspace = useCallback(
    (workspaceId: string, memberId: string) => {
      const updatedWorkspaces = workspaces.map((workspace) => {
        if (workspace.id === workspaceId) {
          // Don't allow removing the owner
          const memberToRemove = workspace.members.find(
            (m) => m.id === memberId
          );
          if (memberToRemove?.id === workspace.ownerId) {
            showError("Cannot remove workspace owner");
            return workspace;
          }

          return {
            ...workspace,
            members: workspace.members.filter((m) => m.id !== memberId),
          };
        }
        return workspace;
      });

      saveWorkspaces(updatedWorkspaces);

      // Update active workspace if it was modified
      if (activeWorkspace?.id === workspaceId) {
        const updatedActiveWorkspace = updatedWorkspaces.find(
          (w) => w.id === workspaceId
        );
        if (updatedActiveWorkspace) {
          setActiveWorkspace(updatedActiveWorkspace);
        }
      }

      showSuccess("Member removed from workspace");
    },
    [workspaces, saveWorkspaces, activeWorkspace, showSuccess, showError]
  );

  // Share chat to workspace
  const shareChatToWorkspace = useCallback(
    (workspaceId: string, chatId: string) => {
      const updatedWorkspaces = workspaces.map((workspace) => {
        if (workspace.id === workspaceId) {
          if (workspace.sharedChats.includes(chatId)) {
            showInfo("Chat is already shared to this workspace");
            return workspace;
          }

          return {
            ...workspace,
            sharedChats: [...workspace.sharedChats, chatId],
          };
        }
        return workspace;
      });

      saveWorkspaces(updatedWorkspaces);

      // Update active workspace if it was modified
      if (activeWorkspace?.id === workspaceId) {
        const updatedActiveWorkspace = updatedWorkspaces.find(
          (w) => w.id === workspaceId
        );
        if (updatedActiveWorkspace) {
          setActiveWorkspace(updatedActiveWorkspace);
        }
      }

      showSuccess("Chat shared to workspace");
    },
    [workspaces, saveWorkspaces, activeWorkspace, showSuccess, showInfo]
  );

  // Remove chat from workspace
  const removeChatFromWorkspace = useCallback(
    (workspaceId: string, chatId: string) => {
      const updatedWorkspaces = workspaces.map((workspace) => {
        if (workspace.id === workspaceId) {
          return {
            ...workspace,
            sharedChats: workspace.sharedChats.filter((id) => id !== chatId),
          };
        }
        return workspace;
      });

      saveWorkspaces(updatedWorkspaces);

      // Update active workspace if it was modified
      if (activeWorkspace?.id === workspaceId) {
        const updatedActiveWorkspace = updatedWorkspaces.find(
          (w) => w.id === workspaceId
        );
        if (updatedActiveWorkspace) {
          setActiveWorkspace(updatedActiveWorkspace);
        }
      }

      showSuccess("Chat removed from workspace");
    },
    [workspaces, saveWorkspaces, activeWorkspace, showSuccess]
  );

  // Update workspace settings
  const updateWorkspaceSettings = useCallback(
    (workspaceId: string, settings: Partial<TeamWorkspace["settings"]>) => {
      const updatedWorkspaces = workspaces.map((workspace) => {
        if (workspace.id === workspaceId) {
          return {
            ...workspace,
            settings: { ...workspace.settings, ...settings },
          };
        }
        return workspace;
      });

      saveWorkspaces(updatedWorkspaces);

      // Update active workspace if it was modified
      if (activeWorkspace?.id === workspaceId) {
        const updatedActiveWorkspace = updatedWorkspaces.find(
          (w) => w.id === workspaceId
        );
        if (updatedActiveWorkspace) {
          setActiveWorkspace(updatedActiveWorkspace);
        }
      }

      showSuccess("Workspace settings updated");
    },
    [workspaces, saveWorkspaces, activeWorkspace, showSuccess]
  );

  // Get workspace chats (filter shared chats)
  const getWorkspaceChats = useCallback(
    (allChats: ChatSession[], workspaceId?: string): ChatSession[] => {
      const workspace = workspaceId
        ? workspaces.find((w) => w.id === workspaceId)
        : activeWorkspace;

      if (!workspace) return [];

      return allChats.filter(
        (chat) =>
          workspace.sharedChats.includes(chat.id) ||
          chat.workspaceId === workspace.id
      );
    },
    [workspaces, activeWorkspace]
  );

  return {
    // State
    workspaces,
    activeWorkspace,
    setActiveWorkspace,

    // Workspace management
    createWorkspace,
    deleteWorkspace,
    updateWorkspaceSettings,

    // Member management
    addMemberToWorkspace,
    removeMemberFromWorkspace,

    // Chat sharing
    shareChatToWorkspace,
    removeChatFromWorkspace,
    getWorkspaceChats,

    // Utilities
    saveWorkspaces,
  };
};
