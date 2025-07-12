export async function fetchArticlesFromAzureSearch(
  query: string
): Promise<string[]> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();

  // Debug: log the actual response structure
  console.log("Azure Search response:", data);
  console.log("Available documents:", data.value);

  if (!data.value || !Array.isArray(data.value)) {
    console.warn("No search results found");
    return [];
  }

  // Since you have MCP tools data, let's try to extract more relevant information
  return data.value.map((doc: any) => {
    // Log each document structure to see what fields are available
    console.log("Document structure:", Object.keys(doc));

    // Try different field names that might contain MCP tool information
    const functionName =
      doc.functionName || doc.name || doc.toolName || doc.function;
    const description = doc.description || doc.desc || doc.summary;

    if (functionName && description) {
      return `${functionName}: ${description}`;
    } else if (functionName) {
      return functionName;
    } else if (description) {
      return description;
    } else {
      // Fallback to any string field we can find
      return doc.articleName || doc.title || doc.name || JSON.stringify(doc);
    }
  });
}
