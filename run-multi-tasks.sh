#!/bin/bash
# Script for running multiple test tasks in parallel, optimized console output

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Show help information
show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -t, --tasks TASKS      Set task ID list, comma separated (default: '1,2,3')"
  echo "  -u, --url URL          Set test URL (default: 'https://initia-widget-playground.vercel.app')"
  echo "  -p, --path PATH        Set test script path (default: 'tests/simple-keplr.test.ts')"
  echo "  -b, --build           Rebuild Docker image"
  echo "  -v, --verbose         Show detailed logs (default shows summary only)"
  echo "  -h, --help            Show help information"
  echo
  echo "Examples:"
  echo "  $0 --tasks 1,2,3,4,5"
  echo "  $0 --url https://example.com --tasks a,b,c"
  echo
}

# Set default values
TASKS="1,2,3"
TEST_URL="https://initia-widget-playground.vercel.app"
TEST_PATH="tests/simple-keplr.test.ts"
REBUILD=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--tasks)
      TASKS="$2"
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
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown parameter $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

# Check if entrypoint.sh file exists and is executable
if [ ! -f "entrypoint.sh" ]; then
  echo -e "${RED}Error: entrypoint.sh does not exist${NC}"
  echo "Please ensure entrypoint.sh file is in current directory and has execute permissions"
  exit 1
fi

if [ ! -x "entrypoint.sh" ]; then
  echo -e "${YELLOW}Warning: entrypoint.sh lacks execute permissions, adding...${NC}"
  chmod +x entrypoint.sh
fi

# Check if Keplr extension exists
if [ ! -d "extensions/keplr" ]; then
  echo -e "${YELLOW}Warning: Keplr extension directory (extensions/keplr) does not exist or is empty${NC}"
  echo -e "${YELLOW}Suggest running ./setup.sh to download Keplr extension${NC}"
  
  # Prompt user whether to continue
  read -p "Continue anyway? [y/N] " response
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

# Convert task list to array
IFS=',' read -r -a TASK_ARRAY <<< "$TASKS"

# Display test settings
echo -e "${GREEN}Ready to start ${#TASK_ARRAY[@]} test tasks with following settings:${NC}"
echo "  - Task ID list: ${TASK_ARRAY[*]}"
echo "  - Test URL: ${TEST_URL}"
echo "  - Test script: ${TEST_PATH}"
echo "  - Verbose mode: $([ "$VERBOSE" = true ] && echo "enabled" || echo "disabled")"

# Start a Docker container for each task ID
echo -e "${GREEN}Starting parallel execution of all test tasks...${NC}"

# Array for storing all child process PIDs
declare -a pids
declare -a status_files
declare -a start_times

# Create status file directory
mkdir -p .task_status

# Start each task and record PID
for task_id in "${TASK_ARRAY[@]}"; do
  echo -e "${BLUE}Starting task ${task_id}...${NC}"
  
  # Record start time
  start_times[$task_id]=$(date +%s)
  
  # Create status file
  status_file=".task_status/task_${task_id}_status"
  echo "running" > "$status_file"
  status_files[$task_id]="$status_file"
  
  # Run Docker container in background, decide output method based on verbose mode
  log_file="logs/test_${task_id}_$(date +%Y%m%d_%H%M%S).log"
  
  if [ "$VERBOSE" = true ]; then
    # Verbose mode: output to console and save to log file
    docker run --rm \
      -v "$(pwd):/app" \
      -e TASKID="${task_id}" \
      -e TEST_URL="${TEST_URL}" \
      -e SHOW_VERBOSE="true" \
      keplr-test-runner "${TEST_PATH}" | tee "$log_file" &
  else
    # Summary mode: output to log file only
    docker run --rm \
      -v "$(pwd):/app" \
      -e TASKID="${task_id}" \
      -e TEST_URL="${TEST_URL}" \
      -e SHOW_VERBOSE="false" \
      keplr-test-runner "${TEST_PATH}" > "$log_file" 2>&1 &
  fi
  
  # Record child process PID
  pids[$task_id]=$!
  
  # Small delay between task starts to avoid resource contention
  sleep 2
done

# Show running task information
echo -e "${GREEN}All ${#TASK_ARRAY[@]} tasks started, running in parallel...${NC}"

