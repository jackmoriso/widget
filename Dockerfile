# Use official Playwright Docker image as base
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Set working directory
WORKDIR /app

# Install Xvfb and necessary dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    libx11-6 \
    libxkbcommon0 \
    libxdamage1 \
    libgbm1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxext6 \
    libxrandr2 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories
RUN mkdir -p /app/screenshots /app/tests /app/extensions /app/report /app/logs && \
    chmod -R 777 /app/screenshots /app/report /app/logs

# Set environment variables
ENV NODE_PATH=/app/node_modules \
    PATH=/app/node_modules/.bin:$PATH \
    TASKID="default" \
    KEPLR_EXTENSION_PATH="/app/extensions/keplr" \
    TEST_URL="https://initia-widget-playground.vercel.app/" \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    DEBIAN_FRONTEND=noninteractive

# Note: No longer creating entrypoint.sh in container, using project file instead

# Set entry point
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]