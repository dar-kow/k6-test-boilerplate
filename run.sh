#!/bin/bash

# =============================================================================
# k6 Test Runner Script
# =============================================================================
#
# Usage:
#   ./run.sh                     # Run all tests with LIGHT profile
#   ./run.sh -p MEDIUM           # Run with MEDIUM profile
#   ./run.sh -t get-endpoint     # Run specific test
#   ./run.sh -h PROD -p HEAVY    # Run on PROD with HEAVY profile
#   ./run.sh --help              # Show help
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROFILE="LIGHT"
HOST="DEV"
TEST="all"
OUTPUT_DIR="./results"
VERBOSE=false

# =============================================================================
# FUNCTIONS
# =============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                    k6 Performance Tests                        ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --profile PROFILE   Load profile: SMOKE, LIGHT, MEDIUM, HEAVY (default: LIGHT)"
    echo "  -h, --host HOST         Target host: DEV, STAGING, PROD (default: DEV)"
    echo "  -t, --test TEST         Test to run: all, get-endpoint, post-endpoint, crud (default: all)"
    echo "  -o, --output DIR        Output directory for results (default: ./results)"
    echo "  -v, --verbose           Verbose output"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                              # Run all tests with LIGHT profile on DEV"
    echo "  $0 -p MEDIUM                    # Run all tests with MEDIUM profile"
    echo "  $0 -t get-endpoint -p LIGHT     # Run GET endpoint test with LIGHT profile"
    echo "  $0 -h PROD -p HEAVY             # Run all tests on PROD with HEAVY profile"
    echo ""
    echo "Load Profiles:"
    echo "  SMOKE   - 1 VU, 30s   (quick sanity check)"
    echo "  LIGHT   - 10 VUs, 60s (daily CI/CD)"
    echo "  MEDIUM  - 30 VUs, 5m  (weekly regression)"
    echo "  HEAVY   - 100 VUs, 10m (stress testing)"
}

check_k6() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Error: k6 is not installed.${NC}"
        echo "Install k6: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
}

create_output_dir() {
    if [ ! -d "$OUTPUT_DIR" ]; then
        mkdir -p "$OUTPUT_DIR"
        echo -e "${GREEN}Created output directory: $OUTPUT_DIR${NC}"
    fi
}

get_timestamp() {
    date +"%Y%m%d_%H%M%S"
}

run_test() {
    local test_file=$1
    local test_name=$2
    local timestamp=$(get_timestamp)
    local output_file="${OUTPUT_DIR}/${test_name}_${PROFILE}_${timestamp}.json"

    echo -e "${YELLOW}Running: ${test_name}${NC}"
    echo -e "  Profile: ${PROFILE}"
    echo -e "  Host: ${HOST}"
    echo -e "  Output: ${output_file}"
    echo ""

    if [ "$VERBOSE" = true ]; then
        k6 run \
            -e PROFILE="$PROFILE" \
            -e HOST="$HOST" \
            --out json="$output_file" \
            "$test_file"
    else
        k6 run \
            -e PROFILE="$PROFILE" \
            -e HOST="$HOST" \
            --out json="$output_file" \
            --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
            "$test_file"
    fi

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ ${test_name} completed successfully${NC}"
    else
        echo -e "${RED}✗ ${test_name} failed with exit code ${exit_code}${NC}"
    fi

    echo ""
    return $exit_code
}

# =============================================================================
# PARSE ARGUMENTS
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -t|--test)
            TEST="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            print_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            print_help
            exit 1
            ;;
    esac
done

# =============================================================================
# MAIN
# =============================================================================

print_header
check_k6
create_output_dir

echo -e "${BLUE}Configuration:${NC}"
echo "  Profile: $PROFILE"
echo "  Host: $HOST"
echo "  Test: $TEST"
echo "  Output: $OUTPUT_DIR"
echo ""

START_TIME=$(date +%s)

case $TEST in
    all)
        echo -e "${BLUE}Running all tests...${NC}"
        echo ""
        run_test "run-all.js" "all-scenarios"
        ;;
    get-endpoint|get)
        run_test "tests/example/get-endpoint.js" "get-endpoint"
        ;;
    post-endpoint|post)
        run_test "tests/example/post-endpoint.js" "post-endpoint"
        ;;
    crud|crud-operations)
        run_test "tests/example/crud-operations.js" "crud-operations"
        ;;
    *)
        # Try to run as custom test file
        if [ -f "$TEST" ]; then
            run_test "$TEST" "$(basename $TEST .js)"
        elif [ -f "tests/$TEST.js" ]; then
            run_test "tests/$TEST.js" "$TEST"
        elif [ -f "tests/example/$TEST.js" ]; then
            run_test "tests/example/$TEST.js" "$TEST"
        else
            echo -e "${RED}Unknown test: $TEST${NC}"
            echo "Available tests: all, get-endpoint, post-endpoint, crud"
            exit 1
        fi
        ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Test execution completed in ${DURATION} seconds${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
