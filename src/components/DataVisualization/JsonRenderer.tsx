import React, { useState } from "react";
import styles from "./JsonRenderer.module.css";

export interface JsonRendererProps {
  data: any;
  toolName?: string;
  t?: (key: string) => string;
}

export const JsonRenderer: React.FC<JsonRendererProps> = ({
  data,
  toolName,
  t,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const copyToClipboard = async (jsonData: any) => {
    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopySuccess("copied");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      setCopySuccess("error");
      setTimeout(() => setCopySuccess(null), 2000);
    }
  };

  const renderJsonValue = (
    value: any,
    key: string | number,
    path: string,
    level: number = 0
  ): React.ReactNode => {
    const currentPath = `${path}.${key}`;
    const isExpanded = expandedNodes.has(currentPath);

    if (value === null) {
      return <span className={styles.jsonNull}>null</span>;
    }

    if (typeof value === "boolean") {
      return <span className={styles.jsonBoolean}>{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className={styles.jsonNumber}>{value}</span>;
    }

    if (typeof value === "string") {
      return <span className={styles.jsonString}>"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className={styles.jsonArray}>[]</span>;
      }

      return (
        <div className={styles.jsonContainer}>
          <button
            className={styles.toggleButton}
            onClick={() => toggleNode(currentPath)}
            aria-label={isExpanded ? "Collapse array" : "Expand array"}
          >
            <span className={styles.toggleIcon}>{isExpanded ? "▼" : "▶"}</span>
            <span className={styles.jsonBracket}>[</span>
            {!isExpanded && (
              <span className={styles.jsonPreview}>
                {value.length} item{value.length !== 1 ? "s" : ""}
              </span>
            )}
            {!isExpanded && <span className={styles.jsonBracket}>]</span>}
          </button>
          {isExpanded && (
            <div className={styles.jsonContent}>
              {value.map((item, index) => (
                <div key={index} className={styles.jsonItem}>
                  <span className={styles.jsonIndex}>{index}:</span>
                  {renderJsonValue(item, index, currentPath, level + 1)}
                  {index < value.length - 1 && (
                    <span className={styles.jsonComma}>,</span>
                  )}
                </div>
              ))}
              <div className={styles.jsonClosing}>
                <span className={styles.jsonBracket}>]</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (typeof value === "object" && value !== null) {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className={styles.jsonObject}>{"{}"}</span>;
      }

      return (
        <div className={styles.jsonContainer}>
          <button
            className={styles.toggleButton}
            onClick={() => toggleNode(currentPath)}
            aria-label={isExpanded ? "Collapse object" : "Expand object"}
          >
            <span className={styles.toggleIcon}>{isExpanded ? "▼" : "▶"}</span>
            <span className={styles.jsonBracket}>{"{"}</span>
            {!isExpanded && (
              <span className={styles.jsonPreview}>
                {keys.length} propert{keys.length !== 1 ? "ies" : "y"}
              </span>
            )}
            {!isExpanded && <span className={styles.jsonBracket}>{"}"}</span>}
          </button>
          {isExpanded && (
            <div className={styles.jsonContent}>
              {keys.map((objKey, index) => (
                <div key={objKey} className={styles.jsonItem}>
                  <span className={styles.jsonKey}>"{objKey}":</span>
                  {renderJsonValue(
                    value[objKey],
                    objKey,
                    currentPath,
                    level + 1
                  )}
                  {index < keys.length - 1 && (
                    <span className={styles.jsonComma}>,</span>
                  )}
                </div>
              ))}
              <div className={styles.jsonClosing}>
                <span className={styles.jsonBracket}>{"}"}</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <span className={styles.jsonUnknown}>{String(value)}</span>;
  };

  const expandAll = () => {
    const getAllPaths = (obj: any, currentPath: string = "root"): string[] => {
      const paths: string[] = [];
      if (typeof obj === "object" && obj !== null) {
        if (Array.isArray(obj)) {
          paths.push(currentPath);
          obj.forEach((item, index) => {
            paths.push(...getAllPaths(item, `${currentPath}.${index}`));
          });
        } else {
          paths.push(currentPath);
          Object.keys(obj).forEach((key) => {
            paths.push(...getAllPaths(obj[key], `${currentPath}.${key}`));
          });
        }
      }
      return paths;
    };

    const allPaths = getAllPaths(data);
    setExpandedNodes(new Set(allPaths));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  return (
    <div className={styles.jsonRenderer}>
      <div className={styles.jsonHeader}>
        <div className={styles.jsonTitle}>
          <span className={styles.jsonIcon}>📋</span>
          <span>{t ? t("json.viewer") : "JSON Document"}</span>
          {toolName && <span className={styles.toolName}>from {toolName}</span>}
        </div>
        <div className={styles.jsonControls}>
          <button
            className={styles.jsonButton}
            onClick={expandAll}
            title={t ? t("json.expandAll") : "Expand All"}
          >
            <span>📂</span>
          </button>
          <button
            className={styles.jsonButton}
            onClick={collapseAll}
            title={t ? t("json.collapseAll") : "Collapse All"}
          >
            <span>📁</span>
          </button>
          <button
            className={styles.jsonButton}
            onClick={() => copyToClipboard(data)}
            title={t ? t("json.copy") : "Copy JSON"}
          >
            <span>📋</span>
          </button>
          {copySuccess && (
            <span className={styles.copyFeedback}>
              {copySuccess === "copied"
                ? t
                  ? t("json.copied")
                  : "Copied!"
                : t
                ? t("json.copyError")
                : "Copy failed"}
            </span>
          )}
        </div>
      </div>
      <div className={styles.jsonContent}>
        {renderJsonValue(data, "root", "", 0)}
      </div>
    </div>
  );
};
