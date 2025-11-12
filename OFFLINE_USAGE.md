# Offline Usage Guide

The FGA AC Simulator Electron app is designed to work **completely offline** without requiring internet access or additional software installation.

## ✅ What Works Offline

### 1. ESP32 Firmware Flasher ⚡
- Flash ESP32 devices via USB
- No Python installation required
- No pip or esptool installation needed
- Bundled esptool v4.7.0 for Windows and Linux
- Works in air-gapped environments

### 2. MQTT Communication
- Connect to local MQTT broker
- Simulate AC devices
- Control devices over local network
- No cloud connection required

### 3. UDP Logger
- Log messages from devices
- Save logs locally
- Real-time auto-save
- Export to TXT/JSON/CSV

### 4. TCP Console
- Direct TCP connection to devices
- Send commands
- View responses
- Works on local network

## 🚀 Quick Start (Offline)

### Prerequisites

**None!** Everything is bundled with the app.

### Linux Installation

1. Download the AppImage or .deb file
2. Make it executable:
   ```bash
   chmod +x FGA_Simulator-*.AppImage
   ```
3. Run it:
   ```bash
   ./FGA_Simulator-*.AppImage
   ```

**Or install the .deb:**
```bash
sudo dpkg -i FGA_Simulator-*.deb
```

### Windows Installation

1. Download the installer (.exe) or portable (.exe)
2. Run the installer
3. Launch from Start Menu or Desktop

**Portable version:**
- No installation needed
- Just run the .exe file
- Works from USB drive

## 📦 What's Bundled

The application includes:

| Component | Size | Purpose |
|-----------|------|---------|
| esptool (Linux) | ~61 MB | Flash ESP32 on Linux |
| esptool (Windows) | ~30 MB | Flash ESP32 on Windows |
| Electron Runtime | ~150 MB | Application framework |
| Node.js modules | ~20 MB | MQTT, SerialPort, etc. |
| **Total** | **~260 MB** | Complete offline package |

## 🔧 USB Permissions (Linux Only)

### One-Time Setup

Add your user to the `dialout` group to access USB ports:

```bash
sudo usermod -a -G dialout $USER
```

**Log out and log back in** for changes to take effect.

### Temporary Permission (Quick Fix)

If you need immediate access:

```bash
sudo chmod 666 /dev/ttyUSB0  # or your port
sudo chmod 666 /dev/ttyACM0
```

### Verify Permissions

Check if you have access:

```bash
ls -l /dev/ttyUSB*
ls -l /dev/ttyACM*
```

You should see `crw-rw-rw-` or your user in the group.

## 💻 System Requirements

### Minimum Requirements

| Component | Linux | Windows |
|-----------|-------|---------|
| OS | Ubuntu 20.04+ / Debian 11+ | Windows 10/11 (64-bit) |
| RAM | 2 GB | 2 GB |
| Disk Space | 500 MB | 500 MB |
| USB | USB 2.0+ ports | USB 2.0+ ports |

### Recommended

- 4 GB RAM
- 1 GB free disk space
- USB 3.0 ports for faster data transfer

## 🌐 Network Configuration (Optional)

### MQTT Broker

If you want MQTT functionality:

1. Install Mosquitto locally:
   ```bash
   # Ubuntu/Debian
   sudo apt install mosquitto
   
   # Start service
   sudo systemctl start mosquitto
   ```

2. Configure in app:
   - Broker: `localhost` or local IP
   - Port: `1883` (default)

### No Internet Required

- MQTT broker can be on local network
- No cloud services needed
- All communication is local

## 🔌 ESP32 Flashing (Offline)

### Step-by-Step Guide

1. **Connect ESP32**
   - Plug ESP32 into USB port
   - Wait for system to recognize it

2. **Open Flasher**
   - Click **⚡ ESP32 Flasher** tab
   - Click **🔄 Refresh Ports**

3. **Select Port**
   - Choose your ESP32 from dropdown
   - Usually `/dev/ttyACM0` (Linux) or `COM3` (Windows)

4. **Select Firmware**
   - Click **📁 Browse Firmware**
   - Choose your `.bin` or `.elf` file

5. **Flash!**
   - Click **⚡ FLASH ESP32 FIRMWARE**
   - Wait 1-2 minutes
   - Done! ✅

### Bundled esptool Features

- ✅ Auto-detects platform (Linux/Windows)
- ✅ Sets executable permissions automatically
- ✅ No Python installation needed
- ✅ No pip packages needed
- ✅ Works in corporate/restricted networks
- ✅ Works on fresh OS installs
- ✅ Consistent version (v4.7.0)
- ✅ Tested and stable

