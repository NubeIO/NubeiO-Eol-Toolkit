# Windows Build Setup Guide

## ✅ Setup Completed!

Your Windows machine is now set up to build the Electron app.

## 📋 Current Setup Status

- ✅ Node.js installed (v16.20.0)
- ✅ npm installed (v8.19.4)
- ✅ Dependencies installed in `electron-app/`
- ✅ electron and electron-builder ready

## ⚠️ Important Note

Your Node.js version (v16.20.0) is older than what some dependencies require:
- **serialport** requires Node.js >= 20.0.0
- **@serialport/bindings-cpp** requires Node.js >= 18.0.0

### Recommendation: Update Node.js

To avoid potential issues, it's recommended to update to Node.js LTS (v20 or v22):

1. Download Node.js from: https://nodejs.org/
2. Install the LTS version (v20.x or v22.x)
3. Restart your terminal
4. Run: `cd electron-app; npm install` again

## 🚀 Build Commands

### For Windows (Current Machine):

```powershell
# Navigate to electron-app directory
cd electron-app

# Build Windows portable executable
npm run build:win

# Or build for all platforms
npm run build:all
```

### Expected Output:

After running `npm run build:win`, you'll find:
- `dist/FGA Simulator 1.0.0.exe` - Windows portable executable
- `dist/win-unpacked/` - Unpacked version for testing

## 🧪 Testing the Build

### Option 1: Run the portable executable
```powershell
cd electron-app/dist
.\FGA Simulator 1.0.0.exe
```

### Option 2: Run in development mode (before building)
```powershell
cd electron-app
npm start
```

## 📦 Build Options

### Windows Only:
```powershell
npm run build:win
```

### Linux Only (requires WSL or Docker):
```powershell
npm run build:linux
```

### Both Windows and Linux:
```powershell
npm run build:all
```

## 🔧 Troubleshooting

### Issue: "electron-builder command not found"
**Solution:** Run `npm install` in the electron-app directory

### Issue: Build fails with serialport errors
**Solution:** Update Node.js to v20 or newer

### Issue: "EPERM: operation not permitted"
**Solution:** Close any running instances of the app and try again

### Issue: Antivirus blocking the build
**Solution:** Add `electron-app/dist/` to your antivirus exclusions

## 📁 Project Structure

```
electron-app/
├── main.js              # Electron main process
├── preload.js           # Preload script
├── renderer/            # UI files
├── services/            # Backend services (MQTT, UDP, TCP)
├── tools/               # ESP32 flashing tools
├── config/              # Configuration files
├── package.json         # Project dependencies
└── dist/                # Build output (created after build)
```

## 🎯 Next Steps

1. **Update Node.js** (recommended)
2. **Run `npm run build:win`** to create Windows executable
3. **Test the executable** from the `dist/` folder
4. **Distribute** the portable .exe file

## 💡 Tips

- First build takes longer (~2-5 minutes)
- Subsequent builds are faster
- The portable .exe is self-contained and doesn't require installation
- You can run the .exe on any Windows machine without installing dependencies

## 🆘 Need Help?

Check the other documentation files:
- `BUILD.md` - General build instructions
- `README.md` - Project overview
- `USER_GUIDE.md` - How to use the application

