#!/bin/bash
# verify_test_refactor.sh - Shared verification script for test file refactoring
# Usage: ./scripts/verify_test_refactor.sh <test-file-prefix> <package-path>
#
# Example: ./scripts/verify_test_refactor.sh websocket_handler ./internal/network
#          ./scripts/verify_test_refactor.sh physics ./internal/game

set -e

if [ $# -lt 2 ]; then
  echo "Usage: $0 <test-file-prefix> <package-path>"
  echo "Example: $0 websocket_handler ./internal/network"
  exit 1
fi

TEST_PREFIX=$1
PACKAGE_PATH=$2
BASELINE_DIR="/tmp/test_refactor_${TEST_PREFIX}"
ORIGINAL_FILE="stick-rumble-server/${PACKAGE_PATH}/${TEST_PREFIX}_test.go"

echo "========================================="
echo "Test Refactor Verification"
echo "========================================="
echo "Test Prefix: $TEST_PREFIX"
echo "Package: $PACKAGE_PATH"
echo "Original File: $ORIGINAL_FILE"
echo "Baseline Dir: $BASELINE_DIR"
echo "========================================="
echo ""

# Create baseline directory
mkdir -p "$BASELINE_DIR"

# ============================================
# PHASE 1: PRE-REFACTORING BASELINE
# ============================================
if [ ! -f "$BASELINE_DIR/baseline_complete.txt" ]; then
  echo "📋 PHASE 1: Capturing pre-refactoring baseline..."

  # 1. Run tests and save output
  echo "  → Running tests..."
  cd stick-rumble-server && go test "$PACKAGE_PATH" -v > "$BASELINE_DIR/test_output.txt" 2>&1 || true
  cd ..

  # 2. Count test functions
  echo "  → Counting test functions..."
  TOTAL_TESTS=$(grep -o "^func Test" "$ORIGINAL_FILE" 2>/dev/null | wc -l | tr -d ' ')
  echo "$TOTAL_TESTS" > "$BASELINE_DIR/test_count.txt"
  echo "    Found $TOTAL_TESTS test functions"

  # 3. Capture coverage
  echo "  → Capturing coverage..."
  cd stick-rumble-server && go test "$PACKAGE_PATH" -cover > "$BASELINE_DIR/coverage.txt" 2>&1 || true
  cd ..

  # 4. Backup original file
  echo "  → Backing up original file..."
  cp "$ORIGINAL_FILE" "$BASELINE_DIR/${TEST_PREFIX}_test.go.BACKUP"

  # Mark baseline as complete
  echo "Baseline captured at $(date)" > "$BASELINE_DIR/baseline_complete.txt"
  echo "✅ Baseline captured successfully!"
  echo ""
else
  echo "✅ Baseline already exists (captured at: $(cat $BASELINE_DIR/baseline_complete.txt))"
  echo ""
fi

# ============================================
# PHASE 2: TEST CONSERVATION CHECK
# ============================================
echo "🔍 PHASE 2: Test conservation check..."

# Count new test functions across all split files
NEW_TOTAL=$(find stick-rumble-server/${PACKAGE_PATH} -name "${TEST_PREFIX}_*_test.go" -exec grep -o "^func Test" {} \; 2>/dev/null | wc -l | tr -d ' ')
EXPECTED_TOTAL=$(cat "$BASELINE_DIR/test_count.txt")

echo "  Original test count: $EXPECTED_TOTAL"
echo "  New test count: $NEW_TOTAL"

if [ "$NEW_TOTAL" -eq "$EXPECTED_TOTAL" ]; then
  echo "✅ Test count preserved!"
elif [ "$NEW_TOTAL" -eq 0 ]; then
  echo "⚠️  No split test files found yet (refactor not started)"
else
  echo "❌ ERROR: Test count mismatch!"
  echo "   Expected: $EXPECTED_TOTAL"
  echo "   Found: $NEW_TOTAL"
  echo "   Missing: $((EXPECTED_TOTAL - NEW_TOTAL)) tests"
  exit 1
fi
echo ""

# ============================================
# PHASE 3: POST-REFACTORING VERIFICATION
# ============================================
if [ "$NEW_TOTAL" -gt 0 ]; then
  echo "🧪 PHASE 3: Post-refactoring verification..."

  # Run all tests
  echo "  → Running all tests..."
  cd stick-rumble-server
  if go test "$PACKAGE_PATH" -v; then
    echo "  ✅ All tests pass"
  else
    echo "  ❌ Tests failed!"
    cd ..
    exit 1
  fi

  # Check coverage
  echo "  → Checking coverage..."
  go test "$PACKAGE_PATH" -cover

  # Run go vet
  echo "  → Running go vet..."
  if go vet "$PACKAGE_PATH"; then
    echo "  ✅ go vet passes"
  else
    echo "  ❌ go vet failed!"
    cd ..
    exit 1
  fi

  cd ..
  echo ""
  echo "========================================="
  echo "✅ REFACTORING VERIFICATION COMPLETE!"
  echo "========================================="
else
  echo "ℹ️  Refactoring not yet started. Run this script again after splitting files."
fi

echo ""
echo "Baseline data stored in: $BASELINE_DIR"
echo "To restore original: cp $BASELINE_DIR/${TEST_PREFIX}_test.go.BACKUP $ORIGINAL_FILE"