## 📁 Offline File Locations

### Application Data

**Linux:**
```
~/.config/fga-ac-simulator-electron/
├── mqtt_config.json
├── device_state.json
└── logs/
```

**Windows:**
```
C:\Users\YourName\AppData\Roaming\fga-ac-simulator-electron\
├── mqtt_config.json
├── device_state.json
└── logs\
```

### Saved Logs

Wherever you choose to save them:
- UDP logs (.txt, .json, .csv)
- Flash logs
- Application logs

## 🛠️ Troubleshooting (Offline)

### ESP32 Not Detected

1. Check USB cable (must support data, not just power)
2. Try different USB port
3. Check permissions (Linux):
   ```bash
   ls -l /dev/ttyUSB*
   ls -l /dev/ttyACM*
   ```
4. Add user to dialout group (see above)

### Flash Failed

1. Hold **BOOT** button on ESP32 during flash
2. Try lower baud rate (115200)
3. Enable **Erase Flash** option
4. Check firmware file integrity

### esptool Not Found

**This shouldn't happen!** esptool is bundled.

If it does:
1. Reinstall the application
2. Check `tools/esptool/` directory exists
3. On Linux, check execute permissions:
   ```bash
   chmod +x ~/.config/fga-ac-simulator-electron/tools/esptool/esptool-linux-amd64/esptool
   ```

### MQTT Connection Failed

1. Check if Mosquitto is running:
   ```bash
   sudo systemctl status mosquitto
   ```
2. Try `localhost` instead of IP address
3. Check firewall settings
4. Verify port 1883 is not in use

## 🏢 Enterprise/Air-Gapped Deployment

### Installation Media

1. Download installer on internet-connected machine
2. Copy to USB drive
3. Install on air-gapped machine
4. Works without internet!

### USB Distribution

**Portable Windows Version:**
```
USB Drive/
├── FGA_Simulator-portable.exe
├── firmware/
│   ├── esp32-v1.0.bin
│   └── esp32-v2.0.bin
└── README.txt
```

Just run from USB - no installation needed!

### Verified Offline Environments

✅ Corporate networks (no external access)
✅ Military/government air-gapped systems
✅ Manufacturing floors (isolated networks)
✅ Remote locations (no internet)
✅ Testing labs (controlled environments)

## 📋 Pre-Installation Checklist

Before deploying to offline environment:

- [ ] Download correct installer for your OS
- [ ] Download required firmware files
- [ ] Prepare USB cable for ESP32
- [ ] Note: No antivirus conflicts on Windows
- [ ] Verify disk space (500 MB minimum)
- [ ] On Linux: Plan to add user to dialout group
- [ ] Optional: Install local MQTT broker

## 🎯 Common Offline Scenarios

### Scenario 1: Factory Floor

**Requirements:** Flash ESP32 devices in production
**Solution:** Use portable Windows version on USB drive
**Network:** None required
**Works:** ✅ Yes, completely offline

### Scenario 2: Field Service

**Requirements:** Update firmware at customer sites
**Solution:** Laptop with AppImage + firmware files
**Network:** None required
**Works:** ✅ Yes, carry everything on laptop

### Scenario 3: Development Lab

**Requirements:** Test and flash prototypes
**Solution:** Install on dev machine + local MQTT
**Network:** Local network only
**Works:** ✅ Yes, all features work locally

### Scenario 4: Corporate IT

**Requirements:** No external downloads allowed
**Solution:** Download installer once, distribute internally
**Network:** Corporate intranet only
**Works:** ✅ Yes, no internet needed after install

## 🔒 Security Benefits of Offline

- ✅ No data sent to cloud
- ✅ No telemetry or analytics
- ✅ No automatic updates (controlled)
- ✅ No external dependencies
- ✅ Works in restricted networks
- ✅ Compliant with air-gap policies
- ✅ Full control over updates

## 📞 Support (Offline-Friendly)

Since you're offline, use these local resources:

1. **Built-in Help**: Click help buttons in app
2. **README Files**: Check installation directory
3. **Documentation**: Included in installation
4. **Logs**: Check application logs for errors

## ✨ Summary

The FGA AC Simulator is designed for **complete offline operation**:

- ✅ No internet required
- ✅ No Python/pip installation needed
- ✅ No external dependencies
- ✅ Bundled esptool for flashing
- ✅ Works on fresh OS installs
- ✅ Air-gap compatible
- ✅ USB-distributable
- ✅ Enterprise-ready

**Just install and go!** 🚀

