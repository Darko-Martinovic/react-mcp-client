import { Message } from "../services/chatService";

interface WelcomeMessageData {
  title: string;
  message: Message;
}

const welcomeMessages: Record<string, WelcomeMessageData> = {
  en: {
    title: "Welcome to MCP Client",
    message: {
      sender: "system",
      text: '👋 Welcome to the MCP (Model Context Protocol) Client!\n\nThis is your English chat session. You can:\n• Ask questions about your business data\n• Query inventory, sales, and products\n• Get insights through AI-powered analysis\n\nTry asking: "Show me recent sales data" or "What products are low in stock?"',
    },
  },
  fr: {
    title: "Bienvenue dans MCP Client",
    message: {
      sender: "system",
      text: '👋 Bienvenue dans le Client MCP (Model Context Protocol) !\n\nCeci est votre session de chat en français. Vous pouvez :\n• Poser des questions sur vos données commerciales\n• Consulter l\'inventaire, les ventes et les produits\n• Obtenir des insights grâce à l\'analyse IA\n\nEssayez de demander : "Montrez-moi les données de ventes récentes" ou "Quels produits sont en rupture de stock ?"',
    },
  },
  nl: {
    title: "Welkom bij MCP Client",
    message: {
      sender: "system",
      text: '👋 Welkom bij de MCP (Model Context Protocol) Client!\n\nDit is uw Nederlandse chat sessie. U kunt:\n• Vragen stellen over uw bedrijfsgegevens\n• Inventaris, verkoop en producten opvragen\n• Inzichten krijgen door AI-analyse\n\nProbeer te vragen: "Toon me recente verkoopgegevens" of "Welke producten hebben weinig voorraad?"',
    },
  },
};

export function getWelcomeMessage(language: string): WelcomeMessageData | null {
  return welcomeMessages[language] || null;
}
