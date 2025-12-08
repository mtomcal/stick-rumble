#!/bin/bash
# Check Go test coverage against thresholds
# Usage: ./scripts/check-coverage.sh [threshold]
# Default threshold: 90%

set -e

THRESHOLD=${1:-90}
COVERAGE_FILE=$(mktemp)

echo "Running tests with coverage..."
go test ./... -coverprofile="$COVERAGE_FILE" -covermode=atomic

echo ""
echo "Coverage by package:"
go tool cover -func="$COVERAGE_FILE" | tail -20

# Extract total coverage percentage
TOTAL_COVERAGE=$(go tool cover -func="$COVERAGE_FILE" | grep "^total:" | awk '{print $3}' | tr -d '%')

echo ""
echo "=========================================="
echo "Total Coverage: ${TOTAL_COVERAGE}%"
echo "Required Threshold: ${THRESHOLD}%"
echo "=========================================="

# Compare using bc for floating point comparison
if (( $(echo "$TOTAL_COVERAGE < $THRESHOLD" | bc -l) )); then
    echo ""
    echo "FAIL: Coverage ${TOTAL_COVERAGE}% is below threshold ${THRESHOLD}%"
    rm -f "$COVERAGE_FILE"
    exit 1
else
    echo ""
    echo "PASS: Coverage ${TOTAL_COVERAGE}% meets threshold ${THRESHOLD}%"
    rm -f "$COVERAGE_FILE"
    exit 0
fi
