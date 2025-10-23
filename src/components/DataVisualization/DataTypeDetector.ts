/**
 * Data type detection utilities for determining the best visualization format
 */

export interface DataTypeAnalysis {
  isTabular: boolean;
  isJson: boolean;
  isHomogeneous: boolean;
  hasComplexNesting: boolean;
  recordCount: number;
  fieldCount: number;
  complexFieldCount: number;
  recommendedView: "table" | "json" | "mixed";
}

/**
 * Analyze data structure to determine the best visualization approach
 */
export function analyzeDataStructure(data: any[]): DataTypeAnalysis {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      isTabular: false,
      isJson: false,
      isHomogeneous: false,
      hasComplexNesting: false,
      recordCount: 0,
      fieldCount: 0,
      complexFieldCount: 0,
      recommendedView: "json",
    };
  }

  const recordCount = data.length;
  let isHomogeneous = true;
  let hasComplexNesting = false;
  let totalFieldCount = 0;
  let complexFieldCount = 0;

  // Get field structure from first record
  const firstRecord = data[0];
  const firstRecordFields = Object.keys(firstRecord || {});
  const firstRecordFieldTypes = getFieldTypes(firstRecord);

  // Analyze each record
  data.forEach((record, index) => {
    if (typeof record !== "object" || record === null) {
      isHomogeneous = false;
      return;
    }

    const recordFields = Object.keys(record);
    const recordFieldTypes = getFieldTypes(record);

    // Check field consistency
    if (index === 0) {
      totalFieldCount = recordFields.length;
      complexFieldCount = Object.values(recordFieldTypes).filter(
        (type) => type === "object" || type === "array"
      ).length;
    } else {
      // Check if fields match first record
      if (
        recordFields.length !== firstRecordFields.length ||
        !recordFields.every((field) => firstRecordFields.includes(field))
      ) {
        isHomogeneous = false;
      }

      // Check if field types match
      Object.keys(recordFieldTypes).forEach((field) => {
        if (firstRecordFieldTypes[field] !== recordFieldTypes[field]) {
          isHomogeneous = false;
        }
      });
    }

    // Check for complex nesting
    if (hasComplexNestedData(record)) {
      hasComplexNesting = true;
    }
  });

  // Determine if data is suitable for tabular display
  const isTabular =
    isHomogeneous &&
    !hasComplexNesting &&
    complexFieldCount <= Math.max(1, totalFieldCount * 0.3); // Allow up to 30% complex fields

  const isJson = !isTabular || hasComplexNesting;

  // Recommend view based on analysis
  let recommendedView: "table" | "json" | "mixed" = "table";

  if (hasComplexNesting || complexFieldCount > totalFieldCount * 0.5) {
    recommendedView = "json";
  } else if (!isHomogeneous || complexFieldCount > 0) {
    recommendedView = "mixed";
  }

  return {
    isTabular,
    isJson,
    isHomogeneous,
    hasComplexNesting,
    recordCount,
    fieldCount: totalFieldCount,
    complexFieldCount,
    recommendedView,
  };
}

/**
 * Get field types for a record
 */
function getFieldTypes(record: any): Record<string, string> {
  const fieldTypes: Record<string, string> = {};

  if (typeof record === "object" && record !== null) {
    Object.keys(record).forEach((key) => {
      const value = record[key];
      if (value === null || value === undefined) {
        fieldTypes[key] = "null";
      } else if (Array.isArray(value)) {
        fieldTypes[key] = "array";
      } else if (typeof value === "object") {
        fieldTypes[key] = "object";
      } else {
        fieldTypes[key] = typeof value;
      }
    });
  }

  return fieldTypes;
}

/**
 * Check if a record has complex nested data structures
 */
