import { Message } from "../../services/chatService";

export const exportChat = (messages: Message[], title: string) => {
  // Transform messages with better role names and formatting
  const transformedMessages = messages.map((msg) => {
    let role = "Unknown";
    let displayName = "Unknown";

    switch (msg.sender) {
      case "user":
        role = "user";
        displayName = "You";
        break;
      case "system":
        role = "assistant";
        displayName = "AI Assistant";
        break;
      default:
        role = msg.sender;
        displayName = msg.sender;
    }

    return {
      role,
      displayName,
      content:
        msg.text ||
        (msg.tableData ? `[Table Data: ${msg.toolName}]` : "[No content]"),
      timestamp: new Date().toISOString(),
      ...(msg.tableData && {
        tableData: msg.tableData,
        toolName: msg.toolName,
      }),
    };
  });

  // Create enhanced export data
  const exportData = {
    chatTitle: title,
    exportedAt: new Date().toISOString(),
    messageCount: transformedMessages.length,
    participants: ["You", "AI Assistant"],
    messages: transformedMessages,
  };

  const dataStr =
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}_export.json`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

// Export as readable text format
export const exportChatAsText = (messages: Message[], title: string) => {
  const header = `Chat Export: ${title}\nExported: ${new Date().toLocaleString()}\n${"=".repeat(
    50
  )}\n\n`;

  const textContent = messages
    .map((msg) => {
      const sender = msg.sender === "user" ? "You" : "AI Assistant";
      const timestamp = new Date().toLocaleTimeString();
      const content =
        msg.text ||
        (msg.tableData ? `[Table Data: ${msg.toolName}]` : "[No content]");

      return `[${timestamp}] ${sender}:\n${content}\n`;
    })
    .join("\n");

  const fullText = header + textContent;

  const dataStr =
    "data:text/plain;charset=utf-8," + encodeURIComponent(fullText);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}_export.txt`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

// Export as Markdown format
export const exportChatAsMarkdown = (messages: Message[], title: string) => {
  const header = `# ${title}\n\n**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;

  const markdownContent = messages
    .map((msg) => {
      const sender = msg.sender === "user" ? "**You**" : "**AI Assistant**";
      const content =
        msg.text ||
        (msg.tableData ? `*[Table Data: ${msg.toolName}]*` : "*[No content]*");

      return `${sender}: ${content}\n`;
    })
    .join("\n");

  const fullMarkdown = header + markdownContent;

  const dataStr =
    "data:text/markdown;charset=utf-8," + encodeURIComponent(fullMarkdown);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `${title.replace(/\s+/g, "_") || "chat"}_export.md`
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};
