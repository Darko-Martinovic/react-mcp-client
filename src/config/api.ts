/**
 * Centralized API Configuration
 *
 * This module provides a single source of truth for all API endpoints.
 * The API version can be changed via environment variable or by modifying API_VERSION.
 *
 * Usage:
 *   import { endpoints, API_BASE } from '../config/api';
 *   const response = await fetch(endpoints.tool, { ... });
 */

// API version - change this value to update all API endpoints
export const API_VERSION = 'v1';

// Base API path with version
export const API_BASE = `/api/${API_VERSION}`;

/**
 * API Endpoints
 *
 * All API endpoints are defined here for easy maintenance and versioning.
 * Grouped by service/domain for better organization.
 */
export const endpoints = {
  // ─────────────────────────────────────────────────────────────────
  // Tool Proxy Endpoints
  // ─────────────────────────────────────────────────────────────────
  /** Execute an MCP tool */
  tool: `${API_BASE}/tool`,

  /** Search Azure Cognitive Search */
  search: `${API_BASE}/search`,

  /** Get Azure Search tools schema */
  toolsSchema: `${API_BASE}/tools/schema`,

  // ─────────────────────────────────────────────────────────────────
  // Supermarket Endpoints
  // ─────────────────────────────────────────────────────────────────
  /** Get all products */
  products: `${API_BASE}/supermarket/products`,

  /** Get low stock products with optional threshold */
  lowStock: (threshold = 10) =>
    `${API_BASE}/supermarket/products/low-stock?threshold=${threshold}`,

  /** Get sales data within a date range */
  sales: (startDate: string, endDate: string) =>
    `${API_BASE}/supermarket/sales?startDate=${startDate}&endDate=${endDate}`,

  /** Get inventory status */
  inventory: `${API_BASE}/supermarket/inventory/status`,

  // ─────────────────────────────────────────────────────────────────
  // ThirdApi (MongoDB) Endpoints
  // ─────────────────────────────────────────────────────────────────
  /** Get content types from MongoDB */
  contentTypes: `${API_BASE}/thirdapi/content-types`,

  /** Get articles with ingredients */
  articlesWithIngredients: `${API_BASE}/thirdapi/articles/ingredients`,

  /** Search articles by name */
  articlesByName: (name: string) =>
    `${API_BASE}/thirdapi/articles/search?name=${encodeURIComponent(name)}`,

  /** Get article by key */
  articleByKey: (key: string) => `${API_BASE}/thirdapi/articles/${key}`,

  // ─────────────────────────────────────────────────────────────────
  // Chat Endpoints
  // ─────────────────────────────────────────────────────────────────
  /** Send a chat message */
  chatMessage: `${API_BASE}/chat/message`,

  /** Get available chat functions */
  chatFunctions: `${API_BASE}/chat/functions`,

  // ─────────────────────────────────────────────────────────────────
  // Health Check Endpoints
  // ─────────────────────────────────────────────────────────────────
  /** Main health check (not versioned) */
  health: '/health',

  /** Supermarket service health */
  supermarketHealth: `${API_BASE}/supermarket/health`,

  /** ThirdApi service health */
  thirdapiHealth: `${API_BASE}/thirdapi/health`,
} as const;

// Type for endpoint keys (useful for type-safe endpoint references)
export type EndpointKey = keyof typeof endpoints;

