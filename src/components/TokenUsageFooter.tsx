import React from "react";
import styles from "./TokenUsageFooter.module.css";
import { TokenUsage } from "../services/chatService";

interface TokenUsageFooterProps {
  tokensUsed?: TokenUsage;
  estimatedCost?: number;
  model?: string;
  usedTools?: boolean;
  toolsCalled?: string[];
}

export const TokenUsageFooter: React.FC<TokenUsageFooterProps> = ({
  tokensUsed,
  estimatedCost,
  model,
  usedTools,
  toolsCalled,
}) => {
  if (!tokensUsed) {
    return null;
  }

  return (
    <div className={styles.tokenFooter}>
      <div className={styles.tokenStats}>
        <span className={styles.stat}>
          <span className={styles.icon}>🎯</span>
          <span className={styles.label}>Tokens:</span>
          <span className={styles.value}>
            {tokensUsed.total.toLocaleString()}
          </span>
          <span className={styles.detail}>
            ({tokensUsed.prompt} in / {tokensUsed.completion} out)
          </span>
        </span>

        {estimatedCost !== undefined && (
          <span className={styles.stat}>
            <span className={styles.icon}>💰</span>
            <span className={styles.label}>Cost:</span>
            <span className={styles.value}>${estimatedCost.toFixed(6)}</span>
          </span>
        )}

        {model && (
          <span className={styles.stat}>
            <span className={styles.icon}>🤖</span>
            <span className={styles.label}>Model:</span>
            <span className={styles.value}>{model}</span>
          </span>
        )}

        {usedTools && toolsCalled && toolsCalled.length > 0 && (
          <span className={styles.stat}>
            <span className={styles.icon}>🔧</span>
            <span className={styles.label}>Tools:</span>
            <span className={styles.value}>{toolsCalled.join(", ")}</span>
          </span>
        )}
      </div>
    </div>
  );
};
