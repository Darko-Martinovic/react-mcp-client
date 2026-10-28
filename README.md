# React MCP Client

A React + TypeScript chat client for [McpServer](https://github.com/Darko-Martinovic/McpServer), a Model Context Protocol server with supermarket and product-catalog data. Ask questions in plain language; Azure OpenAI picks the tools, McpServer runs them, and the client shows the answers as text, charts and tables.

## ✨ Key Features

- 🤖 **AI chat**: Azure OpenAI with function calling over McpServer's tools, through McpServer, so the browser never holds a key
- 📊 **Data visualisation**: automatic bar, pie and line charts and interactive tables, plus a JSON viewer with expand and collapse
- 📈 **Analytics dashboard**: chats, messages and tool calls over time, tool usage and activity by hour
- 🔍 **Tool search**: Azure AI Search finds the right tool for a question (RAG over the tool catalog)
- 🧾 **Response metadata**: tokens used, estimated cost, tools called and model for every answer
- 🌍 **Three languages**: English, French and Dutch, each with its own chat history
- 💾 **Save, import and export**: save chats, import them (JSON, TXT, MD), export tables to formatted Excel
- 🎙️ **Speech to text**: dictate questions in the browser
- ⚙️ **System prompt editor**: add your own instructions to the base system prompt
- 👥 **Team workspaces and sharing**: share chats and group them in workspaces (stored in the browser)
- 🌗 **Light and dark themes**, a response cache with its own manager, toast notifications, and a step-by-step trace of how each answer was made

## 🎬 Demo Video

See the React MCP Client in action with intelligent query processing and data visualization:

https://github.com/user-attachments/assets/c06299ae-9ed7-42bc-a93f-4879ca464a8a

_The demo showcases smart query processing, automatic data visualization, and multilingual chat capabilities._

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite 5, CSS Modules
- **AI**: Azure OpenAI and Azure AI Search, both reached through McpServer
- **Charts**: Recharts
- **Export**: xlsx
- **i18n**: react-i18next with browser language detection

## 📋 Quick Start

### Prerequisites

- Node.js 18+
- [McpServer](https://github.com/Darko-Martinovic/McpServer) running in Web API mode on port 5000 (`dotnet run -- --webapi`), with the Azure OpenAI settings in its `.env`

### Installation

1. **Clone and install**

   ```bash
   git clone https://github.com/Darko-Martinovic/react-mcp-client.git
   cd react-mcp-client
   npm install
   ```

2. **Environment (optional)**

   Copy `.env.example` to `.env`. The client needs no key: Azure OpenAI and Azure AI Search are configured in McpServer, and the client calls them through McpServer's API. Every `VITE_` variable is built into the browser bundle, so never put a key in one.

   ```env
   # Shown in the system prompt editor; the default is http://localhost:5000
   VITE_MCP_SERVER_URL=http://localhost:5000
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open** `http://localhost:5173`

`npm run build` builds for production into `dist/`.

## 🎯 How It Works

```
React client → Vite proxy (/api → localhost:5000) → McpServer → Azure OpenAI / SQL Server / MongoDB
```

1. **Question**: the user types or dictates a question.
2. **Tool choice**: the client sends it, with its tool definitions, to `POST /api/v1/chat/completions`; McpServer adds its key and calls Azure OpenAI, which chooses the tools and their parameters.
3. **Parameters**: the client fills in dates, thresholds, categories and suppliers the question implies.
4. **Tools**: the client runs each tool through McpServer's `POST /api/v1/tool`.
5. **Answer**: the results come back as a summary, a chart or a table, with the response's metadata.

## 🏗️ Project Structure

```
src/
├── components/
│   ├── App.tsx                # Layout, sessions, panels
│   ├── Chat/                  # Chat, header, input, messages
│   ├── DataVisualization/     # Charts, tables, data type detection
│   ├── AnalyticsDashboard/    # Usage and cost charts
│   ├── TeamWorkspace/         # Workspaces
│   ├── ShareDialog/           # Sharing chats
│   ├── SpeechToText/          # Dictation
│   ├── ThemeToggle/           # Light and dark themes
│   ├── Toast/                 # Notifications
│   ├── SystemPromptEditor.tsx # Custom system prompt
│   ├── CacheManager.tsx       # Response cache
│   └── WorkflowVisualization.tsx # How an answer was made, step by step
├── config/api.ts              # McpServer's endpoints, versioned (/api/v1)
├── services/
│   ├── azureOpenAI.ts         # Chat completions, through McpServer
│   ├── azureSearch.ts         # Tool search, through McpServer
│   ├── mcpServer.ts           # Tool calls
│   ├── chatService.ts         # Parameter extraction and orchestration
│   └── cacheManager.ts        # Response cache
├── hooks/                     # Toasts, speech, collaboration, workspaces, chat metadata
├── i18n/locales/              # en, fr, nl
└── utils/exporters/           # Chat and Excel export
```

## 💡 Usage Examples

- "Show me recent sales data" → last 30 days, as a chart
- "What products are low in stock?" → low-stock products with the threshold applied
- "Category performance this month" → sales by category for the month
- "Find articles with cola in the name" → catalog search
- "Which articles have ingredients?" → articles with their ingredient text

## 🐛 Troubleshooting

**Chat errors**

- A 503 from `/api/v1/chat/completions` means McpServer has no Azure OpenAI settings: check `AOAI_ENDPOINT`, `AOAI_APIKEY` and `CHATCOMPLETION_DEPLOYMENTNAME` in its `.env`
- A 400 means the request asked for more than 4000 `max_tokens` or more than one answer

**No data**

- Check McpServer is running on port 5000 in Web API mode (`http://localhost:5000/health`)
- The client calls relative `/api/v1/...` URLs, which Vite's proxy (`vite.config.js`) sends to McpServer; a client served another way needs its own proxy, or its origin in McpServer's `CORS_ORIGINS`

**Charts**

- A chart needs numeric values and categories; otherwise the data shows as a table
- Check the browser console for rendering errors

**Language or saved chats**

- Chats are kept per language in the browser's localStorage

`search-proxy.cjs` is the earlier Node.js proxy for Azure AI Search, kept for reference; McpServer now does this, so the client doesn't need it.

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Azure OpenAI](https://learn.microsoft.com/azure/ai-services/openai/)
- [React](https://react.dev/) | [Vite](https://vitejs.dev/) | [Recharts](https://recharts.org/)

## 🛡️ Disclaimer

This project was developed independently on personal equipment and in personal time.  
It is not affiliated with, endorsed by, or derived from the intellectual property of any employer or client.  
All examples, configurations, and data are generic and intended solely for demonstration and educational purposes.

---

**Built with ❤️ using React + TypeScript + MCP**
