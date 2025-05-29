#!/bin/bash
# Simplified script for running tests with Docker

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Show help information
show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -t, --taskid ID      Set test task ID (default: 'test_run')"
  echo "  -u, --url URL        Set test URL (default: 'https://initia-widget-playground.vercel.app/')"
  echo "  -p, --path PATH      Set test script path (default: 'tests/simple-keplr.test.ts')"
  echo "  -b, --build          Rebuild Docker image"
  echo "  -h, --help           Show help information"
  echo
  echo "Examples:"
  echo "  $0 --taskid 1 --url https://initia-widget-playground.vercel.app"
  echo "  $0 --path tests/my-custom-test.spec.ts"
  echo
}

# Set default values
TASKID="2"
TEST_URL="https://initia-widget-playground.vercel.app"
TEST_PATH="tests/simple-keplr.test.ts"
REBUILD=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--taskid)
      TASKID="$2"
      shift 2
      ;;
    -u|--url)
      TEST_URL="$2"
      shift 2
      ;;
    -p|--path)
      TEST_PATH="$2"
      shift 2
      ;;
    -b|--build)
      REBUILD=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown argument $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

# Check if entrypoint.sh file exists and is executable
if [ ! -f "entrypoint.sh" ]; then
  echo -e "${RED}Error: entrypoint.sh does not exist${NC}"
  echo "Please ensure the entrypoint.sh file is in the current directory with execute permissions"
  exit 1
fi

if [ ! -x "entrypoint.sh" ]; then
  echo -e "${YELLOW}Warning: entrypoint.sh does not have execute permissions, adding...${NC}"
  chmod +x entrypoint.sh
fi

# Check if Keplr extension exists
if [ ! -d "extensions/keplr" ]; then
  echo -e "${YELLOW}Warning: Keplr extension directory (extensions/keplr) does not exist or is empty${NC}"
  echo -e "${YELLOW}Recommend running ./setup.sh to download Keplr extension${NC}"
  
  # Prompt user whether to continue
  read -p "Do you want to continue anyway? [y/N] " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Test cancelled"
    exit 1
  fi
fi

# Create necessary directories
mkdir -p extensions report logs screenshots

# If needed, build Docker image
if [ "$REBUILD" = true ]; then
  echo -e "${GREEN}Rebuilding Docker image...${NC}"
  docker build -t keplr-test-runner .
fi

# If image doesn't exist, build it
if ! docker image inspect keplr-test-runner &>/dev/null; then
  echo -e "${GREEN}Docker image does not exist, building...${NC}"
  docker build -t keplr-test-runner .
fi

# Show test settings
echo -e "${GREEN}Starting test with the following settings:${NC}"
echo "  - Task ID: ${TASKID}"
echo "  - Test URL: ${TEST_URL}"
echo "  - Test Script: ${TEST_PATH}"

# Run Docker container
echo -e "${GREEN}Running test container...${NC}"
docker run --rm \
  -v "$(pwd):/app" \
  -e TASKID="${TASKID}" \
  -e TEST_URL="${TEST_URL}" \
  keplr-test-runner "${TEST_PATH}"

# Get exit code
EXIT_CODE=$?

# Show results
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}[TaskID: ${TASKID}] Test completed successfully!${NC}"
else
  echo -e "${RED}[TaskID: ${TASKID}] Test failed with exit code: $EXIT_CODE${NC}"
fi

# Find latest report directory
LATEST_REPORT=$(ls -td report/report_${TASKID}_* 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
  echo -e "${GREEN}[TaskID: ${TASKID}] Test report saved at: $LATEST_REPORT${NC}"
  
  # If on Mac, provide option to open report
  if [[ "$OSTYPE" == "darwin"* ]]; then
    read -p "Would you like to open the test report? [y/N] " open_report
    if [[ "$open_report" =~ ^[Yy]$ ]]; then
      open "$LATEST_REPORT/index.html"
    fi
  fi
fi

exit $EXIT_CODE