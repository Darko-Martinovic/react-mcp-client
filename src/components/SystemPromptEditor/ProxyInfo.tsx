import React from "react";
import styles from "../SystemPromptEditor.module.css";

interface ProxyInfoProps {
  mcpServerUrl: string;
}

export const ProxyInfo: React.FC<ProxyInfoProps> = ({ mcpServerUrl }) => {
  return (
    <div className={styles.proxyInfo}>
      <div className={styles.flowDiagram}>
        React App (5173) → Vite Proxy → Search Proxy (5002) → MCP Server (
        {mcpServerUrl})
      </div>
      <details className={styles.proxyDetails}>
        <summary>ℹ️ About the proxy setup</summary>
        <ul>
          <li>Handles CORS issues between frontend and backend</li>
          <li>Routes /api requests to MCP server</li>
          <li>Configured in vite.config.js and search-proxy.cjs</li>
        </ul>
      </details>
    </div>
  );
};
