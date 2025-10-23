export interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export type ChartType = "bar" | "line" | "pie" | "none";
export type DisplayMode = "table" | "json" | "mixed" | "auto";

export interface VisualizationProps {
  data: Record<string, unknown>[] | any;
  toolName?: string;
  query?: string;
  t?: (key: string) => string;
  displayMode?: DisplayMode;
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

export interface JsonProps {
  data: any;
  toolName?: string;
  t?: (key: string) => string;
}
