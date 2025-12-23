#!/bin/bash

# =============================================================================
# Parallel Tests Runner
# =============================================================================
#
# Runs all tests simultaneously for stress testing
# Use for maximum load generation
#
# Usage:
#   ./parallel-tests.sh              # Run with LIGHT profile
#   ./parallel-tests.sh MEDIUM       # Run with MEDIUM profile
#
# =============================================================================

set -e

PROFILE="${1:-LIGHT}"
HOST="${2:-DEV}"
RESULTS_DIR="./results/parallel_$(date +%Y%m%d_%H%M%S)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                Parallel Test Execution                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Profile: $PROFILE"
echo "Host: $HOST"
echo "Results: $RESULTS_DIR"
echo ""

mkdir -p "$RESULTS_DIR"

# Array to store background process PIDs
declare -a PIDS

# Function to run a test in background
run_test_bg() {
    local test_file=$1
    local test_name=$2
    local output_file="${RESULTS_DIR}/${test_name}.json"

    echo "Starting: $test_name"

    k6 run \
        -e PROFILE="$PROFILE" \
        -e HOST="$HOST" \
        --out json="$output_file" \
        "$test_file" \
        > "${RESULTS_DIR}/${test_name}.log" 2>&1 &

    PIDS+=($!)
}

echo "Starting parallel test execution..."
echo ""

# Launch all tests in parallel
run_test_bg "tests/example/get-endpoint.js" "get-endpoint"
run_test_bg "tests/example/post-endpoint.js" "post-endpoint"
run_test_bg "tests/example/crud-operations.js" "crud-operations"

echo ""
echo "Waiting for all tests to complete..."
echo "PIDs: ${PIDS[*]}"
echo ""

# Wait for all tests and collect exit codes
FAILED=0
PASSED=0

for i in "${!PIDS[@]}"; do
    if wait ${PIDS[$i]}; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
done

TOTAL=${#PIDS[@]}

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "                      SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo "Total:  $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Logs:"
for log in "$RESULTS_DIR"/*.log; do
    echo "  - $log"
done
echo "════════════════════════════════════════════════════════════════"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
