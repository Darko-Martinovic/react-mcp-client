import React, {
  useState,
  FormEvent,
  ChangeEvent,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import styles from "./Chat.module.css";
import { askAzureOpenAI } from "../services/azureOpenAI";
import { callMcpTool } from "../services/mcpServer";
import {
  fetchArticlesFromAzureSearch,
  fetchAzureSearchSchema,
  getSearchableFields,
  getFilterableFields,
} from "../services/azureSearch";
import { 
  callMCPServer, 
  parseAIResponseForMCPCall, 
  extractParametersDirectly,
  formatStructuredMCPResponse 
} from "../services/chatService";
import { getSystemPromptConfig } from "./SystemPromptEditor";
import EmojiPicker from "./EmojiPicker";
import QuestionPicker from "./QuestionPicker";
import { DataVisualization, isSimpleTable } from "./DataVisualization";
import {
  exportChat,
  exportChatAsText,
  exportChatAsMarkdown,
  copyToClipboard,
} from "../utils/exporters";
import * as XLSX from "xlsx";
import {
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Message {
  sender: "user" | "system";
  text?: string;
  tableData?: Record<string, unknown>[];
  toolName?: string;
  traceData?: {
    aiResponse?: any;
    mcpCall?: any;
    mcpResponse?: any;
    selectedTool?: any;
    parameters?: any;
    timestamp?: string;
    userInput?: string;
    error?: string;
  };
}

interface ChatProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  title?: string;
}

interface AIResponse {
  aiMessage: string;
  functionCalls?: any[];
}

interface MCPCall {
  function: string;
  parameters: Record<string, any>;
}

interface SearchResult {
  value: Array<{
    functionName?: string;
    name?: string;
    description?: string;
    endpoint?: string;
    httpMethod?: string;
    parameters?: string;
    category?: string;
    isActive?: boolean;
    responseType?: string;
    lastUpdated?: string;
  }>;
}

interface MCPResponse {
  success?: boolean;
  data?: Record<string, unknown>[];
  error?: string;
  timestamp?: string;
  count?: number;
  text?: string;
  tableData?: Record<string, unknown>[];
  toolName?: string;
  summary?: string;
}

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

type ChartType = "bar" | "line" | "pie" | "none";

// Function to export table data to Excel
const exportToExcel = (
  data: Record<string, unknown>[],
  filename: string,
  toolName?: string
) => {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  // Auto-size columns
  const columnWidths: { wch: number }[] = [];
  const headers = Object.keys(data[0]);

  headers.forEach((header, colIndex) => {
    let maxWidth = header.length;

    // Check all data rows for max width in this column
    data.forEach((row) => {
      const cellValue = String(row[header] || "");
      maxWidth = Math.max(maxWidth, cellValue.length);
    });

    // Set reasonable limits (min 10, max 50 characters)
    columnWidths.push({ wch: Math.min(Math.max(maxWidth, 10), 50) });
  });

  worksheet["!cols"] = columnWidths;

  // Style the header row
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }
  }

  // Add borders and formatting to data cells
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          },
          alignment: { vertical: "center" },
        };

        // Format numbers as currency if they look like prices
        const cellValue = worksheet[cellAddress].v;
        if (
          typeof cellValue === "number" &&
          cellValue % 1 !== 0 &&
          cellValue < 10000
        ) {
          worksheet[cellAddress].s.numFmt = "$#,##0.00";
        } else if (typeof cellValue === "number") {
          worksheet[cellAddress].s.numFmt = "#,##0";
        }
      }
    }
  }

  // Add the worksheet to the workbook
  const sheetName = toolName ? toolName.substring(0, 31) : "Data"; // Excel sheet names max 31 chars
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Add metadata sheet with export info
  const metadataSheet = XLSX.utils.aoa_to_sheet([
    ["Export Information"],
    [""],
    ["Tool Name:", toolName || "Unknown"],
    ["Export Date:", new Date().toLocaleString()],
    ["Total Records:", data.length],
    ["Columns:", headers.join(", ")],
    [""],
    ["Generated by React MCP Client"],
  ]);

  // Style the metadata sheet
  metadataSheet["A1"].s = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: "center" },
  };

  XLSX.utils.book_append_sheet(workbook, metadataSheet, "Export Info");

  // Generate and download the file
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const finalFilename = `${filename}_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, finalFilename);
};

const renderTable = (
  data: Record<string, unknown>[],
  toolName?: string,
  t?: (key: string) => string
) => {
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

const transformDataForChart = (
  data: Record<string, unknown>[]
): ChartData[] => {
  if (!data || data.length === 0) return [];

  const firstItem = data[0];
  const keys = Object.keys(firstItem);

  // Find the best key for names/labels (prefer text fields)
  const nameKey =
    keys.find(
      (key) =>
        typeof firstItem[key] === "string" &&
        (key.toLowerCase().includes("name") ||
          key.toLowerCase().includes("title") ||
          key.toLowerCase().includes("label") ||
          key.toLowerCase().includes("category"))
    ) ||
    keys.find((key) => typeof firstItem[key] === "string") ||
    keys[0];

  // Find the best key for values (prefer numeric fields)
  const valueKey =
    keys.find(
      (key) =>
        typeof firstItem[key] === "number" &&
        (key.toLowerCase().includes("count") ||
          key.toLowerCase().includes("total") ||
          key.toLowerCase().includes("amount") ||
          key.toLowerCase().includes("value") ||
          key.toLowerCase().includes("price"))
    ) || keys.find((key) => typeof firstItem[key] === "number");

  if (!valueKey) return [];

  return data.map((item, index) => ({
    name: String(item[nameKey] || `Item ${index + 1}`),
    value: Number(item[valueKey]) || 0,
    ...item,
  }));
};

const getVisualizationType = (
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

const shouldShowTable = (query?: string): boolean => {
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

const shouldShowChart = (chartType: ChartType, query?: string): boolean => {
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

const generateChartTitle = (
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

const renderChart = (
  data: Record<string, unknown>[],
  chartType: ChartType,
  query?: string
) => {
  const chartData = transformDataForChart(data);

  if (chartType === "none" || chartData.length === 0) return null;

  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7c7c",
    "#8dd1e1",
    "#d084d0",
    "#ffb347",
    "#87ceeb",
    "#dda0dd",
    "#98fb98",
  ];

  const chartTitle = generateChartTitle(chartType, data, query);

  const renderChartComponent = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        );

      case "line":
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              strokeWidth={2}
            />
          </LineChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className={styles.chartContainer}>
      <h4 className={styles.chartTitle}>{chartTitle}</h4>
      <ResponsiveContainer width="100%" height={300}>
        {renderChartComponent()}
      </ResponsiveContainer>
    </div>
  );
};

const buildSystemPrompt = (articles: string[]) => `
You are an MCP (Model Context Protocol) assistant. Use the provided MCP tool information to answer the user's question.

Available MCP Tools and Functions:
${articles.map((a, i) => `${i + 1}. ${a}`).join("\n")}

