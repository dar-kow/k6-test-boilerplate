/**
 * @file Service Level Objectives (SLO) Configuration
 * @description Define performance targets for your API endpoints
 *
 * SLO Guidelines:
 * - p95: 95th percentile response time
 * - p99: 99th percentile response time
 * - errorRate: Maximum acceptable error rate (0.01 = 1%)
 *
 * Categorization:
 * - READ operations: Faster requirements (users waiting for UI)
 * - WRITE operations: Can be slower (admin/background tasks)
 * - CRITICAL: Endpoints on critical path (checkout, auth)
 */

// =============================================================================
// DEFAULT SLO VALUES
// =============================================================================

export const DEFAULT_SLO = {
  read: {
    p95: 500,       // 95% of requests < 500ms
    p99: 1000,      // 99% of requests < 1s
    errorRate: 0.01 // 1% error rate max
  },
  write: {
    p95: 1000,      // 95% of requests < 1s
    p99: 2500,      // 99% of requests < 2.5s
    errorRate: 0.02 // 2% error rate max
  },
  critical: {
    p95: 200,       // 95% of requests < 200ms
    p99: 500,       // 99% of requests < 500ms
    errorRate: 0.005 // 0.5% error rate max
  }
};

// =============================================================================
// ENDPOINT-SPECIFIC SLO
// =============================================================================

/**
 * Define SLO per endpoint or domain
 * Customize based on your API requirements
 */
export const ENDPOINT_SLO = {
  // Authentication - critical path
  auth: {
    login: {
      p95: 300,
      p99: 800,
      errorRate: 0.005
    },
    logout: {
      p95: 200,
      p99: 500,
      errorRate: 0.01
    }
  },

  // Users - standard CRUD
  users: {
    list: {
      p95: 500,
      p99: 1000,
      errorRate: 0.01
    },
    details: {
      p95: 200,
      p99: 500,
      errorRate: 0.01
    },
    create: {
      p95: 1000,
      p99: 2000,
      errorRate: 0.02
    },
    update: {
      p95: 800,
      p99: 1500,
      errorRate: 0.02
    },
    delete: {
      p95: 500,
      p99: 1000,
      errorRate: 0.02
    }
  },

  // Products - read-heavy
  products: {
    list: {
      p95: 300,
      p99: 800,
      errorRate: 0.01
    },
    search: {
      p95: 500,
      p99: 1200,
      errorRate: 0.01
    },
    details: {
      p95: 150,
      p99: 400,
      errorRate: 0.01
    }
  }
};

// =============================================================================
// THRESHOLD GENERATORS
// =============================================================================

/**
 * Generate k6 thresholds from SLO config
 * @param {Object} slo - SLO configuration object
 * @returns {Object} k6 thresholds object
 *
 * Example:
 * const thresholds = generateThresholds(ENDPOINT_SLO.products.list);
 * // Returns: { http_req_duration: ['p(95)<300', 'p(99)<800'], http_req_failed: ['rate<0.01'] }
 */
export function generateThresholds(slo) {
  return {
    http_req_duration: [
      `p(95)<${slo.p95}`,
      `p(99)<${slo.p99}`
    ],
    http_req_failed: [`rate<${slo.errorRate}`],
    checks: ['rate>0.95']
  };
}

/**
 * Generate thresholds with custom metric prefix (for scenarios)
 * @param {Object} slo - SLO configuration object
 * @param {string} prefix - Metric prefix (e.g., 'get_users')
 * @returns {Object} k6 thresholds object with custom metrics
 */
export function generateCustomThresholds(slo, prefix) {
  return {
    ...generateThresholds(slo),
    [`${prefix}_duration`]: [
      `p(95)<${slo.p95}`,
      `p(99)<${slo.p99}`
    ]
  };
}

/**
 * Generate scenario-tagged thresholds
 * @param {Object} slo - SLO configuration object
 * @param {string} testType - Test type tag value
 * @returns {Object} k6 thresholds with tag filters
 */
export function generateScenarioThresholds(slo, testType) {
  return {
    [`http_req_duration{test_type:${testType}}`]: [
      `p(95)<${slo.p95}`,
      `p(99)<${slo.p99}`
    ],
    [`http_req_failed{test_type:${testType}}`]: [`rate<${slo.errorRate}`]
  };
}
