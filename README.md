# React MCP Client

A modern React-based client application for interacting with Model Context Protocol (MCP) servers, featuring AI-powered chat interface with Azure OpenAI integration and advanced trace debugging capabilities.

## 🚀 Features

- **AI-Powered Chat Interface**: Interactive chat with Azure OpenAI integration
- **MCP Server Integration**: Direct communication with Model Context Protocol servers
- **Advanced Trace Debugging**: Comprehensive trace functionality for AI-MCP request/response flows
- **Smart Table Rendering**: Automatic detection and beautiful rendering of structured data
- **Azure Search Integration**: RAG (Retrieval-Augmented Generation) capabilities with Azure Cognitive Search
- **Chat Session Management**: Create, manage, and export multiple chat sessions
- **Multiple Export Formats**: Export conversations in JSON, Text, or Markdown formats
- **Real-time Visual Feedback**: Copy-to-clipboard functionality with visual confirmation
- **Responsive Design**: Modern, mobile-friendly interface with smooth animations

## 🛠️ Technology Stack

- **Frontend**: React 19.1.0 with TypeScript
- **Build Tool**: Vite 7.0.4
- **Styling**: Custom CSS with modern design patterns
- **State Management**: React hooks (useState, useEffect, useRef)
- **HTTP Client**: Axios for API requests
- **Development**: ESLint for code quality

## 📋 Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- Azure OpenAI account and API key
- Azure Cognitive Search service (optional, for RAG capabilities)
- MCP Server running on port 5000

## 🔧 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd react-mcp-client
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   Create a `.env` file in the root directory with the following variables:

   ```env
   # Azure OpenAI Configuration (Required)
   VITE_AOAI_ENDPOINT=https://your-openai-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2023-05-15
   VITE_AOAI_APIKEY=your-azure-openai-api-key

   # Azure Search Configuration (Optional - for RAG capabilities)
   AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
   AZURE_SEARCH_APIKEY=your-search-admin-key
   AZURE_SEARCH_INDEX=your-index-name

   # MCP Server Configuration
   VITE_MCP_SERVER_URL=http://localhost:5000
   ```

4. **Start the search proxy server** (if using Azure Search)

   ```bash
   node search-proxy.cjs
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to `http://localhost:5174` (or the port shown in terminal)

## 🏗️ Project Structure

