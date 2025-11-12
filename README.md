# FGA Simulator - Electron Edition

A cross-platform desktop application for simulating and controlling Fujitsu Air Conditioner systems via MQTT. Built with Electron, Node.js, and Vanilla JavaScript.

## 🎯 Features

### Core Functionality
- **Multi-Device Control**: Monitor and control multiple AC devices simultaneously
- **MQTT Communication**: Full MQTT integration for remote control and monitoring
- **UDP Logging**: Real-time UDP log viewer on port 56789 with zero-flicker terminal display
- **Device Discovery**: Automatic detection of ESP32-based AC devices
- **Config Persistence**: MQTT settings saved locally using electron-store
- **Modern UI**: Clean, responsive interface with Tailwind CSS

### Device Control
- Power on/off
- Mode selection (Auto, Cool, Dry, Fan, Heat)
- Temperature adjustment (16-30°C)
- Fan speed control (Auto, Low, Med, Hi)
- Swing function
- Room temperature injection for testing

### UDP Logger
- Real-time log display from UDP port 56789
- ANSI color code stripping for clean output
- Automatic log buffering (last 1000 logs)
- Zero-flicker incremental DOM updates
- Scroll position preservation
- Clear logs functionality

## 📦 Prerequisites

- **Node.js**: 16+ and npm
- **MQTT Broker**: Mosquitto, EMQX, or cloud MQTT service
- **Docker** (optional): For cross-platform builds

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd FGA-AC-Simulator
git checkout electron

# Navigate to electron app
cd electron-app

# Install dependencies
npm install
```

### Development

```bash
# Start the application in development mode
npm start

# Or use the dev script
npm run dev
```

### Building

#### Build for Linux (Current Platform)
```bash
npm run build
```

**Output:**
- `dist/FGA Simulator-1.0.0.AppImage` - Portable Linux application
- `dist/fga-ac-simulator-electron_1.0.0_amd64.deb` - Debian/Ubuntu package

#### Build for Windows (Using Docker)
```bash
# Build for Windows using Docker (no Wine required)
./build.sh

# Or manually
npm run build:all
```

**Output:**
- `dist/FGA Simulator Setup 1.0.0.exe` - Windows installer (NSIS)
- `dist/FGA Simulator 1.0.0.exe` - Windows portable executable
- `dist/FGA Simulator-1.0.0.AppImage` - Linux AppImage
- `dist/fga-ac-simulator-electron_1.0.0_amd64.deb` - Debian package

#### Platform-Specific Builds
```bash
# Linux only
npm run build:linux

# Windows only (requires Docker)
npm run build:win

# All platforms (requires Docker)
npm run build:all
```

## 🔧 Configuration

### MQTT Settings

The application stores MQTT configuration locally. Configure via the UI:

1. Click the **⚙️ Config** button
2. Enter MQTT broker details:
   - **Broker**: Hostname or IP address (e.g., `113.160.225.31`)
   - **Port**: MQTT port (default: `1883`)
   - **Device ID**: Unique identifier for this simulator
3. Click **Save Config**
4. Click **Connect**

**Default Configuration:**
```json
{
  "broker": "localhost",
  "port": 1883,
  "deviceId": "ac_sim_simulator_<random>"
}
```

### UDP Logger

The UDP logger automatically starts on port **56789** and listens for UDP packets from ESP32 devices.

**ESP32 Configuration:**
```c
// Send logs to simulator
udp_send("192.168.1.100", 56789, log_message);
```

## 📱 Usage

### Main Interface

#### 🏠 Devices Tab
- View all discovered AC devices in a card-based grid layout
- Each card shows:
  - Device ID (shortened, e.g., `01C0073C` from `AC_SIM_01C0073C`)
  - Current state (Power, Mode, Temperature, Fan Speed)
  - Control buttons for individual device management

#### 📡 UDP Logs Tab
- Real-time log viewer for UDP packets
- Terminal-style display with:
  - Timestamp
  - Source IP:Port
  - Log message (ANSI codes stripped)
- **Clear Logs** button to reset the buffer
- Automatic scroll position preservation

### Device Control

**Power Control:**
- Click **ON** or **OFF** button

**Mode Selection:**
- Auto, Cool, Dry, Fan, Heat

**Temperature:**
- Use **-** and **+** buttons (16-30°C)

**Fan Speed:**
- Auto, Low, Med, Hi

### Device Discovery

Devices announce themselves via MQTT:

**Discovery Topic:** `ac_sim/discovery`

**Discovery Message:**
```json
{
  "deviceId": "AC_SIM_01C0073C",
  "timestamp": "2025-10-07T09:00:00Z",
  "capabilities": {
    "power": true,
    "mode": true,
    "temperature": true,
    "fanSpeed": true,
    "swing": true
  }
}
```

## 🔌 MQTT Topics

### Device-Specific Topics

#### State Updates
**Topic:** `ac_sim/{device_id}/state`

**Message:**
```json
{
  "timestamp": "2025-10-07T09:00:00Z",
  "deviceId": "AC_SIM_01C0073C",
  "data": {
    "power": true,
    "mode": "Cool",
    "temperature": 22.0,
    "fanSpeed": "Auto",
    "swing": false,
    "currentTemp": 24.5
  }
}
```

#### Control Commands
**Topic:** `ac_sim/{device_id}/control`

**Examples:**
```json
{"command": "power", "value": true}
{"command": "mode", "value": "Cool"}
{"command": "temperature", "value": 22.5}
{"command": "fanSpeed", "value": "Auto"}
{"command": "swing", "value": false}
{"command": "room_temperature", "value": 24.5}
```

### Broadcast Topics

#### Discovery
**Topic:** `ac_sim/discovery`

#### Broadcast Control
**Topic:** `ac_sim/all/control`

Controls all devices simultaneously.

## 🛠️ Architecture

### Main Process (`main.js`)
- **MQTTService**: Handles MQTT client, device discovery, and control
- **UDPLogger**: Listens on UDP port 56789 for log messages
- **Config Management**: Loads/saves MQTT configuration using electron-store
- **IPC Handlers**: Exposes backend functionality to renderer process

### Renderer Process (`renderer/app.js`)
- **Vanilla JavaScript**: No framework dependencies
- **State Management**: Local state for devices, config, and logs
- **DOM Manipulation**: Direct DOM updates for zero-flicker performance
- **Incremental Updates**: Only adds new logs without re-rendering entire list

### Preload Script (`preload.js`)
- **Context Bridge**: Secure API exposure to renderer
- **IPC Communication**: Safe method invocation between processes

## 🐳 Docker Build

For cross-platform builds without Wine:

```bash
# Build using Docker
./build.sh

