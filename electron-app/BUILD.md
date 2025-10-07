# Building FGA Simulator - Cross-Platform Guide

This guide explains how to build the FGA Simulator for different platforms.

## 📦 Available Build Methods

### Method 1: Docker Build (Recommended for Cross-Platform)

**Advantages:**
- ✅ Build for Windows, Linux, and macOS from any platform
- ✅ No Wine installation required
- ✅ Consistent build environment
- ✅ Isolated dependencies

**Requirements:**
- Docker installed on your system

**Steps:**

```bash
# Make sure you're in the project directory
cd /data/projects/nube-io/FGA-AC-Simulator-Electron

# Run the Docker build script
./build.sh

# Or manually:
docker build -f Dockerfile.build -t fga-simulator-builder .
docker run --rm -v "$(pwd)/dist:/project/dist" fga-simulator-builder
```

**Output:**
- `dist/FGA Simulator-1.0.0.AppImage` - Linux AppImage
- `dist/fga-ac-simulator-electron_1.0.0_amd64.deb` - Debian/Ubuntu package
- `dist/FGA Simulator Setup 1.0.0.exe` - Windows installer (NSIS)
- `dist/FGA Simulator 1.0.0.exe` - Windows portable
- `dist/FGA Simulator-1.0.0.dmg` - macOS installer (if building on macOS)

---

### Method 2: Native Linux Build (Linux Only)

**What it builds:**
- ✅ Linux packages (AppImage, .deb)
- ❌ Windows packages (requires Wine)
- ❌ macOS packages (requires macOS)

**Steps:**

```bash
# Install dependencies
npm install

# Build for Linux only
npm run build:linux
```

**Output:**
- `dist/FGA Simulator-1.0.0.AppImage`
- `dist/fga-ac-simulator-electron_1.0.0_amd64.deb`

---

### Method 3: Windows Build with Wine (Advanced)

If you want to build Windows executables directly on Linux without Docker:

**Requirements:**
```bash
# Install Wine
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install wine64 wine32
```

**Steps:**
```bash
npm run build:win
```

**Output:**
- `dist/FGA Simulator Setup 1.0.0.exe` - Windows installer
- `dist/FGA Simulator 1.0.0.exe` - Windows portable

---

### Method 4: Build on Windows (Native)

If you're on a Windows machine:

**Steps:**
```bash
# Install dependencies
npm install

# Build for Windows
npm run build:win

# Or build for all platforms (if you have the tools)
npm run build:all
```

---

## 🚀 Quick Start

### For Development:
```bash
npm install
npm start
```

### For Production Build (Current Platform):
```bash
npm run build
```

### For All Platforms (Docker):
```bash
./build.sh
```

---

## 📋 Build Outputs

### Linux:
- **AppImage** - Portable, runs on any Linux distro
  - Usage: `chmod +x "FGA Simulator-1.0.0.AppImage" && ./FGA\ Simulator-1.0.0.AppImage`
- **.deb** - Debian/Ubuntu package
  - Usage: `sudo dpkg -i fga-ac-simulator-electron_1.0.0_amd64.deb`

### Windows:
- **NSIS Installer** - Full installer with uninstaller
  - Usage: Double-click `FGA Simulator Setup 1.0.0.exe`
- **Portable** - No installation required
  - Usage: Double-click `FGA Simulator 1.0.0.exe`

### macOS:
- **.dmg** - macOS disk image
  - Usage: Double-click to mount, drag to Applications

---

## 🐛 Troubleshooting

### "wine is required" error:
**Solution:** Use Docker build method (`./build.sh`) or install Wine (see Method 3)

### Docker not found:
**Solution:** Install Docker:
```bash
# Ubuntu/Debian
sudo apt install docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and log back in
```

### Permission denied on build.sh:
**Solution:**
```bash
chmod +x build.sh
```

### Build fails with "ENOSPC" error:
**Solution:** Increase inotify watches:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 📝 Notes

- **Code Signing:** Builds are not code-signed by default. For production, you should sign the executables.
- **Auto-Update:** Not configured. You can add `electron-updater` for auto-update functionality.
- **Build Time:** First build may take 5-10 minutes. Subsequent builds are faster.
- **Disk Space:** Ensure you have at least 2GB free space for build artifacts.

---

## 🔧 Customization

### Change App Version:
Edit `package.json`:
```json
{
  "version": "1.0.1"
}
```

### Change App Name:
Edit `package.json`:
```json
{
  "name": "your-app-name",
  "productName": "Your App Name"
}
```

### Add Icon:
1. Create `build/icon.ico` (Windows)
2. Create `build/icon.png` (Linux)
3. Create `build/icon.icns` (macOS)

---

## 📦 Distribution

### Linux:
- Upload `.AppImage` for universal compatibility
- Upload `.deb` for Debian/Ubuntu users
- Consider creating `.rpm` for Fedora/RHEL users

### Windows:
- Distribute the NSIS installer for most users
- Provide portable version for users who can't install software

### macOS:
- Distribute the `.dmg` file
- Consider notarization for Gatekeeper compatibility

---

## 🎯 Recommended Workflow

1. **Development:** `npm start`
2. **Test Build:** `npm run build` (current platform)
3. **Production Build:** `./build.sh` (all platforms via Docker)
4. **Test Executables:** Run the built apps on target platforms
5. **Distribute:** Upload to GitHub Releases or your distribution platform
