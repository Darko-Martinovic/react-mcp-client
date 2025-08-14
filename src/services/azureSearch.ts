import { cacheManager, generateSearchCacheKey } from "./cacheManager";

export async function fetchArticlesFromAzureSearch(
  query: string
): Promise<string[]> {
  // Generate cache key for this search
  const cacheKey = generateSearchCacheKey(query);

  // Check cache first
  const cachedResults = cacheManager.get<string[]>(cacheKey);
  if (cachedResults) {
    console.log(`🎯 Using cached search results for: "${query}"`);
    return cachedResults;
  }

  console.log(`🔍 Making fresh search request for: "${query}"`);

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
  const results = data.value.map((doc: any) => {
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

  // Cache the search results with 10 minute TTL
  cacheManager.set(cacheKey, results, 10 * 60 * 1000);
  console.log(`📦 Cached search results for: "${query}"`);

  return results;
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

// Function to fetch Azure Search index schema
export async function fetchAzureSearchSchema(): Promise<IndexSchema | null> {
  const cacheKey = "azure-search-schema";

  // Check cache first
  const cachedSchema = cacheManager.get<IndexSchema>(cacheKey);
  if (cachedSchema) {
    console.log("🎯 Using cached Azure Search schema");
    return cachedSchema;
  }

  console.log("📋 Fetching fresh Azure Search schema");

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
      // Cache schema for 30 minutes (schemas don't change often)
      cacheManager.set(cacheKey, schemaResponse.data, 30 * 60 * 1000);
      console.log("📦 Cached Azure Search schema");
      return schemaResponse.data;
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
