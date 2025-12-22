/**
 * @file CRUD Operations Performance Test
 * @description Complete CRUD (Create, Read, Update, Delete) flow testing
 *
 * Test Objectives:
 * - Test complete resource lifecycle
 * - Measure performance of all CRUD operations
 * - Validate data consistency across operations
 * - Simulate realistic user workflows
 *
 * Usage:
 *   k6 run tests/example/crud-operations.js
 *   k6 run -e PROFILE=MEDIUM tests/example/crud-operations.js
 */

import { check, sleep, fail } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { get, post, put, del, extractId, safeJson } from '../../utils/http-utils.js';
import { checkStatus, checkItemResponse, checkPostEndpoint, checkDeleteEndpoint } from '../../utils/checks.js';
import {
  createProductPayload,
  randomString,
  randomInt,
  thinkTime,
  logError
} from '../../helpers/common.js';
import { getProfile } from '../../config/env.js';
import { DEFAULT_SLO } from '../../config/slo.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Per-operation metrics
const createDuration = new Trend('crud_create_duration');
const readDuration = new Trend('crud_read_duration');
const updateDuration = new Trend('crud_update_duration');
const deleteDuration = new Trend('crud_delete_duration');

// Success rates
const crudSuccessRate = new Rate('crud_success_rate');
const fullFlowSuccess = new Counter('crud_full_flow_success');
const fullFlowFailed = new Counter('crud_full_flow_failed');

// Operation counters
const operationCounts = {
  create: new Counter('crud_create_count'),
  read: new Counter('crud_read_count'),
  update: new Counter('crud_update_count'),
  delete: new Counter('crud_delete_count'),
};

// =============================================================================
// OPTIONS
// =============================================================================

const profile = getProfile();

export const options = {
  // CRUD tests use moderate VUs
  vus: Math.ceil(profile.vus * 0.5),
  duration: profile.duration,
  thresholds: {
    // Overall success rate
    crud_success_rate: ['rate>0.90'],
    checks: ['rate>0.85'],

    // Per-operation thresholds
    crud_create_duration: [`p(95)<${DEFAULT_SLO.write.p95}`],
    crud_read_duration: [`p(95)<${DEFAULT_SLO.read.p95}`],
    crud_update_duration: [`p(95)<${DEFAULT_SLO.write.p95}`],
    crud_delete_duration: [`p(95)<${DEFAULT_SLO.write.p95}`],

    // Flow completion
    crud_full_flow_failed: ['count<50'],

    http_req_failed: ['rate<0.05'],
  },
};

// =============================================================================
// SETUP & TEARDOWN
// =============================================================================

export function setup() {
  console.log('========================================');
  console.log('CRUD Operations Performance Test');
  console.log('========================================');
  console.log(`Profile: ${__ENV.PROFILE || 'LIGHT'}`);
  console.log(`VUs: ${options.vus}`);
  console.log(`Duration: ${profile.duration}`);
  console.log('========================================');
  console.log('Testing complete CRUD lifecycle:');
  console.log('  1. CREATE - POST /products');
  console.log('  2. READ   - GET /products/{id}');
  console.log('  3. UPDATE - PUT /products/{id}');
  console.log('  4. DELETE - DELETE /products/{id}');
  console.log('========================================');

  return {};
}

