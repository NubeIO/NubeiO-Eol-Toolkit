# Building for Windows from Linux - Quick Guide

## 🎯 Best Option: Docker (No Wine Required!)

The easiest and most reliable way to build Windows executables from Linux without installing Wine.

### Prerequisites:
```bash
# Install Docker (Ubuntu/Debian)
sudo apt update
sudo apt install docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and log back in for group changes to take effect
```

### Build Command:
```bash
cd /data/projects/nube-io/FGA-AC-Simulator-Electron
./build.sh
```

### What You Get:
- ✅ `dist/FGA Simulator Setup 1.0.0.exe` - Windows installer (NSIS)
- ✅ `dist/FGA Simulator 1.0.0.exe` - Windows portable executable
- ✅ `dist/FGA Simulator-1.0.0.AppImage` - Linux AppImage
- ✅ `dist/fga-ac-simulator-electron_1.0.0_amd64.deb` - Debian package

---

## 🐳 How It Works

The Docker build uses the official `electronuserland/builder:wine` image which includes:
- Wine (for Windows builds)
- All necessary build tools
- Isolated environment (no system pollution)

**Dockerfile.build:**
```dockerfile
FROM electronuserland/builder:wine
WORKDIR /project
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "build"]
```

**build.sh:**
```bash
#!/bin/bash
docker build -f Dockerfile.build -t fga-simulator-builder .
docker run --rm -v "$(pwd)/dist:/project/dist" fga-simulator-builder
```

---

## 🚀 Quick Start

### One-Time Setup:
```bash
# 1. Install Docker
sudo apt install docker.io
sudo systemctl start docker
sudo usermod -aG docker $USER

# 2. Log out and log back in

# 3. Verify Docker works
docker run hello-world
```

### Every Build:
```bash
cd /data/projects/nube-io/FGA-AC-Simulator-Electron
./build.sh
```

That's it! 🎉

---

## 📦 Build Output

After the build completes, check the `dist/` directory:

```bash
cd dist
ls -lh

# You should see:
# - FGA Simulator Setup 1.0.0.exe    (Windows installer)
# - FGA Simulator 1.0.0.exe          (Windows portable)
# - FGA Simulator-1.0.0.AppImage     (Linux)
# - fga-ac-simulator-electron_1.0.0_amd64.deb (Linux)
```

---

## 🧪 Testing Windows Builds

### Option 1: Windows VM
- Use VirtualBox or VMware
- Install Windows 10/11
- Copy the .exe files and test

### Option 2: Wine (for quick testing only)
```bash
sudo apt install wine64
wine "dist/FGA Simulator 1.0.0.exe"
```
**Note:** Wine testing is not a substitute for real Windows testing!

### Option 3: Windows Machine
- Transfer files via USB, network, or cloud
- Test on actual Windows hardware

---

## 🔧 Troubleshooting

### "Docker command not found"
```bash
sudo apt install docker.io
```

### "Permission denied" on Docker
```bash
sudo usermod -aG docker $USER
# Log out and log back in
```

### "Permission denied" on build.sh
```bash
chmod +x build.sh
```

### Build takes too long
First build downloads the Docker image (~1GB) and takes 5-10 minutes.
Subsequent builds are much faster (1-2 minutes).

### "No space left on device"
```bash
# Clean up Docker images
docker system prune -a

# Check disk space
df -h
```

---

## 💡 Tips

1. **First Build:** Takes longer due to Docker image download
2. **Incremental Builds:** Much faster after the first time
3. **Clean Builds:** Delete `dist/` folder before building
4. **Parallel Builds:** Docker handles this automatically
5. **CI/CD:** This same method works great in GitHub Actions!

---

## 🎯 Comparison: Docker vs Wine

| Feature | Docker | Wine |
|---------|--------|------|
| Setup Complexity | Easy | Medium |
| System Pollution | None | Some |
| Build Reliability | High | Medium |
| Speed | Fast | Fast |
| Maintenance | Low | Medium |
| Cross-Platform | Yes | Limited |

**Recommendation:** Use Docker! 🐳

---

## 📝 Alternative: GitHub Actions

If you don't want to build locally, you can use GitHub Actions to build automatically:

```yaml
# .github/workflows/build.yml
name: Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: builds
          path: dist/
```

This builds on every push and provides downloadable artifacts!

---

## 🎉 Success!

You now have Windows executables built from Linux without Wine! 🚀

**Next Steps:**
1. Test the Windows builds on a real Windows machine
2. Consider code signing for production
3. Set up auto-updates with `electron-updater`
4. Distribute via GitHub Releases or your preferred method
