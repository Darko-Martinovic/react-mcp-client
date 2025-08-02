import React from "react";
import { TableProps } from "./types";
import { exportToExcel } from "../../utils/exporters/ExcelExporter";
import styles from "./TableRenderer.module.css";

export const TableRenderer: React.FC<TableProps> = ({ data, toolName, t }) => {
  if (!Array.isArray(data) || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  // Function to format cell values
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      // Format currency if it looks like a price
      if (value % 1 !== 0 && value < 1000) {
        return `$${value.toFixed(2)}`;
      }
      return value.toLocaleString();
    }
    if (
      typeof value === "string" &&
      value.includes("T") &&
      value.includes("Z")
    ) {
      // Format ISO date strings
      try {
        const date = new Date(value);
        return (
          date.toLocaleDateString() +
          " " +
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  // Function to get column header display name
  const getColumnHeader = (col: string): string => {
    const headerMap: Record<string, string> = {
      productId: "ID",
      productName: "Product Name",
      stockQuantity: "Stock",
      unitPrice: "Unit Price",
      totalAmount: "Total",
      saleDate: "Sale Date",
      saleId: "Sale ID",
    };
    return headerMap[col] || col.charAt(0).toUpperCase() + col.slice(1);
  };

  // Function to get cell content class based on column type and value
  const getCellContentClass = (col: string, value: unknown): string => {
    let className = styles.cellContent;

    if (col.toLowerCase().includes("name")) {
      className += ` ${styles.cellContentName}`;
    } else if (
      col.toLowerCase().includes("price") ||
      col.toLowerCase().includes("amount")
    ) {
      className += ` ${styles.cellContentPrice}`;
    } else if (col.toLowerCase().includes("stock") && Number(value) < 30) {
      className += ` ${styles.cellContentLowStock}`;
    } else if (col.toLowerCase().includes("id")) {
      className += ` ${styles.cellContentId}`;
    }

    return className;
  };

  return (
    <div className={styles.tableContainer}>
      {toolName && (
        <div className={styles.tableTitle}>
          📊 {toolName} {t?.("table.title") || "Results"}
        </div>
      )}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead className={styles.tableHeader}>
            <tr>
              {columns.map((col) => (
                <th key={col} className={styles.tableHeaderCell}>
                  {getColumnHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className={`${styles.tableRow} ${
                  idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                }`}
              >
                {columns.map((col) => (
                  <td key={col} className={styles.tableCell}>
                    <span className={getCellContentClass(col, row[col])}>
                      {formatCellValue(row[col])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        <span>
          📋 {t?.("table.showing") || "Showing"} {data.length}{" "}
          {data.length !== 1
            ? t?.("table.results") || "results"
            : t?.("table.result") || "result"}
        </span>
        <button
          onClick={() => {
            const filename = toolName
              ? toolName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
              : "table_data";
            exportToExcel(data, filename, toolName);
          }}
          className={styles.excelButton}
          title={t?.("export.excelTitle") || "Download as Excel file"}
        >
          📊 {t?.("export.excel") || "Excel"}
        </button>
      </div>
    </div>
  );
};
