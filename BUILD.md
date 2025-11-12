# Build Instructions for FGA Simulator

## Important: Native Modules

This Electron app uses **native Node.js modules** (`serialport`) which require platform-specific compilation.

## 🪟 Windows Build

**For Windows executable, you MUST build on a Windows machine.**

### Requirements:
- Node.js (v16+ recommended, v20+ for full compatibility)
- npm
- Windows 10/11

### Build Command:
```bash
cd electron-app
npm install
npm run build:win
```

### Output:
- `dist/FGA_Simulator 1.0.0.exe` - Portable executable
- `dist/win-unpacked/` - Unpacked application folder

### ✅ The resulting `.exe` will work on any Windows PC without requiring:
- Visual Studio Build Tools
- Python
- Node.js
- npm

---

## 🐧 Linux Build

**For Linux AppImage, you can use Docker or build on Linux.**

### Option 1: Docker Build (Recommended)
```bash
cd electron-app
./build.sh
```

### Option 2: Native Linux Build
```bash
cd electron-app
npm install
npm run build:linux
```

### Output:
- `dist/FGA_Simulator-1.0.0.AppImage` - Linux AppImage

---

## ⚠️ Cross-Platform Build Limitation

**Do NOT use Docker (`build.sh`) to build Windows executables!**

### Why?
- Docker runs in a Linux environment
- Native modules (serialport) are compiled for Linux
- Even though a Windows `.exe` is produced, the native bindings are incorrect
- The `.exe` will fail on Windows PCs with error: "not a valid Win32 application"

### Solution:
- **Windows builds**: Use `npm run build:win` on Windows PC
- **Linux builds**: Use `./build.sh` or `npm run build:linux`

---

## 🔧 Build Scripts

| Command | Platform | Environment | Output |
|---------|----------|-------------|---------|
| `npm run build:win` | Windows | Windows PC | Portable `.exe` |
| `npm run build:linux` | Linux | Linux/Docker | AppImage |
| `npm run build:mac` | macOS | macOS | DMG |
| `./build.sh` | Linux | Docker | AppImage |

---

## 📦 What Gets Built

### Windows (`npm run build:win`)
1. Rebuilds `serialport` for Windows + Electron v28
2. Packages app with `electron-builder`
3. Extracts native modules from asar (via `asarUnpack`)
4. Creates portable executable

### Linux (`npm run build:linux` or `./build.sh`)
1. Rebuilds `serialport` for Linux + Electron v28
2. Packages app with `electron-builder`
3. Creates AppImage

---

## 🐛 Troubleshooting

### "not a valid Win32 application" error
- **Cause**: Built with Docker on Linux
- **Fix**: Rebuild on Windows PC using `npm run build:win`

### "Cannot find module 'serialport'"
- **Cause**: Native module not properly unpacked
- **Fix**: Check `asarUnpack` in `package.json`

### Build fails on Windows
- **Cause**: Missing build tools
- **Fix**: Install Windows Build Tools (only needed for building, not for running)
  ```bash
  npm install --global windows-build-tools
  ```

---

## 📝 Summary

**For Production Builds:**

| Target OS | Build On | Command |
|-----------|----------|---------|
| Windows | Windows PC | `npm run build:win` |
| Linux | Linux or Docker | `./build.sh` |
| macOS | macOS | `npm run build:mac` |

**Never cross-compile Windows builds with native modules from Linux/Docker!**
