#!/bin/bash

# =============================================================================
# Sequential Tests Runner
# =============================================================================
#
# Runs tests one by one for isolation testing
# Use when you need to ensure tests don't interfere with each other
#
# Usage:
#   ./sequential-tests.sh              # Run with LIGHT profile
#   ./sequential-tests.sh MEDIUM       # Run with MEDIUM profile
#
# =============================================================================

set -e

PROFILE="${1:-LIGHT}"
HOST="${2:-DEV}"
RESULTS_DIR="./results/sequential_$(date +%Y%m%d_%H%M%S)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              Sequential Test Execution                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Profile: $PROFILE"
echo "Host: $HOST"
echo "Results: $RESULTS_DIR"
echo ""

mkdir -p "$RESULTS_DIR"

# List of tests to run
TESTS=(
    "tests/example/get-endpoint.js:get-endpoint"
    "tests/example/post-endpoint.js:post-endpoint"
    "tests/example/crud-operations.js:crud-operations"
)

TOTAL=${#TESTS[@]}
PASSED=0
FAILED=0

for i in "${!TESTS[@]}"; do
    IFS=':' read -r TEST_FILE TEST_NAME <<< "${TESTS[$i]}"

    echo "────────────────────────────────────────────────────────────────"
    echo "[$((i+1))/$TOTAL] Running: $TEST_NAME"
    echo "────────────────────────────────────────────────────────────────"

    OUTPUT_FILE="${RESULTS_DIR}/${TEST_NAME}.json"

    if k6 run \
        -e PROFILE="$PROFILE" \
        -e HOST="$HOST" \
        --out json="$OUTPUT_FILE" \
        "$TEST_FILE"; then
        echo "✓ $TEST_NAME: PASSED"
        ((PASSED++))
    else
        echo "✗ $TEST_NAME: FAILED"
        ((FAILED++))
    fi

    echo ""

    # Wait between tests to let system stabilize
    if [ $i -lt $((TOTAL-1)) ]; then
        echo "Waiting 10 seconds before next test..."
        sleep 10
    fi
done

echo "════════════════════════════════════════════════════════════════"
echo "                      SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo "Total:  $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo "════════════════════════════════════════════════════════════════"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
