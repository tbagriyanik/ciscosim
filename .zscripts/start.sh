#!/bin/sh

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

# Validate required tools
check_required_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ Error: Required tool '$1' is not installed or not in PATH"
        exit 1
    fi
}

check_required_tool "bun"
check_required_tool "caddy"

# Store all subprocess PIDs
pids=""

# Cleanup function: gracefully shutdown all services
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    
    # Send SIGTERM to all child processes
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   Stopping process $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    
    # Wait for all processes to exit (max 5 seconds)
    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            # If still running, wait max 4 more seconds
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            # If still running, force kill
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Force killing process $pid..."
                kill -KILL "$pid" 2>/dev/null || true
            fi
        fi
    done
    
    echo "✅ All services shut down"
    exit 0
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

echo "🚀 Starting all services..."
echo ""

# Change to build directory
cd "$BUILD_DIR" || exit 1

# List contents for debugging
ls -lah

# Initialize database if needed
if [ -d "./next-service-dist/db" ] && [ "$(ls -A ./next-service-dist/db 2>/dev/null)" ]; then
    if [ -d "/db" ]; then
        echo "🗄️  Initializing database from ./next-service-dist/db to /db..."
        if cp -r ./next-service-dist/db/* /db/ 2>/dev/null; then
            echo "✅ Database initialization completed"
        else
            echo "⚠️  Warning: Could not copy database files, skipping"
        fi
    else
        echo "ℹ️  /db directory not found, skipping database initialization"
    fi
fi

# Start Next.js server
if [ -f "./next-service-dist/server.js" ]; then
    echo "🚀 Starting Next.js server..."
    cd next-service-dist/ || exit 1
    
    # Set environment variables
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    
    # Start Next.js in background
    if bun server.js &
    then
        NEXT_PID=$!
        pids="$NEXT_PID"
        
        # Wait a moment to check if process started successfully
        sleep 1
        if ! kill -0 "$NEXT_PID" 2>/dev/null; then
            echo "❌ Next.js server failed to start"
            exit 1
        else
            echo "✅ Next.js server started (PID: $NEXT_PID, Port: $PORT)"
        fi
    else
        echo "❌ Failed to start Next.js server"
        exit 1
    fi
    
    cd ../
else
    echo "⚠️  Next.js server file not found: ./next-service-dist/server.js"
fi

# Start mini-services
if [ -f "./mini-services-start.sh" ]; then
    echo "🚀 Starting mini-services..."
    
    # Run startup script from root directory
    if sh ./mini-services-start.sh &
    then
        MINI_PID=$!
        pids="$pids $MINI_PID"
        
        # Wait a moment to check if process started
        sleep 1
        if ! kill -0 "$MINI_PID" 2>/dev/null; then
            echo "⚠️  Warning: mini-services may have failed to start, continuing..."
        else
            echo "✅ mini-services started (PID: $MINI_PID)"
        fi
    else
        echo "⚠️  Warning: Failed to start mini-services script"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "⚠️  mini-services directory exists but startup script not found"
else
    echo "ℹ️  mini-services directory not found, skipping"
fi

# Start Caddy
echo "🚀 Starting Caddy..."

# Validate Caddyfile exists
if [ ! -f "Caddyfile" ]; then
    echo "⚠️  Warning: Caddyfile not found, Caddy may fail to start"
fi

echo "✅ Caddy starting (running in foreground)"
echo ""
echo "🎉 All services started!"
echo ""
echo "💡 Press Ctrl+C to stop all services"
echo ""

# Run Caddy as main process (foreground)
exec caddy run --config Caddyfile --adapter caddyfile
