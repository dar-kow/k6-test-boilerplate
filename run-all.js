/**
 * @file Run All Tests
 * @description Orchestration script for running all test scenarios
 *
 * Usage:
 *   k6 run run-all.js
 *   k6 run -e PROFILE=MEDIUM run-all.js
 *   k6 run -e HOST=PROD -e PROFILE=HEAVY run-all.js
 *
 * Scenarios:
 *   - get_list: GET list endpoints (70% traffic)
 *   - get_details: GET single item endpoints (20% traffic)
 *   - create: POST create endpoints (10% traffic)
 */

import { sleep } from 'k6';
import { getProfile, CURRENT_HOST } from './config/env.js';
import { DEFAULT_SLO, ENDPOINT_SLO } from './config/slo.js';

// Import test functions from individual test files
import { listTest, detailsTest } from './tests/example/get-endpoint.js';
import { createTest } from './tests/example/post-endpoint.js';

// =============================================================================
// PROFILE CONFIGURATION
// =============================================================================

const profile = getProfile();
const { vus, duration } = profile;

console.log('========================================');
console.log('k6 Test Suite - All Scenarios');
console.log('========================================');
console.log(`Host: ${CURRENT_HOST}`);
console.log(`Profile: ${__ENV.PROFILE || 'LIGHT'}`);
console.log(`VUs: ${vus}`);
console.log(`Duration: ${duration}`);
console.log('========================================');

// =============================================================================
// SCENARIOS CONFIGURATION
// =============================================================================

export const options = {
  scenarios: {
    // GET List - High traffic (70%)
    get_list: {
      exec: 'getListScenario',
      executor: 'constant-vus',
      vus: Math.ceil(vus * 0.7),
      duration: duration,
      startTime: '0s',
      tags: { test_type: 'get-list', operation: 'read' },
    },

    // GET Details - Medium traffic (20%)
    get_details: {
      exec: 'getDetailsScenario',
      executor: 'constant-vus',
      vus: Math.ceil(vus * 0.2),
      duration: duration,
      startTime: '0s',
      tags: { test_type: 'get-details', operation: 'read' },
    },

    // POST Create - Low traffic (10%)
    create: {
      exec: 'createScenario',
      executor: 'constant-vus',
      vus: Math.ceil(vus * 0.1) || 1, // At least 1 VU
      duration: duration,
      startTime: '10s', // Start slightly delayed
      tags: { test_type: 'create', operation: 'write' },
    },
  },

  // =============================================================================
  // THRESHOLDS
  // =============================================================================

  thresholds: {
    // Global thresholds
    http_req_failed: ['rate<0.05'],            // 95% success rate
    http_req_duration: ['p(95)<2000'],         // General 95th percentile
    checks: ['rate>0.90'],                     // 90% check success

    // Per-scenario thresholds (tagged)
    'http_req_duration{test_type:get-list}': [
      `p(95)<${ENDPOINT_SLO.products.list.p95}`,
      `p(99)<${ENDPOINT_SLO.products.list.p99}`
    ],
    'http_req_duration{test_type:get-details}': [
      `p(95)<${ENDPOINT_SLO.products.details.p95}`,
      `p(99)<${ENDPOINT_SLO.products.details.p99}`
    ],
    'http_req_duration{test_type:create}': [
      `p(95)<${ENDPOINT_SLO.users.create.p95}`,
      `p(99)<${ENDPOINT_SLO.users.create.p99}`
    ],

    // Operation-level thresholds
    'http_req_failed{operation:read}': ['rate<0.02'],    // 98% read success
    'http_req_failed{operation:write}': ['rate<0.05'],   // 95% write success
  },
};

// =============================================================================
// SETUP & TEARDOWN
// =============================================================================

export function setup() {
  console.log('========================================');
  console.log('Setup: Preparing test data...');
  console.log('========================================');

  // Add any setup logic here (e.g., fetch existing IDs, create test data)
  return {
    startTime: new Date().toISOString(),
    itemIds: [1, 2, 3, 4, 5], // Example: pre-fetch real IDs from API
  };
}

export function teardown(data) {
  console.log('========================================');
  console.log('Teardown: Cleaning up...');
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test ended at: ${new Date().toISOString()}`);
  console.log('========================================');

  // Add any cleanup logic here
}

// =============================================================================
// SCENARIO FUNCTIONS
// =============================================================================

/**
 * GET List Scenario
 * Tests list/pagination endpoints
 */
export function getListScenario() {
  listTest();
}

/**
 * GET Details Scenario
 * Tests single item retrieval endpoints
 */
export function getDetailsScenario(data) {
  detailsTest(data);
}

/**
 * Create Scenario
 * Tests resource creation endpoints
 */
export function createScenario() {
  createTest();
}

// =============================================================================
// ALTERNATIVE: RAMPING SCENARIOS
// =============================================================================

/**
 * Example: Ramping VUs configuration
 * Uncomment to use instead of constant-vus
 */
/*
export const rampingOptions = {
  scenarios: {
    ramping_load: {
      exec: 'mixedScenario',
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: Math.ceil(vus * 0.5) },  // Warm up
        { duration: '3m', target: vus },                    // Ramp to full load
        { duration: '5m', target: vus },                    // Steady state
        { duration: '2m', target: Math.ceil(vus * 1.5) },  // Peak
        { duration: '2m', target: vus },                    // Back to normal
        { duration: '1m', target: 0 },                      // Ramp down
      ],
    },
  },
};

export function mixedScenario(data) {
  const rand = Math.random();

  if (rand < 0.70) {
    listTest();
  } else if (rand < 0.90) {
    detailsTest(data);
  } else {
    createTest();
  }
}
*/

// =============================================================================
// ALTERNATIVE: ARRIVAL RATE SCENARIOS
// =============================================================================

/**
 * Example: Constant arrival rate configuration
 * Use when you need consistent request rate regardless of response time
 */
/*
export const arrivalRateOptions = {
  scenarios: {
    constant_arrival: {
      exec: 'getListScenario',
      executor: 'constant-arrival-rate',
      rate: 100,           // 100 iterations per timeUnit
      timeUnit: '1s',      // Per second
      duration: duration,
      preAllocatedVUs: vus,
      maxVUs: vus * 2,
    },
  },
};
*/
