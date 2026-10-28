// Advanced Cache Manager for React MCP Client
// Phase 2: Semantic query matching and intelligent caching

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
  queryHash: string;
  hits: number;
  // Phase 2: Semantic matching fields
  originalQuery?: string;
  normalizedQuery?: string;
  semanticTokens?: string[];
  category?: string;
}

interface SemanticMatch {
  key: string;
  entry: CacheEntry<any>;
  similarity: number;
  matchType: "exact" | "semantic" | "category";
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  semanticHits: number;
  hitRate: number;
  semanticHitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

class AdvancedCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Maximum number of cache entries
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
  private stats = {
    hits: 0,
    misses: 0,
    semanticHits: 0,
    sets: 0,
    evictions: 0,
  };

  // Phase 2: Semantic matching configuration
  private semanticSimilarityThreshold = 0.75; // 75% similarity threshold
  private enableSemanticMatching = true;

  /**
   * Store data in cache with optional TTL and semantic analysis
   */
  set<T>(key: string, data: T, ttl?: number, originalQuery?: string): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      queryHash: this.hashQuery(key),
      hits: 0,
      // Phase 2: Add semantic analysis
      originalQuery,
      normalizedQuery: originalQuery
        ? this.normalizeQuery(originalQuery)
        : undefined,
      semanticTokens: originalQuery
        ? this.extractSemanticTokens(originalQuery)
        : undefined,
      category: this.categorizeQuery(key, originalQuery),
    };

    // Remove expired entries and enforce size limit
    this.cleanup();

    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    this.stats.sets++;

    console.log(
      `📦 Cache SET: ${key} (TTL: ${entry.ttl}ms)${
        originalQuery ? ` [Query: "${originalQuery}"]` : ""
      }`
    );
  }

  /**
   * Retrieve data from cache with semantic matching
   */
  get<T>(key: string, originalQuery?: string): T | null {
    // First try exact match
    const exactMatch = this.cache.get(key);

    if (exactMatch && !this.isExpired(exactMatch)) {
      exactMatch.hits++;
      this.stats.hits++;
      console.log(`✅ Cache EXACT HIT: ${key} (hits: ${exactMatch.hits})`);
      return exactMatch.data;
    }

    // If no exact match and semantic matching is enabled, try semantic matching
    if (this.enableSemanticMatching && originalQuery) {
      const semanticMatch = this.findSemanticMatch(originalQuery, key);
      if (semanticMatch) {
        semanticMatch.entry.hits++;
        this.stats.semanticHits++;
        console.log(
          `🧠 Cache SEMANTIC HIT: ${semanticMatch.key} (similarity: ${(
            semanticMatch.similarity * 100
          ).toFixed(1)}%, hits: ${semanticMatch.entry.hits})`
        );
        return semanticMatch.entry.data;
      }
    }

    // Clean up expired exact match if it existed
    if (exactMatch && this.isExpired(exactMatch)) {
      this.cache.delete(key);
      console.log(`⏰ Cache EXPIRED: ${key}`);
    }

    this.stats.misses++;
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }
  /**
   * Check if cache has valid entry for key
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Remove specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, semanticHits: 0, sets: 0, evictions: 0 };
    console.log("🧹 Cache CLEARED");
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalHits = this.stats.hits + this.stats.semanticHits;
    const totalMisses = this.stats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      totalEntries: this.cache.size,
      totalHits,
      totalMisses,
      semanticHits: this.stats.semanticHits,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      semanticHitRate:
        totalRequests > 0 ? (this.stats.semanticHits / totalRequests) * 100 : 0,
      oldestEntry:
        entries.length > 0 ? Math.min(...entries.map((e) => e.timestamp)) : 0,
      newestEntry:
        entries.length > 0 ? Math.max(...entries.map((e) => e.timestamp)) : 0,
    };
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{ key: string; entry: CacheEntry<any> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
    }));
  }

  /**
   * Set cache configuration
   */
  configure(options: { maxSize?: number; defaultTTL?: number }): void {
    if (options.maxSize !== undefined) {
      this.maxSize = options.maxSize;
    }
    if (options.defaultTTL !== undefined) {
      this.defaultTTL = options.defaultTTL;
    }
    console.log(
      `⚙️ Cache configured: maxSize=${this.maxSize}, defaultTTL=${this.defaultTTL}ms`
    );
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Generate hash for query similarity
   */
  private hashQuery(query: string): string {
    // Simple hash function for basic similarity detection
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      console.log(`🧹 Cache cleanup removed expired: ${key}`);
    });
  }

  /**
   * Evict oldest entry when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      console.log(`🚫 Cache evicted oldest: ${oldestKey}`);
    }
  }

  // Phase 2: Semantic Analysis Methods

  /**
   * Find semantically similar cached entries, respecting service prefixes
   */
  private findSemanticMatch(
    query: string,
    targetKey?: string
  ): SemanticMatch | null {
    const normalizedQuery = this.normalizeQuery(query);
    const queryTokens = this.extractSemanticTokens(query);
    const queryCategory = this.categorizeQuery("", query);

    // Extract service prefix from target key to limit search scope
    let servicePrefix = "";
    if (targetKey) {
      const parts = targetKey.split(":");
      if (parts.length >= 3) {
        // Format: chat:id:service:... or global:service:...
        servicePrefix = parts.slice(0, 3).join(":"); // e.g., "chat:id:ai" or "global:search"
      }
    }

    let bestMatch: SemanticMatch | null = null;
    let bestSimilarity = 0;

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry) || !entry.normalizedQuery) {
        continue;
      }

      // CRITICAL FIX: Only search within the same service prefix
      if (servicePrefix && !key.startsWith(servicePrefix)) {
        continue;
      }

      // Calculate different types of similarity
      const textSimilarity = this.calculateTextSimilarity(
        normalizedQuery,
        entry.normalizedQuery
      );
      const tokenSimilarity = entry.semanticTokens
        ? this.calculateTokenSimilarity(queryTokens, entry.semanticTokens)
        : 0;
      const categorySimilarity = entry.category === queryCategory ? 0.3 : 0;

      // Weighted average of different similarity measures
      const overallSimilarity =
        textSimilarity * 0.4 + tokenSimilarity * 0.4 + categorySimilarity;

      if (
        overallSimilarity > bestSimilarity &&
        overallSimilarity >= this.semanticSimilarityThreshold
      ) {
        bestSimilarity = overallSimilarity;
        bestMatch = {
          key,
          entry,
          similarity: overallSimilarity,
          matchType:
            overallSimilarity > 0.95
              ? "exact"
              : categorySimilarity > 0
              ? "category"
              : "semantic",
        };
      }
    }

    return bestMatch;
  }

  /**
   * Normalize query for better matching
   */
  private normalizeQuery(query: string): string {
    return (
      query
        .toLowerCase()
        .trim()
        // Normalize time references
        .replace(/\b(today|now|current)\b/g, "[current]")
        .replace(/\b(yesterday|last\s+day)\b/g, "[previous_day]")
        .replace(/\b(last\s+week|this\s+week)\b/g, "[week]")
        .replace(/\b(last\s+month|this\s+month)\b/g, "[month]")
        .replace(/\b(last\s+year|this\s+year)\b/g, "[year]")
        // Normalize numbers
        .replace(/\b\d+\b/g, "[number]")
        // Normalize action words
        .replace(
          /\b(show|display|get|fetch|retrieve|find|list|give|provide)\b/g,
          "[action]"
        )
        // Normalize question words
        .replace(/\b(what|how|which|when|where|why)\b/g, "[question]")
        // Remove extra whitespace
        .replace(/\s+/g, " ")
    );
  }

  /**
   * Extract semantic tokens from query
   */
  private extractSemanticTokens(query: string): string[] {
    const tokens = new Set<string>();
    const words = query.toLowerCase().split(/\s+/);

    // Business domain keywords
    const businessKeywords = [
      "sales",
      "revenue",
      "profit",
      "products",
      "inventory",
      "stock",
      "orders",
      "customers",
      "suppliers",
      "categories",
      "performance",
      "analytics",
      "data",
      "low",
      "high",
      "best",
      "worst",
      "top",
      "bottom",
      "total",
      "summary",
    ];

    // Time-related keywords
    const timeKeywords = [
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "today",
      "yesterday",
      "current",
      "recent",
      "latest",
      "period",
      "range",
      "since",
      "until",
      "between",
    ];

    // Action keywords
    const actionKeywords = [
      "show",
      "display",
      "get",
      "fetch",
      "list",
      "find",
      "search",
      "analyze",
      "calculate",
      "report",
      "export",
      "view",
      "check",
    ];

    words.forEach((word) => {
      if (businessKeywords.includes(word)) tokens.add(`business:${word}`);
      if (timeKeywords.includes(word)) tokens.add(`time:${word}`);
      if (actionKeywords.includes(word)) tokens.add(`action:${word}`);
      if (
        word.length > 3 &&
        !["the", "and", "for", "with", "that", "this"].includes(word)
      ) {
        tokens.add(word);
      }
    });

    return Array.from(tokens);
  }

  /**
   * Categorize query for similarity matching
   */
  private categorizeQuery(cacheKey: string, query?: string): string {
    const combined = `${cacheKey} ${query || ""}`.toLowerCase();

    if (
      combined.includes("sales") ||
      combined.includes("revenue") ||
      combined.includes("profit")
    ) {
      return "sales";
    }
    if (
      combined.includes("inventory") ||
      combined.includes("stock") ||
      combined.includes("products")
    ) {
      return "inventory";
    }
    if (combined.includes("customer") || combined.includes("order")) {
      return "customer";
    }
    if (combined.includes("search") || combined.includes("find")) {
      return "search";
    }
    if (combined.includes("category") || combined.includes("performance")) {
      return "analytics";
    }

    return "general";
  }

  /**
   * Calculate text similarity using word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(" ").filter((w) => w.length > 2));
    const words2 = new Set(text2.split(" ").filter((w) => w.length > 2));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate token-based similarity
   */
  private calculateTokenSimilarity(
    tokens1: string[],
    tokens2: string[]
  ): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Configure semantic matching
   */
  configureSemanticMatching(options: {
    enabled?: boolean;
    threshold?: number;
  }): void {
    if (options.enabled !== undefined) {
      this.enableSemanticMatching = options.enabled;
    }
    if (options.threshold !== undefined) {
      this.semanticSimilarityThreshold = Math.max(
        0.1,
        Math.min(1.0, options.threshold)
      );
    }
    console.log(
      `🧠 Semantic matching configured: enabled=${this.enableSemanticMatching}, threshold=${this.semanticSimilarityThreshold}`
    );
  }
}

