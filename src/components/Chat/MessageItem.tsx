import React from "react";
import { useTranslation } from "react-i18next";
import { Message } from "../../services/chatService";
import { DataVisualization } from "../DataVisualization";
import { TokenUsageFooter } from "../TokenUsageFooter";
import { copyToClipboard } from "../../utils/exporters";
import styles from "./Chat.module.css";

interface MessageItemProps {
  message: Message;
  messageIndex: number;
  copiedMessageId: string | null;
  onCopy: (text: string, index: number) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  messageIndex,
  copiedMessageId,
  onCopy,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.messageItem} ${
        message.sender === "user"
          ? styles.messageItemUser
          : styles.messageItemSystem
      }`}
    >
      {/* Message label */}
      <div
        className={`${styles.messageLabel} ${
          message.sender === "user"
            ? styles.messageLabelUser
            : styles.messageLabelSystem
        }`}
      >
        {message.sender === "user"
          ? t("app.you") || "You"
          : t("app.ai") || "AI"}
      </div>

      {/* Message content */}
      {message.tableData ? (
        <>
          {/* Show summary text above the table if it exists */}
          {message.text && (
            <span
              className={`${styles.messageBubble} ${
                message.sender === "user"
                  ? styles.messageBubbleUser
                  : styles.messageBubbleSystem
              }`}
              style={{ marginBottom: "10px", display: "block" }}
            >
              {message.text}
            </span>
          )}

          <DataVisualization
            data={message.tableData}
            toolName={message.toolName}
            query={message.traceData?.userInput}
            t={t}
            displayMode="auto"
          />

          {/* Token Usage Footer for AI responses */}
          {message.sender === "system" && (
            <TokenUsageFooter
              tokensUsed={message.tokensUsed}
              estimatedCost={message.estimatedCost}
              model={message.model}
              usedTools={message.usedTools}
              toolsCalled={message.toolsCalled}
            />
          )}

          {/* Copy button for table data */}
          <div
            className={`${styles.messageActions} ${
              message.sender === "user"
                ? styles.messageActionsUser
                : styles.messageActionsSystem
            }`}
          >
            <div className={styles.copyButtonContainer}>
              <button
                onClick={() =>
                  onCopy(
                    JSON.stringify(message.tableData, null, 2),
                    messageIndex
                  )
                }
                className={styles.copyButton}
              >
                <span role="img" aria-label="copy">
                  📋
                </span>
              </button>
              {copiedMessageId === `table-${messageIndex}` && (
                <div className={styles.copyTooltip}>
                  {t("app.copied") || "Copied!"}
                </div>
              )}
            </div>
          </div>
        </>
      ) : message.jsonData ? (
        <>
          {/* Show summary text above the JSON if it exists */}
          {message.text && (
            <span
              className={`${styles.messageBubble} ${
                message.sender === "user"
                  ? styles.messageBubbleUser
                  : styles.messageBubbleSystem
              }`}
              style={{ marginBottom: "10px", display: "block" }}
            >
              {message.text}
            </span>
          )}

          <DataVisualization
            data={message.jsonData}
            toolName={message.toolName}
            query={message.traceData?.userInput}
            t={t}
            displayMode="auto"
          />

          {/* Token Usage Footer for AI responses */}
          {message.sender === "system" && (
            <TokenUsageFooter
              tokensUsed={message.tokensUsed}
              estimatedCost={message.estimatedCost}
              model={message.model}
              usedTools={message.usedTools}
              toolsCalled={message.toolsCalled}
            />
          )}

          {/* Copy button for JSON data */}
          <div
            className={`${styles.messageActions} ${
              message.sender === "user"
                ? styles.messageActionsUser
                : styles.messageActionsSystem
            }`}
          >
            <div className={styles.copyButtonContainer}>
              <button
                onClick={() =>
                  onCopy(
                    JSON.stringify(message.jsonData, null, 2),
                    messageIndex
                  )
                }
                className={styles.copyButton}
              >
                <span role="img" aria-label="copy">
                  📋
                </span>
              </button>
              {copiedMessageId === `json-${messageIndex}` && (
                <div className={styles.copyTooltip}>
                  {t("app.copied") || "Copied!"}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Regular text message */}
          <span
            className={`${styles.messageBubble} ${
              message.sender === "user"
                ? styles.messageBubbleUser
                : styles.messageBubbleSystem
            }`}
          >
            {message.text}
          </span>

          {/* Token Usage Footer for AI responses */}
          {message.sender === "system" && (
            <TokenUsageFooter
              tokensUsed={message.tokensUsed}
              estimatedCost={message.estimatedCost}
              model={message.model}
              usedTools={message.usedTools}
              toolsCalled={message.toolsCalled}
            />
          )}
        </>
      )}
    </div>
  );
};
