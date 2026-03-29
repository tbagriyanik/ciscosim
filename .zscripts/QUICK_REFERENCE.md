# Quick Reference Card

## Common Commands

### Build
```bash
./.zscripts/build.sh
```
Creates `/tmp/build_fullstack_<timestamp>.tar.gz`

### Start Services
```bash
./.zscripts/start.sh
```
Starts Next.js, mini-services, and Caddy

### Stop Services
```
Press Ctrl+C
```
Gracefully shuts down all services

## Environment Variables

```bash
# Custom build ID
BUILD_ID=v1.0.0 ./.zscripts/build.sh

# Custom port
PORT=8080 ./.zscripts/start.sh

# Custom hostname
HOSTNAME=localhost ./.zscripts/start.sh
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | `chmod +x ./.zscripts/*.sh` |
| Command not found: bun | Install bun: https://bun.sh/docs/installation |
| Command not found: caddy | Install caddy: https://caddyserver.com/docs/install |
| Build fails | Check error message, verify tools installed |
| Services won't start | Check if ports are in use, verify tools installed |
| Orphaned processes | `ps aux \| grep bun` then `kill -9 <PID>` |

## File Structure

```
.zscripts/
├── build.sh                    # Main build script
├── start.sh                    # Main startup script
├── mini-services-build.sh      # Build mini-services
├── mini-services-install.sh    # Install mini-services deps
├── mini-services-start.sh      # Start mini-services
├── README.md                   # Full documentation
├── FIXES_APPLIED.md            # Technical details
├── MIGRATION_GUIDE.md          # Migration guide
├── SUMMARY.md                  # Summary of changes
└── QUICK_REFERENCE.md          # This file
```

## Key Features

✅ Dynamic path resolution (no hardcoded paths)
✅ Tool validation (bun, node, caddy)
✅ Comprehensive error handling
✅ Empty project support
✅ Graceful shutdown
✅ Better logging
✅ Environment variable support
✅ Backward compatible

## Ports

- **Next.js**: 3000 (default, configurable with PORT)
- **Caddy**: 80, 443 (configured in Caddyfile)

## Logs

- Build output: Console
- Service output: Console
- Build package: `/tmp/build_fullstack_<timestamp>.tar.gz`

## Performance

- Build time: 2-5 minutes
- Startup time: 10-30 seconds
- Memory: 500MB-1GB

## Support

- 📖 README.md - Usage guide
- 🔧 FIXES_APPLIED.md - Technical details
- 🚀 MIGRATION_GUIDE.md - Migration help
- 📋 SUMMARY.md - Overview of changes

## Deployment

```bash
# Build
./.zscripts/build.sh

# Extract
tar -xzf /tmp/build_fullstack_*.tar.gz -C /path/to/deploy

# Run
cd /path/to/deploy
./start.sh
```

## Development

```bash
# Use Next.js dev server
npm run dev
```

## Testing

```bash
# Test build
./.zscripts/build.sh

# Test start (in build directory)
./start.sh

# Verify graceful shutdown
# Press Ctrl+C
```

## Useful Commands

```bash
# Make scripts executable
chmod +x ./.zscripts/*.sh

# Check tool versions
bun --version
node --version
caddy version

# Find running processes
ps aux | grep bun
ps aux | grep caddy

# Kill process
kill -9 <PID>

# List build packages
ls -lh /tmp/build_fullstack_*.tar.gz

# Extract build package
tar -xzf /tmp/build_fullstack_*.tar.gz -C /path/to/deploy
```

## Environment Setup

```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Install caddy (macOS)
brew install caddy

# Install caddy (Linux)
sudo apt-get install caddy

# Add to PATH (if needed)
export PATH="$HOME/.bun/bin:$PATH"
```

## Common Errors

```
❌ Error: Required tool 'bun' is not installed
→ Install bun: https://bun.sh/docs/installation

❌ Error: package.json not found
→ Run from project root directory

❌ Failed to install dependencies
→ Check internet connection, verify bun installation

❌ Next.js server failed to start
→ Check if port 3000 is in use, check error message

❌ Caddyfile not found
→ Ensure Caddyfile exists in project root
```

## Tips

- Always make scripts executable: `chmod +x ./.zscripts/*.sh`
- Run build.sh from project root
- Run start.sh from build directory
- Use Ctrl+C to gracefully stop services
- Check error messages for specific issues
- Verify all tools are installed before running

## Version

Network Simulator 2026 v0.2.0
Scripts v2.0.0 (Fixed)

---

For more information, see:
- README.md - Full documentation
- FIXES_APPLIED.md - Technical details
- MIGRATION_GUIDE.md - Migration help
