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

## 🎬 Demo Video

See the React MCP Client in action with intelligent query processing and data visualization:

https://github.com/user-attachments/assets/c06299ae-9ed7-42bc-a93f-4879ca464a8a

_The demo showcases smart query processing, automatic data visualization, and multilingual chat capabilities._

## 🆕 Latest Features

Experience the newest enhancements in our React MCP Client:

https://github.com/user-attachments/assets/b1bcc904-3729-42d8-81dd-f165dcd010ff

**Recent Additions:**

1. **Custom Plugin Support** - Define custom logic to access your database or API through configurable plugins
2. **Advanced JSON Viewer** - Interactive data visualizer with expand/collapse functionality and intelligent formatting
3. **Enhanced AI Response Tracking** - Each AI response now includes detailed metadata:
   - Number of tokens used (prompt + completion)
   - Estimated cost breakdown
   - Tools utilized during processing
   - AI model information

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
- MCP Server running on port 9090
- Proxy server running on port 5002

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
   VITE_MCP_SERVER_URL=http://localhost:9090

   # Optional - for RAG capabilities
   AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
   AZURE_SEARCH_APIKEY=your-search-admin-key
   AZURE_SEARCH_INDEX=your-index-name
   ```

3. **Start the applications**

   ```bash
   # Start proxy server (handles frontend ↔ MCP communication)
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
Frontend (React) → Vite Proxy (/api/*) → Proxy Server (5002) → MCP Server (9090) → Data Processing → UI Rendering
```

1. **User Input**: User submits query through React chat interface
2. **AI Processing**: Azure OpenAI analyzes intent and generates function calls
3. **Parameter Extraction**: Smart extraction of dates, thresholds, categories, suppliers
4. **Proxy Communication**: Frontend calls /api endpoints, proxied to search-proxy.cjs on port 5002
5. **MCP Communication**: Proxy server communicates with MCP server on port 9090
6. **Data Processing**: Intelligent formatting (summary vs detailed data)
7. **Visualization**: Automatic chart/table rendering with export capabilities

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

- Check MCP server is running on port 9090
- Check proxy server is running on port 5002
- Verify proxy can reach MCP server endpoints
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

## 🛡️ Disclaimer

This project was developed independently on personal equipment and in personal time.  
It is not affiliated with, endorsed by, or derived from the intellectual property of EPAM Systems or any of its clients.  
All examples, configurations, and data are generic and intended solely for demonstration and educational purposes.

---

**Built with ❤️ using React + TypeScript + MCP**
