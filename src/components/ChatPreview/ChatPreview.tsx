import React, { useState } from "react";
import { ChatSession } from "../../types/chat";
import {
  useChatMetadata,
  getChatTypeIcon,
  getChatTypeLabel,
} from "../../hooks/useChatMetadata";
import { useChatCategories } from "../../hooks/useChatCategories";
import styles from "./ChatPreview.module.css";

interface ChatPreviewProps {
  chat: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string, title: string) => void;
  onStar: (id: string) => void;
  onCategorize: (id: string, category: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  editTitle: string;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTitleBlur: (id: string) => void;
  onTitleKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string
  ) => void;
}

const ChatPreview: React.FC<ChatPreviewProps> = ({
  chat,
  isActive,
  isEditing,
  onSelect,
  onDoubleClick,
  onStar,
  onCategorize,
  onDelete,
  onSave,
  onEditTitle,
  editTitle,
  onTitleChange,
  onTitleBlur,
  onTitleKeyDown,
}) => {
  const metadata = useChatMetadata(chat);
  const { categories } = useChatCategories();
  const [showCategorySelect, setShowCategorySelect] = useState(false);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    onCategorize(chat.id, category);
    setShowCategorySelect(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`${styles.chatPreview} ${isActive ? styles.active : ""}`}
      onClick={() => onSelect(chat.id)}
      onDoubleClick={() => onDoubleClick(chat.id, chat.title)}
    >
      {/* Chat Header */}
      <div className={styles.chatHeader}>
        <div
          className={styles.chatTypeIcon}
          title={getChatTypeLabel(metadata.chatType)}
        >
          {getChatTypeIcon(metadata.chatType)}
        </div>

        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={onTitleChange}
            onBlur={() => onTitleBlur(chat.id)}
            onKeyDown={(e) => onTitleKeyDown(e, chat.id)}
            className={styles.chatTitleInput}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={styles.chatTitle} title={chat.title}>
            {chat.title}
          </div>
        )}

        <button
          className={`${styles.starButton} ${
            chat.isStarred ? styles.starred : styles.unstarred
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onStar(chat.id);
          }}
          title={chat.isStarred ? "Remove from favorites" : "Add to favorites"}
        >
          {chat.isStarred ? "⭐" : "☆"}
        </button>

        <div className={styles.chatDate}>{formatDate(chat.createdAt)}</div>
      </div>

      {/* Message Preview */}
      <div className={styles.messagePreview}>{metadata.messagePreview}</div>

      {/* Chat Statistics */}
      <div className={styles.chatStatistics}>
        <div className={styles.statItem}>
          <span className={styles.statIcon}>💬</span>
          <span>{chat.messageCount || chat.messages.length}</span>
        </div>

        {metadata.toolsUsed.length > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statIcon}>🔧</span>
            <span>{metadata.toolsUsed.length}</span>
          </div>
        )}

        {metadata.hasDataExports && (
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📊</span>
            <span>Data</span>
          </div>
        )}

        {metadata.hasCharts && (
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📈</span>
            <span>Charts</span>
          </div>
        )}
      </div>

      {/* Chat Labels */}
      <div className={styles.chatLabels}>
        {/* Category */}
        <div className={styles.categoryContainer}>
          {showCategorySelect ? (
            <select
              className={styles.categorySelect}
              value={chat.category || ""}
              onChange={handleCategoryChange}
              onBlur={() => setShowCategorySelect(false)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          ) : (
            <button
              className={styles.categoryBadge}
              onClick={(e) => {
                e.stopPropagation();
                setShowCategorySelect(true);
              }}
              title="Click to change category"
            >
              {chat.category || "No category"}
            </button>
          )}
        </div>

        {/* Topics/Tags */}
        {metadata.keyTopics.length > 0 && (
          <div className={styles.tagsContainer}>
            {metadata.keyTopics.map((topic, index) => (
              <span key={index} className={styles.tag}>
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className={styles.chatActions}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditTitle(chat.id, chat.title);
          }}
          className={styles.actionButton}
          title="Edit Title"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave(chat.id);
          }}
          className={styles.actionButton}
          title="Confirm Save (Auto-save enabled)"
        >
          💾
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(chat.id);
          }}
          className={styles.actionButton}
          title="Delete Chat"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default ChatPreview;