# In non-verbose mode, show progress bar
if [ "$VERBOSE" = false ]; then
  echo "Task progress:"
  
  # Periodically check and display progress of each task
  while true; do
    all_done=true
    progress_line=""
    
    for task_id in "${TASK_ARRAY[@]}"; do
      # Check if process is still running
      if ps -p ${pids[$task_id]} > /dev/null 2>&1; then
        all_done=false
        
        # Task still running, try to extract key progress information from logs
        latest_log=$(ls -t logs/test_${task_id}_* 2>/dev/null | head -1)
        
        if [ -f "$latest_log" ]; then
          # Try to extract key stage information
          if grep -q "Wallet connection flow complete" "$latest_log"; then
            if grep -q "Simplified Bridge test complete" "$latest_log"; then
              current_stage="Test complete"
              status_color="${GREEN}"
            elif grep -q "Clicking home button" "$latest_log"; then
              current_stage="Navigation test"
              status_color="${BLUE}"
            elif grep -q "Bridge/Swap interface" "$latest_log"; then
              current_stage="Bridge operation"
              status_color="${CYAN}"
            else
              current_stage="Post wallet connection"
              status_color="${BLUE}"
            fi
          elif grep -q "Wallet connection flow" "$latest_log"; then
            current_stage="Connecting wallet"
            status_color="${YELLOW}"
          else
            current_stage="Initializing"
            status_color="${YELLOW}"
          fi
          
          # Calculate elapsed time
          current_time=$(date +%s)
          elapsed=$((current_time - start_times[$task_id]))
          
          # Add to progress line
          progress_line="${progress_line}${status_color}[Task ${task_id}]${NC}: ${current_stage} (${elapsed}s)  "
        else
          progress_line="${progress_line}${YELLOW}[Task ${task_id}]${NC}: Waiting for logs...  "
        fi
      else
        # Process ended, check exit status
        wait ${pids[$task_id]} 2>/dev/null
        exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
          progress_line="${progress_line}${GREEN}[Task ${task_id}]${NC}: Completed ✓  "
          echo "success" > "${status_files[$task_id]}"
        else
          progress_line="${progress_line}${RED}[Task ${task_id}]${NC}: Failed ✗  "
          echo "failed" > "${status_files[$task_id]}"
        fi
      fi
    done
    
    # Clear previous line and show new progress line
    echo -ne "\r\033[K$progress_line"
    
    # If all tasks completed, exit loop
    if [ "$all_done" = true ]; then
      echo # Newline
      break
    fi
    
    # Pause one second
    sleep 1
  done
else
  # In verbose mode, wait for all processes to complete
  echo "Waiting for all tasks to complete..."
  
  # Wait for all processes to complete
  for task_id in "${TASK_ARRAY[@]}"; do
    wait ${pids[$task_id]}
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
      echo "success" > "${status_files[$task_id]}"
    else
      echo "failed" > "${status_files[$task_id]}"
    fi
  done
fi

# Show final results
echo -e "\n${GREEN}All test tasks completed, results summary:${NC}"

# Count successful and failed tasks
success_count=0
failure_count=0
exit_status=0

for task_id in "${TASK_ARRAY[@]}"; do
  status="unknown"
  
  if [ -f "${status_files[$task_id]}" ]; then
    status=$(cat "${status_files[$task_id]}")
  fi
  
  latest_log=$(ls -t logs/test_${task_id}_* 2>/dev/null | head -1)
  
  if [ "$status" = "success" ]; then
    echo -e "${GREEN}[Task ${task_id}]${NC}: Successfully completed ✓  (Log: ${latest_log})"
    success_count=$((success_count + 1))
  elif [ "$status" = "failed" ]; then
    echo -e "${RED}[Task ${task_id}]${NC}: Failed ✗  (Log: ${latest_log})"
    failure_count=$((failure_count + 1))
    exit_status=1
  else
    echo -e "${YELLOW}[Task ${task_id}]${NC}: Status unknown ?  (Log: ${latest_log})"
    failure_count=$((failure_count + 1))
    exit_status=1
  fi
  
  # Find latest report directory
  latest_report=$(ls -td report/report_${task_id}_* 2>/dev/null | head -1)
  if [ -n "$latest_report" ]; then
    echo -e "  - Report: $latest_report"
  fi
done

# Clean up status files
rm -rf .task_status

# Show final statistics
echo
echo -e "${GREEN}Tests completed:${NC}"
echo -e "  - Total tasks: ${#TASK_ARRAY[@]}"
echo -e "  - Successful tasks: ${GREEN}${success_count}${NC}"
echo -e "  - Failed tasks: ${failure_count}"

# If user wants to view detailed logs, provide hint
if [ "$VERBOSE" = false ] && [ $failure_count -gt 0 ]; then
  echo
  echo -e "${YELLOW}Tip:${NC} Use following commands to view detailed logs of failed tasks:"
  
  for task_id in "${TASK_ARRAY[@]}"; do
    status=$(cat "${status_files[$task_id]}" 2>/dev/null)
    if [ "$status" = "failed" ]; then
      latest_log=$(ls -t logs/test_${task_id}_* 2>/dev/null | head -1)
      if [ -n "$latest_log" ]; then
        echo "  cat $latest_log"
      fi
    fi
  done
fi

exit $exit_status