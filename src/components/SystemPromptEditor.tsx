import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./SystemPromptEditor.module.css";
import CacheManager from "./CacheManager";
import { cacheManager } from "../services/cacheManager";
import { BASE_SYSTEM_PROMPT } from "./SystemPromptEditor/constants";
import { ProxyInfo } from "./SystemPromptEditor/ProxyInfo";

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
                  value={BASE_SYSTEM_PROMPT}
                  readOnly
                  rows={15}
                />
              </div>

              <div className={styles.section}>
                <h3>✏️ Custom Prompt Addition</h3>
                <textarea
                  className={styles.customPrompt}
                  value={config.customPromptAddition}
                  onChange={(e) =>
                    handleConfigChange("customPromptAddition", e.target.value)
                  }
                  placeholder="Add custom instructions (e.g., 'Prioritize financial data')"
                  rows={6}
                />
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className={styles.settingsTab}>
              <div className={styles.settingsGrid}>
                <div className={styles.settingGroup}>
                  <label>🌐 MCP Server URL</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      value={config.mcpServerUrl}
                      onChange={(e) =>
                        handleConfigChange("mcpServerUrl", e.target.value)
                      }
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={resetMcpUrlToEnv}
                      className={styles.resetButton}
                      title="Reset to environment variable"
                    >
                      🔄
                    </button>
                  </div>
                  <ProxyInfo mcpServerUrl={config.mcpServerUrl} />
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
                <label>🧠 Semantic Cache</label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={(e) => {
                      cacheManager.configureSemanticMatching({
                        enabled: e.target.checked,
                      });
                    }}
                  />
                  Enable semantic query matching
                </label>
                <div style={{ marginTop: "8px" }}>
                  <label style={{ fontSize: "13px" }}>
                    Similarity: <span id="threshold-value">75%</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    defaultValue="75"
                    style={{ width: "100%", marginTop: "4px" }}
                    onChange={(e) => {
                      const threshold = parseInt(e.target.value) / 100;
                      cacheManager.configureSemanticMatching({ threshold });
                      const valueSpan =
                        document.getElementById("threshold-value");
                      if (valueSpan)
                        valueSpan.textContent = `${e.target.value}%`;
                    }}
                  />
                </div>
                <small>
                  Matches similar queries like "show sales" vs "display revenue"
                </small>
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