When the user asks about available tools, functions, or capabilities, refer to this list. If the user asks about something not in this list, let them know it's not available.
`;

const Chat: React.FC<ChatProps> = ({ messages, setMessages, title }) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [visibleTraces, setVisibleTraces] = useState<Set<number>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [systemConfig, setSystemConfig] = useState(() =>
    getSystemPromptConfig()
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Listen for system prompt config changes
  useEffect(() => {
    const handleConfigChange = (event: CustomEvent) => {
      setSystemConfig(event.detail);
    };

    window.addEventListener(
      "systemPromptConfigChanged",
      handleConfigChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "systemPromptConfigChanged",
        handleConfigChange as EventListener
      );
    };
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    }

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showExportMenu]);

  // Defensive fallback: ensure messages is always an array
  const safeMessages = Array.isArray(messages) ? messages : [];

  // Function to copy text and show visual feedback
  const copyToClipboardWithFeedback = (text: string, messageId: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedMessageId(messageId);
        // Hide the message after 2 seconds
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  // Function to toggle trace visibility
  const toggleTraceVisibility = (messageIndex: number) => {
    const newVisibleTraces = new Set(visibleTraces);
    if (newVisibleTraces.has(messageIndex)) {
      newVisibleTraces.delete(messageIndex);
    } else {
      newVisibleTraces.add(messageIndex);
    }
    setVisibleTraces(newVisibleTraces);
  };

  // Function to handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setInput((prevInput) => prevInput + emoji);
    setShowEmojiPicker(false);
    // Focus back on input after emoji selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Function to toggle emoji picker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
    // Close question picker when opening emoji picker
    if (!showEmojiPicker) {
      setShowQuestionPicker(false);
    }
  };

  // Function to handle question selection
  const handleQuestionSelect = (question: string) => {
    setInput(question);
    setShowQuestionPicker(false);
    // Focus on input after question selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Function to toggle question picker
  const toggleQuestionPicker = () => {
    setShowQuestionPicker((prev) => !prev);
    // Close emoji picker when opening question picker
    if (!showQuestionPicker) {
      setShowEmojiPicker(false);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Send clicked, input:", input);
    if (!input.trim() || loading) return;

    const userMsg: Message = { sender: "user", text: input };
    const baseMessages = Array.isArray(messages) ? messages : [];
    setMessages([...baseMessages, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Initialize trace data
      const traceData: any = {
        timestamp: new Date().toISOString(),
        userInput: input,
        aiResponse: null,
        mcpCall: null,
        mcpResponse: null,
        selectedTool: null,
        parameters: {},
        schema: null, // Add schema info to trace
      };

      // Check if user is asking about schema or capabilities
      const isSchemaQuery =
        input.toLowerCase().includes("schema") ||
        input.toLowerCase().includes("index") ||
        input.toLowerCase().includes("what tools") ||
        input.toLowerCase().includes("available tools") ||
        input.toLowerCase().includes("capabilities");

      if (isSchemaQuery) {
        // Fetch and display schema information
        const schema = await fetchAzureSearchSchema();
        traceData.schema = schema;

        if (schema) {
          const searchableFields = getSearchableFields(schema);
          const filterableFields = getFilterableFields(schema);

          const schemaInfo = `🔧 **Azure Search Index Schema**

**Index Name:** ${schema.indexName}

**Available Fields:**
${schema.fields
  .map(
    (field) =>
      `• **${field.name}** (${field.type})${field.key ? " 🔑" : ""}${
        field.searchable ? " 🔍" : ""
      }${field.filterable ? " 🏷️" : ""}${field.sortable ? " ↕️" : ""}`
  )
  .join("\n")}

**Field Legend:**
🔑 Key field | 🔍 Searchable | 🏷️ Filterable | ↕️ Sortable

**Searchable Fields:** ${searchableFields.join(", ")}
**Filterable Fields:** ${filterableFields.join(", ")}

**Total Fields:** ${schema.fields.length}
**Last Updated:** ${new Date().toLocaleString()}`;

          setMessages([
            ...baseMessages,
            userMsg,
            {
              sender: "system",
              text: schemaInfo,
              traceData: traceData,
            },
          ]);
          return;
        } else {
          setMessages([
            ...baseMessages,
            userMsg,
            {
              sender: "system",
              text: "❌ Could not retrieve Azure Search index schema. The schema endpoint may not be available.",
              traceData: traceData,
            },
          ]);
          return;
        }
      }

      // Step 1: Get AI intent (but don't display AI response)
      const aiResponse = await getAIIntent(input, baseMessages);
      traceData.aiResponse = {
        aiMessage: aiResponse.aiMessage,
        functionCalls: aiResponse.functionCalls,
      };

      console.log("=== AI RESPONSE DEBUG ===");
      console.log("Full AI Response Object:", aiResponse);
      console.log("AI Message Content:", aiResponse.aiMessage);
      console.log("AI Function Calls:", aiResponse.functionCalls);
      console.log("========================");

      // Check if AI generated function calls
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        console.log("=== PROCESSING FUNCTION CALLS ===");

        // Check for direct MCP tool calls (GetSalesByCategory, GetSalesData, etc.)
        const directMcpCall = aiResponse.functionCalls.find(
          (call: any) => call.name === "GetSalesByCategory" || 
                        call.name === "GetSalesData" || 
                        call.name === "GetProducts" ||
                        call.name === "GetInventory"
        );

        if (directMcpCall) {
          console.log("Found direct MCP tool call:", directMcpCall);

          // Extract parameters and add original user input for better parameter extraction
          const extractedParams = extractParametersDirectly(input);
          const finalParameters = { 
            ...directMcpCall.arguments, 
            ...extractedParams,
            originalUserInput: input 
          };

          // Remove unnecessary parameters for the MCP call
          delete finalParameters.originalUserInput;

          traceData.mcpCall = {
            function: directMcpCall.name,
            parameters: finalParameters,
          };
          traceData.selectedTool = directMcpCall.name;
          traceData.parameters = finalParameters;

          console.log("Direct MCP call with extracted parameters:", {
            tool: directMcpCall.name,
            parameters: finalParameters,
          });

          // Execute the direct MCP call
          try {
            const mcpResponse = await callMcpTool(directMcpCall.name, finalParameters);
            traceData.mcpResponse = mcpResponse;

            // Format and display the response
            let actualData: any = mcpResponse;
            if (mcpResponse && mcpResponse.data && typeof mcpResponse.data === "object") {
              actualData = mcpResponse.data;
            }

            const formattedResponse = formatStructuredMCPResponse(
              actualData,
              directMcpCall.name,
              finalParameters,
              input
            );

            if (formattedResponse.tableData) {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text: formattedResponse.summary,
                  tableData: formattedResponse.tableData,
                  toolName: directMcpCall.name,
                  traceData: traceData,
                },
              ]);
            } else {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text: formattedResponse.text || "No data returned from the tool.",
                  traceData: traceData,
                },
              ]);
            }
            return; // Exit here since we handled the direct MCP call
          } catch (mcpError) {
            console.error("Direct MCP Tool Error:", mcpError);
            traceData.error =
              mcpError instanceof Error ? mcpError.message : String(mcpError);
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: `Error calling ${directMcpCall.name}: ${
                  mcpError instanceof Error ? mcpError.message : String(mcpError)
                }`,
                traceData: traceData,
              },
            ]);
            return;
          }
        }

        // Find search_azure_cognitive function call (fallback method)
        const searchCall = aiResponse.functionCalls.find(
          (call: any) => call.name === "search_azure_cognitive"
        );

        if (searchCall && searchCall.arguments?.query) {
          console.log("Found search_azure_cognitive call:", searchCall);

          // Create MCP call from function call, including original user input for parameter extraction
          const mcpCall = {
            function: "multi_tool_use",
            parameters: {
              query: searchCall.arguments.query,
              originalUserInput: input, // Add original user input for parameter extraction
            },
          };

          traceData.mcpCall = mcpCall;
          traceData.selectedTool = mcpCall.function;
          traceData.parameters = mcpCall.parameters;

          console.log("Generated MCP call from function call:", mcpCall);

          // Execute the MCP call
          try {
            const mcpResponse = await callMCPServer(mcpCall);
            traceData.mcpResponse = mcpResponse;

            // Handle the response
            if (typeof mcpResponse === "object" && mcpResponse.tableData) {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text: mcpResponse.summary,
                  tableData: mcpResponse.tableData,
                  toolName: mcpResponse.toolName,
                  traceData: traceData,
                },
              ]);
            } else if (typeof mcpResponse === "object" && mcpResponse.text) {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text: mcpResponse.text,
                  traceData: traceData,
                },
              ]);
            } else {
              setMessages([
                ...baseMessages,
                userMsg,
                {
                  sender: "system",
                  text:
                    typeof mcpResponse === "string"
                      ? mcpResponse
                      : JSON.stringify(mcpResponse),
                  traceData: traceData,
                },
              ]);
            }
            return; // Exit here since we handled the function call
          } catch (mcpError) {
            console.error("MCP Server Error:", mcpError);
            traceData.error =
              mcpError instanceof Error ? mcpError.message : String(mcpError);
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: "Sorry, I couldn't process your request through the MCP server. Please try again.",
                traceData: traceData,
              },
            ]);
            return;
          }
        }
        console.log("=================================");
      }

      // Step 2: Parse AI response to extract MCP server call (fallback)
      const mcpCall = parseAIResponseForMCPCall(aiResponse.aiMessage);
      traceData.mcpCall = mcpCall;
      traceData.selectedTool = mcpCall?.function;
      traceData.parameters = mcpCall?.parameters || {};

      console.log("=== MCP CALL EXTRACTION ===");
      console.log("Extracted MCP Call:", mcpCall);
      console.log("==========================");

      if (mcpCall) {
        // Step 3: Call MCP server directly instead of showing AI response
        try {
          const mcpResponse = await callMCPServer(mcpCall);
          traceData.mcpResponse = mcpResponse;

          // Check if the response contains table data
          if (typeof mcpResponse === "object" && mcpResponse.tableData) {
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: mcpResponse.summary,
                tableData: mcpResponse.tableData,
                toolName: mcpResponse.toolName,
                traceData: traceData,
              },
            ]);
          } else if (typeof mcpResponse === "object" && mcpResponse.text) {
            // Handle structured response with text property
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text: mcpResponse.text,
                traceData: traceData,
              },
            ]);
          } else {
            // Handle string response
            setMessages([
              ...baseMessages,
              userMsg,
              {
                sender: "system",
                text:
                  typeof mcpResponse === "string"
                    ? mcpResponse
                    : JSON.stringify(mcpResponse),
                traceData: traceData,
              },
            ]);
          }
        } catch (mcpError) {
          console.error("MCP Server Error:", mcpError);
          traceData.error =
            mcpError instanceof Error ? mcpError.message : String(mcpError);
          setMessages([
            ...baseMessages,
            userMsg,
            {
              sender: "system",
              text: "Sorry, I couldn't process your request through the MCP server. Please try again.",
              traceData: traceData,
            },
          ]);
        }
      } else {
        // No MCP call needed, use AI response as fallback
        setMessages([
          ...baseMessages,
          userMsg,
          { sender: "system", text: aiResponse.aiMessage },
        ]);
      }
    } catch (err) {
      console.error("Error processing request:", err);
      setMessages([
        ...baseMessages,
        userMsg,
        { sender: "system", text: t("app.error") },
      ]);
    } finally {
      setLoading(false);
      // Keep focus on input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  // Function to get AI intent without displaying the response
  const getAIIntent = async (
    userMessage: string,
    previousMessages: Message[]
  ): Promise<AIResponse> => {
    // Get system configuration first
    const systemConfig = getSystemPromptConfig();

    // Fetch schema first to understand the index structure
    const schema = await fetchAzureSearchSchema();
    console.log("=== AZURE SEARCH SCHEMA ===");
    console.log("Schema loaded:", schema);

    if (schema) {
      const searchableFields = getSearchableFields(schema);
      const filterableFields = getFilterableFields(schema);
      console.log("Searchable fields:", searchableFields);
      console.log("Filterable fields:", filterableFields);
    }
    console.log("===========================");

    // Fetch articles from Azure Search for RAG context
    const articles = await fetchArticlesFromAzureSearch("*");

    // Build enhanced system prompt with schema information
    let schemaInfo = "";
    if (schema) {
      schemaInfo = `

