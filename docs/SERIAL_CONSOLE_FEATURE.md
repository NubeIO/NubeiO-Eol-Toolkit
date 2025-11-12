# Serial Console Feature

## Overview

The Serial Console feature provides direct serial port communication with ESP32 devices for real-time monitoring, debugging, and command execution. This is an essential tool for developers working with ESP32 firmware.

## Features

### Backend Service (`services/serial-console.js`)
- ✅ **Serial Port Management**
  - List available serial ports with device information
  - Connect/disconnect with configurable baud rates (9600-921600)
  - Automatic port detection and manufacturer identification
  
- ✅ **Real-Time Communication**
  - Stream messages from ESP32 in real-time
  - Send commands to ESP32 via serial
  - Line-based parsing with ReadlineParser
  - Message buffering (up to 1000 messages)
  
- ✅ **Error Handling**
  - Graceful error handling for port operations
  - Automatic cleanup on disconnect
  - Error messages displayed in console
  - System notifications for connection status

### Frontend Module (`renderer/modules/SerialConsoleModule.js`)
- ✅ **User Interface**
  - Port selection dropdown with auto-detection
  - Baud rate selector (8 common rates)
  - Real-time message display with timestamps
  - Auto-scroll to latest messages
  - Message counter showing total messages
  
- ✅ **Message Display**
  - Color-coded messages:
    - **Blue**: Sent commands (with `>` prefix)
    - **Red**: Error messages
    - **Green**: System notifications
    - **Black**: Received data
  - Monospace font for better readability
  - Timestamps for each message
  
- ✅ **Interactive Features**
  - Send command input with Enter key support
  - Clear messages functionality
  - Connect/Disconnect buttons
  - Refresh ports button
  - Input field disabled when not connected

### Integration
- ✅ **Main Process** (`main.js`)
  - IPC handlers for all serial operations
  - Message streaming via IPC events
  - Service initialization on app startup
  
- ✅ **Preload Script** (`preload.js`)
  - Exposed serial console APIs to renderer
  - Safe IPC communication bridge
  
- ✅ **Application UI** (`renderer/app.js`)
  - Serial Console tab in navigation
  - Keyboard shortcut: **Ctrl+3**
  - Auto-initialization on app load
  - Page switching logic
  
- ✅ **Menu System**
  - Menu item: View → Serial Console
  - Keyboard accelerator: Ctrl+3
  
- ✅ **Configuration** (`config/features.json`)
  - Feature flag for enabling/disabling
  - Description and metadata

## Usage

### How to Use Serial Console

1. **Open Serial Console**
   - Click "🔌 Serial Console" button in navigation
   - Or use keyboard shortcut: **Ctrl+3**
   - Or select from menu: View → Serial Console

2. **Connect to ESP32**
   - Select serial port from dropdown (e.g., `/dev/ttyUSB0` on Linux)
   - Choose baud rate (default: 115200)
   - Click "🔌 Connect" button
   - Green indicator shows connected status

3. **Monitor Messages**
   - Real-time messages appear with timestamps
   - Auto-scrolls to latest messages
   - Color-coded for easy identification
   - Supports ANSI escape codes

4. **Send Commands**
   - Type command in input field
   - Press Enter or click "Send" button
   - Sent commands appear in blue with `>` prefix

5. **Disconnect**
   - Click "🔌 Disconnect" button when done
   - Port becomes available for other applications

## Common Use Cases

### 1. Debugging ESP32 Firmware
```
> help
Available commands: status, reset, info
> status
WiFi: Connected, IP: 192.168.1.100
MQTT: Connected to broker
Uptime: 1234 seconds
```

### 2. Viewing Boot Logs
```
ESP-ROM:esp32s3-20210327
Build:Mar 27 2021
rst:0x1 (POWERON),boot:0x18 (SPI_FAST_FLASH_BOOT)
...
I (123) main: Starting application
```

### 3. AT Command Testing
```
> AT
OK
> AT+GMR
AT version:2.1.0.0
OK
```

### 4. Interactive Debugging
```
> test sensors
Temperature: 25.3°C
Humidity: 65%
Pressure: 1013 hPa
OK
```

## Technical Details

### Serial Port Configuration
- **Default Baud Rate**: 115200
- **Supported Baud Rates**: 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600
- **Data Bits**: 8
- **Parity**: None
- **Stop Bits**: 1
- **Flow Control**: None

### Message Buffer
- **Max Messages**: 1000 (configurable)
- **Auto-Pruning**: Oldest messages removed when limit reached
- **Memory Efficient**: Prevents memory leaks during long sessions

