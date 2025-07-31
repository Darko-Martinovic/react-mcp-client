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
      title: t("workflow.steps.userInput.title"),
      description: t("workflow.steps.userInput.description"),
      details: t("workflow.steps.userInput.detail"),
      icon: "�",
      type: "input",
      position: { x: 15, y: 15 },
    },
    {
      id: "azure-ai",
      title: t("workflow.steps.azureOpenAI.title"),
      description: t("workflow.steps.azureOpenAI.description"),
      details: t("workflow.steps.azureOpenAI.detail"),
      icon: "🧠",
      type: "ai",
      position: { x: 45, y: 15 },
    },
    {
      id: "parameter-extraction",
      title: t("workflow.steps.parameterExtraction.title"),
      description: t("workflow.steps.parameterExtraction.description"),
      details: t("workflow.steps.parameterExtraction.detail"),
      icon: "🔍",
      type: "processing",
      position: { x: 75, y: 15 },
    },
    {
      id: "mcp-server",
      title: t("workflow.steps.mcpServer.title"),
      description: t("workflow.steps.mcpServer.description"),
      details: t("workflow.steps.mcpServer.detail"),
      icon: "�",
      type: "mcp",
      position: { x: 75, y: 50 },
    },
    {
      id: "data-processing",
      title: t("workflow.steps.dataProcessing.title"),
      description: t("workflow.steps.dataProcessing.description"),
      details: t("workflow.steps.dataProcessing.detail"),
      icon: "⚙️",
      type: "processing",
      position: { x: 45, y: 50 },
    },
    {
      id: "visualization",
      title: t("workflow.steps.visualization.title"),
      description: t("workflow.steps.visualization.description"),
      details: t("workflow.steps.visualization.detail"),
      icon: "📊",
      type: "output",
      position: { x: 15, y: 50 },
    },
  ];

  const connections = [
    { from: "user-input", to: "azure-ai" },
    { from: "azure-ai", to: "parameter-extraction" },
    { from: "parameter-extraction", to: "mcp-server" },
    { from: "mcp-server", to: "data-processing" },
    { from: "data-processing", to: "visualization" },
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
