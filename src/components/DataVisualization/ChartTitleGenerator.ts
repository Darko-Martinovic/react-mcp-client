import { ChartType } from "./types";

export const generateChartTitle = (
  chartType: ChartType,
  data: Record<string, unknown>[],
  query?: string
): string => {
  // Extract meaningful information from the data
  const firstItem = data[0] || {};
  const keys = Object.keys(firstItem);

  // Look for category or filtering info in the query
  const queryLower = query?.toLowerCase() || "";

  // Extract category information
  let categoryInfo = "";
  const categoryMatch = queryLower.match(/category[:\s]*([a-zA-Z]+)/i);
  if (categoryMatch) {
    categoryInfo = categoryMatch[1];
  } else {
    // Look for common category names in the query
    const categories = [
      "dairy",
      "meat",
      "fruits",
      "vegetables",
      "beverages",
      "bakery",
    ];
    const foundCategory = categories.find((cat) => queryLower.includes(cat));
    if (foundCategory) {
      categoryInfo = foundCategory;
    }
  }

  // Extract supplier information
  let supplierInfo = "";
  const supplierMatch = queryLower.match(/supplier[:\s]*([a-zA-Z\s]+)/i);
  if (supplierMatch) {
    supplierInfo = supplierMatch[1].trim();
  }

  // Generate appropriate titles based on chart type and content
  let baseTitle = "";

  if (queryLower.includes("sales") || queryLower.includes("revenue")) {
    if (chartType === "pie") {
      baseTitle = "Sales Distribution";
    } else if (chartType === "line") {
      baseTitle = "Sales Trends";
    } else {
      baseTitle = "Sales Comparison";
    }
  } else if (queryLower.includes("stock") || queryLower.includes("inventory")) {
    if (chartType === "pie") {
      baseTitle = "Inventory Distribution";
    } else if (chartType === "line") {
      baseTitle = "Stock Levels Over Time";
    } else {
      baseTitle = "Stock Comparison";
    }
  } else if (queryLower.includes("products")) {
    if (chartType === "pie") {
      baseTitle = "Product Distribution";
    } else {
      baseTitle = "Product Analysis";
    }
  } else {
    // Generic titles based on chart type
    if (chartType === "pie") {
      baseTitle = "Distribution Analysis";
    } else if (chartType === "line") {
      baseTitle = "Trend Analysis";
    } else {
      baseTitle = "Comparison Analysis";
    }
  }

  // Add category or supplier context if found
  if (categoryInfo) {
    baseTitle += ` - ${
      categoryInfo.charAt(0).toUpperCase() + categoryInfo.slice(1)
    }`;
  } else if (supplierInfo) {
    baseTitle += ` - ${supplierInfo}`;
  }

  return baseTitle;
};
