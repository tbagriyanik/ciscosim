# Network Simulator 2026 - Build & Deployment Scripts

This directory contains shell scripts for building and deploying the Network Simulator 2026 application.

## Quick Start

### Build the Application
```bash
./.zscripts/build.sh
```
Creates a complete build package with Next.js, mini-services, and all dependencies.

### Start All Services
```bash
./.zscripts/start.sh
```
Starts Next.js server, mini-services, and Caddy reverse proxy.

## Scripts Overview

### build.sh
Builds the complete application stack for deployment.

**What it does:**
- Validates required tools (bun, node)
- Installs project dependencies
- Builds Next.js application
- Builds mini-services (if present)
- Collects all artifacts
- Handles database migration
- Creates a compressed package

**Output:** `/tmp/build_fullstack_<timestamp>.tar.gz`

**Environment Variables:**
- `BUILD_ID`: Custom build identifier (optional, defaults to timestamp)

**Example:**
```bash
BUILD_ID=v1.0.0 ./.zscripts/build.sh
```

### start.sh
Starts all services for the application.

**What it does:**
- Validates required tools (bun, caddy)
- Initializes database (if present)
- Starts Next.js server (background)
- Starts mini-services (background)
- Starts Caddy reverse proxy (foreground)

**Environment Variables:**
- `PORT`: Next.js server port (default: 3000)
- `HOSTNAME`: Next.js server hostname (default: 0.0.0.0)

**Example:**
```bash
PORT=8080 HOSTNAME=localhost ./.zscripts/start.sh
```

**Stopping Services:**
Press `Ctrl+C` to gracefully shutdown all services.

### mini-services-install.sh
Installs dependencies for all mini-services.

**What it does:**
- Finds all mini-services directories
- Runs `bun install` in each
- Reports success/failure for each service

**Usage:**
```bash
./.zscripts/mini-services-install.sh
```

### mini-services-build.sh
Builds all mini-services.

**What it does:**
- Finds all mini-services with package.json
- Intelligently locates entry files (src/index.ts, index.ts, etc.)
- Builds each service with bun
- Outputs to `/tmp/build_fullstack_<timestamp>/mini-services-dist/`

**Usage:**
```bash
./.zscripts/mini-services-build.sh
```

### mini-services-start.sh
Starts all built mini-services.

**What it does:**
- Finds all built mini-service-*.js files
- Starts each service with bun (background)
- Monitors startup success
- Gracefully shuts down on Ctrl+C

**Usage:**
```bash
./.zscripts/mini-services-start.sh
```

## Project Structure

```
.
├── .zscripts/
│   ├── build.sh                    # Main build script
│   ├── start.sh                    # Main startup script
│   ├── mini-services-build.sh      # Build mini-services
│   ├── mini-services-install.sh    # Install mini-services deps
│   ├── mini-services-start.sh      # Start mini-services
│   ├── README.md                   # This file
│   └── FIXES_APPLIED.md            # Detailed fix documentation
├── mini-services/                  # Optional: mini-services directory
│   ├── service-1/
│   │   ├── package.json
│   │   └── src/index.ts
│   └── service-2/
│       ├── package.json
│       └── index.ts
├── db/                             # Optional: database files
│   └── custom.db
├── public/                         # Static files
├── src/                            # Next.js source
├── package.json
├── Caddyfile                       # Caddy configuration
└── next.config.ts
```

## Error Handling

All scripts include comprehensive error handling:

### Missing Required Tools
```
❌ Error: Required tool 'bun' is not installed or not in PATH
```
**Solution:** Install the required tool or add it to your PATH.

### Missing Project Files
```
❌ Error: package.json not found in /path/to/project
```
**Solution:** Ensure you're running the script from the correct directory.

### Build Failures
Scripts will show which step failed and exit with error code 1.

### Graceful Degradation
Non-critical failures (like missing mini-services) will show warnings but continue:
```
⚠️  Warning: mini-services directory not found, skipping
```

## Environment Support

Scripts work in any environment:
- ✅ Different directory structures
- ✅ Different operating systems (Linux, macOS, WSL)
- ✅ Different shell environments (bash, sh, zsh)
- ✅ Empty/new projects
- ✅ Projects with or without mini-services
- ✅ Projects with or without database

## Troubleshooting

### "Command not found: bun"
Install bun: https://bun.sh/docs/installation

### "Command not found: caddy"
Install caddy: https://caddyserver.com/docs/install

### "Permission denied"
Make scripts executable:
```bash
chmod +x ./.zscripts/*.sh
```

### Build fails with database error
- Check if database files exist in `./db/`
- Ensure `db:push` script exists in package.json
- Check database file permissions

### Services won't start
- Check if ports are already in use (default: 3000 for Next.js)
- Check if required tools are installed
- Review error messages for specific issues

### Orphaned processes
If services don't shut down cleanly:
```bash
# Find processes
ps aux | grep bun
ps aux | grep caddy

# Kill manually if needed
kill -9 <PID>
```

## Development vs Production

### Development
```bash
# Use Next.js dev server instead
npm run dev
```

### Production
```bash
# Build and start
./.zscripts/build.sh
# Extract and run
tar -xzf /tmp/build_fullstack_*.tar.gz -C /path/to/deploy
cd /path/to/deploy
./start.sh
```

## Performance Notes

- Build time: ~2-5 minutes (depends on dependencies)
- Startup time: ~10-30 seconds (depends on services)
- Memory usage: ~500MB-1GB (depends on services)

## Support

For issues or questions:
1. Check FIXES_APPLIED.md for detailed changes
2. Review error messages carefully
3. Ensure all required tools are installed
4. Check file permissions
5. Verify project structure

## Version

Network Simulator 2026 v0.2.0
Last updated: 2024
