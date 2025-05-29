# Build and Run Docker Container for Keplr Tests

This document provides instructions on how to build and run the Docker container for Keplr wallet integration testing.

## Prerequisites

- Docker installed on your system
- Keplr wallet extension files (typically downloaded from Chrome Web Store or another source)

## Building the Docker Image

```bash
# Navigate to your project directory
cd /path/to/keplr-wallet-tests

# Build the Docker image
docker build -t keplr-test-runner .
```

## Running Tests

### Basic Usage

```bash
# Run with default settings
docker run --rm -v $(pwd)/extensions:/app/extensions keplr-test-runner
```

### With Custom Task ID

```bash
# Run with a specific task ID for tracking
docker run --rm \
  -e TASKID="task123" \
  -v $(pwd)/extensions:/app/extensions \
  keplr-test-runner
```

### Custom Test File

```bash
# Run a specific test file
docker run --rm \
  -v $(pwd)/extensions:/app/extensions \
  keplr-test-runner tests/keplr-browser.spec.ts
```

### Full Example with All Options

```bash
# Run with all customization options
docker run --rm \
  -e TASKID="customer_test_123" \
  -e KEPLR_EXTENSION_PATH="/app/extensions/keplr" \
  -e TEST_URL="http://example.com" \
  -v $(pwd)/extensions:/app/extensions \
  -v $(pwd)/report:/app/report \
  -v $(pwd)/logs:/app/logs \
  keplr-test-runner tests/simple-keplr.test.ts
```

## Directory Structure

- `/app/extensions`: Mount point for Keplr wallet extension files
- `/app/report`: Test reports output directory
- `/app/logs`: Log files directory
- `/app/screenshots`: Screenshots taken during test runs

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| TASKID | Identifier for the test run | "default" |
| KEPLR_EXTENSION_PATH | Path to Keplr extension in container | "/app/extensions/keplr" |
| TEST_URL | URL to test against | "https://initia-widget-playground.vercel.app/" |

## Preparing Keplr Extension

Before running tests, you need to have the Keplr extension files in your local `extensions/keplr` directory:

```bash
# Create directories if they don't exist
mkdir -p extensions/keplr

# Copy Keplr extension files to this directory
# You'll need to obtain these files from a Chrome extension download or other source
```

## Viewing Test Results

After a test run completes:

1. Test reports are saved to the `/app/report` directory with unique timestamps
2. Logs are saved to the `/app/logs` directory
3. Screenshots can be found in the `/app/screenshots` directory

You can access these files by mounting volumes as shown in the examples above.