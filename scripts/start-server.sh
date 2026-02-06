#!/bin/sh
set -e

CONTENT_DIR="/lzcapp/pkg/content"
SERVER_SRC_DIR="$CONTENT_DIR/server"
SERVER_WORK_DIR="/lzcapp/var/server"
SERVER_ENTRY="$SERVER_WORK_DIR/dist/server/index.js"
PORT="${PORT:-5177}"

export npm_config_registry="https://registry.npmmirror.com"

mkdir -p "$SERVER_WORK_DIR"
if [ -d "$SERVER_SRC_DIR" ]; then
  cp -a "$SERVER_SRC_DIR"/. "$SERVER_WORK_DIR"/
else
  echo "ERROR: $SERVER_SRC_DIR not found. Server package missing."
  exit 1
fi

cd "$SERVER_WORK_DIR"

if [ "$(id -u 2>/dev/null || echo 1)" != "0" ]; then
  echo "Warning: insufficient permissions. Package installation may fail."
fi

if ! command -v node >/dev/null 2>&1; then
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache nodejs npm || echo "apk install failed"
  else
    echo "Node.js not found and apk is unavailable. Server may fail to start."
  fi
fi

if ! command -v python3 >/dev/null 2>&1; then
  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache python3 py3-pip py3-setuptools py3-wheel || echo "apk python install failed"
  else
    echo "Python3 not found and apk is unavailable. Python tasks may fail."
  fi
fi

if command -v apk >/dev/null 2>&1; then
  apk add --no-cache \
    curl \
    wget \
    bash \
    git \
    unzip \
    tar \
    gzip \
    xz \
    procps \
    ca-certificates \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont || echo "apk base tools install failed"
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update || true
  apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    unzip \
    tar \
    gzip \
    xz-utils \
    procps \
    iproute2 \
    dnsutils \
    ca-certificates \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libdrm2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libasound2 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    libexpat1 \
    libglib2.0-0 \
    libnspr4 \
    libdbus-1-3 \
    libxshmfence1 \
    libuuid1 || echo "apt chromium install failed"
  rm -rf /var/lib/apt/lists/* || true
fi

export PLAYWRIGHT_BROWSERS_PATH="$SERVER_WORK_DIR/extensions/browser/browsers"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

if [ ! -d node_modules ]; then
  npm install --production || npm install || true
fi

if command -v npx >/dev/null 2>&1; then
  if [ ! -d "$PLAYWRIGHT_BROWSERS_PATH" ] || [ -z "$(ls -A "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null)" ]; then
    if command -v apt-get >/dev/null 2>&1; then
      npx playwright install --with-deps chromium || npx playwright install chromium || true
    else
      npx playwright install chromium || true
    fi
  fi
fi

if command -v chromium >/dev/null 2>&1; then
  if ! pgrep -f "chromium.*--remote-debugging-port=9222" >/dev/null 2>&1; then
    chromium --headless --no-sandbox --disable-dev-shm-usage \
      --remote-debugging-port=9222 \
      --user-data-dir="$SERVER_WORK_DIR/extensions/browser/system-profile" \
      about:blank >/dev/null 2>&1 &
  fi
fi

export PORT
exec node "$SERVER_ENTRY"
