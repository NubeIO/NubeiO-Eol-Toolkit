# FGA AC Simulator - Electron + React Version

A desktop application built with Electron and React for simulating Fujitsu Air Conditioner units via MQTT protocol. This version uses the same React UI as the Wails version for consistency.

## Features

- ⚛️ **React UI** - Same React components as Wails version
- 🌐 **MQTT Communication** - Connect to MQTT broker for device control
- 🔍 **Auto-Discovery** - Automatically discover ESP32 AC devices
- 🎛️ **Multi-Device Control** - Control multiple AC units simultaneously
- 📊 **Real-time Status** - Live device state updates
- 💾 **Config Persistence** - Broker settings saved automatically
- 🖥️ **Cross-Platform** - Works on Linux, Windows, and macOS

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MQTT Broker (e.g., Mosquitto)

## Installation

```bash
# Navigate to project directory
cd FGA-AC-Simulator-Electron

# Install dependencies
npm install
```

## Development

```bash
# Run in development mode (React dev server + Electron)
npm run dev

# Or run directly
npm start
```

## Building

```bash
# Build React app and package Electron
npm run build

# Build for specific platform
npm run build:linux
npm run build:win
npm run build:mac
```

## Project Structure

```
FGA-AC-Simulator-Electron/
├── main.js              # Electron main process (Node.js backend)
├── preload.js           # IPC bridge (secure communication)
├── src/                 # React application
│   ├── App.js           # Main React component (same as Wails)
│   ├── index.js         # React entry point
│   └── index.css        # Tailwind CSS
├── public/              # Static files
│   └── index.html       # HTML template
├── package.json         # Dependencies & scripts
└── README.md            # This file
```

## Configuration

The MQTT configuration is automatically saved to:
- **Linux**: `~/.config/fga-ac-simulator-electron/mqtt_config.json`
- **Windows**: `%APPDATA%/fga-ac-simulator-electron/mqtt_config.json`
- **macOS**: `~/Library/Application Support/fga-ac-simulator-electron/mqtt_config.json`

Default settings:
- **Broker**: localhost
- **Port**: 1883
- **Device ID**: Auto-generated (AC_SIM_XXXXXX)

## Usage

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Configure MQTT Connection**
   - Click the "⚙️ Config" button
   - Enter your MQTT broker address and port
   - Click "Save & Connect"
   - Settings are automatically saved

3. **Control Devices**
   - Discovered ESP32 devices appear as cards
   - Click controls to send commands
   - Power, Mode, Temperature, and Fan Speed controls available

## Key Differences from Wails Version

### Similarities
✅ **Same React UI** - Identical look and feel
✅ **Same functionality** - All features work the same
✅ **Same MQTT topics** - Compatible with same devices

### Architecture
- **Backend**: Node.js (Electron) vs Go (Wails)
- **IPC**: `window.electronAPI` vs `window.go.main.App`
- **Config Storage**: JSON file vs Go config

### Advantages of Electron Version
✅ Mature ecosystem with extensive npm packages
✅ Better cross-platform support
✅ Full Chrome DevTools for debugging
✅ Hot reload in development
✅ Easier for web developers

### Advantages of Wails Version
✅ Smaller binary size (~20MB vs ~100MB)
✅ Better performance
✅ No Node.js runtime needed
✅ Single executable file

## Development Tips

### Hot Reload
In development mode, React changes are hot-reloaded automatically:
```bash
npm run dev
```

### Debugging
- **React**: Use Chrome DevTools (opens automatically in dev mode)
- **Main Process**: Check terminal output
- **IPC**: Console.log in both processes

### Building for Production
```bash
# Build React app
npm run build:react

# Package Electron app
npm run build:electron

# Or do both
npm run build
```

## Troubleshooting

### Config Not Persisting
- Check file permissions in app data directory
- Verify `mqtt_config.json` is being created
- Try deleting config file and reconnecting

### Connection Issues
- Ensure MQTT broker is running
- Check firewall settings
- Verify broker address and port in config

### Device Not Appearing
- Ensure ESP32 devices publish to `ac_sim/discovery`
- Check MQTT topic subscriptions
- Verify network connectivity

## MQTT Topics

### Subscribed
- `ac_sim/discovery` - Device discovery
- `ac_sim/+/state` - Device state updates
- `ac_sim/{device_id}/control` - Device control
- `ac_sim/all/control` - Broadcast control

### Published
- `ac_sim/{device_id}/state` - Simulator status
- `ac_sim/{device_id}/control` - Control commands

## License

MIT

## Author

Nube IO