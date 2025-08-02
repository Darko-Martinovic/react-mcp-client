import React from "react";
import { VisualizationProps } from "./types";
import {
  getVisualizationType,
  shouldShowTable,
  shouldShowChart,
} from "./ChartTypeDetector";
import { TableRenderer } from "./TableRenderer";
import { ChartRenderer } from "./ChartRenderer";
import styles from "./DataVisualization.module.css";

export const DataVisualization: React.FC<VisualizationProps> = ({
  data,
  toolName,
  query,
  t,
}) => {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const chartType = getVisualizationType(data, query);
  const showTable = shouldShowTable(query);
  const showChart = shouldShowChart(chartType, query);

  return (
    <div className={styles.visualizationContainer}>
      {showChart && (
        <ChartRenderer data={data} chartType={chartType} query={query} />
      )}
      {showTable && <TableRenderer data={data} toolName={toolName} t={t} />}
    </div>
  );
};
