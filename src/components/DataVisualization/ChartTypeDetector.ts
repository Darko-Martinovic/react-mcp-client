import { ChartType } from "./types";
import { getSystemPromptConfig } from "../SystemPromptEditor";

export const getVisualizationType = (
  data: Record<string, unknown>[],
  query?: string
): ChartType => {
  const systemConfig = getSystemPromptConfig();

  if (!data || data.length === 0) return "none";

  const queryLower = query?.toLowerCase() || "";
  const firstItem = data[0];
  const keys = Object.keys(firstItem);

  // Check for explicit "no chart" or "table only" requests
  if (
    queryLower.includes("table only") ||
    queryLower.includes("no chart") ||
    queryLower.includes("no graph") ||
    queryLower.includes("just table") ||
    queryLower.includes("only table")
  ) {
    return "none";
  }

  // Check for explicit visualization requests in query with specific types
  if (queryLower.includes("pie chart") || queryLower.includes("pie"))
    return "pie";
  if (
    queryLower.includes("line chart") ||
    queryLower.includes("line graph") ||
    queryLower.includes("trend") ||
    queryLower.includes("over time")
  )
    return "line";
  if (
    queryLower.includes("bar chart") ||
    queryLower.includes("bar graph") ||
    queryLower.includes("bar chat") || // Handle common typo
    queryLower.includes("bar") ||
    queryLower.includes("compare")
  )
    return "bar";

  // Check for general chart/graph requests (let system decide type)
  const wantsVisualization =
    queryLower.includes("chart") ||
    queryLower.includes("chat") || // Handle common typo
    queryLower.includes("graph") ||
    queryLower.includes("visualize") ||
    queryLower.includes("plot") ||
    queryLower.includes("show graph") ||
    queryLower.includes("show chart") ||
    queryLower.includes("show chat") || // Handle common typo
    // Enhanced detection for distribution requests
    (queryLower.includes("distribution") &&
      (queryLower.includes("chart") ||
        queryLower.includes("chat") || // Handle common typo
        queryLower.includes("graph") ||
        queryLower.includes("just") ||
        queryLower.includes("only")));

  // If user explicitly wants visualization, determine best type
  if (wantsVisualization) {
    // Check if data has time-based fields (good for line charts)
    const hasTimeField = keys.some(
      (key) =>
        key.toLowerCase().includes("date") ||
        key.toLowerCase().includes("time") ||
        key.toLowerCase().includes("year") ||
        key.toLowerCase().includes("month")
    );

    if (hasTimeField) return "line";

    // If data has categorical names and numeric values, choose based on size
    const hasNameField = keys.some(
      (key) =>
        typeof firstItem[key] === "string" &&
        (key.toLowerCase().includes("name") ||
          key.toLowerCase().includes("category") ||
          key.toLowerCase().includes("type"))
    );

    const hasNumericField = keys.some(
      (key) => typeof firstItem[key] === "number"
    );

    if (hasNameField && hasNumericField) {
      // Use pie chart for smaller datasets (good for parts of a whole)
      if (data.length <= 8) return "pie";
      return "bar";
    }

    return systemConfig?.defaultVisualizationType || "bar"; // Default when visualization is requested
  }

  // Auto-detection for implicit requests (current behavior)
  // Only show charts automatically for certain contexts
  const autoChartContexts = [
    "distribution",
    "breakdown",
    "analysis",
    "performance",
    "comparison",
    "trends",
    "pattern",
  ];

  const hasAutoChartContext = autoChartContexts.some((context) =>
    queryLower.includes(context)
  );

  if (!hasAutoChartContext) {
    return "none"; // Don't show charts unless explicitly requested or in specific contexts
  }

  // Check if data has time-based fields (good for line charts)
  const hasTimeField = keys.some(
    (key) =>
      key.toLowerCase().includes("date") ||
      key.toLowerCase().includes("time") ||
      key.toLowerCase().includes("year") ||
      key.toLowerCase().includes("month")
  );

  if (hasTimeField) return "line";

  // If data has categorical names and numeric values, use bar chart
  const hasNameField = keys.some(
    (key) =>
      typeof firstItem[key] === "string" &&
      (key.toLowerCase().includes("name") ||
        key.toLowerCase().includes("category") ||
        key.toLowerCase().includes("type"))
  );

  const hasNumericField = keys.some(
    (key) => typeof firstItem[key] === "number"
  );

  if (hasNameField && hasNumericField) {
    // Use pie chart for smaller datasets (good for parts of a whole)
    if (data.length <= 8) return "pie";
    return "bar";
  }

  return "none";
};

export const shouldShowTable = (query?: string): boolean => {
  if (!query) return true; // Default: show table

  const queryLower = query.toLowerCase();

  // Check for explicit "chart only" or "graph only" requests
  if (
    queryLower.includes("chart only") ||
    queryLower.includes("graph only") ||
    queryLower.includes("just chart") ||
    queryLower.includes("just graph") ||
    queryLower.includes("only chart") ||
    queryLower.includes("only graph") ||
    queryLower.includes("no table") ||
    // Handle common typos like "chat" instead of "chart"
    queryLower.includes("only chat") ||
    queryLower.includes("just chat") ||
    queryLower.includes("chat only") ||
    // More flexible patterns including typos
    /\bjust\s+(chart|graph|visualization|chat)\b/.test(queryLower) ||
    /\bonly\s+(chart|graph|visualization|chat)\b/.test(queryLower) ||
    /(chart|graph|visualization|chat)\s+only\b/.test(queryLower) ||
    /\bonly\s+show\s+(a\s+)?(chart|graph|visualization|chat)\b/.test(
      queryLower
    ) ||
    /\bshow\s+only\s+(a\s+)?(chart|graph|visualization|chat)\b/.test(queryLower)
  ) {
    return false;
  }

  return true; // Default: show table
};

export const shouldShowChart = (
  chartType: ChartType,
  query?: string
): boolean => {
  if (chartType === "none") return false;

  if (!query) return true; // If we have a valid chart type, show it

  const queryLower = query.toLowerCase();

  // Check for explicit "table only" requests
  if (
    queryLower.includes("table only") ||
    queryLower.includes("no chart") ||
    queryLower.includes("no graph") ||
    queryLower.includes("just table") ||
    queryLower.includes("only table")
  ) {
    return false;
  }

  return true; // Default: show chart if type is determined
};
