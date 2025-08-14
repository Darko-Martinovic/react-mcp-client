import React, { useState, useEffect } from "react";
import { cacheManager } from "../services/cacheManager";
import styles from "./CacheManager.module.css";

interface CacheManagerProps {
  className?: string;
}

const CacheManager: React.FC<CacheManagerProps> = ({ className }) => {
  const [stats, setStats] = useState(cacheManager.getStats());
  const [entries, setEntries] = useState(cacheManager.getEntries());
  const [showDetails, setShowDetails] = useState(false);

  const refreshStats = () => {
    setStats(cacheManager.getStats());
    setEntries(cacheManager.getEntries());
  };

  useEffect(() => {
    // Refresh stats every 5 seconds
    const interval = setInterval(refreshStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    if (window.confirm("Are you sure you want to clear all cached data?")) {
      cacheManager.clear();
      refreshStats();
    }
  };

  const handleDeleteEntry = (key: string) => {
    cacheManager.delete(key);
    refreshStats();
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatTTL = (ttl: number) => {
    const minutes = Math.floor(ttl / (1000 * 60));
    const seconds = Math.floor((ttl % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getTimeRemaining = (entry: any) => {
    const now = Date.now();
    const remaining = entry.ttl - (now - entry.timestamp);
    return remaining > 0 ? formatTTL(remaining) : "Expired";
  };

  return (
    <div className={`${styles.cacheManager} ${className || ""}`}>
      <div className={styles.header}>
        <h3>📦 Cache Status</h3>
        <button onClick={refreshStats} className={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Entries:</span>
          <span className={styles.statValue}>{stats.totalEntries}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Hit Rate:</span>
          <span className={styles.statValue}>{stats.hitRate.toFixed(1)}%</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Hits:</span>
          <span className={styles.statValue}>{stats.totalHits}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Misses:</span>
          <span className={styles.statValue}>{stats.totalMisses}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={styles.toggleButton}
        >
          {showDetails ? "🔼 Hide Details" : "🔽 Show Details"}
        </button>
        <button
          onClick={handleClearCache}
          className={styles.clearButton}
          disabled={stats.totalEntries === 0}
        >
          🗑️ Clear Cache
        </button>
      </div>

      {showDetails && (
        <div className={styles.details}>
          <h4>Cache Entries ({entries.length})</h4>
          {entries.length === 0 ? (
            <p className={styles.empty}>No cached entries</p>
          ) : (
            <div className={styles.entryList}>
              {entries.map(({ key, entry }) => (
                <div key={key} className={styles.entry}>
                  <div className={styles.entryHeader}>
                    <span className={styles.entryKey} title={key}>
                      {key.length > 50 ? `${key.substring(0, 50)}...` : key}
                    </span>
                    <button
                      onClick={() => handleDeleteEntry(key)}
                      className={styles.deleteButton}
                      title="Delete this cache entry"
                    >
                      ❌
                    </button>
                  </div>
                  <div className={styles.entryInfo}>
                    <small>
                      Cached: {formatTimestamp(entry.timestamp)} | Hits:{" "}
                      {entry.hits} | TTL: {getTimeRemaining(entry)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CacheManager;
