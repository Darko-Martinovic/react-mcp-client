export interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export type ChartType = "bar" | "line" | "pie" | "none";

export interface VisualizationProps {
  data: Record<string, unknown>[];
  toolName?: string;
  query?: string;
  t?: (key: string) => string;
}

export interface ChartProps {
  data: Record<string, unknown>[];
  chartType: ChartType;
  query?: string;
}

export interface TableProps {
  data: Record<string, unknown>[];
  toolName?: string;
  t?: (key: string) => string;
}