Index Schema Information:
- Index Name: ${schema.indexName}
- Available Fields: ${schema.fields
        .map((f) => `${f.name} (${f.type})`)
        .join(", ")}
- Searchable Fields: ${getSearchableFields(schema).join(", ")}
- Filterable Fields: ${getFilterableFields(schema).join(", ")}`;
    }

    // Build system prompt with MCP function instruction
    const baseSystemPrompt = `You are an intelligent assistant that helps users interact with MCP (Model Context Protocol) tools through Azure Search.

When users ask questions about products, inventory, sales, or business data, you should call the search_azure_cognitive function to find relevant tools and data.

Your job is to:
1. Understand the user's intent
2. Call the search_azure_cognitive function with appropriate search terms
3. The system will automatically find the best MCP tool and execute it

Query Intent Guidelines:
- For product listings/inventory: search for "products inventory" to find GetProducts or GetDetailedInventory tools
- For specific suppliers: include supplier name in search
- For specific categories: include category name in search  
- For sales data: search for "sales data" to find GetSalesData tools
- For low stock alerts: search for "low stock" to find GetLowStockProducts tool
- For general inventory/stock levels: search for "detailed inventory" to find GetDetailedInventory tool
- For revenue data: search for "revenue" to find GetTotalRevenue tool
- For category performance: search for "sales category" to find GetSalesByCategory tool
- For daily summaries: search for "daily summary" to find GetDailySummary tool
- For inventory status: search for "inventory status" to find GetInventoryStatus tool

Available MCP tools in the search index: ${articles
      .map((a: any) => a.functionName || a.name)
      .join(", ")}${schemaInfo}

Available sample tools: ${articles
      .map((a: any) => `${a.functionName}: ${a.description}`)
      .slice(0, 3)
      .join(", ")}`;

    // Add custom prompt addition if configured
    const finalSystemPrompt = systemConfig.customPromptAddition
      ? `${baseSystemPrompt}

