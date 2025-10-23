import React, { useState } from "react";
import { VisualizationProps } from "./types";
import {
  getVisualizationType,
  shouldShowTable,
  shouldShowChart,
} from "./ChartTypeDetector";
import {
  analyzeDataStructure,
  shouldDisplayAsJson,
  shouldDisplayAsTable,
  isMongoDbResponse,
  flattenForTable,
} from "./DataTypeDetector";
import { TableRenderer } from "./TableRenderer";
import { ChartRenderer } from "./ChartRenderer";
import { JsonRenderer } from "./JsonRenderer";
import styles from "./DataVisualization.module.css";

export const DataVisualization: React.FC<VisualizationProps> = ({
  data,
  toolName,
  query,
  t,
  displayMode = "auto",
}) => {
  const [currentView, setCurrentView] = useState<"table" | "json">("table");

  // Handle empty data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // Handle non-array data (single document/object)
  if (!Array.isArray(data)) {
    return (
      <div className={styles.visualizationContainer}>
        <JsonRenderer data={data} toolName={toolName} t={t} />
      </div>
    );
  }

  // Analyze data structure
  const dataAnalysis = analyzeDataStructure(data);
  const isMongoData = isMongoDbResponse(toolName, data);

  // Determine display strategy
  let showJson = false;
  let showTable = false;
  let showChart = false;
  let allowToggle = false;

  if (displayMode === "json") {
    showJson = true;
  } else if (displayMode === "table") {
    showTable = true;
  } else if (displayMode === "mixed") {
    showJson = true;
    showTable = true;
    allowToggle = true;
  } else {
    // Auto mode - make intelligent decision
    if (isMongoData || shouldDisplayAsJson(data, query)) {
      showJson = true;
      allowToggle = dataAnalysis.isTabular; // Allow toggle if data could also be tabular
    } else if (shouldDisplayAsTable(data, query)) {
      showTable = true;
      allowToggle = dataAnalysis.hasComplexNesting; // Allow toggle if data has complex structure
    } else {
      // Fallback based on analysis
      if (dataAnalysis.recommendedView === "json") {
        showJson = true;
        allowToggle = dataAnalysis.isTabular;
      } else {
        showTable = true;
        allowToggle = dataAnalysis.hasComplexNesting;
      }
    }
  }

  // Chart logic (only for tabular data)
  const chartType = showTable ? getVisualizationType(data, query) : "none";
  if (showTable && !showJson) {
    showChart = shouldShowChart(chartType, query) && shouldShowTable(query);
  }

  // Prepare table data (flatten if needed for complex structures)
  const tableData =
    dataAnalysis.hasComplexNesting && showTable && !showJson
      ? flattenForTable(data)
      : data;

  return (
    <div className={styles.visualizationContainer}>
      {/* View Toggle Controls */}
      {allowToggle && showJson && showTable && (
        <div className={styles.viewControls}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleButton} ${
                currentView === "table" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("table")}
              title={t ? t("view.table") : "Table View"}
            >
              <span>📊</span>
              <span>{t ? t("view.table") : "Table"}</span>
            </button>
            <button
              className={`${styles.toggleButton} ${
                currentView === "json" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("json")}
              title={t ? t("view.json") : "JSON View"}
            >
              <span>📋</span>
              <span>{t ? t("view.json") : "JSON"}</span>
            </button>
          </div>
          <div className={styles.dataInfo}>
            <span className={styles.recordCount}>
              {dataAnalysis.recordCount}{" "}
              {dataAnalysis.recordCount === 1 ? "record" : "records"}
            </span>
            {isMongoData && <span className={styles.dataSource}>MongoDB</span>}
          </div>
        </div>
      )}

      {/* Chart Rendering */}
      {showChart && currentView === "table" && (
        <ChartRenderer data={data} chartType={chartType} query={query} />
      )}

      {/* Table Rendering */}
      {showTable && (allowToggle ? currentView === "table" : true) && (
        <TableRenderer data={tableData} toolName={toolName} t={t} />
      )}

      {/* JSON Rendering */}
      {showJson && (allowToggle ? currentView === "json" : true) && (
        <JsonRenderer data={data} toolName={toolName} t={t} />
      )}
    </div>
  );
};