```
react-mcp-client/
├── public/
│   └── vite.svg                 # Vite logo
├── src/
│   ├── assets/
│   │   └── react.svg           # React logo
│   ├── services/
│   │   ├── azureOpenAI.ts      # Azure OpenAI integration
│   │   ├── azureSearch.ts      # Azure Search integration
│   │   └── mcpServer.ts        # MCP server communication
│   ├── App.tsx                 # Main application component
│   ├── Chat.tsx                # Chat interface component
│   ├── index.css               # Global styles
│   └── main.tsx                # Application entry point
├── search-proxy.cjs            # Express proxy for Azure Search
├── vite.config.js              # Vite configuration
├── package.json                # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## 🔄 How It Works

### 1. **Chat Flow**

```
User Input → Azure OpenAI → MCP Call Extraction → MCP Server → Response Rendering
```

1. User submits a query through the chat interface
2. Azure OpenAI processes the intent and generates structured function calls
3. The system extracts MCP server calls from the AI response
4. Direct communication with the MCP server on port 5000
5. Results are formatted and displayed with optional table rendering

### 2. **Trace Debugging**

The application includes comprehensive trace functionality that captures:

- **User Input**: Original query from the user
- **AI Response**: Full Azure OpenAI response with function calls
- **MCP Call**: Extracted function name and parameters
- **MCP Response**: Raw response from the MCP server
- **Selected Tool**: The specific tool/function called
- **Parameters**: Processed parameters sent to the MCP server
- **Timestamp**: Exact time of the request
- **Error Handling**: Any errors encountered during the process

### 3. **Data Rendering**

- **Text Responses**: Rendered as formatted markdown-style text
- **Table Data**: Automatically detected and rendered in beautiful, interactive tables
- **Mixed Content**: Support for responses containing both text summaries and structured data

## 🎨 UI Features

### Chat Interface

- **Modern Design**: Clean, professional interface with subtle animations
- **Message Types**: Distinct styling for user and AI messages
- **Copy Functionality**: One-click copy with visual feedback
- **Trace Toggle**: Expandable debug panels for each AI response

### Table Rendering

- **Auto-Detection**: Automatic identification of structured data
- **Smart Formatting**: Intelligent formatting for dates, currencies, and IDs
- **Interactive Elements**: Hover effects and responsive design
- **Custom Headers**: Human-readable column headers
- **Color Coding**: Context-aware styling (e.g., low stock warnings)

### Session Management

- **Multiple Chats**: Create and manage multiple conversation sessions
- **Persistent Storage**: Local storage integration for session persistence
- **Export Options**: Export conversations in multiple formats
- **Title Editing**: Rename chat sessions for better organization

## 🔧 Configuration

### Azure OpenAI Setup

1. Create an Azure OpenAI resource in Azure Portal
2. Deploy a chat model (e.g., GPT-4, GPT-3.5-turbo)
3. Obtain the endpoint URL and API key
4. Configure the `.env` file with your credentials

### Azure Search Setup (Optional)

1. Create an Azure Cognitive Search service
2. Create and populate a search index with your MCP tool documentation
3. Configure the search proxy with your credentials
4. Start the proxy server before running the main application

### MCP Server Integration

Ensure your MCP server is running on port 5000 and provides the following:

- RESTful API endpoints for tool functions
- JSON responses with structured data
- Error handling and appropriate HTTP status codes

## 🚀 Available Scripts

- **`npm run dev`** - Start development server with hot reload
- **`npm run build`** - Build for production
- **`npm run preview`** - Preview production build locally
- **`npm run lint`** - Run ESLint for code quality checks

## 🔍 API Integration

### Azure OpenAI Service

Located in `src/services/azureOpenAI.ts`

- Handles structured prompts for MCP function extraction
- Processes AI responses for function call identification
- Error handling and response formatting

### Azure Search Service

Located in `src/services/azureSearch.ts`

- RAG capabilities for enhanced AI responses
- Tool discovery and documentation retrieval
- Fallback mechanisms for offline operation

### MCP Server Communication

Located in `src/services/mcpServer.ts`

- Direct HTTP communication with MCP servers
- Parameter enrichment and query processing
- Response formatting and error handling

## 🎯 Use Cases

- **AI Assistant Development**: Test and debug AI-powered applications
- **MCP Protocol Testing**: Validate MCP server implementations
- **Data Exploration**: Interactive exploration of structured datasets
- **API Testing**: Test and document API endpoints through conversational interface
- **RAG System Development**: Build and test retrieval-augmented generation systems

## 🐛 Troubleshooting

### Common Issues

1. **"Azure OpenAI endpoint or API key not set"**

   - Verify your `.env` file contains correct `VITE_AOAI_ENDPOINT` and `VITE_AOAI_APIKEY`
   - Ensure the endpoint URL includes the full path with API version

2. **"No matching MCP tool found"**

   - Check that your MCP server is running on port 5000
   - Verify the search index contains tool documentation
   - Check the search proxy server logs for errors

3. **Table data not rendering**

   - Ensure your MCP server returns data in the expected JSON format
   - Check browser console for JavaScript errors
   - Verify the response structure matches the expected format

4. **Trace panel not showing**
   - Click the checkbox next to the copy button to toggle trace visibility
   - Check that the message contains `traceData` in the response

### Debug Mode

Enable trace debugging by clicking the trace checkbox next to any AI response. This will show:

- Complete request/response flow
- Parameter processing details
- Error messages and stack traces
- Performance timing information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Azure OpenAI Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/openai/)
- [Azure Cognitive Search Documentation](https://docs.microsoft.com/en-us/azure/search/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

## 🆘 Support

For questions, issues, or contributions, please:

1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a new issue with detailed information about your problem
4. Include environment details, error messages, and steps to reproduce

---

**Built with ❤️ using React, TypeScript, and the Model Context Protocol**
