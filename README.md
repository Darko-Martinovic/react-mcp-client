# React MCP Client

A modern React TypeScript application for interacting with Model Context Protocol (MCP) servers, featuring AI-powered chat with Azure OpenAI integration, multilingual support, and advanced data visualization.

## ✨ Key Features

- 🤖 **AI-Powered Chat**: Interactive interface with Azure OpenAI integration
- 🌍 **Multilingual Support**: English, French, and Dutch with language-specific chat storage
- 📊 **Data Visualization**: Automatic charts (bar, pie, line) and interactive tables
- 💾 **Manual Save/Import**: Conversations can be manually saved and imported (JSON, TXT, MD)
- 🍞 **Toast Notifications**: Modern toast system for user feedback
- 🔍 **Azure Search Integration**: RAG capabilities with Azure Cognitive Search
- 📈 **Excel Export**: Professional Excel exports with formatting and metadata
- 🐛 **Debug Tracing**: Comprehensive trace functionality for troubleshooting

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript, Vite, CSS Modules
- **AI Integration**: Azure OpenAI, Azure Search  
- **Charts**: Recharts library for data visualization
- **Export**: XLSX library for Excel generation
- **i18n**: react-i18next with browser language detection

## 📋 Quick Start

### Prerequisites
- Node.js 16+
- Azure OpenAI account and API key
- MCP Server running on port 5000

### Installation

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd react-mcp-client
   npm install
   ```

2. **Environment Setup**
   Create `.env` file:
   ```env
   VITE_AOAI_ENDPOINT=https://your-openai-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2023-05-15
   VITE_AOAI_APIKEY=your-azure-openai-api-key
   VITE_MCP_SERVER_URL=http://localhost:5000
   
   # Optional - for RAG capabilities
   AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
   AZURE_SEARCH_APIKEY=your-search-admin-key
   AZURE_SEARCH_INDEX=your-index-name
   ```

3. **Start the application**
   ```bash
   # Start search proxy (if using Azure Search)
   node search-proxy.cjs
   
   # Start development server
   npm run dev
   ```

4. **Open browser**: Navigate to `http://localhost:5174`

## 🏗️ Project Architecture

```
src/
├── components/
│   ├── App.tsx                 # Main app & session management
│   ├── Chat/Chat.tsx          # Chat interface & data visualization
│   ├── Toast/                 # Toast notification system
│   ├── DataVisualization/     # Chart rendering & table components
│   └── LanguageSelector.tsx   # Multi-language support
├── services/
│   ├── azureOpenAI.ts         # Azure OpenAI integration
│   ├── azureSearch.ts         # Azure Search/RAG capabilities
│   ├── mcpServer.ts           # MCP server communication
│   └── chatService.ts         # Business logic & parameter extraction
├── i18n/
│   └── locales/              # Translation files (en, fr, nl)
└── hooks/
    └── useToast.ts           # Toast notification hook
```

## 🎯 How It Works

```
User Query → Azure OpenAI → Parameter Extraction → MCP Server → Data Processing → UI Rendering
```

1. **User Input**: User submits query through React chat interface
2. **AI Processing**: Azure OpenAI analyzes intent and generates function calls
3. **Parameter Extraction**: Smart extraction of dates, thresholds, categories, suppliers
4. **MCP Communication**: Direct HTTP calls to MCP server on port 5000
5. **Data Processing**: Intelligent formatting (summary vs detailed data)
6. **Visualization**: Automatic chart/table rendering with export capabilities

## 💡 Usage Examples

### Chat Queries
- "Show me recent sales data" → Applies 30-day date range, renders charts
- "What products are low in stock?" → Extracts thresholds, filters data
- "Category performance this month" → Auto-applies date filters, shows breakdown

### Data Export
- **Manual Save**: Click 💾 button to save chat to localStorage
- **Import**: Click 📥 to import conversations (JSON/TXT/MD)
- **Excel Export**: Export data tables to formatted Excel files

### Language Support
- Switch between 🇺🇸 English, 🇫🇷 French, 🇳🇱 Dutch
- Each language maintains separate chat history
- All UI elements fully translated

## 🐛 Troubleshooting

### Common Issues

**Azure OpenAI Connection**
- Verify `.env` file has correct `VITE_AOAI_ENDPOINT` and `VITE_AOAI_APIKEY`
- Ensure endpoint URL includes full path with API version

**MCP Server Issues**
- Check MCP server is running on port 5000
- Verify server returns data in expected JSON format

**Data Visualization**
- Ensure data has numeric values and categories for charts
- Check browser console for rendering errors

**Language/Storage Issues**
- Check browser localStorage for language-specific keys
- Translation files should load in browser network tab

## 🚀 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run preview` - Preview production build
- `npm run lint` - Run code quality checks

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Azure OpenAI](https://docs.microsoft.com/en-us/azure/cognitive-services/openai/)
- [React](https://react.dev/) | [Vite](https://vitejs.dev/) | [Recharts](https://recharts.org/)

---

**Built with ❤️ using React + TypeScript + MCP**
