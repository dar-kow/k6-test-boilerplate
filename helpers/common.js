/**
 * @file Common helper functions
 * @description Reusable utilities for k6 tests
 *
 * Pattern: DRY principle - reduce code duplication by ~40%
 */

import { CURRENT_HOST, TOKENS } from '../config/env.js';

// =============================================================================
// URL BUILDERS
// =============================================================================

/**
 * Build full URL from path
 * @param {string} path - API endpoint path
 * @returns {string} Full URL
 *
 * Example: getUrl('/users/123') => 'https://api.example.com/users/123'
 */
export function getUrl(path) {
  return `${CURRENT_HOST}${path}`;
}

/**
 * Build URL with query parameters
 * @param {string} path - API endpoint path
 * @param {Object} params - Query parameters
 * @returns {string} Full URL with query string
 *
 * Example: getUrlWithParams('/users', { page: 1, limit: 10 })
 *          => 'https://api.example.com/users?page=1&limit=10'
 */
export function getUrlWithParams(path, params = {}) {
  const url = getUrl(path);
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return queryString ? `${url}?${queryString}` : url;
}

// =============================================================================
// HEADERS
// =============================================================================

/**
 * Get authorization headers for specified role
 * @param {string} role - User role (USER, ADMIN, SUPER_USER)
 * @returns {Object} Headers object with Authorization
 *
 * Example: getHeaders('ADMIN')
 */
export function getHeaders(role = 'USER') {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKENS[role]}`
  };
}

/**
 * Get headers without authorization (for public endpoints)
 * @returns {Object} Headers object
 */
export function getPublicHeaders() {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
}

/**
 * Get headers with custom additions
 * @param {string} role - User role
 * @param {Object} customHeaders - Additional headers
 * @returns {Object} Merged headers object
 */
export function getCustomHeaders(role, customHeaders = {}) {
  return {
    ...getHeaders(role),
    ...customHeaders
  };
}

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Log error messages (only errors, not info)
 * @param {string} context - Test context/name
 * @param {string} message - Error message
 */
export function logError(context, message) {
  console.error(`ERROR [${context}]: ${message}`);
}

/**
 * Log request failure with details
 * @param {string} context - Test context/name
 * @param {Object} response - k6 response object
 */
export function logRequestError(context, response) {
  logError(context, `Request failed with status ${response.status}: ${response.body?.substring(0, 200) || 'No body'}`);
}

// =============================================================================
// RANDOM DATA GENERATORS
// =============================================================================

/**
 * Generate random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random item from array
 * @param {Array} array - Source array
 * @returns {*} Random item from array
 */
export function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random string
 * @param {number} length - String length
 * @returns {string} Random alphanumeric string
 */
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 * @returns {string} Random email address
 */
export function randomEmail() {
  return `test-${randomString(8)}@example.com`;
}

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

/**
 * Generate pagination parameters
 * @param {number} pageNumber - Page number (1-based)
 * @param {number} pageSize - Items per page
 * @returns {Object} Pagination parameters
 */
export function paginationParams(pageNumber = 1, pageSize = 50) {
  return {
    pageNumber,
    pageSize
  };
}

/**
 * Generate random page parameters for testing
 * @param {number} maxPage - Maximum page number
 * @param {number} maxSize - Maximum page size
 * @returns {Object} Random pagination parameters
 */
export function randomPaginationParams(maxPage = 10, maxSize = 100) {
  return {
    pageNumber: randomInt(1, maxPage),
    pageSize: randomItem([10, 25, 50, 100].filter(s => s <= maxSize))
  };
}

// =============================================================================
// PAYLOAD BUILDERS
// =============================================================================

/**
 * Build standard list request payload
 * @param {Object} options - Request options
 * @returns {Object} Request payload
 */
export function listPayload(options = {}) {
  return {
    pageNumber: options.pageNumber || 1,
    pageSize: options.pageSize || 50,
    search: options.search || null,
    sort: options.sort || null,
    filters: options.filters || {}
  };
}

/**
 * Create user payload (example)
 * @param {Object} overrides - Override default values
 * @returns {Object} User creation payload
 */
export function createUserPayload(overrides = {}) {
  return {
    name: overrides.name || `Test User ${randomString(5)}`,
    email: overrides.email || randomEmail(),
    role: overrides.role || 'USER',
    ...overrides
  };
}

/**
 * Create product payload (example)
 * @param {Object} overrides - Override default values
 * @returns {Object} Product creation payload
 */
export function createProductPayload(overrides = {}) {
  return {
    name: overrides.name || `Product ${randomString(5)}`,
    price: overrides.price || randomInt(10, 1000),
    stock: overrides.stock || randomInt(0, 100),
    category: overrides.category || 'general',
    ...overrides
  };
}

// =============================================================================
// RESPONSE VALIDATORS
// =============================================================================

/**
 * Check if response has paginated list structure
 * @param {Object} data - Response data
 * @returns {boolean} True if valid list structure
 */
export function isValidListResponse(data) {
  return (
    data !== null &&
    data !== undefined &&
    data.items !== undefined &&
    Array.isArray(data.items)
  );
}

/**
 * Check if response has expected item count
 * @param {Object} data - Response data
 * @param {number} maxItems - Maximum expected items
 * @returns {boolean} True if valid
 */
export function hasValidItemCount(data, maxItems = 50) {
  return (
    isValidListResponse(data) &&
    data.items.length > 0 &&
    data.items.length <= maxItems
  );
}

// =============================================================================
// TIMING HELPERS
// =============================================================================

/**
 * Sleep with jitter (randomized delay)
 * @param {number} baseMs - Base sleep time in ms
 * @param {number} jitterMs - Maximum jitter in ms
 * @returns {number} Actual sleep time for use with k6 sleep()
 */
export function sleepWithJitter(baseMs, jitterMs = 0) {
  const jitter = jitterMs > 0 ? randomInt(0, jitterMs) : 0;
  return (baseMs + jitter) / 1000; // Convert to seconds for k6 sleep()
}

/**
 * Think time - realistic user delay
 * @returns {number} Sleep time in seconds
 */
export function thinkTime() {
  return sleepWithJitter(1000, 2000); // 1-3 seconds
}