function hasComplexNestedData(
  record: any,
  maxDepth: number = 2,
  currentDepth: number = 0
): boolean {
  if (
    currentDepth >= maxDepth ||
    typeof record !== "object" ||
    record === null
  ) {
    return false;
  }

  for (const key in record) {
    const value = record[key];

    if (Array.isArray(value)) {
      // Array of primitives is OK, array of objects is complex
      if (
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null
      ) {
        return true;
      }
      // Check if array has more than simple values
      if (
        value.some(
          (item) =>
            Array.isArray(item) || (typeof item === "object" && item !== null)
        )
      ) {
        return true;
      }
    } else if (typeof value === "object" && value !== null) {
      // Nested object
      const nestedKeys = Object.keys(value);
      if (nestedKeys.length > 3) {
        // More than 3 nested fields is complex
        return true;
      }
      if (hasComplexNestedData(value, maxDepth, currentDepth + 1)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if data should be displayed as JSON based on query context
 */
export function shouldDisplayAsJson(data: any[], query?: string): boolean {
  const analysis = analyzeDataStructure(data);

  // Query-based hints
  const queryLower = (query || "").toLowerCase();
  const jsonKeywords = [
    "json",
    "document",
    "raw",
    "structure",
    "nested",
    "complex",
  ];
  const tableKeywords = ["table", "list", "summary", "report", "chart"];

  const hasJsonHint = jsonKeywords.some((keyword) =>
    queryLower.includes(keyword)
  );
  const hasTableHint = tableKeywords.some((keyword) =>
    queryLower.includes(keyword)
  );

  // If query explicitly requests format, honor it
  if (hasJsonHint && !hasTableHint) {
    return true;
  }
  if (hasTableHint && !hasJsonHint) {
    return false;
  }

  // Use analysis recommendation
  return analysis.recommendedView === "json";
}

/**
 * Check if data should be displayed as table
 */
export function shouldDisplayAsTable(data: any[], query?: string): boolean {
  const analysis = analyzeDataStructure(data);

  // Query-based hints
  const queryLower = (query || "").toLowerCase();
  const jsonKeywords = ["json", "document", "raw", "structure"];
  const tableKeywords = ["table", "list", "summary", "report"];

  const hasJsonHint = jsonKeywords.some((keyword) =>
    queryLower.includes(keyword)
  );
  const hasTableHint = tableKeywords.some((keyword) =>
    queryLower.includes(keyword)
  );

  // If query explicitly requests format, honor it
  if (hasTableHint && !hasJsonHint) {
    return true;
  }
  if (hasJsonHint && !hasTableHint) {
    return false;
  }

  // Use analysis recommendation
  return (
    analysis.recommendedView === "table" || analysis.recommendedView === "mixed"
  );
}

/**
 * Detect if response is from MongoDB/GkApi based on plugin information
 */
export function isMongoDbResponse(toolName?: string, data?: any): boolean {
  // Check tool name for GkApi indicators
  if (toolName && toolName.toLowerCase().includes("gkapi")) {
    return true;
  }

  // Check for MongoDB-specific response structure
  if (data && typeof data === "object") {
    // Check for common MongoDB response patterns
    if (data.totalDocuments || data.totalUniqueTypes) {
      return true;
    }

    // Check for ObjectId patterns in data
    if (Array.isArray(data) && data.length > 0) {
      const firstRecord = data[0];
      if (firstRecord && typeof firstRecord === "object") {
        // Look for MongoDB ObjectId pattern
        if (
          firstRecord._id &&
          typeof firstRecord._id === "string" &&
          /^[0-9a-fA-F]{24}$/.test(firstRecord._id)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Flatten nested objects for table display (when mixed view is needed)
 */
export function flattenForTable(data: any[]): any[] {
  return data.map((record) => {
    const flattened: any = {};

    function flatten(obj: any, prefix: string = "") {
      Object.keys(obj || {}).forEach((key) => {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value === null || value === undefined) {
          flattened[newKey] = value;
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            flattened[newKey] = "[]";
          } else if (value.every((item) => typeof item !== "object")) {
            // Array of primitives
            flattened[newKey] = value.join(", ");
          } else {
            // Complex array
            flattened[newKey] = `[${value.length} items]`;
          }
        } else if (typeof value === "object") {
          const objKeys = Object.keys(value);
          if (objKeys.length <= 2) {
            // Small object - flatten it
            flatten(value, newKey);
          } else {
            // Large object - summarize
            flattened[newKey] = `{${objKeys.length} fields}`;
          }
        } else {
          flattened[newKey] = value;
        }
      });
    }

    flatten(record);
    return flattened;
  });
}
