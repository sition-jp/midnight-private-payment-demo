#!/bin/bash
echo "=== Midnight MCP Demo - Environment Check ==="
echo ""

# Node.js check (20+ required)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        echo "[OK] Node.js $NODE_VERSION"
    else
        echo "[NG] Node.js $NODE_VERSION (20+ required)"
    fi
else
    echo "[NG] Node.js not found"
fi

# npx check
if command -v npx &> /dev/null; then
    echo "[OK] npx available"
else
    echo "[NG] npx not found"
fi

# Claude Code check
if command -v claude &> /dev/null; then
    echo "[OK] Claude Code available"
else
    echo "[NG] Claude Code not found"
fi

# Compact CLI check
if command -v compact &> /dev/null; then
    echo "[OK] Compact CLI available"
else
    echo "[INFO] Compact CLI not found - install from https://docs.midnight.network/getting-started/installation"
fi

echo ""
echo "=== Check Complete ==="
