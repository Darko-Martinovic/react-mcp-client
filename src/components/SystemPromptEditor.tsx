import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./SystemPromptEditor.module.css";
import CacheManager from "./CacheManager";
import { cacheManager } from "../services/cacheManager";

interface SystemPromptConfig {
  customPromptAddition: string;
  mcpServerUrl: string;
  defaultDateRangeDays: number;
  defaultVisualizationType: "bar" | "pie" | "line" | "none";
  maxSearchResults: number;
  enableDetailedLogging: boolean;
}

interface SystemPromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CONFIG: SystemPromptConfig = {
  customPromptAddition: "",
  mcpServerUrl: import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:9090",
  defaultDateRangeDays: 30,
  defaultVisualizationType: "bar",
  maxSearchResults: 50,
  enableDetailedLogging: true,
};

const STORAGE_KEY = "systemPromptConfig";

const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SystemPromptConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"prompt" | "settings">("prompt");

  // Load configuration from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        setConfig({ ...DEFAULT_CONFIG, ...parsedConfig });
      }
    } catch (error) {
      console.error("Error loading system prompt config:", error);
    }
  }, []);

  // Save configuration to localStorage
  const saveConfig = (newConfig: SystemPromptConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);

      // Dispatch custom event to notify Chat component of config changes
      window.dispatchEvent(
        new CustomEvent("systemPromptConfigChanged", {
          detail: newConfig,
        })
      );
    } catch (error) {
      console.error("Error saving system prompt config:", error);
    }
  };

  const handleConfigChange = (field: keyof SystemPromptConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    saveConfig(newConfig);
  };

  const resetToDefaults = () => {
    saveConfig(DEFAULT_CONFIG);
  };

  const resetMcpUrlToEnv = () => {
    const envUrl =
      import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:9090";
    handleConfigChange("mcpServerUrl", envUrl);
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "system-prompt-config.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        saveConfig({ ...DEFAULT_CONFIG, ...importedConfig });
      } catch (error) {
        alert("Error importing configuration file. Please check the format.");
      }
    };
    reader.readAsText(file);
  };

  // Get the base system prompt for display
  const getBaseSystemPrompt = () => {
    return `You are an intelligent assistant that helps users interact with MCP (Model Context Protocol) tools.

CRITICAL: You MUST respond in this EXACT structured format:

Function: search
Parameters: {"query": "search_terms"}
Reasoning: Brief explanation

DO NOT provide any other response format. DO NOT format results or explain tools. Just provide the structured function call.

Your ONLY job is to:
1. Understand the user's intent
2. Return the structured function call format above
3. Extract appropriate search terms for the Parameters based on intent

Query Intent Guidelines:
- For product listings/inventory: use "products" or "inventory" or "detailed inventory"
- For specific suppliers: include supplier name in search
- For specific categories: include category name in search  
- For sales data: use "sales" or "sales data"
- For low stock alerts: use "low stock" or "stock" (only when user specifically asks about LOW stock)
- For general inventory/stock levels: use "detailed inventory" or "products inventory"
- For TOTAL/SUMMARY queries (total revenue, total sales, how much): use "sales data" - the system will automatically provide summary format
- For DETAILED/BREAKDOWN queries (show all sales, list transactions, breakdown): use "detailed sales" or "sales breakdown"
- For CATEGORY PERFORMANCE queries (how categories are performing, category sales): use "sales data product categories" - system will auto-apply date range

VISUALIZATION OPTIONS (users can specify these in their queries):
- "table only" or "no chart" - Shows data table without visualization
- "chart only" or "no table" - Shows visualization without data table  
- "bar chart" or "bar graph" - Forces bar chart visualization
- "pie chart" or "pie" - Forces pie chart visualization
- "line chart" or "line graph" - Forces line chart visualization
- "chart" or "graph" - Lets system choose best visualization type

REMEMBER: Always respond with the structured format. Never format or display the actual results - that will be handled separately.`;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>⚙️ System Configuration</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === "prompt" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("prompt")}
          >
            📝 System Prompt
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === "settings" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Settings
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === "prompt" && (
            <div className={styles.promptTab}>
              <div className={styles.section}>
                <h3>📋 Base System Prompt (Read-Only)</h3>
                <textarea
                  className={styles.basePrompt}
                  value={getBaseSystemPrompt()}
                  readOnly
                  rows={20}
                />
              </div>

              <div className={styles.section}>
                <h3>✏️ Custom Prompt Addition</h3>
                <p className={styles.description}>
                  Add custom instructions that will be appended to the base
                  system prompt:
                </p>
                <textarea
                  className={styles.customPrompt}
                  value={config.customPromptAddition}
                  onChange={(e) =>
                    handleConfigChange("customPromptAddition", e.target.value)
                  }
                  placeholder="Add your custom instructions here... (e.g., 'Always prioritize financial data', 'Focus on inventory optimization', etc.)"
                  rows={8}
                />
                {config.customPromptAddition && (
                  <div className={styles.preview}>
                    <h4>📄 Preview of Final Prompt:</h4>
                    <div className={styles.finalPrompt}>
                      {getBaseSystemPrompt()}
                      <div className={styles.customAddition}>
                        <br />
                        <strong>CUSTOM INSTRUCTIONS:</strong>
                        <br />
                        {config.customPromptAddition}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className={styles.settingsTab}>
              <div className={styles.settingsGrid}>
                <div className={styles.settingGroup}>
                  <label>🌐 MCP Server URL (Display Only)</label>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={config.mcpServerUrl}
                      onChange={(e) =>
                        handleConfigChange("mcpServerUrl", e.target.value)
                      }
                      placeholder="http://localhost:9090"
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={resetMcpUrlToEnv}
                      className={styles.resetButton}
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      title="Reset to environment variable value"
                    >
                      🔄 Reset
                    </button>
                  </div>
                  <small>
                    ℹ️ This setting is for display purposes only and does not
                    affect app functionality. Frontend communicates via Vite
                    proxy (/api → port 5002 → MCP server).
                  </small>
                </div>

                <div className={styles.settingGroup}>
                  <label>🔄 Communication Flow & Proxy Configuration</label>
                  <div
                    style={{
                      background: "#f8f9fa",
                      border: "1px solid #e9ecef",
                      borderRadius: "6px",
                      padding: "16px",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#495057",
                          marginBottom: "8px",
                        }}
                      >
                        📊 Request Flow:
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          background: "#fff",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #dee2e6",
                          lineHeight: "1.6",
                        }}
                      >
                        🌐 <strong>React App</strong> (localhost:5173)
                        <br />
                        ⬇️ <em>fetch('/api/tool', ...)</em>
                        <br />
                        🔧 <strong>Vite Dev Proxy</strong> (vite.config.js)
                        <br />
                        ⬇️ <em>→ localhost:5002</em>
                        <br />
                        🚀 <strong>Search Proxy</strong> (search-proxy.cjs)
                        <br />
                        ⬇️ <em>→ {config.mcpServerUrl}</em>
                        <br />
                        🎯 <strong>MCP Server</strong> (Your Backend)
                      </div>
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#495057",
                          marginBottom: "6px",
                        }}
                      >
                        🤔 Why do we need the proxy?
                      </div>
                      <ul
                        style={{
                          margin: "0",
                          paddingLeft: "16px",
                          color: "#6c757d",
                        }}
                      >
                        <li>
                          <strong>CORS Issues:</strong> Browsers block direct
                          cross-origin requests
                        </li>
                        <li>
                          <strong>Request Routing:</strong> Maps frontend calls
                          to correct MCP endpoints
                        </li>
                        <li>
                          <strong>Error Handling:</strong> Provides consistent
                          error responses
                        </li>
                        <li>
                          <strong>Development:</strong> Vite dev server needs
                          proxy for /api routes
                        </li>
                      </ul>
                    </div>

                    <div>
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#495057",
                          marginBottom: "6px",
                        }}
                      >
                        ⚙️ Configuration Files:
                      </div>
                      <div style={{ fontSize: "12px", color: "#6c757d" }}>
                        • <code>vite.config.js</code> - Proxy /api →
                        localhost:5002
                        <br />• <code>search-proxy.cjs</code> - Runs on port
                        5002
                        <br />• <code>.env</code> - VITE_MCP_SERVER_URL ={" "}
                        {config.mcpServerUrl}
                      </div>
                    </div>
                  </div>
                  <small>
                    💡 <strong>Key Point:</strong> The MCP Server URL above is
                    only used by the proxy server, not by the frontend directly.
                    All frontend requests use relative URLs (/api/*).
                  </small>
                </div>

                <div className={styles.settingGroup}>
                  <label>📅 Default Date Range (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={config.defaultDateRangeDays}
                    onChange={(e) =>
                      handleConfigChange(
                        "defaultDateRangeDays",
                        parseInt(e.target.value) || 30
                      )
                    }
                  />
                  <small>
                    Default number of days for sales/date-based queries
                  </small>
                </div>

                <div className={styles.settingGroup}>
                  <label>📊 Default Visualization Type</label>
                  <select
                    value={config.defaultVisualizationType}
                    onChange={(e) =>
                      handleConfigChange(
                        "defaultVisualizationType",
                        e.target.value
                      )
                    }
                  >
                    <option value="bar">Bar Chart</option>
                    <option value="pie">Pie Chart</option>
                    <option value="line">Line Chart</option>
                    <option value="none">No Chart (Table Only)</option>
                  </select>
                  <small>Default chart type when user doesn't specify</small>
                </div>

                <div className={styles.settingGroup}>
                  <label>🔢 Max Search Results</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.maxSearchResults}
                    onChange={(e) =>
                      handleConfigChange(
                        "maxSearchResults",
                        parseInt(e.target.value) || 50
                      )
                    }
                  />
                  <small>
                    Maximum number of results to return from searches
                  </small>
                </div>

                <div className={styles.settingGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.enableDetailedLogging}
                      onChange={(e) =>
                        handleConfigChange(
                          "enableDetailedLogging",
                          e.target.checked
                        )
                      }
                    />
                    🔍 Enable Detailed Logging
                  </label>
                  <small>
                    Show detailed debug information in browser console
                  </small>
                </div>
              </div>

              {/* Semantic Cache Configuration */}
              <div className={styles.settingGroup}>
                <label>🧠 Semantic Cache Settings</label>
                <div
                  style={{
                    background: "#f0f8ff",
                    border: "1px solid #bee5eb",
                    borderRadius: "6px",
                    padding: "16px",
                    marginTop: "8px",
                  }}
                >
                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        onChange={(e) => {
                          cacheManager.configureSemanticMatching({
                            enabled: e.target.checked,
                          });
                        }}
                      />
                      <span>Enable semantic query matching</span>
                    </label>
                    <small style={{ color: "#6c757d", marginLeft: "24px" }}>
                      Allows cache hits for similar queries (e.g., "show sales"
                      vs "display revenue")
                    </small>
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontSize: "13px",
                      }}
                    >
                      Similarity Threshold:{" "}
                      <span id="threshold-value">75%</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      defaultValue="75"
                      style={{ width: "100%" }}
                      onChange={(e) => {
                        const threshold = parseInt(e.target.value) / 100;
                        cacheManager.configureSemanticMatching({ threshold });
                        const valueSpan =
                          document.getElementById("threshold-value");
                        if (valueSpan)
                          valueSpan.textContent = `${e.target.value}%`;
                      }}
                    />
                    <small style={{ color: "#6c757d" }}>
                      Higher values = more strict matching (fewer false
                      positives)
                    </small>
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#495057",
                      marginTop: "12px",
                    }}
                  >
                    <strong>How semantic matching works:</strong>
                    <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                      <li>
                        Normalizes queries (removes time variations, synonyms)
                      </li>
                      <li>
                        Extracts semantic tokens (business terms, actions)
                      </li>
                      <li>Groups by category (sales, inventory, analytics)</li>
                      <li>
                        Calculates similarity score using multiple algorithms
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Cache Management Section */}
              <CacheManager />

              <div className={styles.actions}>
                <button
                  onClick={resetToDefaults}
                  className={styles.resetButton}
                >
                  🔄 Reset to Defaults
                </button>
                <button onClick={exportConfig} className={styles.exportButton}>
                  📤 Export Config
                </button>
                <label className={styles.importButton}>
                  📥 Import Config
                  <input
                    type="file"
                    accept=".json"
                    onChange={importConfig}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <p>💾 All settings are automatically saved to local storage</p>
        </div>
      </div>
    </div>
  );
};

export default SystemPromptEditor;

// Export function to get current config for use in Chat component
export const getSystemPromptConfig = (): SystemPromptConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Error loading system prompt config:", error);
  }
  return DEFAULT_CONFIG;
};