CUSTOM INSTRUCTIONS:
${systemConfig.customPromptAddition}`
      : baseSystemPrompt;

    if (systemConfig.enableDetailedLogging) {
      console.log("=== SYSTEM PROMPT ===");
      console.log("Base prompt length:", baseSystemPrompt.length);
      console.log("Custom addition:", systemConfig.customPromptAddition);
      console.log("Final prompt length:", finalSystemPrompt.length);
      console.log("=====================");
    }

    return await askAzureOpenAI(userMessage, finalSystemPrompt);
  };

  // Function to parse AI response and extract MCP server call
  const parseAIResponseForMCPCall = (aiResponse: string): MCPCall | null => {
    try {
      console.log("=== PARSING AI RESPONSE ===");
      console.log("Raw AI Response:", aiResponse);
      console.log("AI Response Length:", aiResponse.length);

      // Look for structured function calls in AI response
      const functionMatch = aiResponse.match(/Function:\s*([\w.]+)/i);
      const parametersMatch = aiResponse.match(/Parameters:\s*({.*?})/s);

      console.log("Function Match:", functionMatch);
      console.log("Parameters Match:", parametersMatch);

      if (functionMatch) {
        const functionName = functionMatch[1];
        let parameters: Record<string, any> = {};

        if (parametersMatch) {
          try {
            parameters = JSON.parse(parametersMatch[1]);
            console.log("Successfully parsed parameters:", parameters);
          } catch (e) {
            console.warn("Could not parse parameters:", parametersMatch[1]);
            // Try to extract query from the parameters string
            const queryMatch = parametersMatch[1].match(/"query":\s*"([^"]+)"/);
            if (queryMatch) {
              parameters = { query: queryMatch[1] };
              console.log("Extracted query from parameters:", parameters);
            }
          }
        }

        // Handle multi_tool_use.parallel function calls
        if (
          functionName === "multi_tool_use.parallel" &&
          parameters.tool_uses
        ) {
          // Extract the query from the first tool use
          const firstTool = parameters.tool_uses[0];
          if (firstTool && firstTool.parameters && firstTool.parameters.query) {
            const result: MCPCall = {
              function: "multi_tool_use",
              parameters: { query: firstTool.parameters.query },
            };
            console.log(
              "Multi-tool function call extracted successfully:",
              result
            );
            return result;
          }
        }

        const result: MCPCall = {
          function: functionName.toLowerCase(),
          parameters,
        };
        console.log("Function call extracted successfully:", result);
        return result;
      }

      // Fallback: try to infer from AI response content
      console.log("No structured function found, trying fallback...");
      const lowerResponse = aiResponse.toLowerCase();
      console.log("Lowercase response:", lowerResponse);

      // Check for search-related keywords
      if (
        lowerResponse.includes("search") ||
        lowerResponse.includes("find") ||
        lowerResponse.includes("look") ||
        lowerResponse.includes("show")
      ) {
        console.log("Found search-related keywords, extracting query...");
        const searchQuery = extractSearchQuery(aiResponse);
        console.log("Extracted search query:", searchQuery);
        if (searchQuery) {
          const fallbackResult: MCPCall = {
            function: "search",
            parameters: { query: searchQuery },
          };
          console.log("Fallback function call created:", fallbackResult);
          return fallbackResult;
        }
      }

      console.log("No MCP function call could be extracted");
      return null;
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return null;
    }
  };

  // Function to call actual MCP server on port 5000
  const callMCPServer = async (mcpCall: MCPCall): Promise<MCPResponse> => {
    console.log("Calling actual MCP Server on port 5000:", mcpCall);

    // Get schema information for enhanced debugging
    const schema = await fetchAzureSearchSchema();
    if (schema) {
      console.log("=== SCHEMA VALIDATION ===");
      console.log("Index Name:", schema.indexName);
      console.log(
        "Available Fields:",
        schema.fields.map((f) => f.name)
      );
      console.log("========================");
    }

    // First, get the available tools from Azure Search to find the right tool name and endpoint
    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mcpCall.parameters.query || "*" }),
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed with ${searchResponse.status}`);
    }

    const searchData: SearchResult = await searchResponse.json();
    console.log("Search results for tool lookup:", searchData);
    console.log("=== ENHANCED TOOL SELECTION DEBUG ===");
    console.log("Query used for tool search:", mcpCall.parameters.query || "*");
    console.log("Available tools found:", searchData.value?.length || 0);

    // Enhanced tool logging with schema-aware field checking
    searchData.value?.forEach((tool, index) => {
      console.log(`Tool ${index}:`, {
        functionName: tool.functionName,
        name: tool.name,
        description: tool.description,
        endpoint: tool.endpoint,
        httpMethod: tool.httpMethod,
        // Check if all expected schema fields are present
        hasRequiredFields: {
          functionName: !!tool.functionName,
          description: !!tool.description,
          endpoint: !!tool.endpoint,
          httpMethod: !!tool.httpMethod,
        },
      });
    });

    // Special debugging for category queries
    const originalQuery = mcpCall.parameters.query || "";
    if (originalQuery.toLowerCase().includes("dairy")) {
      console.log("=== DAIRY CATEGORY QUERY DEBUG ===");
      console.log(
        "Looking for tools that might handle category filtering better..."
      );
      const categorySpecificTools = searchData.value?.filter(
        (tool) =>
          tool.functionName &&
          (tool.functionName.toLowerCase().includes("category") ||
            tool.functionName.toLowerCase().includes("filter") ||
            tool.functionName.toLowerCase().includes("bycategory") ||
            tool.description?.toLowerCase().includes("category") ||
            tool.description?.toLowerCase().includes("filter"))
      );
      console.log(
        "Category-specific tools found:",
        categorySpecificTools?.length || 0
      );
      categorySpecificTools?.forEach((tool, idx) => {
        console.log(`Category Tool ${idx}:`, {
          functionName: tool.functionName,
          description: tool.description?.substring(0, 150),
          endpoint: tool.endpoint,
        });
      });
      console.log("===================================");
    }

    console.log("=====================================");

    // Extract the best matching tool and its endpoint
    let selectedTool = null;
    if (searchData.value && searchData.value.length > 0) {
      // Check if we need to override tool selection based on query intent
      const originalQuery = mcpCall.parameters.query || "";
      const isLowStockQuery =
        originalQuery.toLowerCase().includes("low stock") ||
        originalQuery.toLowerCase().includes("under") ||
        originalQuery.toLowerCase().includes("below");

      const isGeneralInventoryQuery =
        !isLowStockQuery &&
        (originalQuery.toLowerCase().includes("all") ||
          originalQuery.toLowerCase().includes("current stock") ||
          originalQuery.toLowerCase().includes("inventory") ||
          originalQuery.toLowerCase().includes("detailed"));

      console.log("Enhanced query analysis:", {
        isLowStockQuery,
        isGeneralInventoryQuery,
        originalQuery,
        queryLength: originalQuery.length,
        queryWords: originalQuery.split(" ").length,
      });

      // Try to find the most appropriate tool with schema validation
      if (isGeneralInventoryQuery) {
        // First, check if there are category-specific tools for this query
        let selectedCategoryTool = null;
        if (
          originalQuery.toLowerCase().includes("dairy") ||
          originalQuery.toLowerCase().includes("meat") ||
          originalQuery.toLowerCase().includes("fruits") ||
          originalQuery.toLowerCase().includes("vegetables") ||
          originalQuery.toLowerCase().includes("beverages") ||
          originalQuery.toLowerCase().includes("bakery")
        ) {
          selectedCategoryTool = searchData.value.find(
            (tool) =>
              tool.functionName &&
              tool.endpoint &&
              (tool.functionName.toLowerCase().includes("category") ||
                tool.functionName.toLowerCase().includes("filter") ||
                tool.functionName.toLowerCase().includes("bycategory") ||
                (tool.description &&
                  (tool.description.toLowerCase().includes("category") ||
                    tool.description.toLowerCase().includes("filter by"))))
          );

          if (selectedCategoryTool) {
            selectedTool = selectedCategoryTool;
            console.log("Override: Selected category-specific tool:", {
              functionName: selectedTool.functionName,
              description: selectedTool.description?.substring(0, 100),
              endpoint: selectedTool.endpoint,
            });
          }
        }

        // If no category-specific tool found, look for general inventory/products tools
        if (!selectedCategoryTool) {
          // For category queries, prefer GetProducts tool which supports category filtering
          let inventoryTool = null;

          // First priority: GetProducts tool (best for category filtering)
          if (
            originalQuery.toLowerCase().includes("dairy") ||
            originalQuery.toLowerCase().includes("meat") ||
            originalQuery.toLowerCase().includes("fruits") ||
            originalQuery.toLowerCase().includes("vegetables") ||
            originalQuery.toLowerCase().includes("beverages") ||
            originalQuery.toLowerCase().includes("bakery")
          ) {
            inventoryTool = searchData.value.find(
              (tool) =>
                tool.functionName &&
                tool.endpoint &&
                tool.functionName.toLowerCase() === "getproducts" &&
                tool.parameters &&
                tool.parameters.toLowerCase().includes("category")
            );

            if (inventoryTool) {
              console.log(
                "Priority: Selected GetProducts for category filtering:",
                {
                  functionName: inventoryTool.functionName,
                  parameters: inventoryTool.parameters,
                  reason: "Best tool for category filtering",
                }
              );
            }
          }

          // Second priority: Other inventory/products tools
          if (!inventoryTool) {
            inventoryTool = searchData.value.find(
              (tool) =>
                tool.functionName &&
                tool.endpoint && // Ensure we have required fields
                (tool.functionName.toLowerCase().includes("inventory") ||
                  tool.functionName.toLowerCase().includes("products") ||
                  tool.functionName.toLowerCase().includes("getproduct")) &&
                !tool.functionName.toLowerCase().includes("low") &&
                !tool.functionName.toLowerCase().includes("stock")
            );
          }

          if (inventoryTool) {
            selectedTool = inventoryTool;
            console.log(
              "Override: Selected general inventory tool with validation:",
              {
                functionName: selectedTool.functionName,
                endpoint: selectedTool.endpoint,
                hasEndpoint: !!selectedTool.endpoint,
                isValid: !!(selectedTool.functionName && selectedTool.endpoint),
                parameters: selectedTool.parameters,
              }
            );
          } else {
            // Fallback to first tool with required fields
            selectedTool =
              searchData.value.find(
                (tool) => tool.functionName && tool.endpoint
              ) || searchData.value[0];
            console.log(
              "Fallback: Using highest scoring tool with validation:",
              selectedTool
            );
          }
        }
      } else {
        // Use the highest scoring result with required fields for other queries
        selectedTool =
          searchData.value.find((tool) => tool.functionName && tool.endpoint) ||
          searchData.value[0];
        console.log("Selected tool to call with validation:", selectedTool);
      }
    }

    if (!selectedTool || !selectedTool.endpoint) {
      const errorMsg = !selectedTool
        ? "No matching MCP tool found for your request."
        : `Selected tool "${selectedTool.functionName}" is missing endpoint information.`;
      console.error("Tool selection failed:", errorMsg);
      return { text: errorMsg };
    }

    console.log("Selected tool for MCP call:", {
      functionName: selectedTool.functionName,
      endpoint: selectedTool.endpoint,
      httpMethod: selectedTool.httpMethod,
      description: selectedTool.description?.substring(0, 100) + "...",
    });

    // Use the mcpServer service to make the actual call through the proxy
    try {
      console.log("=== CALLING MCP SERVER VIA PROXY ===");
      console.log("Tool name:", selectedTool.functionName);
      console.log("Original query:", originalQuery);
      console.log("Parameters:", mcpCall.parameters);

      // Use originalUserInput for parameter extraction if available (from function calls)
      const queryForExtraction =
        mcpCall.parameters.originalUserInput || originalQuery;
      console.log("Query used for parameter extraction:", queryForExtraction);

      // Extract parameters from the original query for this specific tool
      const extractedParams = extractParametersDirectly(queryForExtraction);
      console.log("Extracted parameters from query:", extractedParams);

      // Merge the extracted parameters with the original query parameters
      const finalParameters = { ...mcpCall.parameters, ...extractedParams };

      // Remove the 'query' and 'originalUserInput' parameters as they're not needed for the actual MCP call
      delete finalParameters.query;
      delete finalParameters.originalUserInput;

      console.log("Final parameters for MCP call:", finalParameters);
      console.log("====================================");

      // Call the MCP server through our proxy using the mcpServer service
      const toolName = selectedTool.functionName || "UnknownTool";
      const mcpData = await callMcpTool(toolName, finalParameters);

      console.log("MCP response received:", mcpData);

      // Extract the actual data from the MCP response wrapper
      let actualData: any = mcpData;
      if (mcpData && mcpData.data && typeof mcpData.data === "object") {
        // If the response has a nested data structure, use the inner data
        actualData = mcpData.data;
        console.log("Extracted inner data from MCP response:", actualData);
      }

      return formatStructuredMCPResponse(
        actualData,
        selectedTool.functionName || "Unknown Tool",
        finalParameters,
        originalQuery
      );
    } catch (mcpError) {
      console.error("Error calling MCP server via proxy:", mcpError);
      return {
        text: `Error connecting to MCP server: ${
          mcpError instanceof Error ? mcpError.message : String(mcpError)
        }. Available tool: ${selectedTool.functionName} - ${
          selectedTool.description
        }`,
      };
    }
  };

  // Function to detect if user wants summary vs detailed data
  const isSummaryRequest = (originalQuery: string): boolean => {
    const summaryKeywords = [
      "total",
      "overall",
      "sum",
      "revenue",
      "amount",
      "what was",
      "how much",
      "what is",
      "total sales",
      "total revenue",
      "overall sales",
      "sum of",
      "aggregate",
    ];

    const detailedKeywords = [
      "show me all",
      "list all",
      "breakdown",
      "details",
      "detailed",
      "analytics",
      "analysis",
      "each",
      "individual",
      "transaction",
      "item by item",
    ];

    const lowerQuery = originalQuery.toLowerCase();

    // Check for detailed keywords first (more specific)
    const hasDetailedKeywords = detailedKeywords.some((keyword) =>
      lowerQuery.includes(keyword)
    );

    if (hasDetailedKeywords) {
      return false; // User wants detailed data
    }

    // Check for summary keywords
    const hasSummaryKeywords = summaryKeywords.some((keyword) =>
      lowerQuery.includes(keyword)
    );

    return hasSummaryKeywords;
  };

  // Function to calculate summary from sales data
  const calculateSalesSummary = (
    tableData: any[],
    parameters?: Record<string, any>
  ): string => {
    if (!tableData || tableData.length === 0) {
      return "No sales data found for the specified period.";
    }

    // Calculate total revenue
    const totalRevenue = tableData.reduce((sum, sale) => {
      return sum + (sale.totalAmount || 0);
    }, 0);

    // Get date range from the data
    const salesDates = tableData
      .map((sale) => new Date(sale.saleDate))
      .filter((date) => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const fromDate =
      salesDates.length > 0 ? salesDates[0].toLocaleDateString() : "N/A";
    const toDate =
      salesDates.length > 0
        ? salesDates[salesDates.length - 1].toLocaleDateString()
        : "N/A";

    // Build filter info
    let filterInfo = "";
    if (parameters?.startDate && parameters?.endDate) {
      const startDate = new Date(parameters.startDate);
      const endDate = new Date(parameters.endDate);
      filterInfo = `\n📅 **Period:** ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} (${
        parameters.startDate
      } to ${parameters.endDate})`;
    }

    if (parameters?.category) {
      filterInfo += `\n🏷️ **Category:** ${parameters.category}`;
    }

    if (parameters?.supplier) {
      filterInfo += `\n🏢 **Supplier:** ${parameters.supplier}`;
    }

    return `💰 **Total Revenue:** $${totalRevenue.toFixed(2)}${filterInfo}
📊 **Transaction Count:** ${tableData.length}
📅 **Date Range:** ${fromDate} - ${toDate}`;
  };

  // Function to return structured data for better table rendering
  const formatStructuredMCPResponse = (
    data: any,
    toolName: string,
    parameters?: Record<string, any>,
    originalQuery?: string
  ): MCPResponse => {
    console.log("Formatting structured MCP response:", data);

    if (data.error) {
      return { text: `Error from MCP server: ${data.error}` };
    }

    // Build parameter info for display
    let paramInfo = "";
    if (parameters) {
      const relevantParams = Object.entries(parameters)
        .filter(([key, value]) => key !== "query" && value)
        .map(([key, value]) => {
          // Format dates more clearly
          if (key === "startDate" || key === "endDate") {
            const date = new Date(value as string);
            return `${key}: ${date.toLocaleDateString()} (${value})`;
          }
          return `${key}: ${value}`;
        })
        .join(", ");

      if (relevantParams) {
        paramInfo = `\n🔍 **Applied Filters:** ${relevantParams}`;
      }
    }

    // Handle successful responses with data array
    if (data.success !== undefined) {
      if (data.data && Array.isArray(data.data)) {
        const tableData = data.data;

        if (tableData.length === 0) {
          return {
            text: `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** No data found${
              parameters?.supplier
                ? ` for supplier "${parameters.supplier}"`
                : ""
            }${
              parameters?.category
                ? ` in category "${parameters.category}"`
                : ""
            }\n⏰ **Timestamp:** ${data.timestamp || "N/A"}\n🔢 **Count:** ${
              data.count || 0
            }`,
          };
        }

        // Check if this is a sales data request and user wants summary
        const isSalesData =
          toolName.toLowerCase().includes("sales") ||
          tableData.some((item: any) => item.totalAmount !== undefined);
        const isCategoryData =
          toolName.toLowerCase().includes("category") ||
          tableData.some((item: any) => item.category !== undefined);
        const wantsSummary = originalQuery
          ? isSummaryRequest(originalQuery)
          : false;

        console.log("=== SUMMARY DETECTION ===");
        console.log("Original query:", originalQuery);
        console.log("Is sales data:", isSalesData);
        console.log("Is category data:", isCategoryData);
        console.log("Wants summary:", wantsSummary);
        console.log("Tool name:", toolName);
        console.log("=========================");

        if (isSalesData && wantsSummary && !isCategoryData) {
          // Return summary format for total/revenue queries (but not category breakdowns)
          const summaryText = calculateSalesSummary(tableData, parameters);

          return {
            text: `✅ **${toolName}** executed successfully\n\n${summaryText}\n⏰ **Timestamp:** ${
              data.timestamp || new Date().toLocaleString()
            }`,
          };
        }

        // Return detailed format for other queries
        let summary = `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Results (${
          data.count || tableData.length
        }):**`;

        // Add note if default date range was auto-applied
        if (parameters?.startDate && parameters?.endDate && originalQuery) {
          const hasExplicitDateInQuery =
            originalQuery.toLowerCase().includes("last month") ||
            originalQuery.toLowerCase().includes("last week") ||
            originalQuery.toLowerCase().includes("yesterday") ||
            originalQuery.toLowerCase().includes("today") ||
            originalQuery.toLowerCase().includes("days") ||
            /\d{4}-\d{2}-\d{2}/.test(originalQuery); // Check for date format

          if (
            !hasExplicitDateInQuery &&
            (toolName.toLowerCase().includes("sales") ||
              toolName.toLowerCase().includes("category"))
          ) {
            summary += `\n\n📅 **Note:** Default 30-day date range applied automatically for analysis.`;
          }
        }

        // Check for potential filtering issues and add warning to summary
        if (parameters?.supplier && tableData.length > 0) {
          const filteredItems = tableData.filter(
            (item: any) => item.supplier === parameters.supplier
          ).length;

          if (tableData.length > filteredItems && filteredItems > 0) {
            summary += `\n\n⚠️ **Note:** Backend returned ${tableData.length} items but only ${filteredItems} match the supplier filter. Backend filtering may not be working correctly.`;
          } else if (filteredItems === 0) {
            summary += `\n\n⚠️ **Note:** No items match the specified supplier "${parameters.supplier}". Backend may not be filtering correctly.`;
          }
        }

        if (data.timestamp) {
          summary += `\n⏰ **Timestamp:** ${data.timestamp}`;
        }

        return {
          summary,
          tableData,
          toolName,
        };
      } else if (data.success) {
        return {
          text: `✅ **${toolName}** executed successfully${paramInfo}\n\n📊 **Result:** ${JSON.stringify(
            data,
            null,
            2
          )}`,
        };
      } else {
        return {
          text: `❌ **${toolName}** execution failed${paramInfo}\n\n📊 **Result:** ${JSON.stringify(
            data,
            null,
            2
          )}`,
        };
      }
    }

    // Check if it's a table/array response (fallback)
    if (Array.isArray(data) || (data.data && Array.isArray(data.data))) {
      const tableData = Array.isArray(data) ? data : data.data;

      if (tableData.length === 0) {
        return {
          text: `📊 **${toolName} Results:** No data found${paramInfo}`,
        };
      }

      let summary = `📊 **${toolName} Results:**${paramInfo}`;

      return {
        summary,
        tableData,
        toolName,
      };
    }

    // Handle other response types
    if (typeof data === "object") {
      return {
        text: `📊 **${toolName} Results:**${paramInfo}\n\n${JSON.stringify(
          data,
          null,
          2
        )}`,
      };
    }

    return {
      text: `📊 **${toolName} Results:**${paramInfo}\n\n${String(data)}`,
    };
  };

  // Function to extract search query from text
  const extractSearchQuery = (text: string): string => {
    // Look for quoted search terms
    const quotedMatch = text.match(/"([^"]+)"/);
    if (quotedMatch) return quotedMatch[1];

    // Look for search terms after common keywords
    const searchPatterns = [
      /(?:search|find|look|show).*?(?:for|about)\s+(.+?)(?:\.|$)/i,
      /(?:what|which).*?(?:kind|type|sort).*?(?:of|are)\s+(.+?)(?:\.|$)/i,
      /(?:tools?|functions?|items?).*?(?:about|for|on)\s+(.+?)(?:\.|$)/i,
    ];

    for (const pattern of searchPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1]
          .trim()
          .replace(/[^\w\s]/g, "")
          .trim();
      }
    }

    // Extract key terms (fallback)
    const words = text
      .split(" ")
      .filter(
        (word) =>
          word.length > 3 &&
          ![
            "the",
            "and",
            "for",
            "with",
            "that",
            "this",
            "what",
            "which",
            "kind",
            "type",
          ].includes(word.toLowerCase())
      )
      .map((word) => word.replace(/[^\w]/g, ""));

    return words.slice(0, 3).join(" ").trim() || "*";
  };

  // Direct parameter extraction function as fallback
  const extractParametersDirectly = (query: string): Record<string, any> => {
    const today = new Date();
    const currentDate = today.toISOString().split("T")[0];
    const lowerQuery = query.toLowerCase();

    console.log("=== DIRECT PARAMETER EXTRACTION ===");
    console.log("Query:", query);
    console.log("Today's date:", currentDate);

    const params: Record<string, any> = {};

    // Extract numeric thresholds for stock level queries
    const thresholdPatterns = [
      /(?:under|below|less than|fewer than)\s+(\d+)/i,
      /(\d+)\s+(?:units?|items?|or less|or fewer)/i,
      /stock.*?(?:under|below|less than|fewer than)\s+(\d+)/i,
      /(?:under|below|less than|fewer than)\s+(\d+).*?(?:units?|items?)/i,
    ];

    for (const pattern of thresholdPatterns) {
      const match = query.match(pattern);
      if (match) {
        const threshold = parseInt(match[1]);
        if (!isNaN(threshold) && threshold > 0) {
          params.threshold = threshold;
          console.log("Detected stock threshold:", threshold);
          break;
        }
      }
    }

    // Extract supplier information first
    const supplierPatterns = [
      /from\s+([A-Z][^.?]*(?:Co\.|Corp\.|Inc\.|Ltd\.|LLC|Company))/i,
      /supplier\s+([A-Z][^.?]*(?:Co\.|Corp\.|Inc\.|Ltd\.|LLC|Company))/i,
      /([A-Z][A-Za-z\s]*(?:Co\.|Corp\.|Inc\.|Ltd\.|LLC|Company))/g,
    ];

    for (const pattern of supplierPatterns) {
      const match = query.match(pattern);
      if (match) {
        const supplier = match[1] || match[0];
        if (supplier && supplier.length > 3) {
          params.supplier = supplier.trim();
          console.log("Detected supplier:", params.supplier);
          break;
        }
      }
    }

    // Extract category information (but not if it looks like a supplier)
    const categoryKeywords = [
      "dairy",
      "meat",
      "fruits",
      "vegetables",
      "beverages",
      "bakery",
    ];
    for (const category of categoryKeywords) {
      if (
        lowerQuery.includes(category) &&
        !lowerQuery.includes(category + " co")
      ) {
        params.category = category.charAt(0).toUpperCase() + category.slice(1);
        console.log("Detected category:", params.category);
        break;
      }
    }

    // Calculate date ranges based on common phrases
    if (
      lowerQuery.includes("last month") ||
      lowerQuery.includes("past month")
    ) {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log("Detected 'last month' - calculating 30 days ago to today");
      console.log(`Date range: ${startDate} to ${currentDate}`);
      params.startDate = startDate;
      params.endDate = currentDate;
    }

    if (
      lowerQuery.includes("last two months") ||
      lowerQuery.includes("past two months")
    ) {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log(
        "Detected 'last two months' - calculating 60 days ago to today"
      );
      console.log(`Date range: ${startDate} to ${currentDate}`);
      params.startDate = startDate;
      params.endDate = currentDate;
    }

    if (lowerQuery.includes("last week") || lowerQuery.includes("past week")) {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log("Detected 'last week' - calculating 7 days ago to today");
      console.log(`Date range: ${startDate} to ${currentDate}`);
      params.startDate = startDate;
      params.endDate = currentDate;
    }

    if (lowerQuery.includes("yesterday")) {
      const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log("Detected 'yesterday' - using yesterday's date");
      console.log(`Date range: ${yesterdayDate} to ${yesterdayDate}`);
      params.startDate = yesterdayDate;
      params.endDate = yesterdayDate;
    }

    if (lowerQuery.includes("today")) {
      console.log("Detected 'today' - using today's date");
      console.log(`Date range: ${currentDate} to ${currentDate}`);
      params.startDate = currentDate;
      params.endDate = currentDate;
    }

    // Check for "last X days" pattern
    const daysMatch = lowerQuery.match(/last (\d+) days?/);
    if (daysMatch) {
      const numDays = parseInt(daysMatch[1]);
      const startDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log(
        `Detected 'last ${numDays} days' - calculating ${numDays} days ago to today`
      );
      console.log(`Date range: ${startDate} to ${currentDate}`);
      params.startDate = startDate;
      params.endDate = currentDate;
    }

    // Check for category performance queries without explicit date range
    if (
      (lowerQuery.includes("categories performing") ||
        lowerQuery.includes("category performance") ||
        lowerQuery.includes("sales by category") ||
        lowerQuery.includes("category sales") ||
        lowerQuery.includes("different categories")) &&
      !params.startDate &&
      !params.endDate
    ) {
      // Default to last 30 days for category performance analysis
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      console.log(
        "Detected category performance query - applying default 30-day range"
      );
      console.log(`Date range: ${startDate} to ${currentDate}`);
      params.startDate = startDate;
      params.endDate = currentDate;
    }

    console.log("Extracted parameters:", params);
    console.log("===============================");
    return params;
  };

  // Function to use AI for intelligent parameter extraction
  const extractParametersWithAI = async (
    userQuery: string,
    tool: any
  ): Promise<Record<string, any>> => {
    try {
      const currentDate = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const systemPrompt = `You are a parameter extraction specialist. Extract relevant parameters from the user query for the given tool.

TOOL: ${tool.functionName} - ${tool.description}
QUERY: "${userQuery}"
TODAY: ${currentDate}

CRITICAL PARAMETER EXTRACTION RULES:

1. SUPPLIERS vs CATEGORIES:
   - SUPPLIERS are company names ending in "Co.", "Corp.", "Inc.", "Ltd.", "LLC", or containing "Company"
   - CATEGORIES are product types like "Dairy", "Meat", "Fruits", "Vegetables", "Beverages", "Bakery"
   - "Fresh Dairy Co." = supplier (NOT category)
   - "Premium Meats Inc." = supplier (NOT category)
   - "Dairy" = category (NOT supplier)

2. DATE CALCULATIONS (exact values to use):
   - "last month" → startDate: "${thirtyDaysAgo}", endDate: "${currentDate}"
   - "last two months" → startDate: "${sixtyDaysAgo}", endDate: "${currentDate}"  
   - "last week" → startDate: "${sevenDaysAgo}", endDate: "${currentDate}"
   - "yesterday" → startDate: "${yesterday}", endDate: "${yesterday}"
   - "today" → startDate: "${currentDate}", endDate: "${currentDate}"

3. LOW STOCK QUERIES:
   - Extract numeric thresholds for stock level queries
   - Use "threshold", "maxStockLevel", "stockThreshold", or "limit" parameter names
   - Examples: "under 30", "below 50", "less than 25" → extract the number

4. PARAMETER NAMING:
   - Use "supplier" for company names
   - Use "category" for product types
   - Use "threshold" or "maxStockLevel" for stock level limits
   - For sales queries, ALWAYS include both startDate and endDate

Return ONLY valid JSON with the parameters. Examples:

Input: "What were our total sales for the last month?"
Output: {"startDate": "${thirtyDaysAgo}", "endDate": "${currentDate}"}

Input: "Show me all dairy products"  
Output: {"category": "Dairy"}

Input: "What products do we get from Fresh Dairy Co.?"
Output: {"supplier": "Fresh Dairy Co."}

Input: "Products from Premium Meats Inc."
Output: {"supplier": "Premium Meats Inc."}

Input: "Show me dairy products from Fresh Dairy Co."
Output: {"category": "Dairy", "supplier": "Fresh Dairy Co."}

Input: "Sales from last week"
Output: {"startDate": "${sevenDaysAgo}", "endDate": "${currentDate}"}

Input: "Which products have low stock levels under 30 units?"
Output: {"threshold": 30}

Input: "Show me products with stock below 50"
Output: {"maxStockLevel": 50}

Input: "Low stock dairy products under 25 units"
Output: {"category": "Dairy", "threshold": 25}

Input: "How are our different product categories performing in sales?"
Output: {"startDate": "${thirtyDaysAgo}", "endDate": "${currentDate}"}

Input: "Category sales performance this month"
Output: {"startDate": "${thirtyDaysAgo}", "endDate": "${currentDate}"}

Input: "Sales breakdown by category"
Output: {"startDate": "${thirtyDaysAgo}", "endDate": "${currentDate}"}

Return {} if no parameters needed.`;

      console.log("=== AI PARAMETER EXTRACTION PROMPT ===");
      console.log("System prompt:", systemPrompt);
      console.log("=======================================");

      const response = await askAzureOpenAI(userQuery, systemPrompt);

      console.log("=== AI RESPONSE ===");
      console.log("Raw AI response:", response.aiMessage);
      console.log("===================");

      try {
        // Try to parse the AI response as JSON
        const jsonMatch = response.aiMessage.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const extractedParams = JSON.parse(jsonMatch[0]);

          // Validate extracted dates
          if (
            extractedParams.startDate &&
            !isValidDate(extractedParams.startDate)
          ) {
            console.warn(
              "Invalid startDate extracted:",
              extractedParams.startDate
            );
            delete extractedParams.startDate;
          }
          if (
            extractedParams.endDate &&
            !isValidDate(extractedParams.endDate)
          ) {
            console.warn("Invalid endDate extracted:", extractedParams.endDate);
            delete extractedParams.endDate;
          }

          console.log("AI successfully extracted parameters:", extractedParams);
          return extractedParams;
        } else {
          console.log(
            "AI response doesn't contain valid JSON, trying line-by-line parsing..."
          );

          // Try to extract JSON from response lines
          const lines = response.aiMessage.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
              try {
                const parsed = JSON.parse(trimmed);
                console.log("Found JSON in line:", trimmed);
                return parsed;
              } catch (e) {
                continue;
              }
            }
          }

          console.log("No valid JSON found in AI response");
          return {};
        }
      } catch (parseError) {
        console.warn(
          "Could not parse AI parameter extraction response:",
          response.aiMessage
        );
        return {};
      }
    } catch (error) {
      console.error("Error in AI parameter extraction:", error);
      return {};
    }
  };

  // Helper function to validate date strings
  const isValidDate = (dateString: string): boolean => {
    const date = new Date(dateString);
    return (
      date instanceof Date &&
      !isNaN(date.getTime()) &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    );
  };

  return (
    <div className={styles.chatContainer}>
      {/* Export Chat Button */}
      <div className={styles.exportSection}>
        <div ref={exportMenuRef} className={styles.exportMenuContainer}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className={styles.exportButton}
          >
            <span role="img" aria-label="export">
              📤
            </span>
            {t("export.button")}
            <span style={{ marginLeft: 4 }}>▼</span>
          </button>

          {showExportMenu && (
            <div className={styles.exportDropdown}>
              <button
                onClick={() => {
                  exportChat(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                className={styles.exportOption}
              >
                📋 {t("export.json")}
              </button>
              <button
                onClick={() => {
                  exportChatAsText(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                className={styles.exportOption}
              >
                📄 {t("export.text")}
              </button>
              <button
                onClick={() => {
                  exportChatAsMarkdown(safeMessages, title || "chat");
                  setShowExportMenu(false);
                }}
                className={styles.exportOption}
              >
                📝 {t("export.markdown")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className={styles.messagesContainer}>
        <div className={styles.messagesWrapper}>
          {safeMessages.length === 0 && (
            <div className={styles.emptyMessages}>{t("app.noMessages")}</div>
          )}
          {safeMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.messageItem} ${
                msg.sender === "user"
                  ? styles.messageItemUser
                  : styles.messageItemSystem
              }`}
            >
              {/* Message label */}
              <div
                className={`${styles.messageLabel} ${
                  msg.sender === "user"
                    ? styles.messageLabelUser
                    : styles.messageLabelSystem
                }`}
              >
                {msg.sender === "user" ? t("app.you") : t("app.ai")}
              </div>

              {msg.tableData ? (
                <>
                  {/* Show summary text above the table if it exists */}
                  {msg.text && (
                    <span
                      className={`${styles.messageBubble} ${
                        msg.sender === "user"
                          ? styles.messageBubbleUser
                          : styles.messageBubbleSystem
                      }`}
                      style={{ marginBottom: "10px", display: "block" }}
                    >
                      {msg.text}
                    </span>
                  )}

                  {/* Conditional table rendering */}
                  {(() => {
                    const originalQuery = msg.traceData?.userInput || msg.text;
                    return (
                      shouldShowTable(originalQuery) &&
                      renderTable(msg.tableData, msg.toolName, t)
                    );
                  })()}

                  {/* Conditional chart visualization */}
                  {(() => {
                    const originalQuery = msg.traceData?.userInput || msg.text;
                    const chartType = getVisualizationType(
                      msg.tableData,
                      originalQuery
                    );
                    return shouldShowChart(chartType, originalQuery)
                      ? renderChart(msg.tableData, chartType, originalQuery)
                      : null;
                  })()}

                  {/* Copy button for table data */}
                  <div
                    className={`${styles.messageActions} ${
                      msg.sender === "user"
                        ? styles.messageActionsUser
                        : styles.messageActionsSystem
                    }`}
                  >
                    <div className={styles.copyButtonContainer}>
                      <button
                        onClick={() =>
                          copyToClipboardWithFeedback(
                            JSON.stringify(msg.tableData, null, 2),
                            `table-${idx}`
                          )
                        }
                        className={styles.copyButton}
                        title="Copy Table"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === `table-${idx}` && (
                        <div className={styles.copyTooltip}>
                          {t("table.copied") || "Copied!"}
                        </div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label className={styles.traceToggle}>
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                        />
                        {t("trace.showTrace") || "Show Trace Call"}
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span
                    className={`${styles.messageBubble} ${
                      msg.sender === "user"
                        ? styles.messageBubbleUser
                        : styles.messageBubbleSystem
                    }`}
                  >
                    {msg.text}
                  </span>
                  {/* Copy button for text messages */}
                  <div
                    className={`${styles.messageActions} ${
                      msg.sender === "user"
                        ? styles.messageActionsUser
                        : styles.messageActionsSystem
                    }`}
                  >
                    <div className={styles.copyButtonContainer}>
                      <button
                        onClick={() =>
                          copyToClipboardWithFeedback(
                            msg.text || "",
                            `text-${idx}`
                          )
                        }
                        className={styles.copyButton}
                        title="Copy Message"
                      >
                        <span role="img" aria-label="copy">
                          📋
                        </span>
                      </button>
                      {copiedMessageId === `text-${idx}` && (
                        <div className={styles.copyTooltip}>Copied!</div>
                      )}
                    </div>

                    {/* Trace Call checkbox - only show for system messages with trace data */}
                    {msg.sender === "system" && msg.traceData && (
                      <label className={styles.traceToggle}>
                        <input
                          type="checkbox"
                          checked={visibleTraces.has(idx)}
                          onChange={() => toggleTraceVisibility(idx)}
                        />
                        {t("trace.showTrace") || "Show Trace Call"}
                      </label>
                    )}
                  </div>
                </>
              )}

              {/* Trace details panel - only show when checkbox is checked */}
              {msg.sender === "system" &&
                msg.traceData &&
                visibleTraces.has(idx) && (
                  <div className={styles.tracePanel}>
                    <div className={styles.traceTitle}>
                      <span>Trace Information</span>
                      <div className={styles.copyButtonContainer}>
                        <button
                          onClick={() => {
                            const traceText = JSON.stringify(
                              msg.traceData,
                              null,
                              2
                            );
                            copyToClipboardWithFeedback(
                              traceText,
                              `trace-${idx}`
                            );
                          }}
                          className={styles.copyButton}
                          title="Copy Trace Data"
                        >
                          <span role="img" aria-label="copy">
                            📋
                          </span>
                        </button>
                        {copiedMessageId === `trace-${idx}` && (
                          <div className={styles.copyTooltip}>Copied!</div>
                        )}
                      </div>
                    </div>

                    <div className={styles.traceItem}>
                      <strong>Timestamp:</strong> {msg.traceData.timestamp}
                    </div>

                    {msg.traceData.userInput && (
                      <div className={styles.traceItem}>
                        <strong>User Input:</strong> {msg.traceData.userInput}
                      </div>
                    )}

                    {msg.traceData.selectedTool && (
                      <div className={styles.traceItem}>
                        <strong>Selected Tool:</strong>{" "}
                        {msg.traceData.selectedTool}
                      </div>
                    )}

                    {msg.traceData.parameters &&
                      Object.keys(msg.traceData.parameters).length > 0 && (
                        <div className={styles.traceItem}>
                          <strong>Parameters:</strong>
                          <pre className={styles.traceCode}>
                            {JSON.stringify(msg.traceData.parameters, null, 2)}
                          </pre>
                        </div>
                      )}

                    {msg.traceData.aiResponse && (
                      <div className={styles.traceItem}>
                        <strong>AI Response:</strong>
                        <pre className={styles.traceCode}>
                          {JSON.stringify(msg.traceData.aiResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpCall && (
                      <div className={styles.traceItem}>
                        <strong>MCP Call:</strong>
                        <pre className={styles.traceCode}>
                          {JSON.stringify(msg.traceData.mcpCall, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.mcpResponse && (
                      <div className={styles.traceItem}>
                        <strong>MCP Response:</strong>
                        <pre className={styles.traceCode}>
                          {JSON.stringify(msg.traceData.mcpResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {msg.traceData.error && (
                      <div
                        className={`${styles.traceItem} ${styles.traceItemError}`}
                      >
                        <strong>Error:</strong> {msg.traceData.error}
                      </div>
                    )}
                  </div>
                )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {loading && (
          <div className={styles.loadingMessage}>{t("app.processing")}</div>
        )}
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <form onSubmit={handleSend} className={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={t("app.placeholder") || "Type your message..."}
            className={styles.chatInput}
            disabled={loading}
          />
          <button
            type="button"
            className={styles.questionButton}
            onClick={toggleQuestionPicker}
            disabled={loading}
            title="Standard questions"
          >
            ❓
          </button>
          <button
            type="button"
            className={styles.emojiButton}
            onClick={toggleEmojiPicker}
            disabled={loading}
            title="Add emoji"
          >
            😀
          </button>
          <button
            type="submit"
            className={styles.sendButton}
            disabled={loading}
          >
            {loading ? t("app.processing") : t("app.send")}
          </button>
        </form>

        {/* Question Picker */}
        {showQuestionPicker && (
          <QuestionPicker
            onQuestionSelect={handleQuestionSelect}
            onClose={() => setShowQuestionPicker(false)}
          />
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Chat;
