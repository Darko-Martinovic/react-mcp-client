import { useMemo } from 'react';
import { ChatSession, ChatType, ChatMetadata } from '../types/chat';
import { Message } from '../services/chatService';

export const useChatMetadata = (chat: ChatSession): ChatMetadata => {
  return useMemo(() => {
    const metadata: ChatMetadata = {
      chatType: detectChatType(chat.messages),
      lastUserMessage: getLastUserMessage(chat.messages),
      lastAIMessage: getLastAIMessage(chat.messages),
      hasDataExports: hasExportedData(chat.messages),
      hasCharts: hasGeneratedCharts(chat.messages),
      toolsUsed: extractToolsUsed(chat.messages),
      keyTopics: extractKeyTopics(chat.messages),
      messagePreview: generateMessagePreview(chat.messages),
    };
    return metadata;
  }, [chat.messages]);
};

export const detectChatType = (messages: Message[]): ChatType => {
  const hasTableData = messages.some(m => m.tableData && m.tableData.length > 0);
  const hasToolCalls = messages.some(m => m.toolName);
  
  if (hasTableData) return 'data-analysis';
  if (hasToolCalls) return 'tool-usage';
  return 'conversation';
};

export const getLastUserMessage = (messages: Message[]): Message | undefined => {
  const userMessages = messages.filter(m => m.sender === 'user');
  return userMessages[userMessages.length - 1];
};

export const getLastAIMessage = (messages: Message[]): Message | undefined => {
  const aiMessages = messages.filter(m => m.sender === 'system');
  return aiMessages[aiMessages.length - 1];
};

export const hasExportedData = (messages: Message[]): boolean => {
  return messages.some(m => m.tableData && m.tableData.length > 0);
};

export const hasGeneratedCharts = (messages: Message[]): boolean => {
  // Check if any message contains chart-related trace data or table data that would generate charts
  return messages.some(m => 
    m.tableData && m.tableData.length > 0 && 
    m.traceData?.mcpResponse?.data
  );
};

export const extractToolsUsed = (messages: Message[]): string[] => {
  return [...new Set(
    messages
      .filter(m => m.toolName)
      .map(m => m.toolName!)
  )];
};

export const extractKeyTopics = (messages: Message[]): string[] => {
  const userMessages = messages
    .filter(m => m.sender === 'user' && m.text)
    .map(m => m.text!)
    .join(' ');
    
  // Extract business terms (simple keyword extraction)
  const businessTerms = extractBusinessTerms(userMessages);
  return businessTerms.slice(0, 3); // Top 3 topics
};

export const extractBusinessTerms = (text: string): string[] => {
  const commonBusinessTerms = [
    'sales', 'revenue', 'profit', 'inventory', 'stock', 'products', 'customers',
    'orders', 'shipping', 'analytics', 'reports', 'data', 'trends', 'performance',
    'metrics', 'dashboard', 'export', 'import', 'finance', 'accounting'
  ];
  
  const words = text.toLowerCase().split(/\s+/);
  const foundTerms = words.filter(word => 
    commonBusinessTerms.some(term => word.includes(term))
  );
  
  // Count occurrences and return most frequent
  const termCounts = foundTerms.reduce((acc, term) => {
    acc[term] = (acc[term] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(termCounts)
    .sort(([,a], [,b]) => b - a)
    .map(([term]) => term)
    .slice(0, 3);
};

export const generateMessagePreview = (messages: Message[]): string => {
  const lastUserMessage = getLastUserMessage(messages);
  const lastAIMessage = getLastAIMessage(messages);
  
  if (!lastUserMessage && !lastAIMessage) {
    return 'No messages yet';
  }
  
  if (lastUserMessage && lastAIMessage) {
    const userPreview = truncateText(lastUserMessage.text || '', 40);
    const aiPreview = truncateText(lastAIMessage.text || '', 40);
    return `You: ${userPreview}\nAI: ${aiPreview}`;
  }
  
  if (lastUserMessage) {
    return `You: ${truncateText(lastUserMessage.text || '', 80)}`;
  }
  
  return `AI: ${truncateText(lastAIMessage!.text || '', 80)}`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const getChatTypeIcon = (chatType: ChatType): string => {
  switch (chatType) {
    case 'data-analysis': return '📊';
    case 'tool-usage': return '🔧';
    case 'conversation': return '💬';
    default: return '💬';
  }
};

export const getChatTypeLabel = (chatType: ChatType): string => {
  switch (chatType) {
    case 'data-analysis': return 'Data Analysis';
    case 'tool-usage': return 'Tool Usage';
    case 'conversation': return 'Conversation';
    default: return 'Conversation';
  }
};