export function teardown(data) {
  console.log('========================================');
  console.log('CRUD Operations Test Completed');
  console.log('========================================');
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * CREATE operation
 * @returns {Object} { success: boolean, id: string|null, data: Object|null }
 */
function createResource() {
  const payload = createProductPayload();

  const startTime = Date.now();
  const res = post('/products', payload, 'ADMIN', 'crud-create');
  const duration = Date.now() - startTime;

  createDuration.add(duration);
  operationCounts.create.add(1);

  const success = res.status >= 200 && res.status < 300;
  const id = extractId(res);
  const data = safeJson(res);

  check(res, {
    'CREATE: status 2xx': (r) => r.status >= 200 && r.status < 300,
    'CREATE: has id': () => id !== null,
    'CREATE: response time OK': () => duration < DEFAULT_SLO.write.p95,
  });

  if (!success) {
    logError('crud-create', `Failed with status ${res.status}`);
  }

  crudSuccessRate.add(success);
  return { success, id, data };
}

/**
 * READ operation
 * @param {string} id - Resource ID
 * @returns {Object} { success: boolean, data: Object|null }
 */
function readResource(id) {
  if (!id) {
    logError('crud-read', 'No ID provided');
    return { success: false, data: null };
  }

  const startTime = Date.now();
  const res = get(`/products/${id}`, 'USER', 'crud-read');
  const duration = Date.now() - startTime;

  readDuration.add(duration);
  operationCounts.read.add(1);

  const success = res.status === 200;
  const data = safeJson(res);

  check(res, {
    'READ: status 200': (r) => r.status === 200,
    'READ: has correct id': () => data?.id == id,
    'READ: response time OK': () => duration < DEFAULT_SLO.read.p95,
  });

  if (!success) {
    logError('crud-read', `Failed with status ${res.status} for ID ${id}`);
  }

  crudSuccessRate.add(success);
  return { success, data };
}

/**
 * UPDATE operation
 * @param {string} id - Resource ID
 * @param {Object} originalData - Original resource data
 * @returns {Object} { success: boolean, data: Object|null }
 */
function updateResource(id, originalData) {
  if (!id) {
    logError('crud-update', 'No ID provided');
    return { success: false, data: null };
  }

  // Modify some fields
  const updatePayload = {
    ...originalData,
    name: `Updated ${randomString(5)}`,
    price: randomInt(10, 500),
    updatedAt: new Date().toISOString()
  };

  const startTime = Date.now();
  const res = put(`/products/${id}`, updatePayload, 'ADMIN', 'crud-update');
  const duration = Date.now() - startTime;

  updateDuration.add(duration);
  operationCounts.update.add(1);

  const success = res.status >= 200 && res.status < 300;
  const data = safeJson(res);

  check(res, {
    'UPDATE: status 2xx': (r) => r.status >= 200 && r.status < 300,
    'UPDATE: response time OK': () => duration < DEFAULT_SLO.write.p95,
  });

  // Verify update was applied
  if (success && data) {
    check(data, {
      'UPDATE: name changed': (d) => d.name === updatePayload.name || d.name !== originalData?.name,
    });
  }

  if (!success) {
    logError('crud-update', `Failed with status ${res.status} for ID ${id}`);
  }

  crudSuccessRate.add(success);
  return { success, data };
}

/**
 * DELETE operation
 * @param {string} id - Resource ID
 * @returns {Object} { success: boolean }
 */
function deleteResource(id) {
  if (!id) {
    logError('crud-delete', 'No ID provided');
    return { success: false };
  }

  const startTime = Date.now();
  const res = del(`/products/${id}`, 'ADMIN', 'crud-delete');
  const duration = Date.now() - startTime;

  deleteDuration.add(duration);
  operationCounts.delete.add(1);

  const success = res.status >= 200 && res.status < 300;

  check(res, {
    'DELETE: status 2xx': (r) => r.status >= 200 && r.status < 300,
    'DELETE: response time OK': () => duration < DEFAULT_SLO.write.p95,
  });

  if (!success) {
    logError('crud-delete', `Failed with status ${res.status} for ID ${id}`);
  }

  crudSuccessRate.add(success);
  return { success };
}

/**
 * Verify resource was deleted
 * @param {string} id - Resource ID
 * @returns {boolean} True if resource is gone (404)
 */
function verifyDeleted(id) {
  const res = get(`/products/${id}`, 'USER', 'crud-verify-deleted');

  const isDeleted = res.status === 404;

  check(res, {
    'VERIFY: resource is deleted (404)': (r) => r.status === 404,
  });

  return isDeleted;
}

// =============================================================================
// MAIN TEST - FULL CRUD FLOW
// =============================================================================

export default function() {
  let flowSuccess = true;
  let createdId = null;
  let resourceData = null;

  // Step 1: CREATE
  console.log('Step 1: CREATE');
  const createResult = createResource();
  if (!createResult.success) {
    flowSuccess = false;
    fullFlowFailed.add(1);
    sleep(1);
    return; // Can't continue without created resource
  }
  createdId = createResult.id;
  resourceData = createResult.data;
  sleep(0.5);

  // Step 2: READ
  console.log('Step 2: READ');
  const readResult = readResource(createdId);
  if (!readResult.success) {
    flowSuccess = false;
  }
  resourceData = readResult.data || resourceData;
  sleep(0.5);

  // Step 3: UPDATE
  console.log('Step 3: UPDATE');
  const updateResult = updateResource(createdId, resourceData);
  if (!updateResult.success) {
    flowSuccess = false;
  }
  sleep(0.5);

  // Step 4: READ after UPDATE (verify changes)
  console.log('Step 4: READ (verify update)');
  const verifyUpdateResult = readResource(createdId);
  if (!verifyUpdateResult.success) {
    flowSuccess = false;
  }
  sleep(0.5);

  // Step 5: DELETE
  console.log('Step 5: DELETE');
  const deleteResult = deleteResource(createdId);
  if (!deleteResult.success) {
    flowSuccess = false;
  }
  sleep(0.5);

  // Step 6: VERIFY DELETED
  console.log('Step 6: VERIFY DELETED');
  const isDeleted = verifyDeleted(createdId);
  if (!isDeleted) {
    flowSuccess = false;
    logError('crud-flow', `Resource ${createdId} still exists after delete`);
  }

  // Track flow completion
  if (flowSuccess) {
    fullFlowSuccess.add(1);
  } else {
    fullFlowFailed.add(1);
  }

  check(null, {
    'CRUD flow completed successfully': () => flowSuccess,
  });

  // Think time before next iteration
  sleep(thinkTime());
}

// =============================================================================
// EXPORTED SCENARIO FUNCTIONS
// =============================================================================

// Individual operation tests for scenario-based execution
export function createOnly() {
  createResource();
  sleep(thinkTime());
}

export function readOnly(data) {
  // Use pre-existing IDs from setup
  const id = data?.existingIds?.[randomInt(0, (data?.existingIds?.length || 1) - 1)] || 1;
  readResource(id);
  sleep(thinkTime());
}

export function updateOnly(data) {
  const id = data?.existingIds?.[randomInt(0, (data?.existingIds?.length || 1) - 1)] || 1;
  const readResult = readResource(id);
  if (readResult.success) {
    updateResource(id, readResult.data);
  }
  sleep(thinkTime());
}

export function crudFlow() {
  // Alias for default function
  return arguments.callee.caller.apply(this, arguments);
}
