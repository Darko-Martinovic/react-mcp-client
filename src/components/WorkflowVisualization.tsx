import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./WorkflowVisualization.module.css";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  details: string;
  icon: string;
  type: "input" | "ai" | "mcp" | "processing" | "output" | "search";
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
      title: t("workflow.steps.userInput.title"),
      description: t("workflow.steps.userInput.description"),
      details: t("workflow.steps.userInput.detail"),
      icon: "👤",
      type: "input",
      position: { x: 10, y: 25 },
    },
    {
      id: "azure-ai",
      title: t("workflow.steps.azureOpenAI.title"),
      description: t("workflow.steps.azureOpenAI.description"),
      details: t("workflow.steps.azureOpenAI.detail"),
      icon: "🧠",
      type: "ai",
      position: { x: 35, y: 25 },
    },
    {
      id: "azure-search",
      title: "Azure Search",
      description: "Tool discovery & indexing",
      details:
        "Azure Search maintains an indexed registry of all available MCP tools with their descriptions, parameters, and endpoints. When the AI determines the user's intent, it searches this index to find the most appropriate tools that can fulfill the request. The index contains 8 registered tools including GetProducts, GetSalesData, GetTotalRevenue, GetLowStockProducts, GetSalesByCategory, GetInventoryStatus, GetDailySummary, and GetDetailedInventory.",
      icon: "🔍",
      type: "search",
      position: { x: 60, y: 25 },
    },
    {
      id: "parameter-extraction",
      title: t("workflow.steps.parameterExtraction.title"),
      description: t("workflow.steps.parameterExtraction.description"),
      details: t("workflow.steps.parameterExtraction.detail"),
      icon: "⚙️",
      type: "processing",
      position: { x: 85, y: 25 },
    },
    {
      id: "mcp-server",
      title: t("workflow.steps.mcpServer.title"),
      description: "Proxy-mediated communication",
      details:
        "Frontend requests are routed through a proxy architecture for proper CORS handling and request management:\n\n🌐 Frontend (/api/tool)\n⬇️ Vite Dev Proxy (vite.config.js)\n⬇️ Search Proxy Server (port 5002)\n⬇️ MCP Server (port 9090)\n\nThis proxy chain is essential because:\n• Browsers block direct cross-origin requests (CORS)\n• The proxy handles request/response transformation\n• Provides consistent error handling and logging\n• Maps frontend API calls to correct MCP endpoints\n\nThe proxy server (search-proxy.cjs) acts as a bridge, forwarding tool calls to the actual MCP server while handling authentication, request formatting, and response processing.",
      icon: "🔗",
      type: "mcp",
      position: { x: 85, y: 70 },
    },
    {
      id: "data-processing",
      title: t("workflow.steps.dataProcessing.title"),
      description: t("workflow.steps.dataProcessing.description"),
      details: t("workflow.steps.dataProcessing.detail"),
      icon: "📊",
      type: "processing",
      position: { x: 60, y: 70 },
    },
    {
      id: "visualization",
      title: t("workflow.steps.visualization.title"),
      description: t("workflow.steps.visualization.description"),
      details: t("workflow.steps.visualization.detail"),
      icon: "📈",
      type: "output",
      position: { x: 35, y: 70 },
    },
    {
      id: "user-result",
      title: "User Interface",
      description: "Interactive results & export",
      details:
        "The final step presents processed data through interactive tables, charts, and visualizations in the user interface. Users can interact with the data, sort tables, view trace information for debugging, and export results to Excel with professional formatting for further analysis.",
      icon: "💼",
      type: "output",
      position: { x: 10, y: 70 },
    },
  ];

  const connections = [
    { from: "user-input", to: "azure-ai" },
    { from: "azure-ai", to: "azure-search" },
    { from: "azure-search", to: "parameter-extraction" },
    { from: "parameter-extraction", to: "mcp-server" },
    { from: "mcp-server", to: "data-processing" },
    { from: "data-processing", to: "visualization" },
    { from: "visualization", to: "user-result" },
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
              <div className={`${styles.legendColor} ${styles.search}`}></div>
              <span>{"Azure Search"}</span>
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
