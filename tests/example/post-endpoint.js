/**
 * @file POST Endpoint Performance Test
 * @description Template for testing POST/create endpoints
 *
 * Test Objectives:
 * - Measure response time for POST requests under load
 * - Validate created resource structure
 * - Test with various payload sizes
 * - Ensure SLO compliance for write operations
 *
 * Usage:
 *   k6 run tests/example/post-endpoint.js
 *   k6 run -e PROFILE=MEDIUM tests/example/post-endpoint.js
 */

import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { post, extractId } from '../../utils/http-utils.js';
import { checkPostEndpoint } from '../../utils/checks.js';
import {
  createProductPayload,
  randomString,
  randomInt,
  thinkTime,
  logError
} from '../../helpers/common.js';
import { getProfile } from '../../config/env.js';
import { ENDPOINT_SLO, generateThresholds } from '../../config/slo.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const createRequests = new Counter('post_create_requests');
const createErrors = new Counter('post_create_errors');
const createDuration = new Trend('post_create_duration');
const createdItems = new Counter('post_created_items');

// =============================================================================
// OPTIONS
// =============================================================================

const profile = getProfile();
const slo = ENDPOINT_SLO.users.create; // Using users.create as example

export const options = {
  // Write operations typically use fewer VUs
  vus: Math.ceil(profile.vus * 0.3),
  duration: profile.duration,
  thresholds: {
    ...generateThresholds(slo),
    post_create_duration: [`p(95)<${slo.p95}`, `p(99)<${slo.p99}`],
    post_create_errors: ['count<20'],
    checks: ['rate>0.90'], // More tolerant for write operations
  },
};

// =============================================================================
// TEST DATA
// =============================================================================

// Different payload complexities
const payloadTypes = [
  { type: 'minimal', generator: () => ({ name: `Product ${randomString(5)}` }) },
  { type: 'standard', generator: () => createProductPayload() },
  {
    type: 'complex',
    generator: () => ({
      ...createProductPayload(),
      description: randomString(200),
      tags: ['tag1', 'tag2', 'tag3'],
      attributes: {
        color: 'red',
        size: 'large',
        weight: randomInt(1, 100)
      }
    })
  },
];

// =============================================================================
// SETUP & TEARDOWN
// =============================================================================

export function setup() {
  console.log('========================================');
  console.log('POST Endpoint Performance Test');
  console.log('========================================');
  console.log(`Profile: ${__ENV.PROFILE || 'LIGHT'}`);
  console.log(`VUs: ${options.vus} (30% of profile for writes)`);
  console.log(`Duration: ${profile.duration}`);
  console.log(`SLO: p95<${slo.p95}ms, p99<${slo.p99}ms`);
  console.log('========================================');

  return {
    createdIds: [] // Track created resources for cleanup
  };
}

export function teardown(data) {
  console.log('========================================');
  console.log('POST Endpoint Test Completed');
  console.log(`Total items created: ${data?.createdIds?.length || 0}`);
  console.log('========================================');

  // Optional: Cleanup created resources
  // data.createdIds.forEach(id => del(`/products/${id}`, 'ADMIN', 'cleanup'));
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

/**
 * Test POST create endpoint
 */
function testCreateEndpoint() {
  // Random payload type
  const payloadType = payloadTypes[randomInt(0, payloadTypes.length - 1)];
  const payload = payloadType.generator();

  const startTime = Date.now();
  const res = post('/products', payload, 'ADMIN', 'post-create');
  const duration = Date.now() - startTime;

  // Track metrics
  createRequests.add(1);
  createDuration.add(duration);

  // Check for success
  const isSuccess = res.status >= 200 && res.status < 300;

  if (!isSuccess) {
    createErrors.add(1);
    logError('post-create', `Failed with status ${res.status} for ${payloadType.type} payload`);
  } else {
    createdItems.add(1);
  }

  // Validations
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    [`${payloadType.type} payload accepted`]: (r) => r.status >= 200 && r.status < 300,
    'response time acceptable': () => duration < slo.p95,
  });

  // Validate response structure
  if (isSuccess) {
    checkPostEndpoint(res, ['id'], 'product-create');

    // Extract and store created ID
    const createdId = extractId(res);
    if (createdId) {
      check(res, {
        'created resource has valid id': () => createdId !== null && createdId !== undefined,
      });
    }
  }

  return extractId(res);
}

/**
 * Test POST with validation errors (negative test)
 */
function testInvalidPayload() {
  const invalidPayloads = [
    { payload: {}, description: 'empty payload' },
    { payload: { name: '' }, description: 'empty name' },
    { payload: { name: 'a'.repeat(1000) }, description: 'too long name' },
  ];

  const testCase = invalidPayloads[randomInt(0, invalidPayloads.length - 1)];

  const res = post('/products', testCase.payload, 'ADMIN', 'post-invalid');

  check(res, {
    [`${testCase.description}: returns 4xx`]: (r) => r.status >= 400 && r.status < 500,
    [`${testCase.description}: has error message`]: (r) => {
      try {
        const data = r.json();
        return data.message !== undefined || data.error !== undefined || data.errors !== undefined;
      } catch {
        return false;
      }
    },
  });
}

/**
 * Test batch/bulk create (if supported by API)
 */
function testBulkCreate() {
  const batchSizes = [5, 10, 25];
  const batchSize = batchSizes[randomInt(0, batchSizes.length - 1)];

  const items = [];
  for (let i = 0; i < batchSize; i++) {
    items.push(createProductPayload());
  }

  const startTime = Date.now();
  const res = post('/products/bulk', { items }, 'ADMIN', 'post-bulk');
  const duration = Date.now() - startTime;

  check(res, {
    'bulk create status is 2xx': (r) => r.status >= 200 && r.status < 300,
    [`batch of ${batchSize} items processed`]: (r) => r.status >= 200 && r.status < 300,
    'bulk response time acceptable': () => duration < slo.p99 * 2, // Allow more time for bulk
  });
}

// =============================================================================
// MAIN TEST
// =============================================================================

export default function(data) {
  // Distribution: 80% valid creates, 15% invalid (negative tests), 5% bulk
  const rand = Math.random();

  if (rand < 0.80) {
    testCreateEndpoint();
  } else if (rand < 0.95) {
    testInvalidPayload();
  } else {
    testBulkCreate();
  }

  // Longer think time for write operations
  sleep(thinkTime() * 2);
}

// =============================================================================
// EXPORTED SCENARIO FUNCTIONS
// =============================================================================

export function createTest() {
  testCreateEndpoint();
  sleep(thinkTime() * 2);
}

export function validationTest() {
  testInvalidPayload();
  sleep(1);
}

export function bulkTest() {
  testBulkCreate();
  sleep(thinkTime() * 3);
}
