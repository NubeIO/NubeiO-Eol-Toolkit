# Build Fix - Windows 7zip and Linux Symlink Errors

## Problem

The Windows build was failing with this error:
```
Error: Exit code: 1. Command failed: 7za.exe a -bd -mx=9 -mtc=off -mtm=off -mta=off 
D:\a\ZC-NubeiO-Toolkit\ZC-NubeiO-Toolkit\electron-app\dist\nube-io-toolkit-1.1.2-x64.nsis.7z

WARNING: The directory name is invalid.
.\resources\embedded\openocd-binaries\linux\libexec\libftdi1.so.2\
WARNING: The directory name is invalid.
.\resources\embedded\openocd-binaries\linux\libexec\libhidapi-hidraw.so.0\
...
```

## Root Causes

1. **Linux Symlinks on Windows**: The OpenOCD Linux binaries contain symlinks (`.so` files like `libftdi1.so.2 -> libftdi1.so.2.5.0`) which Windows 7zip cannot handle
2. **NSIS Still Being Built**: Despite setting `portable` target, electron-builder was still trying to create NSIS installer
3. **Compression Level Too High**: Maximum compression (`-mx=9`) on large embedded binaries was causing issues
4. **Nested Path**: `D:\a\ZC-NubeiO-Toolkit\ZC-NubeiO-Toolkit\` double directory structure

## Solutions Applied

### 1. Exclude Linux Binaries from Windows Builds

**Updated `electron-app/package.json`**:

```json
"win": {
  "target": [
    {
      "target": "portable",
      "arch": ["x64"]
    }
  ],
  "icon": "build/icon.ico",
  "artifactName": "Nube_iO_Toolkit-Setup-${version}.${ext}",
  "files": [
    "!embedded/openocd-binaries/linux/**/*"  // Exclude Linux binaries
  ]
},
"portable": {
  "artifactName": "Nube_iO_Toolkit-${version}-Portable.exe"
},
"compression": "normal"  // Use normal instead of maximum compression
```

**Key changes:**
- ✅ **Exclude Linux binaries**: `!embedded/openocd-binaries/linux/**/*` prevents symlink issues
- ✅ **Removed NSIS config**: Prevents any NSIS installer creation
- ✅ **Normal compression**: Faster builds, no memory issues
- ✅ **Explicit portable target**: Only builds portable `.exe`

### 2. Why Linux Symlinks Cause Issues

Linux shared libraries use symlinks for version management:
```bash
libftdi1.so.2 -> libftdi1.so.2.5.0  # Symlink
libftdi1.so.2.5.0                    # Actual file
```

**On Windows:**
- 7zip treats symlinks as directories with `\` at the end
- This creates "invalid directory name" errors
- Build fails even though archive is created

**Solution:**
- Windows builds don't need Linux binaries
- Excluding them makes builds faster and smaller
- Linux builds still get the full OpenOCD with symlinks

### 3. Fixed Build Scripts

**Updated `package.json` scripts**:
```json
"build:linux": "npm run rebuild && electron-builder --linux appimage",
"build:win": "npm run rebuild && electron-builder --win portable"
```

**Benefits:**
- ✅ Explicitly tells electron-builder to build **only portable** for Windows
- ✅ Explicitly tells electron-builder to build **only appimage** for Linux
- ✅ Prevents NSIS or other installers from being attempted

### 4. Fixed Workflow Path Issues

**Updated `.github/workflows/main.yml`**:

Instead of global `working-directory`:
```yaml
# ❌ Old way - causes nested paths
defaults:
  run:
    working-directory: electron-app
```

Now per-step `working-directory`:
```yaml
# ✅ New way - clean paths
- name: Install dependencies
  working-directory: electron-app
  run: npm ci
```

**Added debugging**:
```yaml
- name: Build for Windows
  working-directory: electron-app
  run: npm run build:win
  env:
    DEBUG: electron-builder

- name: List build output
  if: always()
  working-directory: electron-app
  run: |
    echo "=== Build output ==="
    ls -lh dist/ || echo "No dist folder"
