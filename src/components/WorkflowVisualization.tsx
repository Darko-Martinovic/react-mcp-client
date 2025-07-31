import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./WorkflowVisualization.module.css";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  details: string;
  icon: string;
  type: "input" | "ai" | "mcp" | "processing" | "output";
  position: { x: number; y: number };
}

interface WorkflowVisualizationProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowVisualization: React.FC<WorkflowVisualizationProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const workflowSteps: WorkflowStep[] = [
    {
      id: "user-input",
      title: t("workflow.userInput.title") || "User Input",
      description:
        t("workflow.userInput.description") || "Natural language question",
      details:
        t("workflow.userInput.details") ||
        'User types a business question in plain English, such as "What were our dairy sales last month?" or "Which products are low in stock?" The system supports multiple languages (English, French, Dutch) and various query types including analysis, reporting, and data visualization requests.',
      icon: "💬",
      type: "input",
      position: { x: 10, y: 20 },
    },
    {
      id: "azure-ai",
      title: t("workflow.azureAI.title") || "Azure OpenAI",
      description:
        t("workflow.azureAI.description") ||
        "Intent analysis & function extraction",
      details:
        t("workflow.azureAI.details") ||
        "Azure OpenAI processes the user query to understand intent and extract structured function calls. It analyzes the request type (sales data, inventory, low stock, etc.), identifies the appropriate MCP tool to call, and extracts relevant parameters like date ranges, suppliers, categories, and thresholds using advanced AI reasoning.",
      icon: "🧠",
      type: "ai",
      position: { x: 35, y: 20 },
    },
    {
      id: "parameter-extraction",
      title: t("workflow.parameterExtraction.title") || "Parameter Extraction",
      description:
        t("workflow.parameterExtraction.description") ||
        "Smart parameter processing",
      details:
        t("workflow.parameterExtraction.details") ||
        'The system intelligently extracts parameters from natural language using both AI-powered analysis and regex patterns. It handles date calculations ("last month" → specific dates), supplier names ("Fresh Dairy Co."), categories ("Dairy"), and numeric thresholds ("under 30 units"). Failed AI extraction falls back to direct pattern matching.',
      icon: "⚙️",
      type: "processing",
      position: { x: 60, y: 20 },
    },
    {
      id: "mcp-server",
      title: t("workflow.mcpServer.title") || "MCP Server",
      description:
        t("workflow.mcpServer.description") || "Database query execution",
      details:
        t("workflow.mcpServer.details") ||
        "The MCP server receives the structured function call and executes the appropriate database queries. It handles various endpoints like inventory management, sales analytics, category performance, and low stock alerts. The server processes filters, applies date ranges, and returns structured JSON data with comprehensive metadata.",
      icon: "🗄️",
      type: "mcp",
      position: { x: 85, y: 20 },
    },
    {
      id: "data-processing",
      title: t("workflow.dataProcessing.title") || "Data Processing",
      description:
        t("workflow.dataProcessing.description") ||
        "Response formatting & enrichment",
      details:
        t("workflow.dataProcessing.details") ||
        "Raw MCP server responses are processed and enriched. The system determines whether to show summary or detailed data based on user intent, formats currency and dates, validates filtering results, and prepares data for visualization. It also handles error cases and provides meaningful feedback.",
      icon: "🔄",
      type: "processing",
      position: { x: 10, y: 60 },
    },
    {
      id: "visualization",
      title: t("workflow.visualization.title") || "Data Visualization",
      description:
        t("workflow.visualization.description") || "Charts & tables generation",
      details:
        t("workflow.visualization.details") ||
        "The system automatically selects the best visualization type based on data structure and user preferences. It generates interactive charts (bar, pie, line) using Recharts library, creates professional data tables with sorting and filtering, and provides export options. Users can specify visualization preferences in their queries.",
      icon: "📊",
      type: "output",
      position: { x: 35, y: 60 },
    },
    {
      id: "excel-export",
      title: t("workflow.excelExport.title") || "Excel Export",
      description:
        t("workflow.excelExport.description") || "Professional reporting",
      details:
        t("workflow.excelExport.details") ||
        "Data can be exported to professionally formatted Excel files using the XLSX library. The export includes styled headers, auto-sized columns, alternating row colors, and comprehensive metadata sheets. Files are automatically named with timestamps and include source information, making them perfect for business reporting.",
      icon: "📈",
      type: "output",
      position: { x: 60, y: 60 },
    },
    {
      id: "user-interface",
      title: t("workflow.userInterface.title") || "User Interface",
      description:
        t("workflow.userInterface.description") || "Multilingual display",
      details:
        t("workflow.userInterface.details") ||
        "The final results are displayed in the user's selected language (English, French, or Dutch) with interactive tables, responsive charts, copy-to-clipboard functionality, and comprehensive trace debugging. Users can switch languages dynamically, with separate chat histories maintained for each language.",
      icon: "🖥️",
      type: "output",
      position: { x: 85, y: 60 },
    },
  ];

  const connections = [
    { from: "user-input", to: "azure-ai" },
    { from: "azure-ai", to: "parameter-extraction" },
    { from: "parameter-extraction", to: "mcp-server" },
    { from: "mcp-server", to: "data-processing" },
    { from: "data-processing", to: "visualization" },
    { from: "data-processing", to: "excel-export" },
    { from: "visualization", to: "user-interface" },
    { from: "excel-export", to: "user-interface" },
  ];

  const handleStepClick = (stepId: string) => {
    setSelectedStep(selectedStep === stepId ? null : stepId);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            🔄 {t("workflow.title") || "Application Workflow"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.instructions}>
            💡{" "}
            {t("workflow.instructions") ||
              "Click on any component to learn about its role in the workflow"}
          </div>

          <div className={styles.workflowContainer}>
            {/* Render connections */}
            <svg className={styles.connections}>
              {connections.map((connection, index) => {
                const fromStep = workflowSteps.find(
                  (s) => s.id === connection.from
                );
                const toStep = workflowSteps.find(
                  (s) => s.id === connection.to
                );

                if (!fromStep || !toStep) return null;

                const fromX = fromStep.position.x + 10;
                const fromY = fromStep.position.y + 5;
                const toX = toStep.position.x + 10;
                const toY = toStep.position.y + 5;

                return (
                  <line
                    key={index}
                    x1={`${fromX}%`}
                    y1={`${fromY}%`}
                    x2={`${toX}%`}
                    y2={`${toY}%`}
                    className={styles.connectionLine}
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}

              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    className={styles.arrowHead}
                  />
                </marker>
              </defs>
            </svg>

            {/* Render workflow steps */}
            {workflowSteps.map((step) => (
              <div
                key={step.id}
                className={`${styles.workflowStep} ${styles[step.type]} ${
                  selectedStep === step.id ? styles.selected : ""
                }`}
                style={{
                  left: `${step.position.x}%`,
                  top: `${step.position.y}%`,
                }}
                onClick={() => handleStepClick(step.id)}
              >
                <div className={styles.stepIcon}>{step.icon}</div>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepDescription}>{step.description}</div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selectedStep && (
            <div className={styles.detailPanel}>
              {(() => {
                const step = workflowSteps.find((s) => s.id === selectedStep);
                if (!step) return null;

                return (
                  <div className={styles.stepDetails}>
                    <div className={styles.detailHeader}>
                      <span className={styles.detailIcon}>{step.icon}</span>
                      <h3 className={styles.detailTitle}>{step.title}</h3>
                      <span
                        className={`${styles.stepType} ${styles[step.type]}`}
                      >
                        {step.type.toUpperCase()}
                      </span>
                    </div>
                    <p className={styles.detailText}>{step.details}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.input}`}></div>
              <span>{t("workflow.legend.input") || "Input"}</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.ai}`}></div>
              <span>{t("workflow.legend.ai") || "AI Processing"}</span>
            </div>
            <div className={styles.legendItem}>
              <div
                className={`${styles.legendColor} ${styles.processing}`}
              ></div>
              <span>
                {t("workflow.legend.processing") || "Data Processing"}
              </span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.mcp}`}></div>
              <span>{t("workflow.legend.mcp") || "MCP Server"}</span>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor} ${styles.output}`}></div>
              <span>{t("workflow.legend.output") || "Output"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowVisualization;
