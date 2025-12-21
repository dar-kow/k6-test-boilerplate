/**
 * @file GET Endpoint Performance Test
 * @description Template for testing GET list/details endpoints
 *
 * Test Objectives:
 * - Measure response time for GET requests under load
 * - Validate response structure
 * - Ensure SLO compliance
 *
 * Usage:
 *   k6 run tests/example/get-endpoint.js
 *   k6 run -e PROFILE=MEDIUM tests/example/get-endpoint.js
 *   k6 run -e HOST=PROD -e PROFILE=HEAVY tests/example/get-endpoint.js
 */

import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { get, getWithParams, extractItems, getRandomItem } from '../../utils/http-utils.js';
import { checkStatus, checkListResponse, checkItemResponse } from '../../utils/checks.js';
import { randomInt, thinkTime, logError } from '../../helpers/common.js';
import { getProfile } from '../../config/env.js';
import { ENDPOINT_SLO, generateThresholds } from '../../config/slo.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const listRequests = new Counter('get_list_requests');
const listErrors = new Counter('get_list_errors');
const listDuration = new Trend('get_list_duration');

const detailsRequests = new Counter('get_details_requests');
const detailsErrors = new Counter('get_details_errors');
const detailsDuration = new Trend('get_details_duration');

// =============================================================================
// OPTIONS
// =============================================================================

const profile = getProfile();
const slo = ENDPOINT_SLO.products.list;

export const options = {
  ...profile,
  thresholds: {
    ...generateThresholds(slo),
    // Custom metric thresholds
    get_list_duration: [`p(95)<${slo.p95}`, `p(99)<${slo.p99}`],
    get_list_errors: ['count<50'],
    get_details_duration: [`p(95)<${ENDPOINT_SLO.products.details.p95}`],
    get_details_errors: ['count<50'],
  },
};

// =============================================================================
// TEST DATA
// =============================================================================

// Test variations for list endpoint
const listTestCases = [
  { pageSize: 10, description: 'small page' },
  { pageSize: 25, description: 'medium page' },
  { pageSize: 50, description: 'large page' },
];

// =============================================================================
// SETUP & TEARDOWN
// =============================================================================

export function setup() {
  console.log('========================================');
  console.log('GET Endpoint Performance Test');
  console.log('========================================');
  console.log(`Profile: ${__ENV.PROFILE || 'LIGHT'}`);
  console.log(`Host: ${__ENV.HOST || 'DEV'}`);
  console.log(`VUs: ${profile.vus}`);
  console.log(`Duration: ${profile.duration}`);
  console.log(`SLO: p95<${slo.p95}ms, p99<${slo.p99}ms`);
  console.log('========================================');

  // Optional: Fetch some IDs for details endpoint testing
  const res = getWithParams('/products', { pageSize: 10 }, 'USER', 'setup');
  const items = extractItems(res);

  return {
    itemIds: items.map(item => item.id).filter(Boolean)
  };
}

export function teardown(data) {
  console.log('========================================');
  console.log('GET Endpoint Test Completed');
  console.log('========================================');
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

/**
 * Test GET list endpoint with pagination
 */
function testListEndpoint() {
  // Random test case
  const testCase = listTestCases[randomInt(0, listTestCases.length - 1)];

  const startTime = Date.now();
  const res = getWithParams(
    '/products',
    {
      pageNumber: randomInt(1, 5),
      pageSize: testCase.pageSize
    },
    'USER',
    'get-list'
  );
  const duration = Date.now() - startTime;

  // Track metrics
  listRequests.add(1);
  listDuration.add(duration);

  if (res.status !== 200) {
    listErrors.add(1);
    logError('get-list', `Failed with status ${res.status} for ${testCase.description}`);
  }

  // Validations
  checkStatus(res);

  if (res.status === 200) {
    checkListResponse(res, 'products');

    // Validate first item structure
    try {
      const data = res.json();
      if (data.items && data.items.length > 0) {
        check(data.items[0], {
          'item has id': (item) => item.id !== undefined,
          'item has name': (item) => item.name !== undefined,
          'item has price': (item) => item.price !== undefined,
        });
      }
    } catch (e) {
      logError('get-list', `JSON parsing failed: ${e.message}`);
    }
  }
}

/**
 * Test GET details endpoint
 */
function testDetailsEndpoint(itemIds) {
  if (!itemIds || itemIds.length === 0) {
    // Fallback to fixed ID if no IDs available
    itemIds = [1, 2, 3];
  }

  const itemId = itemIds[randomInt(0, itemIds.length - 1)];

  const startTime = Date.now();
  const res = get(`/products/${itemId}`, 'USER', 'get-details');
  const duration = Date.now() - startTime;

  // Track metrics
  detailsRequests.add(1);
  detailsDuration.add(duration);

  if (res.status !== 200) {
    detailsErrors.add(1);
    logError('get-details', `Failed with status ${res.status} for ID ${itemId}`);
  }

  // Validations
  checkStatus(res);

  if (res.status === 200) {
    checkItemResponse(res, ['id', 'name'], 'product-details');
  }
}

// =============================================================================
// MAIN TEST
// =============================================================================

export default function(data) {
  // 70% list requests, 30% details requests (realistic ratio)
  if (Math.random() < 0.7) {
    testListEndpoint();
  } else {
    testDetailsEndpoint(data?.itemIds);
  }

  // Realistic think time between requests
  sleep(thinkTime());
}

// =============================================================================
// EXPORTED SCENARIO FUNCTIONS
// =============================================================================

// For use in run-all.js scenarios
export function listTest() {
  testListEndpoint();
  sleep(thinkTime());
}

export function detailsTest(data) {
  testDetailsEndpoint(data?.itemIds);
  sleep(thinkTime());
}
