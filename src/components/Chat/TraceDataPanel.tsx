import React from "react";
import { Message } from "../../services/chatService";
import styles from "./Chat.module.css";

interface TraceDataPanelProps {
  traceData: Message["traceData"];
  messageIndex: number;
  onCopy: (text: string, index: number) => void;
  copiedMessageId: string | null;
}

export const TraceDataPanel: React.FC<TraceDataPanelProps> = ({
  traceData,
  messageIndex,
  onCopy,
  copiedMessageId,
}) => {
  if (!traceData) return null;

  return (
    <div className={styles.traceData}>
      <div className={styles.traceHeader}>
        <strong>🔍 Trace Data</strong>
        <div className={styles.copyButtonContainer}>
          <button
            onClick={() => {
              const traceText = JSON.stringify(traceData, null, 2);
              onCopy(traceText, messageIndex);
            }}
            className={styles.copyButton}
            title="Copy Trace Data"
          >
            <span role="img" aria-label="copy">
              📋
            </span>
          </button>
          {copiedMessageId === String(messageIndex) && (
            <div className={styles.copyTooltip}>Copied!</div>
          )}
        </div>
      </div>

      <div className={styles.traceItem}>
        <strong>Timestamp:</strong> {traceData.timestamp}
      </div>

      {traceData.userInput && (
        <div className={styles.traceItem}>
          <strong>User Input:</strong> {traceData.userInput}
        </div>
      )}

      {traceData.selectedTool && (
        <div className={styles.traceItem}>
          <strong>Selected Tool:</strong> {traceData.selectedTool}
        </div>
      )}

      {traceData.parameters && Object.keys(traceData.parameters).length > 0 && (
        <div className={styles.traceItem}>
          <strong>Parameters:</strong>
          <pre className={styles.traceCode}>
            {JSON.stringify(traceData.parameters, null, 2)}
          </pre>
        </div>
      )}

      {traceData.aiResponse && (
        <div className={styles.traceItem}>
          <strong>AI Response:</strong>
          <pre className={styles.traceCode}>
            {JSON.stringify(traceData.aiResponse, null, 2)}
          </pre>
        </div>
      )}

      {traceData.mcpCall && (
        <div className={styles.traceItem}>
          <strong>MCP Call:</strong>
          <pre className={styles.traceCode}>
            {JSON.stringify(traceData.mcpCall, null, 2)}
          </pre>
        </div>
      )}

      {traceData.mcpResponse && (
        <div className={styles.traceItem}>
          <strong>MCP Response:</strong>
          <pre className={styles.traceCode}>
            {JSON.stringify(traceData.mcpResponse, null, 2)}
          </pre>
        </div>
      )}

      {traceData.error && (
        <div className={`${styles.traceItem} ${styles.traceItemError}`}>
          <strong>Error:</strong> {traceData.error}
        </div>
      )}
    </div>
  );
};