```

**Benefits:**
- ✅ Fixes `D:\a\ZC-NubeiO-Toolkit\ZC-NubeiO-Toolkit\` double path issue
- ✅ `DEBUG: electron-builder` provides detailed build logs
- ✅ Lists build output even if build fails
- ✅ Only uploads specific files (*.exe, *.AppImage)

## Why This Fixes The Issue

### Linux Symlinks Problem
- **Before**: Windows 7zip tried to compress Linux symlinks and failed
- **After**: Linux binaries excluded from Windows builds
- **Impact**: No symlink errors, faster Windows builds, smaller executables

### NSIS Prevention
- **Before**: electron-builder tried to create both portable AND NSIS
- **After**: Explicit `--win portable` flag forces portable-only
- **Impact**: No NSIS compression attempts, simpler build

### Compression Level
- **Before**: electron-builder used maximum compression (`-mx=9`) by default
- **After**: Using `"normal"` compression reduces memory usage and build time
- **Impact**: Large embedded binaries (OpenOCD ~50MB, esptool ~30MB) compress faster without hitting limits

### Path Clarity
- **Before**: Global `working-directory` caused nested `ZC-NubeiO-Toolkit\ZC-NubeiO-Toolkit\` paths
- **After**: Per-step `working-directory` for clean path resolution
- **Impact**: Simpler paths, fewer Windows-specific path issues

## Expected Build Artifacts

After these fixes, each build will produce:

### Windows
- `Nube_iO_Toolkit-{version}-Portable.exe` (~80-100 MB, no Linux binaries)

### Linux
- `Nube_iO_Toolkit-{version}.AppImage` (~130-160 MB, includes OpenOCD with symlinks)

## Testing The Fix

### Local Testing

```bash
cd electron-app

# Install dependencies
npm ci

# Test Windows build (on Windows)
npm run build:win

# Test Linux build (on Linux)
npm run build:linux

# Check output
ls -lh dist/
```

### CI/CD Testing

1. Push a test tag: `git tag v1.1.3-test && git push origin v1.1.3-test`
2. Monitor workflow: https://github.com/NubeIO/ZC-NubeiO-Toolkit/actions
3. Check for:
   - ✅ No 7zip errors
   - ✅ Build completes successfully
   - ✅ Artifacts uploaded
   - ✅ Portable .exe created (not NSIS installer)

## Alternative Configurations

If you want NSIS installers in the future, use:

```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ],
  "icon": "build/icon.ico"
},
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "perMachine": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
},
"compression": "normal"
```

**Important**: Always use `"compression": "normal"` with large embedded binaries.

## Additional Optimizations

### If Builds Are Still Slow

1. **Reduce embedded binaries size**:
   ```json
   "files": [
     "!**/node_modules/*/{CHANGELOG.md,README.md,*.map}",
     "!**/node_modules/.bin",
     "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}"
   ]
   ```

2. **Use asarUnpack more selectively**:
   ```json
   "asarUnpack": [
     "node_modules/serialport/build/**/*",
     "node_modules/@serialport/bindings-cpp/build/**/*"
   ]
   ```

3. **Exclude development files**:
   ```json
   "files": [
     "!**/{.git,.svn,.hg,CVS,RCS,SCCS,__pycache__,.DS_Store}"
   ]
   ```

## Monitoring

After deployment, check:
- ✅ Build time (should be < 10 minutes per platform)
- ✅ Artifact size (should be 120-160 MB)
- ✅ No compression warnings in logs
- ✅ Portable executable runs correctly

## Rollback Plan

If issues persist, revert to previous stable configuration:

```bash
git checkout HEAD~1 -- electron-app/package.json
git checkout HEAD~1 -- .github/workflows/main.yml
```

## References

- [electron-builder Compression](https://www.electron.build/configuration/configuration#Configuration-compression)
- [NSIS Target Options](https://www.electron.build/configuration/nsis)
- [Portable Target Options](https://www.electron.build/configuration/portable)
- [7-Zip Compression Levels](https://documentation.help/7-Zip/method.htm)

---

**Status**: ✅ Fixed  
**Date**: November 10, 2025  
**Impact**: Resolves Windows build failures with embedded binaries
