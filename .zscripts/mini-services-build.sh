#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$PROJECT_ROOT/mini-services"
DIST_DIR="/tmp/build_fullstack_${BUILD_ID:-$(date +%s)}/mini-services-dist"

# Validate required tools
check_required_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ Error: Required tool '$1' is not installed or not in PATH"
        exit 1
    fi
}

check_required_tool "bun"

main() {
    echo "🚀 Starting batch build..."
    
    # Check if root directory exists
    if [ ! -d "$ROOT_DIR" ]; then
        echo "ℹ️  Directory $ROOT_DIR does not exist, skipping build"
        return 0
    fi
    
    # Create output directory
    mkdir -p "$DIST_DIR"
    
    # Statistics
    success_count=0
    fail_count=0
    
    # Iterate through all folders in mini-services directory
    for dir in "$ROOT_DIR"/*; do
        # Check if it's a directory with package.json
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            
            # Intelligently find entry file (by priority)
            entry_path=""
            for entry in "src/index.ts" "index.ts" "src/index.js" "index.js"; do
                if [ -f "$dir/$entry" ]; then
                    entry_path="$dir/$entry"
                    break
                fi
            done
            
            if [ -z "$entry_path" ]; then
                echo "⚠️  Skipping $project_name: No entry file found (index.ts/js)"
                continue
            fi
            
            echo ""
            echo "📦 Building: $project_name..."
            
            # Use bun build CLI
            output_file="$DIST_DIR/mini-service-$project_name.js"
            
            if bun build "$entry_path" \
                --outfile "$output_file" \
                --target bun \
                --minify 2>/dev/null; then
                echo "✅ $project_name built successfully -> $output_file"
                success_count=$((success_count + 1))
            else
                echo "❌ $project_name build failed"
                fail_count=$((fail_count + 1))
            fi
        fi
    done
    
    # Copy startup script if it exists
    if [ -f "$SCRIPT_DIR/mini-services-start.sh" ]; then
        cp "$SCRIPT_DIR/mini-services-start.sh" "$DIST_DIR/mini-services-start.sh"
        chmod +x "$DIST_DIR/mini-services-start.sh"
    fi
    
    echo ""
    echo "🎉 Build completed!"
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "✅ Successful: $success_count"
        if [ $fail_count -gt 0 ]; then
            echo "❌ Failed: $fail_count"
        fi
    else
        echo "ℹ️  No services found to build"
    fi
}

main

