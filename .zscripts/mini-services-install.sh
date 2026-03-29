#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$PROJECT_ROOT/mini-services"

# Validate required tools
check_required_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ Error: Required tool '$1' is not installed or not in PATH"
        exit 1
    fi
}

check_required_tool "bun"

main() {
    echo "🚀 Starting batch dependency installation..."
    
    # Check if root directory exists
    if [ ! -d "$ROOT_DIR" ]; then
        echo "ℹ️  Directory $ROOT_DIR does not exist, skipping installation"
        return 0
    fi
    
    # Statistics
    success_count=0
    fail_count=0
    failed_projects=""
    
    # Iterate through all folders in mini-services directory
    for dir in "$ROOT_DIR"/*; do
        # Check if it's a directory with package.json
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            echo ""
            echo "📦 Installing dependencies: $project_name..."
            
            # Enter project directory and run bun install
            if (cd "$dir" && bun install 2>/dev/null); then
                echo "✅ $project_name dependencies installed successfully"
                success_count=$((success_count + 1))
            else
                echo "❌ $project_name dependency installation failed"
                fail_count=$((fail_count + 1))
                if [ -z "$failed_projects" ]; then
                    failed_projects="$project_name"
                else
                    failed_projects="$failed_projects, $project_name"
                fi
            fi
        fi
    done
    
    # Summary
    echo ""
    echo "=================================================="
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "🎉 Installation completed!"
        echo "✅ Successful: $success_count"
        if [ $fail_count -gt 0 ]; then
            echo "❌ Failed: $fail_count"
            echo ""
            echo "Failed projects:"
            echo "$failed_projects" | tr ',' '\n' | sed 's/^/  - /'
        fi
    else
        echo "ℹ️  No projects found with package.json"
    fi
    echo "=================================================="
}

main