/**
 * Tool-specific TTL configuration
 */
export const getTTLForTool = (tool: string): number => {
  switch (tool.toLowerCase()) {
    case "getproducts":
    case "products":
      return 15 * 60 * 1000; // 15 minutes - products don't change often

    case "getdetailedinventory":
    case "getinventorystatus":
    case "inventory":
      return 2 * 60 * 1000; // 2 minutes - inventory changes frequently

    case "getlowstockproducts":
    case "lowstock":
      return 1 * 60 * 1000; // 1 minute - critical data, needs to be fresh

    case "getsalesdata":
    case "gettotalrevenue":
    case "getsalesbycategory":
    case "getdailysummary":
    case "sales":
      return 5 * 60 * 1000; // 5 minutes - sales data updates regularly

    case "search_azure_cognitive":
    case "search":
      return 10 * 60 * 1000; // 10 minutes - search results fairly stable

    default:
      return 5 * 60 * 1000; // 5 minutes default
  }
};

/**
 * Generate cache key for MCP tool calls with chat isolation and service prefix
 */
export const generateMcpCacheKey = (
  tool: string,
  args: Record<string, unknown>,
  chatId?: string
): string => {
  // Sort args to ensure consistent cache keys
  const sortedArgs = Object.keys(args)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = args[key];
      return sorted;
    }, {} as Record<string, unknown>);

  const chatPrefix = chatId ? `chat:${chatId}:` : "global:";
  return `${chatPrefix}mcp:${tool}:${JSON.stringify(sortedArgs)}`;
};

