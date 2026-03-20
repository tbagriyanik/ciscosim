# Installation Instructions

## Quick Start

### 1. Install Dependencies

Due to PowerShell execution policy restrictions, use one of these methods:

**Option A: Using CMD (Recommended)**
```cmd
cd f:\netsim2026\ciscosim
npm install
```

**Option B: Enable PowerShell Scripts Temporarily**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
bun install
```

### 2. Required Packages

The following packages have been added to `package.json` but need to be installed:

- `zustand` - State management
- `@dnd-kit/core` - Drag and drop functionality  
- `@dnd-kit/modifiers` - DnD modifiers

Install them with:
```bash
npm install zustand @dnd-kit/core @dnd-kit/modifiers
```

### 3. Development Server

After installing dependencies:

```bash
npm run dev
# or
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## PWA Icons

SVG icons have been created in the `public/` folder:
- `/icon-192x192.svg`
- `/icon-512x512.svg`

These are used instead of PNG files for better scalability and smaller file size.

## Troubleshooting

### PowerShell Execution Policy Error

If you see: `cannot be loaded because running scripts is disabled on this system`

**Solution 1:** Use CMD instead of PowerShell

**Solution 2:** Temporarily bypass policy:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**Solution 3:** Run npm/bun directly from node_modules:
```powershell
.\node_modules\.bin\npm install
```

### Missing Dependencies

If you get module not found errors:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After installation, the app should work immediately. The Zustand store will automatically persist topology and device state to localStorage.
