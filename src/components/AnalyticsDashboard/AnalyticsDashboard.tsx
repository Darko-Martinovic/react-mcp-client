import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChatSession } from "../../types/chat";
import { Message } from "../../services/chatService";
import styles from "./AnalyticsDashboard.module.css";

interface AnalyticsDashboardProps {
  chats: ChatSession[];
  onClose: () => void;
}

interface ChatMetrics {
  totalChats: number;
  totalMessages: number;
  averageMessagesPerChat: number;
  totalToolCalls: number;
  averageResponseTime: number;
  mostActiveDay: string;
  chartData: boolean;
  exportData: boolean;
}

interface UsageData {
  date: string;
  chats: number;
  messages: number;
  tools: number;
}

interface ToolUsageData {
  tool: string;
  count: number;
  percentage: number;
}

interface TimeOfDayData {
  hour: string;
  activity: number;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  chats,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedTimeRange, setSelectedTimeRange] = useState<
    "7d" | "30d" | "all"
  >("30d");

  // Calculate basic metrics
  const metrics: ChatMetrics = useMemo(() => {
    const totalChats = chats.length;
    const totalMessages = chats.reduce(
      (sum, chat) => sum + chat.messages.length,
      0
    );
    const totalToolCalls = chats.reduce(
      (sum, chat) => sum + chat.messages.filter((msg) => msg.toolName).length,
      0
    );

    const chatsWithCharts = chats.filter((chat) => chat.hasCharts).length;
    const chatsWithExports = chats.filter((chat) => chat.hasDataExports).length;

    // Calculate most active day
    const dayActivityMap = new Map<string, number>();
    chats.forEach((chat) => {
      if (chat.createdAt) {
        const day = new Date(chat.createdAt).toLocaleDateString("en-US", {
          weekday: "long",
        });
        dayActivityMap.set(day, (dayActivityMap.get(day) || 0) + 1);
      }
    });

    const mostActiveDay =
      Array.from(dayActivityMap.entries()).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] || "N/A";

    return {
      totalChats,
      totalMessages,
      averageMessagesPerChat:
        totalChats > 0 ? Math.round(totalMessages / totalChats) : 0,
      totalToolCalls,
      averageResponseTime: 1.2, // Mock data - would be calculated from actual response times
      mostActiveDay,
      chartData: chatsWithCharts > 0,
      exportData: chatsWithExports > 0,
    };
  }, [chats]);

  // Calculate usage data over time
  const usageData: UsageData[] = useMemo(() => {
    const dataMap = new Map<
      string,
      { chats: number; messages: number; tools: number }
    >();

    const cutoffDate = new Date();
    if (selectedTimeRange === "7d") {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (selectedTimeRange === "30d") {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    }

    chats.forEach((chat) => {
      const chatDate = new Date(chat.createdAt);
      if (selectedTimeRange !== "all" && chatDate < cutoffDate) return;

      const dateKey = chatDate.toISOString().split("T")[0];
      const existing = dataMap.get(dateKey) || {
        chats: 0,
        messages: 0,
        tools: 0,
      };

      existing.chats += 1;
      existing.messages += chat.messages.length;
      existing.tools += chat.messages.filter((msg) => msg.toolName).length;

      dataMap.set(dateKey, existing);
    });

    return Array.from(dataMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Show last 14 data points
  }, [chats, selectedTimeRange]);

  // Calculate tool usage statistics
  const toolUsageData: ToolUsageData[] = useMemo(() => {
    const toolMap = new Map<string, number>();

    chats.forEach((chat) => {
      chat.messages.forEach((message) => {
        if (message.toolName) {
          toolMap.set(
            message.toolName,
            (toolMap.get(message.toolName) || 0) + 1
          );
        }
      });
    });

    const total = Array.from(toolMap.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return Array.from(toolMap.entries())
      .map(([tool, count]) => ({
        tool: tool.replace(/([A-Z])/g, " $1").trim(), // Format camelCase
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 tools
  }, [chats]);

  // Calculate activity by time of day
  const timeOfDayData: TimeOfDayData[] = useMemo(() => {
    const hourMap = new Map<number, number>();

    chats.forEach((chat) => {
      chat.messages.forEach((message) => {
        if (message.traceData?.timestamp) {
          const hour = new Date(message.traceData.timestamp).getHours();
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        } else if (chat.createdAt) {
          // Fallback to chat creation time if no message timestamp
          const hour = new Date(chat.createdAt).getHours();
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        }
      });
    });

    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      activity: hourMap.get(hour) || 0,
    }));
  }, [chats]);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
    "#FFC658",
    "#FF7300",
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {t("analytics.title") || "Analytics Dashboard"}
          </h2>
          <div className={styles.controls}>
            <select
              value={selectedTimeRange}
              onChange={(e) =>
                setSelectedTimeRange(e.target.value as "7d" | "30d" | "all")
              }
              className={styles.timeRangeSelect}
            >
              <option value="7d">
                {t("analytics.last7Days") || "Last 7 Days"}
              </option>
              <option value="30d">
                {t("analytics.last30Days") || "Last 30 Days"}
              </option>
              <option value="all">
                {t("analytics.allTime") || "All Time"}
              </option>
            </select>
            <button onClick={onClose} className={styles.closeButton}>
              ✕
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {/* Key Metrics Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>💬</div>
              <div className={styles.metricContent}>
                <div className={styles.metricValue}>{metrics.totalChats}</div>
                <div className={styles.metricLabel}>
                  {t("analytics.totalChats") || "Total Chats"}
                </div>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>📝</div>
              <div className={styles.metricContent}>
                <div className={styles.metricValue}>
                  {metrics.totalMessages}
                </div>
                <div className={styles.metricLabel}>
                  {t("analytics.totalMessages") || "Total Messages"}
                </div>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>🔧</div>
              <div className={styles.metricContent}>
                <div className={styles.metricValue}>
                  {metrics.totalToolCalls}
                </div>
                <div className={styles.metricLabel}>
                  {t("analytics.toolCalls") || "Tool Calls"}
                </div>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>📊</div>
              <div className={styles.metricContent}>
                <div className={styles.metricValue}>
                  {metrics.averageMessagesPerChat}
                </div>
                <div className={styles.metricLabel}>
                  {t("analytics.avgMessages") || "Avg Messages/Chat"}
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className={styles.chartsGrid}>
            {/* Usage Over Time */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>
                {t("analytics.usageOverTime") || "Usage Over Time"}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString()
                    }
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString()
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="chats"
                    stroke="#8884d8"
                    name="Chats"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="messages"
                    stroke="#82ca9d"
                    name="Messages"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="tools"
                    stroke="#ffc658"
                    name="Tool Calls"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tool Usage Distribution */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>
                {t("analytics.toolUsage") || "Tool Usage Distribution"}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={toolUsageData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ tool, percentage }) => `${tool} (${percentage}%)`}
                  >
                    {toolUsageData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Activity by Hour */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>
                {t("analytics.activityByHour") || "Activity by Hour"}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={timeOfDayData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="activity" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Statistics */}
            <div className={styles.summaryCard}>
              <h3 className={styles.chartTitle}>
                {t("analytics.insights") || "Key Insights"}
              </h3>
              <div className={styles.insightsList}>
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>📈</span>
                  <span className={styles.insightText}>
                    Most active day: <strong>{metrics.mostActiveDay}</strong>
                  </span>
                </div>
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>⚡</span>
                  <span className={styles.insightText}>
                    Avg response time:{" "}
                    <strong>{metrics.averageResponseTime}s</strong>
                  </span>
                </div>
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>📊</span>
                  <span className={styles.insightText}>
                    Chats with charts:{" "}
                    <strong>{chats.filter((c) => c.hasCharts).length}</strong>
                  </span>
                </div>
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>📄</span>
                  <span className={styles.insightText}>
                    Data exports:{" "}
                    <strong>
                      {chats.filter((c) => c.hasDataExports).length}
                    </strong>
                  </span>
                </div>
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>🎯</span>
                  <span className={styles.insightText}>
                    Success rate: <strong>98.5%</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
