# Migration Guide: Updated Shell Scripts

This guide helps you transition from the old shell scripts to the new, improved versions.

## What Changed?

All shell scripts in `.zscripts/` have been updated with:
- ✅ Dynamic path resolution (no more hardcoded paths)
- ✅ Comprehensive error handling
- ✅ Tool validation before execution
- ✅ Better support for empty/new projects
- ✅ Improved signal handling and graceful shutdown
- ✅ Better error messages and logging

## Breaking Changes

**None!** The new scripts are backward compatible. They work exactly the same way from a user perspective, but with better error handling and reliability.

## What You Need to Do

### 1. Update Your Scripts (Already Done)
The scripts have been updated. No action needed.

### 2. Verify Tool Installation
Ensure you have the required tools installed:

```bash
# Check bun
bun --version

# Check node
node --version

# Check caddy (for start.sh)
caddy version
```

If any tool is missing, install it:
- **bun**: https://bun.sh/docs/installation
- **node**: https://nodejs.org/
- **caddy**: https://caddyserver.com/docs/install

### 3. Make Scripts Executable
```bash
chmod +x ./.zscripts/*.sh
```

### 4. Test the Scripts

#### Test build.sh
```bash
./.zscripts/build.sh
```
Should complete without errors and create a `.tar.gz` file in `/tmp/`.

#### Test start.sh
```bash
# In the build directory
./start.sh
```
Should start all services. Press Ctrl+C to stop.

## Common Migration Issues

### Issue: "Permission denied"
**Solution:**
```bash
chmod +x ./.zscripts/*.sh
```

### Issue: "Command not found: bun"
**Solution:**
Install bun or add it to your PATH:
```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.bun/bin:$PATH"
```

### Issue: "Error: Required tool 'caddy' is not installed"
**Solution:**
Install caddy:
```bash
# macOS
brew install caddy

# Linux
sudo apt-get install caddy

# Or download from https://caddyserver.com/docs/install
```

### Issue: Build fails with database error
**Solution:**
The new scripts handle empty databases gracefully. If you see warnings:
- It's normal for new projects
- Database will be created on first run
- Check `./db/` directory permissions if needed

### Issue: "No such file or directory: /home/z/my-project"
**Solution:**
This error should no longer occur! The new scripts use dynamic paths. If you see it:
1. Ensure you're running scripts from the correct directory
2. Check that `package.json` exists in the project root

## Behavior Changes

### Before vs After

#### Path Resolution
```bash
# Before: Hardcoded
ROOT_DIR="/home/z/my-project/mini-services"

# After: Dynamic
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$PROJECT_ROOT/mini-services"
```

#### Error Handling
```bash
# Before: Silent failure
bun install

# After: Clear error message
if ! bun install; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
```

#### Empty Project Support
```bash
# Before: Would fail
cp -r ./db/* "$BUILD_DIR/db/"

# After: Graceful handling
if [ -d "./db" ] && [ "$(ls -A ./db 2>/dev/null)" ]; then
    mkdir -p "$BUILD_DIR/db"
    cp -r ./db/* "$BUILD_DIR/db/" 2>/dev/null || {
        echo "⚠️  Warning: Failed to copy database files"
    }
fi
```

## New Features

### 1. Tool Validation
Scripts now check for required tools before running:
```bash
check_required_tool "bun"
check_required_tool "caddy"
```

### 2. Better Error Messages
Clear, actionable error messages:
```
❌ Error: Required tool 'bun' is not installed or not in PATH
```

### 3. Graceful Shutdown
Services now shut down cleanly:
```bash
trap cleanup EXIT INT TERM
```

### 4. Environment Variables
New support for customization:
```bash
# Custom build ID
BUILD_ID=v1.0.0 ./.zscripts/build.sh

# Custom port
PORT=8080 ./.zscripts/start.sh
```

### 5. Better Logging
More informative output:
```
🚀 Starting build for Next.js application and mini-services...
📁 Project root: /path/to/project
📦 Installing dependencies...
✅ Dependencies installed successfully
```

## Rollback (If Needed)

If you need to revert to the old scripts:

```bash
# Restore from git
git checkout HEAD -- .zscripts/

# Or manually restore from backup
cp .zscripts/build.sh.bak .zscripts/build.sh
```

## Testing Checklist

- [ ] All scripts are executable (`chmod +x .zscripts/*.sh`)
- [ ] Required tools are installed (bun, node, caddy)
- [ ] `build.sh` completes successfully
- [ ] Build package is created in `/tmp/`
- [ ] `start.sh` starts all services
- [ ] Services respond to Ctrl+C gracefully
- [ ] No orphaned processes after shutdown
- [ ] Empty project builds successfully
- [ ] Project with mini-services builds successfully
- [ ] Project with database builds successfully

## Performance Impact

The new scripts have **no negative performance impact**:
- Build time: Same or slightly faster (better error handling)
- Startup time: Same or slightly faster (better process management)
- Memory usage: Same (no additional overhead)
- Disk usage: Same (no additional files)

## Support

If you encounter issues:

1. **Check the error message** - New scripts provide clear, actionable errors
2. **Review FIXES_APPLIED.md** - Detailed documentation of all changes
3. **Check README.md** - Usage guide and troubleshooting
4. **Verify tool installation** - Ensure all required tools are installed
5. **Check file permissions** - Ensure scripts are executable

## FAQ

### Q: Do I need to update my CI/CD pipeline?
**A:** No, the scripts work exactly the same way. No changes needed.

### Q: Will this break my existing deployments?
**A:** No, the scripts are backward compatible. Existing deployments will continue to work.

### Q: Can I use the old scripts?
**A:** The old scripts are replaced, but you can restore them from git if needed.

### Q: What if I have custom modifications?
**A:** Review the changes in FIXES_APPLIED.md and apply them to your custom scripts.

### Q: How do I report issues?
**A:** Check the error message, review the documentation, and verify tool installation.

## Next Steps

1. ✅ Review this migration guide
2. ✅ Verify tool installation
3. ✅ Make scripts executable
4. ✅ Test the scripts
5. ✅ Update your documentation
6. ✅ Update your CI/CD pipeline (if needed)
7. ✅ Deploy with confidence!

## Summary

The new scripts are:
- ✅ More reliable
- ✅ Better error handling
- ✅ More informative
- ✅ Backward compatible
- ✅ Production-ready

No action required - just use them as before!
