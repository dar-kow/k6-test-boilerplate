/**
 * @file HTTP utilities and wrappers
 * @description Higher-level HTTP functions with built-in error handling
 */

import http from 'k6/http';
import { getUrl, getHeaders, logRequestError } from '../helpers/common.js';

// =============================================================================
// HTTP REQUEST WRAPPERS
// =============================================================================

/**
 * GET request with standard headers and error logging
 * @param {string} path - API endpoint path
 * @param {string} role - User role for auth
 * @param {string} context - Test context for logging
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function get(path, role = 'USER', context = 'get', options = {}) {
  const url = getUrl(path);
  const headers = getHeaders(role);

  const res = http.get(url, { headers, ...options });

  if (res.status >= 400) {
    logRequestError(context, res);
  }

  return res;
}

/**
 * GET request with query parameters
 * @param {string} path - API endpoint path
 * @param {Object} params - Query parameters
 * @param {string} role - User role for auth
 * @param {string} context - Test context
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function getWithParams(path, params = {}, role = 'USER', context = 'get', options = {}) {
  const queryString = Object.entries(params)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const fullPath = queryString ? `${path}?${queryString}` : path;
  return get(fullPath, role, context, options);
}

/**
 * POST request with JSON payload
 * @param {string} path - API endpoint path
 * @param {Object} payload - Request body
 * @param {string} role - User role for auth
 * @param {string} context - Test context
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function post(path, payload, role = 'USER', context = 'post', options = {}) {
  const url = getUrl(path);
  const headers = getHeaders(role);
  const body = JSON.stringify(payload);

  const res = http.post(url, body, { headers, ...options });

  if (res.status >= 400) {
    logRequestError(context, res);
  }

  return res;
}

/**
 * PUT request with JSON payload
 * @param {string} path - API endpoint path
 * @param {Object} payload - Request body
 * @param {string} role - User role for auth
 * @param {string} context - Test context
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function put(path, payload, role = 'USER', context = 'put', options = {}) {
  const url = getUrl(path);
  const headers = getHeaders(role);
  const body = JSON.stringify(payload);

  const res = http.put(url, body, { headers, ...options });

  if (res.status >= 400) {
    logRequestError(context, res);
  }

  return res;
}

/**
 * PATCH request with JSON payload
 * @param {string} path - API endpoint path
 * @param {Object} payload - Request body
 * @param {string} role - User role for auth
 * @param {string} context - Test context
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function patch(path, payload, role = 'USER', context = 'patch', options = {}) {
  const url = getUrl(path);
  const headers = getHeaders(role);
  const body = JSON.stringify(payload);

  const res = http.patch(url, body, { headers, ...options });

  if (res.status >= 400) {
    logRequestError(context, res);
  }

  return res;
}

/**
 * DELETE request
 * @param {string} path - API endpoint path
 * @param {string} role - User role for auth
 * @param {string} context - Test context
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function del(path, role = 'USER', context = 'delete', options = {}) {
  const url = getUrl(path);
  const headers = getHeaders(role);

  const res = http.del(url, null, { headers, ...options });

  if (res.status >= 400) {
    logRequestError(context, res);
  }

  return res;
}

/**
 * DELETE request with body (some APIs require this)
 * @param {string} path - API endpoint path
 * @param {Object} payload - Request body
 * @param {string} role - User role for auth
 * @param {string} context - Test context
 * @param {Object} options - Additional k6 http options
 * @returns {Object} k6 response object
 */
export function delWithBody(path, payload, role = 'USER', context = 'delete', options = {}) {
  const url = getUrl(path);
  const headers = getHeaders(role);
  const body = JSON.stringify(payload);

  const res = http.del(url, body, { headers, ...options });

  if (res.status >= 400) {
    logRequestError(context, res);
  }

  return res;
}

// =============================================================================
// BATCH REQUESTS
// =============================================================================

/**
 * Execute multiple requests in parallel
 * @param {Array} requests - Array of request configs
 * @returns {Array} Array of responses
 *
 * Example:
 * batchGet([
 *   { path: '/users', role: 'ADMIN' },
 *   { path: '/products', role: 'USER' }
 * ])
 */
export function batchGet(requests) {
  const batch = requests.map(req => ({
    method: 'GET',
    url: getUrl(req.path),
    params: { headers: getHeaders(req.role || 'USER') }
  }));

  return http.batch(batch);
}

/**
 * Execute multiple POST requests in parallel
 * @param {Array} requests - Array of request configs with payloads
 * @returns {Array} Array of responses
 */
export function batchPost(requests) {
  const batch = requests.map(req => ({
    method: 'POST',
    url: getUrl(req.path),
    body: JSON.stringify(req.payload),
    params: { headers: getHeaders(req.role || 'USER') }
  }));

  return http.batch(batch);
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Safely parse JSON from response
 * @param {Object} res - k6 response object
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {Object|*} Parsed JSON or default value
 */
export function safeJson(res, defaultValue = null) {
  try {
    return res.json();
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Extract ID from created resource response
 * @param {Object} res - k6 response object
 * @param {string} idField - Name of ID field
 * @returns {*} ID value or null
 */
export function extractId(res, idField = 'id') {
  const data = safeJson(res);
  return data ? data[idField] : null;
}

/**
 * Extract items from list response
 * @param {Object} res - k6 response object
 * @returns {Array} Items array or empty array
 */
export function extractItems(res) {
  const data = safeJson(res);
  return data?.items || [];
}

/**
 * Get random item from list response
 * @param {Object} res - k6 response object
 * @returns {Object|null} Random item or null
 */
export function getRandomItem(res) {
  const items = extractItems(res);
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}
