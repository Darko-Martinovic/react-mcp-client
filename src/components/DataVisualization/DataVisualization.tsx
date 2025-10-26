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

  // Debug logging
  console.log("DataVisualization - toolName:", toolName);
  console.log("DataVisualization - displayMode:", displayMode);
  console.log(
    "DataVisualization - data type:",
    Array.isArray(data) ? "array" : typeof data
  );
  console.log(
    "DataVisualization - data sample:",
    Array.isArray(data) ? data[0] : data
  );

  // Handle empty data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // Handle non-array data (single document/object)
  if (!Array.isArray(data)) {
    // Special handling for GetLatestStatistics - extract contentTypes array
    if (
      toolName &&
      toolName.toLowerCase().includes("getlateststatistics") &&
      data.data &&
      data.data.contentTypes &&
      Array.isArray(data.data.contentTypes)
    ) {
      // Extract and transform the contentTypes array for table display
      const transformedData = data.data.contentTypes.map((item: any) => ({
        className: item.className || "",
        count: item.count || 0,
        contentType: item.contentType || "",
      }));

      return (
        <div className={styles.visualizationContainer}>
          {/* Table View */}
          <TableRenderer data={transformedData} toolName={toolName} t={t} />

          {/* JSON View Header */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📋</span>
            <span className={styles.sectionTitle}>
              {t ? t("view.rawPayload") : "Raw JSON Payload"}
            </span>
          </div>

          {/* JSON View */}
          <JsonRenderer data={data} toolName={toolName} t={t} />
        </div>
      );
    }

    // Default: show only JSON for non-array data
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

  // Check if this is a tool that should show both table and JSON
  const shouldShowBothViews =
    toolName &&
    (toolName.toLowerCase().includes("plu") ||
      toolName.toLowerCase().includes("getpludata") ||
      toolName.toLowerCase().includes("getlateststatistics"));

  console.log("shouldShowBothViews:", shouldShowBothViews);
  console.log("showTable before force:", showTable);
  console.log("showJson before force:", showJson);

  // Force both views for specific tools
  if (shouldShowBothViews) {
    showTable = true;
    showJson = true;
    showChart = false; // Disable chart in dual view mode
  }

  console.log("showTable after force:", showTable);
  console.log("showJson after force:", showJson);

  console.log("Render condition check:", {
    shouldShowBothViews,
    showTable,
    willRenderDualView: shouldShowBothViews && showTable,
  });

  // Transform GetLatestStatistics data for table view
  const transformGetLatestStatisticsData = (data: any[]): any[] => {
    if (!Array.isArray(data) || data.length === 0) return data;

    // Check if this is GetLatestStatistics data structure
    const firstItem = data[0];
    if (
      !firstItem ||
      typeof firstItem !== "object" ||
      !("content" in firstItem)
    ) {
      return data;
    }

    // Extract and flatten the content array
    const transformedData: any[] = [];
    for (const item of data) {
      if (Array.isArray(item.content)) {
        for (const contentItem of item.content) {
          if (contentItem && typeof contentItem === "object") {
            transformedData.push({
              className: contentItem.className || "",
              count: contentItem.count || 0,
              contenttype: contentItem.contenttype || "",
            });
          }
        }
      }
    }

    return transformedData.length > 0 ? transformedData : data;
  };

  // Prepare table data
  let finalTableData = tableData;
  if (
    toolName &&
    toolName.toLowerCase().includes("getlateststatistics") &&
    shouldShowBothViews
  ) {
    finalTableData = transformGetLatestStatisticsData(data);
  }

  return (
    <div className={styles.visualizationContainer}>
      {/* View Toggle Controls */}
      {allowToggle && showJson && showTable && !shouldShowBothViews && (
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
      {showChart && currentView === "table" && !shouldShowBothViews && (
        <ChartRenderer data={data} chartType={chartType} query={query} />
      )}

      {/* Show both table and JSON for specific tools */}
      {shouldShowBothViews && showTable ? (
        <>
          {/* Chart for table view */}
          {showChart && (
            <ChartRenderer data={data} chartType={chartType} query={query} />
          )}

          {/* Table View */}
          <TableRenderer data={finalTableData} toolName={toolName} t={t} />

          {/* JSON View Header */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📋</span>
            <span className={styles.sectionTitle}>
              {t ? t("view.rawPayload") : "Raw JSON Payload"}
            </span>
          </div>

          {/* JSON View */}
          <JsonRenderer data={data} toolName={toolName} t={t} />
        </>
      ) : (
        <>
          {/* Table Rendering */}
          {showTable && (allowToggle ? currentView === "table" : true) && (
            <TableRenderer data={tableData} toolName={toolName} t={t} />
          )}

          {/* JSON Rendering */}
          {showJson && (allowToggle ? currentView === "json" : true) && (
            <JsonRenderer data={data} toolName={toolName} t={t} />
          )}
        </>
      )}
    </div>
  );
};
