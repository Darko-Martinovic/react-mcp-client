// Basic Cache Manager for React MCP Client
// Phase 1: Simple in-memory caching with TTL support

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
  queryHash: string;
  hits: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

class BasicCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Maximum number of cache entries
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };

  /**
   * Store data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      queryHash: this.hashQuery(key),
      hits: 0,
    };

    // Remove expired entries and enforce size limit
    this.cleanup();

    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    this.stats.sets++;

    console.log(`📦 Cache SET: ${key} (TTL: ${entry.ttl}ms)`);
  }

  /**
   * Retrieve data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      console.log(`⏰ Cache EXPIRED: ${key}`);
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    console.log(`✅ Cache HIT: ${key} (hits: ${entry.hits})`);
    return entry.data;
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
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
    console.log("🧹 Cache CLEARED");
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      totalEntries: this.cache.size,
      totalHits,
      totalMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
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
 * Generate cache key for MCP tool calls
 */
export const generateMcpCacheKey = (
  tool: string,
  args: Record<string, unknown>
): string => {
  // Sort args to ensure consistent cache keys
  const sortedArgs = Object.keys(args)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = args[key];
      return sorted;
    }, {} as Record<string, unknown>);

  return `mcp:${tool}:${JSON.stringify(sortedArgs)}`;
};

/**
 * Generate cache key for Azure OpenAI calls
 */
export const generateAICacheKey = (
  message: string,
  context?: string
): string => {
  const normalizedMessage = message.toLowerCase().trim();
  const contextHash = context ? btoa(context).slice(0, 8) : "";
  return `ai:${normalizedMessage}:${contextHash}`;
};

/**
 * Generate cache key for Azure Search calls
 */
export const generateSearchCacheKey = (
  query: string,
  filters?: Record<string, any>
): string => {
  const filtersStr = filters ? JSON.stringify(filters) : "";
  return `search:${query}:${filtersStr}`;
};

// Export singleton instance
export const cacheManager = new BasicCacheManager();

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
