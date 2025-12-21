/**
 * @file Response validation utilities
 * @description Reusable check functions for k6 tests
 *
 * Pattern: Separation of validation logic for consistency
 */

import { check } from 'k6';

// =============================================================================
// STATUS CHECKS
// =============================================================================

/**
 * Check for specific HTTP status
 * @param {Object} res - k6 response object
 * @param {number} expectedStatus - Expected HTTP status code
 * @returns {boolean} Check result
 */
export function checkStatus(res, expectedStatus = 200) {
  return check(res, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus
  });
}

/**
 * Check for successful status (2xx)
 * @param {Object} res - k6 response object
 * @returns {boolean} Check result
 */
export function checkSuccess(res) {
  return check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300
  });
}

/**
 * Check for created status (201)
 * @param {Object} res - k6 response object
 * @returns {boolean} Check result
 */
export function checkCreated(res) {
  return checkStatus(res, 201);
}

/**
 * Check for no content status (204)
 * @param {Object} res - k6 response object
 * @returns {boolean} Check result
 */
export function checkNoContent(res) {
  return checkStatus(res, 204);
}

// =============================================================================
// RESPONSE STRUCTURE CHECKS
// =============================================================================

/**
 * Check paginated list response structure
 * @param {Object} res - k6 response object
 * @param {string} context - Test context for check names
 * @returns {boolean} Check result
 */
export function checkListResponse(res, context = 'list') {
  try {
    const data = res.json();

    return check(data, {
      [`${context}: has items array`]: (d) =>
        d.items !== undefined && Array.isArray(d.items),
      [`${context}: items not empty`]: (d) =>
        d.items && d.items.length > 0,
      [`${context}: valid page size`]: (d) =>
        d.items && d.items.length <= 100
    });
  } catch (e) {
    console.error(`Failed to parse ${context} response:`, e);
    return false;
  }
}

/**
 * Check single item response
 * @param {Object} res - k6 response object
 * @param {Array} requiredFields - Required field names
 * @param {string} context - Test context
 * @returns {boolean} Check result
 */
export function checkItemResponse(res, requiredFields = ['id'], context = 'item') {
  try {
    const data = res.json();

    const checks = {
      [`${context}: response is object`]: (d) =>
        d !== null && typeof d === 'object' && !Array.isArray(d)
    };

    // Add check for each required field
    requiredFields.forEach(field => {
      checks[`${context}: has ${field}`] = (d) => d[field] !== undefined;
    });

    return check(data, checks);
  } catch (e) {
    console.error(`Failed to parse ${context} response:`, e);
    return false;
  }
}

/**
 * Check response has specific fields with correct types
 * @param {Object} res - k6 response object
 * @param {Object} fieldTypes - Object with field names as keys and expected types as values
 * @param {string} context - Test context
 * @returns {boolean} Check result
 *
 * Example:
 * checkFieldTypes(res, { id: 'number', name: 'string', active: 'boolean' }, 'user')
 */
export function checkFieldTypes(res, fieldTypes, context = 'response') {
  try {
    const data = res.json();

    const checks = {};

    Object.entries(fieldTypes).forEach(([field, expectedType]) => {
      checks[`${context}: ${field} is ${expectedType}`] = (d) => {
        const value = d[field];
        if (expectedType === 'array') {
          return Array.isArray(value);
        }
        return typeof value === expectedType;
      };
    });

    return check(data, checks);
  } catch (e) {
    console.error(`Failed to parse ${context} response:`, e);
    return false;
  }
}

// =============================================================================
// BUSINESS LOGIC CHECKS
// =============================================================================

/**
 * Check array item structure (first item in list)
 * @param {Object} res - k6 response object
 * @param {Function} itemValidator - Function to validate single item
 * @param {string} context - Test context
 * @returns {boolean} Check result
 */
export function checkListItemStructure(res, itemValidator, context = 'list-item') {
  try {
    const data = res.json();

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return false;
    }

    return check(data.items[0], {
      [`${context}: valid structure`]: (item) => itemValidator(item)
    });
  } catch (e) {
    console.error(`Failed to validate ${context}:`, e);
    return false;
  }
}

/**
 * Check response time is acceptable
 * @param {Object} res - k6 response object
 * @param {number} maxMs - Maximum acceptable time in ms
 * @param {string} context - Test context
 * @returns {boolean} Check result
 */
export function checkResponseTime(res, maxMs, context = 'response') {
  return check(res, {
    [`${context}: response time < ${maxMs}ms`]: (r) => r.timings.duration < maxMs
  });
}

// =============================================================================
// COMPOSITE CHECKS
// =============================================================================

/**
 * Full validation for GET list endpoint
 * @param {Object} res - k6 response object
 * @param {Function} itemValidator - Optional item validator function
 * @param {string} context - Test context
 * @returns {boolean} All checks passed
 */
export function checkGetListEndpoint(res, itemValidator = null, context = 'list') {
  let allPassed = true;

  // Status check
  allPassed = checkStatus(res) && allPassed;

  // Structure check
  if (res.status === 200) {
    allPassed = checkListResponse(res, context) && allPassed;

    // Item structure check (optional)
    if (itemValidator) {
      allPassed = checkListItemStructure(res, itemValidator, `${context}-item`) && allPassed;
    }
  }

  return allPassed;
}

/**
 * Full validation for GET single item endpoint
 * @param {Object} res - k6 response object
 * @param {Array} requiredFields - Required field names
 * @param {string} context - Test context
 * @returns {boolean} All checks passed
 */
export function checkGetItemEndpoint(res, requiredFields = ['id'], context = 'item') {
  let allPassed = true;

  // Status check
  allPassed = checkStatus(res) && allPassed;

  // Structure check
  if (res.status === 200) {
    allPassed = checkItemResponse(res, requiredFields, context) && allPassed;
  }

  return allPassed;
}

/**
 * Full validation for POST create endpoint
 * @param {Object} res - k6 response object
 * @param {Array} requiredFields - Required fields in created object
 * @param {string} context - Test context
 * @returns {boolean} All checks passed
 */
export function checkPostEndpoint(res, requiredFields = ['id'], context = 'create') {
  let allPassed = true;

  // Status check (201 Created or 200 OK)
  allPassed = check(res, {
    [`${context}: status is 2xx`]: (r) => r.status >= 200 && r.status < 300
  }) && allPassed;

  // Structure check (if response has body)
  if (res.status >= 200 && res.status < 300 && res.body) {
    allPassed = checkItemResponse(res, requiredFields, context) && allPassed;
  }

  return allPassed;
}

/**
 * Full validation for DELETE endpoint
 * @param {Object} res - k6 response object
 * @param {string} context - Test context
 * @returns {boolean} All checks passed
 */
export function checkDeleteEndpoint(res, context = 'delete') {
  return check(res, {
    [`${context}: status is 2xx`]: (r) => r.status >= 200 && r.status < 300
  });
}

// =============================================================================
// ERROR CHECKS
// =============================================================================

/**
 * Check error response structure
 * @param {Object} res - k6 response object
 * @param {number} expectedStatus - Expected error status
 * @param {string} context - Test context
 * @returns {boolean} Check result
 */
export function checkErrorResponse(res, expectedStatus, context = 'error') {
  let allPassed = checkStatus(res, expectedStatus);

  try {
    const data = res.json();
    allPassed = check(data, {
      [`${context}: has error message`]: (d) =>
        d.message !== undefined || d.error !== undefined
    }) && allPassed;
  } catch (e) {
    // Error response might not be JSON
  }

  return allPassed;
}
