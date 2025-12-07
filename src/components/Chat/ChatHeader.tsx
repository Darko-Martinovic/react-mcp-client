import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  exportChat,
  exportChatAsText,
  exportChatAsMarkdown,
} from "../../utils/exporters";
import { Message } from "../../services/chatService";
import styles from "./Chat.module.css";
import reactLogo from "../../assets/react.svg";

interface ChatHeaderProps {
  messages: Message[];
  title: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ messages, title }) => {
  const { t } = useTranslation();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportMenu]);

  return (
    <div className={styles.exportSection}>
      <div className={styles.appTitle}>
        <img src={reactLogo} alt="SmartQuery" className={styles.appIcon} />
        <h1 className={styles.appTitleText}>
          {t("app.title") || "SmartQuery"}
          <span className={styles.appSubtitle}>
            {" · "}
            {t("app.subtitle") || "AI-Powered Data Intelligence"}
          </span>
        </h1>
      </div>
      <div ref={exportMenuRef} className={styles.exportMenuContainer}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className={styles.exportButton}
        >
          <span role="img" aria-label="export">
            📤
          </span>
          {t("export.button") || "Export"}
          <span style={{ marginLeft: 4 }}>▼</span>
        </button>

        {showExportMenu && (
          <div className={styles.exportDropdown}>
            <button
              onClick={() => {
                exportChat(messages, title || "chat");
                setShowExportMenu(false);
              }}
              className={styles.exportOption}
            >
              📋 {t("export.json") || "JSON"}
            </button>
            <button
              onClick={() => {
                exportChatAsText(messages, title || "chat");
                setShowExportMenu(false);
              }}
              className={styles.exportOption}
            >
              📄 {t("export.text") || "Text"}
            </button>
            <button
              onClick={() => {
                exportChatAsMarkdown(messages, title || "chat");
                setShowExportMenu(false);
              }}
              className={styles.exportOption}
            >
              📝 {t("export.markdown") || "Markdown"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
