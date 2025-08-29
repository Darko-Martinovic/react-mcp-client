import React, { useState } from "react";
import {
  ChatSession,
  SharePermission,
  Collaborator,
  ShareLink,
} from "../../types/chat";
import { useCollaboration } from "../../hooks/useCollaboration";
import styles from "./ShareDialog.module.css";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatSession;
  onChatUpdate: (updatedChat: ChatSession) => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  chat,
  onChatUpdate,
}) => {
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [newCollaboratorPermission, setNewCollaboratorPermission] =
    useState<SharePermission>("read");
  const [linkPermission, setLinkPermission] = useState<SharePermission>("read");
  const [linkExpiryDays, setLinkExpiryDays] = useState<number | undefined>(7);
  const [hasExpiry, setHasExpiry] = useState(true);

  const {
    createShareLink,
    addCollaborator,
    removeCollaborator,
    updateCollaboratorPermission,
    revokeShareLink,
    activeShareLinks,
  } = useCollaboration();

  if (!isOpen) return null;

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollaboratorEmail.trim()) return;

    addCollaborator(
      chat.id,
      newCollaboratorEmail.trim(),
      newCollaboratorPermission
    );

    // Update the chat with new collaborator
    const newCollaborator: Collaborator = {
      id: "collab-" + Date.now().toString(36),
      name: newCollaboratorEmail.split("@")[0],
      email: newCollaboratorEmail.trim(),
      permission: newCollaboratorPermission,
      joinedAt: new Date().toISOString(),
    };

    const updatedChat = {
      ...chat,
      isShared: true,
      collaborators: [...(chat.collaborators || []), newCollaborator],
      updatedAt: new Date().toISOString(),
    };

    onChatUpdate(updatedChat);
    setNewCollaboratorEmail("");
  };

  const handleRemoveCollaborator = (collaboratorId: string) => {
    removeCollaborator(chat.id, collaboratorId);

    const updatedCollaborators = (chat.collaborators || []).filter(
      (c) => c.id !== collaboratorId
    );
    const updatedChat = {
      ...chat,
      collaborators: updatedCollaborators,
      isShared: updatedCollaborators.length > 0,
      updatedAt: new Date().toISOString(),
    };

    onChatUpdate(updatedChat);
  };

  const handleCreateShareLink = () => {
    const expiryDays = hasExpiry ? linkExpiryDays : undefined;
    createShareLink(chat.id, linkPermission, expiryDays);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const getPermissionColor = (permission: SharePermission) => {
    switch (permission) {
      case "read":
        return "read";
      case "comment":
        return "comment";
      case "edit":
        return "edit";
      default:
        return "read";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const chatShareLinks = activeShareLinks.filter(
    (link) => link.chatId === chat.id && link.isActive
  );

  return (
    <div className={styles.shareDialog} onClick={onClose}>
      <div
        className={styles.shareDialogContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.shareDialogHeader}>
          <h2 className={styles.shareDialogTitle}>Share "{chat.title}"</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        {/* Collaborators Section */}
        <div className={styles.shareSection}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>👥</span>
            Collaborators
          </h3>

          <form onSubmit={handleAddCollaborator} className={styles.shareForm}>
            <div className={styles.formRow}>
              <input
                type="email"
                placeholder="Enter email address"
                value={newCollaboratorEmail}
                onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                className={styles.emailInput}
                required
              />
              <select
                value={newCollaboratorPermission}
                onChange={(e) =>
                  setNewCollaboratorPermission(
                    e.target.value as SharePermission
                  )
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
                disabled={!newCollaboratorEmail.trim()}
              >
                Add
              </button>
            </div>
          </form>

          <ul className={styles.collaboratorsList}>
            {chat.collaborators && chat.collaborators.length > 0 ? (
              chat.collaborators.map((collaborator) => (
                <li key={collaborator.id} className={styles.collaboratorItem}>
                  <div className={styles.collaboratorInfo}>
                    <div className={styles.collaboratorName}>
                      {collaborator.name}
                    </div>
                    <div className={styles.collaboratorEmail}>
                      {collaborator.email}
                    </div>
                  </div>
                  <div className={styles.collaboratorActions}>
                    <span
                      className={`${styles.permissionBadge} ${
                        styles[getPermissionColor(collaborator.permission)]
                      }`}
                    >
                      {collaborator.permission}
                    </span>
                    <button
                      onClick={() => handleRemoveCollaborator(collaborator.id)}
                      className={styles.removeButton}
                      title="Remove collaborator"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <div className={styles.noCollaborators}>
                No collaborators yet. Add someone by email above.
              </div>
            )}
          </ul>
        </div>

        {/* Share Links Section */}
        <div className={styles.shareSection}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>🔗</span>
            Share Links
          </h3>

          <div className={styles.linkGeneration}>
            <div className={styles.linkOptions}>
              <select
                value={linkPermission}
                onChange={(e) =>
                  setLinkPermission(e.target.value as SharePermission)
                }
                className={styles.permissionSelect}
              >
                <option value="read">Read Only</option>
                <option value="comment">Can Comment</option>
                <option value="edit">Can Edit</option>
              </select>

              <div className={styles.linkOption}>
                <input
                  type="checkbox"
                  id="hasExpiry"
                  checked={hasExpiry}
                  onChange={(e) => setHasExpiry(e.target.checked)}
                />
                <label htmlFor="hasExpiry">Expires in</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={linkExpiryDays || 7}
                  onChange={(e) => setLinkExpiryDays(Number(e.target.value))}
                  disabled={!hasExpiry}
                />
                <span>days</span>
              </div>
            </div>

            <button
              onClick={handleCreateShareLink}
              className={styles.generateLinkButton}
            >
              <span>🔗</span>
              Generate Share Link
            </button>
          </div>

          <div className={styles.activeLinks}>
            {chatShareLinks.length > 0 ? (
              chatShareLinks.map((link) => {
                const url = `${window.location.origin}/shared/${link.id}`;
                return (
                  <div key={link.id} className={styles.activeLinkItem}>
                    <div className={styles.linkInfo}>
                      <div className={styles.linkUrl}>{url}</div>
                      <div className={styles.linkMeta}>
                        {link.permission} access • Created{" "}
                        {formatDate(link.createdAt)} • Accessed{" "}
                        {link.accessCount} times
                        {link.expiresAt &&
                          ` • Expires ${formatDate(link.expiresAt)}`}
                      </div>
                    </div>
                    <div className={styles.linkActions}>
                      <button
                        onClick={() => handleCopyLink(url)}
                        className={styles.copyButton}
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => revokeShareLink(link.id)}
                        className={styles.revokeButton}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.noActiveLinks}>
                No active share links. Generate one above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