# Or manually
docker build -f Dockerfile.build -t fga-simulator-builder .
docker run --rm -v "$(pwd)/dist:/project/dist" fga-simulator-builder
```

**Docker Image:** `electronuserland/builder:wine`

## 📝 Testing

### MQTT Testing

```bash
# Subscribe to all topics
mosquitto_sub -h 113.160.225.31 -t "ac_sim/#" -v

# Send control command
mosquitto_pub -h 113.160.225.31 -t "ac_sim/AC_SIM_01C0073C/control" \
  -m '{"command":"power","value":true}'

# Send discovery message
mosquitto_pub -h 113.160.225.31 -t "ac_sim/discovery" \
  -m '{"deviceId":"AC_SIM_TEST","timestamp":"2025-10-07T09:00:00Z"}'
```

### UDP Testing

```bash
# Send UDP log message
echo "Test log message" | nc -u localhost 56789

# Or using Python
python3 -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.sendto(b'Test log', ('localhost', 56789))"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. MQTT Connection Failed
- ✅ Check broker hostname and port
- ✅ Verify broker is running: `mosquitto -v`
- ✅ Check firewall settings
- ✅ Test connection: `mosquitto_sub -h <broker> -t "#"`

#### 2. UDP Logger Not Receiving
- ✅ Check if port 56789 is available: `netstat -an | grep 56789`
- ✅ Verify firewall allows UDP on port 56789
- ✅ Check ESP32 is sending to correct IP address

#### 3. Config Not Persisting
- ✅ Check file permissions in config directory
- ✅ Config stored in: `~/.config/fga-ac-simulator-electron/`
- ✅ Clear config: `rm -rf ~/.config/fga-ac-simulator-electron/`

#### 4. Build Errors

**Linux:**
```bash
# Install build dependencies
sudo apt-get install build-essential
```

**Windows (Docker):**
```bash
# Ensure Docker is running
docker --version

# Pull builder image
docker pull electronuserland/builder:wine
```

#### 5. Hardware Acceleration Errors
```
libva error: vaGetDriverNameByIndex() failed
```

**Solution:** Already disabled in `main.js`:
```javascript
app.disableHardwareAcceleration();
```

### Logs

**Application Logs:**
- Displayed in terminal when running `npm start`
- MQTT connection status
- UDP logger status
- Device discovery events

**Electron DevTools:**
- Press `Ctrl+Shift+I` (Linux/Windows) or `Cmd+Option+I` (macOS)
- View console logs, network activity, and errors

## 📚 Project Structure

```
electron-app/
├── main.js                 # Main process (Node.js)
├── preload.js             # Preload script (context bridge)
├── renderer/
│   ├── index.html         # Main HTML file
│   └── app.js             # Renderer process (Vanilla JS)
├── package.json           # Dependencies and scripts
├── Dockerfile.build       # Docker build configuration
├── build.sh              # Cross-platform build script
├── .dockerignore         # Docker ignore patterns
├── BUILD.md              # Detailed build instructions
├── WINDOWS_BUILD.md      # Windows-specific build guide
└── README.md             # This file
```

## 🔄 Version History

### v1.0.0 (Current)
- ✅ Multi-device MQTT control
- ✅ UDP logging on port 56789
- ✅ Zero-flicker terminal display
- ✅ Config persistence
- ✅ Cross-platform builds (Linux, Windows)
- ✅ Docker build support
- ✅ Device discovery
- ✅ Individual device control

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

Copyright © 2025 Nube IO. All rights reserved.

## 💬 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check documentation in `BUILD.md` and `WINDOWS_BUILD.md`

## 🙏 Acknowledgments

- **Electron**: Cross-platform desktop framework
- **MQTT.js**: MQTT client library
- **Tailwind CSS**: Utility-first CSS framework
- **electron-builder**: Build and packaging tool
- **electron-store**: Config persistence