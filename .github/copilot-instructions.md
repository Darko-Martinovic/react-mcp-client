# Copilot Instructions for React MCP Client

## Overview

This is a React TypeScript application that integrates Model Context Protocol (MCP) servers with Azure OpenAI and Azure Search. The app provides an intelligent chat interface that can execute tools via MCP, visualize workflows, and perform data analysis.

## Architecture Patterns

### Core Technologies

- **React 18** with TypeScript
- **Vite** for build tooling
- **CSS Modules** for component styling
- **i18next** for internationalization
- **Azure OpenAI** for AI processing
- **Azure Search** for RAG and tool discovery
- **MCP (Model Context Protocol)** for tool execution

### Key Integration Points

#### 1. MCP Server Communication (`src/services/mcpServer.ts`)

- Use `/api/tool` endpoint with Vite proxy configuration
- Always include `originalUserInput` parameter in function calls for better parameter extraction
- Structure: `{ tool: string, arguments: Record<string, unknown> }`
- Error handling: Check response.ok before JSON parsing

#### 2. Azure OpenAI Integration (`src/services/azureOpenAI.ts`)

- Requires `VITE_AOAI_ENDPOINT` and `VITE_AOAI_APIKEY` environment variables
- Supports function calling with predefined tools
- Response format: `{ functionCalls: FunctionCall[], aiMessage: string }`
- Always set `tool_choice: "auto"` for flexible function selection

#### 3. Azure Search RAG (`src/services/azureSearch.ts`)

- Use `/api/search` endpoint for document retrieval
- Handles dynamic field mapping for different document structures
- Schema introspection via `fetchAzureSearchSchema()` function
- Field discovery through `getSearchableFields()` and `getFilterableFields()`

## Component Architecture

### Chat Component (`src/components/Chat.tsx`)

**Key Patterns:**

- Maintains separate chat histories per language (`chatHistoryEn`, `chatHistoryEs`, etc.)
- Trace data collection for debugging with `traceData` objects
- Parameter extraction logic that preserves `originalUserInput`
- Excel export functionality using `xlsx` library
- Chart rendering with Recharts for data visualization

**Critical Function Call Processing:**

```typescript
// Always pass originalUserInput for better parameter extraction
const mcpResponse = await callMcpTool(functionCall.name, {
  ...functionCall.arguments,
  originalUserInput: userMessage,
});
```

**Message Structure:**

```typescript
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
  };
}
```

### Workflow Visualization (`src/components/WorkflowVisualization.tsx`)

**Architecture:**

- 8-step workflow visualization with Azure Search integration
- SVG-based interactive diagram with proper positioning
- Step 3 specifically handles Azure Search for RAG and tool discovery
- Pastel color scheme with enhanced arrow visibility

**Positioning Pattern:**

```typescript
// Use y:25/70 for proper vertical centering without overlaps
const steps = [
  { id: 1, x: 50, y: 25, label: "User Query" },
  { id: 2, x: 200, y: 70, label: "Azure OpenAI Processing" },
  { id: 3, x: 350, y: 25, label: "Azure Search (RAG)" },
  // ... continue pattern
];
```

### Styling Conventions (`*.module.css`)

- Use CSS Modules for component-scoped styling
- Pastel color scheme: soft blues, greens, pinks, yellows
- Connection lines: 3px width, 0.8 opacity for visibility
- Gradient backgrounds for workflow steps
- Interactive hover states for better UX

## Development Workflows

### Adding New MCP Tools

1. Update Azure OpenAI tools array in `azureOpenAI.ts`
2. Add parameter extraction logic in `Chat.tsx`
3. Ensure `originalUserInput` is passed to MCP calls
4. Add appropriate error handling and trace data collection

### Implementing New Visualizations

1. Use Recharts components for data charts
2. Process MCP response data into chart-compatible format
3. Add export functionality using xlsx library
4. Include chart in message `tableData` field

### Internationalization Support

1. Add new translation keys to `src/i18n/locales/`
2. Use `useTranslation()` hook in components
3. Maintain separate chat histories per language
4. Update language-specific system prompts

### Debugging Patterns

- Use `traceData` objects to capture full request/response cycles
- Log Azure Search document structures for field mapping
- Include timestamps and user input in trace data
- Display trace information in collapsed UI sections

## Environment Configuration

Required environment variables:

```
VITE_AOAI_ENDPOINT=https://your-aoai-resource.openai.azure.com/
VITE_AOAI_APIKEY=your-api-key
VITE_MCP_SERVER_URL=http://localhost:9090
```

## Proxy Configuration (`vite.config.js`)

```javascript
server: {
  proxy: {
    '/api': 'http://localhost:5002'
  }
}
```

## Common Issues & Solutions

### MCP Parameter Extraction

**Problem:** Function calls failing with 400 errors
**Solution:** Always include `originalUserInput` parameter in MCP calls

### Workflow Visualization Overlaps

**Problem:** Workflow boxes overlapping
**Solution:** Use y-coordinates 25/70 pattern for proper vertical spacing

### Azure Search Field Mapping

**Problem:** Dynamic document structures causing display issues
**Solution:** Use fallback field mapping with multiple potential field names

### Chart Data Processing

**Problem:** MCP data not compatible with chart components
**Solution:** Transform data to include required `name` and `value` fields

## Testing Patterns

- Test MCP integration with mock tool responses
- Verify chart rendering with sample data sets
- Validate i18n translations across all supported languages
- Check workflow visualization positioning across different screen sizes

## Performance Considerations

- Use React.memo for expensive chart components
- Implement proper cleanup for chat histories
- Optimize Azure Search queries with appropriate field selection
- Cache schema information to reduce API calls

## Security Best Practices

- Never expose API keys in client-side code
- Use Vite proxy for MCP server communication
- Validate all user inputs before MCP tool execution
- Sanitize data before chart rendering

This codebase follows a service-oriented architecture with clear separation between AI processing, MCP tool execution, and data visualization. When adding new features, maintain this pattern and ensure proper error handling and trace data collection for debugging.