/**
 * Generate cache key for Azure OpenAI calls with chat isolation and service prefix
 */
export const generateAICacheKey = (
  message: string,
  context?: string,
  chatId?: string
): string => {
  const normalizedMessage = message.toLowerCase().trim();
  const contextHash = context ? btoa(context).slice(0, 8) : "";
  const chatPrefix = chatId ? `chat:${chatId}:` : "global:";
  return `${chatPrefix}ai:${normalizedMessage}:${contextHash}`;
};

/**
 * Generate cache key for Azure Search calls with service prefix (global by default)
 */
export const generateSearchCacheKey = (
  query: string,
  filters?: Record<string, any>,
  chatId?: string
): string => {
  const filtersStr = filters ? JSON.stringify(filters) : "";
  // Search results are usually global, but allow chat-specific if needed
  const chatPrefix = chatId ? `chat:${chatId}:` : "global:";
  return `${chatPrefix}search:${query}:${filtersStr}`;
};

// Export singleton instance
export const cacheManager = new AdvancedCacheManager();

// Configure cache for development (more aggressive caching)
if (import.meta.env.DEV) {
  cacheManager.configure({
    maxSize: 50, // Smaller cache in development
    defaultTTL: 10 * 60 * 1000, // 10 minutes in development
  });
} else {
  cacheManager.configure({
    maxSize: 200, // Larger cache in production
    defaultTTL: 5 * 60 * 1000, // 5 minutes in production
  });
}

export default cacheManager;
