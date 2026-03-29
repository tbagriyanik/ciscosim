#!/bin/sh

# Configuration
DIST_DIR="./mini-services-dist"

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
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

main() {
    echo "🚀 Starting all mini services..."
    
    # Check if dist directory exists
    if [ ! -d "$DIST_DIR" ]; then
        echo "ℹ️  Directory $DIST_DIR does not exist"
        return 0
    fi
    
    # Find all mini-service-*.js files
    service_files=""
    for file in "$DIST_DIR"/mini-service-*.js; do
        if [ -f "$file" ]; then
            if [ -z "$service_files" ]; then
                service_files="$file"
            else
                service_files="$service_files $file"
            fi
        fi
    done
    
    # Count service files
    service_count=0
    for file in $service_files; do
        service_count=$((service_count + 1))
    done
    
    if [ $service_count -eq 0 ]; then
        echo "ℹ️  No mini service files found"
        return 0
    fi
    
    echo "📦 Found $service_count service(s), starting..."
    echo ""
    
    # Start each service
    for file in $service_files; do
        service_name=$(basename "$file" .js | sed 's/mini-service-//')
        echo "▶️  Starting service: $service_name..."
        
        # Run service with bun (background)
        if bun "$file" &
        then
            pid=$!
            if [ -z "$pids" ]; then
                pids="$pid"
            else
                pids="$pids $pid"
            fi
            
            # Wait a moment to check if process started successfully
            sleep 0.5
            if ! kill -0 "$pid" 2>/dev/null; then
                echo "❌ $service_name failed to start"
                # Remove failed PID from list
                pids=$(echo "$pids" | sed "s/\b$pid\b//" | sed 's/  */ /g' | sed 's/^ *//' | sed 's/ *$//')
            else
                echo "✅ $service_name started (PID: $pid)"
            fi
        else
            echo "❌ Failed to start $service_name"
        fi
    done
    
    # Count running services
    running_count=0
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            running_count=$((running_count + 1))
        fi
    done
    
    echo ""
    echo "🎉 All services started! $running_count service(s) running"
    echo ""
    echo "💡 Press Ctrl+C to stop all services"
    echo ""
    
    # Wait for all background processes
    wait
}

main

