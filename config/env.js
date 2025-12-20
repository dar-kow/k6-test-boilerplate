/**
 * @file Environment configuration
 * @description Centralized configuration for hosts, tokens, and load profiles
 *
 * Pattern: Multi-environment support (PROD/DEV/STAGING)
 *
 * Usage:
 * - Update HOSTS with your API endpoints
 * - Add tokens for different user roles
 * - Customize load profiles as needed
 */

// =============================================================================
// HOSTS CONFIGURATION
// =============================================================================

export const HOSTS = {
  PROD: "https://api.example.com",
  DEV: "https://api-dev.example.com",
  STAGING: "https://api-staging.example.com",
  LOCAL: "http://localhost:3000"
};

// Active host for tests - change this based on environment
// Can be overridden with __ENV.HOST
export const CURRENT_HOST = __ENV.HOST
  ? HOSTS[__ENV.HOST] || __ENV.HOST
  : HOSTS.DEV;

// =============================================================================
// AUTHENTICATION TOKENS
// =============================================================================

/**
 * Tokens for different user roles
 *
 * Best practices:
 * - Store sensitive tokens in environment variables
 * - Use __ENV.TOKEN_USER || 'fallback' pattern
 * - Never commit real tokens to version control
 */
export const TOKENS = {
  USER: __ENV.TOKEN_USER || "your-user-token-here",
  ADMIN: __ENV.TOKEN_ADMIN || "your-admin-token-here",
  SUPER_USER: __ENV.TOKEN_SUPER_USER || "your-super-user-token-here"
};

// =============================================================================
// LOAD PROFILES
// =============================================================================

/**
 * Standardized load profiles
 *
 * | Profile | VUs | Duration | Use Case                    |
 * |---------|-----|----------|----------------------------|
 * | LIGHT   | 10  | 60s      | Smoke testing, CI/CD       |
 * | MEDIUM  | 30  | 5min     | Standard load, regression  |
 * | HEAVY   | 100 | 10min    | Stress testing, capacity   |
 */
export const LOAD_PROFILES = {
  SMOKE: {
    vus: 1,
    duration: "30s",
    description: "Quick sanity check"
  },
  LIGHT: {
    vus: 10,
    duration: "60s",
    description: "Daily CI/CD, quick validation"
  },
  MEDIUM: {
    vus: 30,
    duration: "5m",
    description: "Weekly regression, pre-release"
  },
  HEAVY: {
    vus: 100,
    duration: "10m",
    description: "Monthly stress testing, capacity planning"
  }
};

// Default profile - used when PROFILE env var is not set
export const DEFAULT_PROFILE = LOAD_PROFILES.LIGHT;

/**
 * Get profile based on environment variable
 * @returns {Object} Load profile configuration
 *
 * Usage: k6 run -e PROFILE=MEDIUM script.js
 */
export function getProfile() {
  const profileName = __ENV.PROFILE || 'LIGHT';
  return LOAD_PROFILES[profileName] || DEFAULT_PROFILE;
}

// =============================================================================
// API PATHS
// =============================================================================

/**
 * Centralized API paths
 * Pattern: Keep all paths in one place for easy maintenance
 */
export const API_PATHS = {
  // Auth endpoints
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh"
  },
  // Example domain endpoints
  USERS: {
    LIST: "/users",
    DETAILS: (id) => `/users/${id}`,
    CREATE: "/users",
    UPDATE: (id) => `/users/${id}`,
    DELETE: (id) => `/users/${id}`
  },
  PRODUCTS: {
    LIST: "/products",
    DETAILS: (id) => `/products/${id}`,
    SEARCH: "/products/search"
  }
};
