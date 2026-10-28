export interface ExportData {
  chatTitle: string;
  exportedAt: string;
  messageCount: number;
  participants: string[];
  messages: TransformedMessage[];
}

export interface TransformedMessage {
  role: string;
  displayName: string;
  content: string;
  timestamp: string;
  tableData?: Record<string, unknown>[];
  toolName?: string;
}
