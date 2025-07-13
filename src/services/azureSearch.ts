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

// Azure Search schema interface
interface FieldSchema {
  name: string;
  type: string;
  key?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
}

interface IndexSchema {
  indexName: string;
  fields: FieldSchema[];
}

interface SchemaResponse {
  success: boolean;
  data: IndexSchema;
  message: string;
  timestamp: string;
}

// Cache for schema to avoid repeated fetches
let cachedSchema: IndexSchema | null = null;

// Function to fetch Azure Search index schema
export async function fetchAzureSearchSchema(): Promise<IndexSchema | null> {
  if (cachedSchema) {
    return cachedSchema;
  }

  try {
    const response = await fetch("/api/tools/schema", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(`Schema fetch failed with ${response.status}`);
      return null;
    }

    const schemaResponse: SchemaResponse = await response.json();
    console.log("Fetched Azure Search schema:", schemaResponse);

    if (schemaResponse.success && schemaResponse.data) {
      cachedSchema = schemaResponse.data;
      return cachedSchema;
    }

    return null;
  } catch (error) {
    console.error("Error fetching Azure Search schema:", error);
    return null;
  }
}

// Function to get searchable fields from schema
export function getSearchableFields(schema: IndexSchema): string[] {
  return schema.fields
    .filter((field) => field.searchable === true)
    .map((field) => field.name);
}

// Function to get filterable fields from schema
export function getFilterableFields(schema: IndexSchema): string[] {
  return schema.fields
    .filter((field) => field.filterable === true)
    .map((field) => field.name);
}
