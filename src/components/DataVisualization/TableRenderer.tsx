import React from "react";
import { TableProps } from "./types";
import { exportToExcel } from "../../utils/exporters/ExcelExporter";
import styles from "./TableRenderer.module.css";

export const TableRenderer: React.FC<TableProps> = ({ data, toolName, t }) => {
  if (!Array.isArray(data) || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  // Function to format cell values
  const formatCellValue = (value: unknown, columnName?: string): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      // Check if this is a monetary column that should show 2 decimal places
      const isMonetaryColumn =
        columnName &&
        (columnName.toLowerCase().includes("sales") ||
          columnName.toLowerCase().includes("amount") ||
          columnName.toLowerCase().includes("price") ||
          columnName.toLowerCase().includes("total") ||
          columnName.toLowerCase().includes("revenue") ||
          columnName.toLowerCase().includes("cost"));

      if (isMonetaryColumn) {
        // Format monetary values with exactly 2 decimal places
        return value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else {
        // Format other numbers (quantities, counts, etc.) without forcing decimals
        return value.toLocaleString();
      }
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
      unitPrice: "Unit Price (in €)",
      totalAmount: "Total (in €)",
      saleDate: "Sale Date",
      saleId: "Sale ID",
      totalSales: "Total Sales (in €)",
      totalQuantity: "Total Quantity",
    };

    // Check if this is a monetary column
    const isMonetaryColumn =
      col.toLowerCase().includes("sales") ||
      col.toLowerCase().includes("amount") ||
      col.toLowerCase().includes("price") ||
      col.toLowerCase().includes("total") ||
      col.toLowerCase().includes("revenue") ||
      col.toLowerCase().includes("cost");

    // If not in headerMap, convert camelCase to readable format
    if (headerMap[col]) {
      return headerMap[col];
    }

    // Convert camelCase to Title Case with spaces
    let formattedHeader = col
      .replace(/([A-Z])/g, " $1") // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim(); // Remove any leading/trailing spaces

    // Add currency indicator for monetary columns
    if (isMonetaryColumn) {
      formattedHeader += " (in €)";
    }

    return formattedHeader;
  };

  // Function to get cell content class based on column type and value
  const getCellContentClass = (col: string, value: unknown): string => {
    let className = styles.cellContent;

    if (col.toLowerCase().includes("name")) {
      className += ` ${styles.cellContentName}`;
    } else if (
      col.toLowerCase().includes("price") ||
      col.toLowerCase().includes("amount") ||
      col.toLowerCase().includes("sales") ||
      col.toLowerCase().includes("total") ||
      col.toLowerCase().includes("quantity") ||
      typeof value === "number"
    ) {
      className += ` ${styles.cellContentNumber}`;
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
                    <span
                      className={getCellContentClass(col, row[col])}
                      data-column={col}
                    >
                      {formatCellValue(row[col], col)}
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