### Architecture
```
┌─────────────────┐
│   ESP32 Device  │
└────────┬────────┘
         │ USB Serial
         │
┌────────▼────────────────────────────────────┐
│  Electron Main Process                      │
│  ┌──────────────────────────────────────┐  │
│  │ serial-console.js Service            │  │
│  │ - SerialPort management              │  │
│  │ - ReadlineParser for messages        │  │
│  │ - Message buffering & callbacks      │  │
│  └──────────────┬───────────────────────┘  │
│                 │ IPC                       │
│  ┌──────────────▼───────────────────────┐  │
│  │ main.js IPC Handlers                 │  │
│  │ - serial:connect                     │  │
│  │ - serial:disconnect                  │  │
│  │ - serial:send                        │  │
│  │ - serial:getMessages                 │  │
│  └──────────────┬───────────────────────┘  │
└─────────────────┼───────────────────────────┘
                  │ IPC Bridge (preload.js)
┌─────────────────▼───────────────────────────┐
│  Electron Renderer Process                  │
│  ┌──────────────────────────────────────┐  │
│  │ SerialConsoleModule.js               │  │
│  │ - UI rendering                       │  │
│  │ - Message display                    │  │
│  │ - User interactions                  │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │ app.js Main App                      │  │
│  │ - Page routing                       │  │
│  │ - Module initialization              │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Dependencies

- **serialport**: Serial port communication library
- **@serialport/parser-readline**: Line-based message parsing
- Included in: `package.json` (already installed)

## Future Enhancements

Potential improvements for future versions:

1. **Save Session Logs**
   - Export messages to file (TXT, CSV, JSON)
   - Auto-save feature like UDP Logger
   
2. **Command History**
   - Up/Down arrows to recall previous commands
   - Command autocomplete
   
3. **Custom Baud Rates**
   - Allow manual input for non-standard rates
   
4. **Hex View Mode**
   - Display raw bytes in hexadecimal
   - Binary protocol debugging
   
5. **Multiple Port Support**
   - Connect to multiple serial ports simultaneously
   - Tabbed interface for each connection
   
6. **Macros & Scripts**
   - Predefined command sequences
   - Automated testing scripts

## Troubleshooting

### Port Not Found
- **Issue**: Selected port doesn't appear in dropdown
- **Solution**: 
  - Check USB cable connection
  - Ensure ESP32 is powered
  - Click refresh button (🔄)
  - Check port permissions on Linux: `sudo usermod -a -G dialout $USER`

### Permission Denied
- **Issue**: "Failed to open port: Permission denied"
- **Solution** (Linux):
  ```bash
  sudo usermod -a -G dialout $USER
  # Log out and log back in for changes to take effect
  ```

### Messages Not Appearing
- **Issue**: Connected but no messages displayed
- **Solution**:
  - Verify correct baud rate (check ESP32 firmware)
  - Ensure ESP32 is sending data
  - Check serial monitor in Arduino IDE for comparison

### Port Already in Use
- **Issue**: "Port is already open"
- **Solution**:
  - Close other serial monitor applications
  - Disconnect from flasher/provisioning tabs
  - Restart application if needed

## Comparison with Other Tools

| Feature | FGA Serial Console | Arduino IDE | PuTTY | screen |
|---------|-------------------|-------------|-------|--------|
| GUI | ✅ Modern UI | ✅ Basic | ✅ Windows | ❌ CLI |
| Auto-scroll | ✅ Yes | ✅ Yes | ⚠️ Limited | ✅ Yes |
| Color coding | ✅ Yes | ❌ No | ⚠️ Limited | ⚠️ Limited |
| Timestamps | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Message history | ✅ 1000 msgs | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited |
| Integration | ✅ Built-in | ❌ Separate | ❌ Separate | ❌ Separate |
| Cross-platform | ✅ Yes | ✅ Yes | ❌ Windows | ✅ Unix |

## Files Modified/Created

### New Files
- `electron-app/services/serial-console.js` (247 lines)
- `electron-app/renderer/modules/SerialConsoleModule.js` (370 lines)

### Modified Files
- `electron-app/main.js` (+58 lines)
- `electron-app/preload.js` (+11 lines)
- `electron-app/renderer/app.js` (+24 lines)
- `electron-app/renderer/index.html` (+1 line)
- `electron-app/config/features.json` (+4 lines)
- `electron-app/package.json` (+1 dependency)
- `electron-app/package-lock.json` (dependency update)

**Total**: 9 files changed, 715 insertions, 2 deletions

## Git Commit

```bash
commit 847c699
Author: AI Assistant
Date: Mon Oct 13 11:36:00 2025 +07

    Add Serial Console feature for ESP32 debugging
```

## Testing Checklist

- ✅ Serial port detection and listing
- ✅ Connect/disconnect functionality
- ✅ Message receiving and display
- ✅ Send commands to ESP32
- ✅ Color-coded message types
- ✅ Timestamp display
- ✅ Auto-scroll behavior
- ✅ Clear messages function
- ✅ Port refresh functionality
- ✅ Baud rate selection
- ✅ Keyboard shortcuts (Ctrl+3)
- ✅ Menu navigation
- ✅ UI responsiveness
- ✅ Error handling
- ✅ Memory management (1000 msg buffer)

## Support

For issues or questions about the Serial Console feature:
1. Check this documentation
2. Review Troubleshooting section
3. Check Git commit history for implementation details
4. Test with Arduino IDE serial monitor for comparison

---

**Version**: 1.0.0  
**Date**: October 13, 2025  
**Status**: ✅ Production Ready

