#!/bin/bash
# Container entry script - Optimized version, controls log output
# This script executes when container starts

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get TASKID, default to 'default'
TASKID=${TASKID:-default}

# Key step log output function - These logs will be recorded to file and output to console
log_key_step() {
  echo "[TaskID: ${TASKID}] $1"
}

# Verbose log output function - These logs will only be recorded to file if verbose mode is enabled
log_verbose() {
  if [[ "${SHOW_VERBOSE}" == "true" ]]; then
    echo "[TaskID: ${TASKID}] $1"
  fi
}

# Display basic information
log_key_step "Starting test, TEST_URL=${TEST_URL}"

# Check if extension directory exists
if [ ! -d "$KEPLR_EXTENSION_PATH" ]; then
  log_key_step "${YELLOW}Warning: Keplr extension not found at $KEPLR_EXTENSION_PATH. Please ensure it's correctly mounted.${NC}"
fi

# Check if dependencies need to be installed
if [ ! -d "/app/node_modules" ] || [ ! -f "/app/node_modules/.bin/playwright" ]; then
  log_key_step "Installing project dependencies..."
  cd /app && npm install
fi

# Create timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
log_verbose "Timestamp: ${TIMESTAMP}"

# Ensure directories exist
mkdir -p /app/screenshots /app/report/report_${TASKID}_${TIMESTAMP} /app/logs

# Run test, using test script path parameter (if provided)
TEST_PATH=${1:-"tests/simple-keplr.test.ts"}
log_key_step "Running test script: ${TEST_PATH}"

# Set TaskID environment variable, directly pass to test script
export TASKID

# Create temporary directory for storing test status
mkdir -p /app/.task_status
STATUS_FILE="/app/.task_status/task_${TASKID}_status"
echo "running" > "$STATUS_FILE"

# Use Xvfb to execute test
LOG_FILE="/app/logs/test_${TASKID}_${TIMESTAMP}.log"

# Create a pipe for filtering output
cd /app

# Execute test command and pipe all output
exec 3>&1 # Save original stdout
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" \
  npx playwright test $TEST_PATH \
  --reporter=list,html 2>&1 | tee "$LOG_FILE" | grep -E "(Running|worker|✓|✘|failed)" >&3

# Return status code
EXIT_CODE=${PIPESTATUS[0]}

# Update status file based on status code
if [ $EXIT_CODE -eq 0 ]; then
  echo "success" > "$STATUS_FILE"
  log_key_step "${GREEN}Test completed successfully, status code: $EXIT_CODE${NC}"
else
  echo "failed" > "$STATUS_FILE"
  log_key_step "${RED}Test failed, status code: $EXIT_CODE${NC}"
fi

# Copy report to unique location
if [ -d "/app/playwright-report" ]; then
  cp -r /app/playwright-report/* /app/report/report_${TASKID}_${TIMESTAMP}/
  log_key_step "Test report has been saved to /app/report/report_${TASKID}_${TIMESTAMP}"
fi

exit $EXIT_CODE