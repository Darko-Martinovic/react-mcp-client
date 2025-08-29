import React, { useState } from "react";
import { TeamWorkspace, SharePermission, ChatSession } from "../../types/chat";
import { useTeamWorkspace } from "../../hooks/useTeamWorkspace";
import styles from "./TeamWorkspace.module.css";

interface TeamWorkspaceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  allChats: ChatSession[];
  onShareChatToWorkspace: (chatId: string, workspaceId: string) => void;
}

const TeamWorkspaceManager: React.FC<TeamWorkspaceManagerProps> = ({
  isOpen,
  onClose,
  allChats,
  onShareChatToWorkspace,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPermission, setNewMemberPermission] =
    useState<SharePermission>("read");

  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    createWorkspace,
    deleteWorkspace,
    addMemberToWorkspace,
    removeMemberFromWorkspace,
    removeChatFromWorkspace,
    getWorkspaceChats,
  } = useTeamWorkspace();

  if (!isOpen) return null;

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    createWorkspace(newWorkspaceName.trim(), newWorkspaceDescription.trim());
    setNewWorkspaceName("");
    setNewWorkspaceDescription("");
    setShowCreateForm(false);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !activeWorkspace) return;

    addMemberToWorkspace(
      activeWorkspace.id,
      newMemberEmail.trim(),
      newMemberPermission
    );
    setNewMemberEmail("");
  };

  const handleRemoveMember = (memberId: string) => {
    if (!activeWorkspace) return;
    removeMemberFromWorkspace(activeWorkspace.id, memberId);
  };

  const handleRemoveChatFromWorkspace = (chatId: string) => {
    if (!activeWorkspace) return;
    removeChatFromWorkspace(activeWorkspace.id, chatId);
  };

  const handleDeleteWorkspace = () => {
    if (!activeWorkspace) return;
    if (
      window.confirm(
        `Are you sure you want to delete workspace "${activeWorkspace.name}"?`
      )
    ) {
      deleteWorkspace(activeWorkspace.id);
    }
  };

  const getCurrentUser = () => ({
    id: "user-" + Date.now(),
    name: "Current User",
    email: "user@example.com",
  });

  const currentUser = getCurrentUser();
  const isWorkspaceOwner = activeWorkspace?.ownerId === currentUser.id;
  const workspaceChats = activeWorkspace ? getWorkspaceChats(allChats) : [];

  return (
    <div className={styles.workspaceManager} onClick={onClose}>
      <div
        className={styles.workspaceContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.workspaceHeader}>
          <h2 className={styles.workspaceTitle}>Team Workspaces</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        {/* Workspace Selector */}
        <div className={styles.workspaceSelector}>
          <span className={styles.currentWorkspace}>Current:</span>
          <select
            value={activeWorkspace?.id || ""}
            onChange={(e) => {
              const workspace = workspaces.find((w) => w.id === e.target.value);
              setActiveWorkspace(workspace || null);
            }}
            className={styles.workspaceSelect}
          >
            <option value="">Select a workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateForm(true)}
            className={styles.createWorkspaceButton}
          >
            New Workspace
          </button>
        </div>

        {/* Create Workspace Form */}
        {showCreateForm && (
          <div className={styles.workspaceSection}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>➕</span>
              Create New Workspace
            </h3>
            <form
              onSubmit={handleCreateWorkspace}
              className={styles.createWorkspaceForm}
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className={styles.formInput}
                  placeholder="Enter workspace name"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Description (Optional)
                </label>
                <textarea
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  className={styles.formTextarea}
                  placeholder="Describe what this workspace is for"
                />
              </div>
              <div className={styles.formButtons}>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton}>
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Workspace Info */}
        {activeWorkspace && (
          <>
            <div className={styles.workspaceInfo}>
              <div className={styles.workspaceName}>{activeWorkspace.name}</div>
              {activeWorkspace.description && (
                <div className={styles.workspaceDescription}>
                  {activeWorkspace.description}
                </div>
              )}
              <div className={styles.workspaceStats}>
                <span>{activeWorkspace.members.length} members</span>
                <span>{workspaceChats.length} shared chats</span>
                <span>
                  Created{" "}
                  {new Date(activeWorkspace.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Members Section */}
            <div className={styles.workspaceSection}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>👥</span>
                Members
              </h3>

              {isWorkspaceOwner && (
                <form
                  onSubmit={handleAddMember}
                  className={styles.addMemberForm}
                >
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className={styles.emailInput}
                    required
                  />
                  <select
                    value={newMemberPermission}
                    onChange={(e) =>
                      setNewMemberPermission(e.target.value as SharePermission)
                    }
                    className={styles.permissionSelect}
                  >
                    <option value="read">Read Only</option>
                    <option value="comment">Can Comment</option>
                    <option value="edit">Can Edit</option>
                  </select>
                  <button
                    type="submit"
                    className={styles.addButton}
                    disabled={!newMemberEmail.trim()}
                  >
                    Add
                  </button>
                </form>
              )}

              <ul className={styles.membersList}>
                {activeWorkspace.members.map((member) => (
                  <li key={member.id} className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{member.name}</div>
                      <div className={styles.memberEmail}>{member.email}</div>
                    </div>
                    <div className={styles.memberActions}>
                      {member.id === activeWorkspace.ownerId ? (
                        <span className={styles.ownerBadge}>Owner</span>
                      ) : (
                        <span className={styles.permissionBadge}>
                          {member.permission}
                        </span>
                      )}
                      {isWorkspaceOwner &&
                        member.id !== activeWorkspace.ownerId && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className={styles.removeButton}
                            title="Remove member"
                          >
                            🗑️
                          </button>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Shared Chats Section */}
            <div className={styles.workspaceSection}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>💬</span>
                Shared Chats
              </h3>

              {workspaceChats.length > 0 ? (
                <ul className={styles.sharedChatsList}>
                  {workspaceChats.map((chat) => (
                    <li key={chat.id} className={styles.sharedChatItem}>
                      <div className={styles.chatInfo}>
                        <div className={styles.chatTitle}>{chat.title}</div>
                        <div className={styles.chatMeta}>
                          {chat.messageCount || chat.messages.length} messages •
                          Created{" "}
                          {new Date(chat.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {isWorkspaceOwner && (
                        <button
                          onClick={() => handleRemoveChatFromWorkspace(chat.id)}
                          className={styles.removeChatButton}
                          title="Remove from workspace"
                        >
                          🗑️
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.noSharedChats}>
                  No chats shared to this workspace yet.
                  <br />
                  Use the share button on individual chats to add them here.
                </div>
              )}
            </div>

            {/* Workspace Management */}
            {isWorkspaceOwner && (
              <div className={styles.workspaceSection}>
                <button
                  onClick={handleDeleteWorkspace}
                  className={styles.deleteWorkspaceButton}
                >
                  Delete Workspace
                </button>
              </div>
            )}
          </>
        )}

        {!activeWorkspace && workspaces.length === 0 && (
          <div className={styles.noMembers}>
            No workspaces yet. Create your first workspace to start
            collaborating!
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamWorkspaceManager;
