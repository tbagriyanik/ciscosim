#!/bin/bash

# Redirect stderr to stdout to avoid command execution errors
exec 2>&1

set -e

# Get script directory (relative to workspace root)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Validate required tools
check_required_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ Error: Required tool '$1' is not installed or not in PATH"
        exit 1
    fi
}

check_required_tool "bun"
check_required_tool "node"

# Use PROJECT_ROOT as the Next.js project directory
NEXTJS_PROJECT_DIR="$PROJECT_ROOT"

# Validate project directory
if [ ! -f "$NEXTJS_PROJECT_DIR/package.json" ]; then
    echo "❌ Error: package.json not found in $NEXTJS_PROJECT_DIR"
    exit 1
fi

echo "🚀 Starting build for Next.js application and mini-services..."
echo "📁 Project root: $NEXTJS_PROJECT_DIR"

# Change to project directory
cd "$NEXTJS_PROJECT_DIR" || exit 1

# Set environment variables
export NEXT_TELEMETRY_DISABLED=1

# Generate unique build directory
BUILD_ID="${BUILD_ID:-$(date +%s)}"
BUILD_DIR="/tmp/build_fullstack_${BUILD_ID}"

echo "📁 Creating build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
if ! bun install; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Build Next.js application
echo "🔨 Building Next.js application..."
if ! bun run build; then
    echo "❌ Failed to build Next.js application"
    exit 1
fi

# Build mini-services if directory exists
if [ -d "$NEXTJS_PROJECT_DIR/mini-services" ]; then
    echo "🔨 Building mini-services..."
    if ! sh "$SCRIPT_DIR/mini-services-install.sh"; then
        echo "⚠️  Warning: mini-services installation had issues, continuing..."
    fi
    if ! sh "$SCRIPT_DIR/mini-services-build.sh"; then
        echo "⚠️  Warning: mini-services build had issues, continuing..."
    fi
    
    # Copy mini-services-start.sh to build directory
    if [ -f "$SCRIPT_DIR/mini-services-start.sh" ]; then
        echo "  - Copying mini-services-start.sh to $BUILD_DIR"
        cp "$SCRIPT_DIR/mini-services-start.sh" "$BUILD_DIR/mini-services-start.sh"
        chmod +x "$BUILD_DIR/mini-services-start.sh"
    fi
else
    echo "ℹ️  mini-services directory not found, skipping"
fi

# Collect build artifacts
echo "📦 Collecting build artifacts to $BUILD_DIR..."

# Copy Next.js standalone build output
if [ -d ".next/standalone" ]; then
    echo "  - Copying .next/standalone"
    mkdir -p "$BUILD_DIR/next-service-dist"
    cp -r .next/standalone/* "$BUILD_DIR/next-service-dist/" || {
        echo "⚠️  Warning: Failed to copy .next/standalone"
    }
fi

# Copy Next.js static files
if [ -d ".next/static" ]; then
    echo "  - Copying .next/static"
    mkdir -p "$BUILD_DIR/next-service-dist/.next"
    cp -r .next/static "$BUILD_DIR/next-service-dist/.next/" || {
        echo "⚠️  Warning: Failed to copy .next/static"
    }
fi

# Copy public directory
if [ -d "public" ]; then
    echo "  - Copying public"
    cp -r public "$BUILD_DIR/next-service-dist/" || {
        echo "⚠️  Warning: Failed to copy public directory"
    }
fi

# Handle database migration
if [ -d "./db" ] && [ "$(ls -A ./db 2>/dev/null)" ]; then
    echo "🗄️  Database files detected, running migration..."
    mkdir -p "$BUILD_DIR/db"
    
    # Copy existing database files
    cp -r ./db/* "$BUILD_DIR/db/" 2>/dev/null || {
        echo "⚠️  Warning: Failed to copy database files"
    }
    
    # Run database push if db:push script exists
    if grep -q '"db:push"' package.json 2>/dev/null; then
        if DATABASE_URL="file:$BUILD_DIR/db/custom.db" bun run db:push 2>/dev/null; then
            echo "✅ Database migration completed"
        else
            echo "⚠️  Warning: Database migration script failed, continuing with copied files"
        fi
    fi
    
    ls -lah "$BUILD_DIR/db" 2>/dev/null || true
else
    echo "ℹ️  No database files found, skipping database migration"
fi

# Copy Caddyfile if it exists
if [ -f "Caddyfile" ]; then
    echo "  - Copying Caddyfile"
    cp Caddyfile "$BUILD_DIR/" || {
        echo "⚠️  Warning: Failed to copy Caddyfile"
    }
else
    echo "ℹ️  Caddyfile not found, skipping"
fi

# Copy start.sh script
if [ -f "$SCRIPT_DIR/start.sh" ]; then
    echo "  - Copying start.sh to $BUILD_DIR"
    cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
    chmod +x "$BUILD_DIR/start.sh"
else
    echo "⚠️  Warning: start.sh not found"
fi

# Package build artifacts
PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo ""
echo "📦 Packaging build artifacts to $PACKAGE_FILE..."

if cd "$BUILD_DIR" && tar -czf "$PACKAGE_FILE" . && cd - > /dev/null; then
    echo ""
    echo "✅ Build completed successfully!"
    echo "📊 Package file size:"
    ls -lh "$PACKAGE_FILE"
else
    echo "❌ Failed to create package file"
    exit 1
fi
