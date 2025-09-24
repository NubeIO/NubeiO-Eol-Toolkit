# 📦 FGA_Simulator_source.tar.gz - Quick Deployment Guide

## ✅ What's Included (193KB Archive)
- ✅ All Go source code (`app.go`, `main.go`)
- ✅ Frontend React code (`frontend/src/`)
- ✅ Configuration files (`wails.json`, `package.json`, `go.mod`)
- ✅ Complete documentation (`README.md`, `OFFICE_SETUP.md`, `PROJECT_SUMMARY.md`)
- ✅ All essential project files

## ❌ What's Excluded (to keep size small)
- ❌ `node_modules/` (413MB) - will be downloaded fresh
- ❌ `build/` directory - will be created during build
- ❌ `dist/` directory - will be created during build

## 🚀 Office PC Setup (5 minutes)

### Step 1: Extract Archive
```bash
# Copy FGA_Simulator_source.tar.gz to your office PC
# Then extract:
tar -xzf FGA_Simulator_source.tar.gz
cd FGA_Simulator
```

### Step 2: Install Dependencies (First time only)
```bash
# Install Go 1.21+
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
export PATH=$PATH:~/go/bin
```

### Step 3: Build Application
```bash
# This will automatically download node_modules and build everything
wails build

# The executable will be created at: ./build/bin/FGA_Simulator
```

### Step 4: Setup Serial Access
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# IMPORTANT: Log out and log back in after this command
```

### Step 5: Run Application
```bash
# After logging back in:
./build/bin/FGA_Simulator
```

## ✅ Why This Will Work

### Complete Source Code ✅
- All protocol implementation is in `app.go`
- All UI code is in `frontend/src/`
- All configuration files included

### Automatic Dependency Resolution ✅
- `wails build` will automatically:
  - Download all Go dependencies (`go mod download`)
  - Install npm packages (`npm install`)
  - Build the frontend
  - Compile the Go backend
  - Create the final executable

### Verified Working ✅
- Same source code that's currently working
- All Fujitsu protocol implementation intact
- Complete frame parsing and object processing
- Power control commands working: `0x1000` → `0x0001`/`0x0000`

## 🔧 What Happens During Build

```bash
wails build
```

This single command will:
1. **Check Go environment** ✅
2. **Download Go modules** (from `go.mod`) ✅
3. **Install Node.js packages** (from `package.json`) ✅
4. **Build React frontend** ✅
5. **Compile Go backend** ✅
6. **Create executable** at `./build/bin/FGA_Simulator` ✅

## 📊 Expected Build Output
```
Wails CLI v2.10.2
• Generating bindings: Done.
• Installing frontend dependencies: Done.
• Compiling frontend: Done.
• Compiling application: Done.
• Packaging application: Done.
Built './build/bin/FGA_Simulator' in X.XXXs.
```

## 🎯 Final Verification

After build, you should see:
```bash
ls -la build/bin/FGA_Simulator
# -rwxr-xr-x 1 user user XXXXXXX FGA_Simulator

./build/bin/FGA_Simulator
# FGA Simulator started
# Successfully connected to serial port...
```

## 📞 If You Need Help

1. **Check `OFFICE_SETUP.md`** for detailed troubleshooting
2. **All documentation is in the archive**
3. **Working configuration is preserved**

---

**🎉 The 193KB archive contains everything needed for a complete rebuild!**
