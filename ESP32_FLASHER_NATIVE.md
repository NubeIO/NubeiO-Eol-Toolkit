# ESP32 Flasher - Native Binary Implementation

## Overview
The ESP32 flasher has been completely reimplemented using **native esptool binaries** instead of esptool-js. This approach is based on the proven NubeFlexTerm implementation and provides:

- ✅ **Automatic chip detection** (ESP32, ESP32-S2, ESP32-S3, ESP32-C3, etc.)
- ✅ **Reliable flashing** using official esptool binaries
- ✅ **Cross-platform support** (Linux & Windows)
- ✅ **Real-time progress updates**
- ✅ **No browser API dependencies**
- ✅ **Works offline**

## Architecture

### Backend (Node.js)
- **services/esp32-flasher-native.js**: Main flasher service
  - Extracts embedded esptool binary to temp directory
  - Spawns esptool process for flashing operations
  - Parses progress from esptool output
  - Handles chip detection

### Frontend (Renderer)
- **modules/ESP32FlasherModule.js**: UI interface
  - Uses IPC to communicate with backend
  - Receives real-time progress updates
  - Manages flasher state and UI

### IPC Communication
- **main.js**: IPC handlers
  - `flasher:getSerialPorts` - List available serial ports
  - `flasher:getStatus` - Get flasher status
  - `flasher:detectChip` - Detect ESP32 chip type
  - `flasher:flashFirmware` - Flash firmware
  - `flasher:cancelFlash` - Cancel flash operation
  - `flasher:showFirmwareDialog` - Show file picker
  - `flasher:progress` - Progress updates (event)

## Files

### Added
- `embedded/esptool-binaries/linux/esptool` (12MB) - Linux binary
- `embedded/esptool-binaries/windows/esptool.exe` (13MB) - Windows binary
- `services/esp32-flasher-native.js` - Native flasher service

### Modified
- `main.js` - Added IPC handlers and service initialization
- `preload.js` - Added IPC method exports
- `renderer/modules/ESP32FlasherModule.js` - Rewritten for backend IPC
- `renderer/index.html` - Cleaned up (removed esptool-js references)

### Removed/Deprecated
- `renderer/assets/esptool-js.bundle.js` - No longer needed
- `renderer/assets/esptool-wrapper.js` - No longer needed
- `renderer/assets/atob-shim.js` - No longer needed
- `services/esp32-flasher.js` - Old Python-based implementation (deprecated)
- `node_modules/esptool-js` - Can be uninstalled

## Usage

### For Users

1. **Select Serial Port**: Choose the ESP32's serial port from dropdown
2. **Select Firmware**: Browse and select `.bin` firmware file
3. **Configure Options**:
   - Baud Rate: 115200 (stable) / 460800 (fast) / 921600 (fastest)
   - Flash Address: Default 0x10000 for application
   - Erase Flash: Optional full flash erase
4. **Flash**: Click "Flash Firmware" button
5. **Monitor Progress**: Real-time progress bar with stage updates

### For Developers

**Initialize flasher**:
```javascript
const flasher = new ESP32FlasherModule(app);
```

**Detect chip**:
```javascript
const result = await flasher.detectChip('/dev/ttyUSB0');
// { success: true, chipType: 'ESP32-S3', output: '...' }
```

**Flash firmware**:
```javascript
const result = await flasher.flashFirmware({
  port: '/dev/ttyUSB0',
  firmwarePath: '/path/to/firmware.bin',
  baudRate: 460800,
  flashAddress: '0x10000',
  eraseFlash: true
});
```

**Monitor progress**:
```javascript
window.electronAPI.onFlasherProgress((progress) => {
  console.log(`Stage: ${progress.stage}`);
  console.log(`Progress: ${progress.progress}%`);
  console.log(`Message: ${progress.message}`);
});
```

## Progress Stages

1. **detecting** (5%) - Detecting chip type
2. **detected** (10%) - Chip detected successfully
3. **connecting** (15%) - Changing baud rate
4. **erasing** (20%) - Erasing flash (if enabled)
5. **writing** (20-95%) - Writing firmware
6. **verifying** (98%) - Verifying data
7. **complete** (100%) - Flash complete
8. **failed** (0%) - Operation failed

## Binary Extraction

The esptool binaries are embedded in the application and extracted on first run:

1. **Source**: `embedded/esptool-binaries/{platform}/esptool[.exe]`
2. **Destination**: `{tmpdir}/fga-simulator-esptool/esptool[.exe]`
3. **Permissions**: Automatically set executable on Linux (755)
4. **Testing**: Binary is tested with `version` command
5. **Caching**: Extracted binary is reused across app restarts

## Platform Support

### ✅ Linux
- Binary: `esptool` (12MB, Python standalone executable)
- Tested on: Ubuntu 20.04+
- Serial ports: `/dev/ttyUSB*`, `/dev/ttyACM*`

### ✅ Windows
- Binary: `esptool.exe` (13MB, Python standalone executable)
- Tested on: Windows 10/11
- Serial ports: `COM*`

### ⏳ macOS
- Not currently included
- Can be added by copying binary to `embedded/esptool-binaries/macos/`

## Chip Detection

Auto-detects all ESP32 variants:
- ESP32 (original)
- ESP32-S2
- ESP32-S3
- ESP32-C3
- ESP32-C6
- ESP32-H2

## Configuration

### Enable/Disable Flasher
The flasher is **enabled by default**. To disable:

1. In `main.js`, comment out flasher initialization:
```javascript
// esp32Flasher = new ESP32FlasherNative();
// esp32Flasher.initialize()...
```

2. In `renderer/app.js`, hide the flasher tab:
```javascript
// Don't render flasher tab
```

### Configurable Settings
- **Baud Rate**: 115200, 460800, 921600
- **Flash Address**: Any hex address (default 0x10000)
- **Erase Flash**: true/false
- **Firmware Path**: User-selected .bin file

## Error Handling

Common errors and solutions:

**"Failed to initialize ESP32 flasher"**
- Binary extraction failed
- Check file permissions in temp directory

**"Chip detection failed"**
- Wrong serial port selected
- ESP32 not in boot mode (hold BOOT button)
- USB cable issue

**"Flash failed"**
- Incorrect flash address
- Corrupted firmware file
- Insufficient power to ESP32
- Try lower baud rate (115200)

## Troubleshooting

### Binary not executable (Linux)
```bash
chmod +x /tmp/fga-simulator-esptool/esptool
```

### Serial port permission denied (Linux)
```bash
sudo usermod -a -G dialout $USER
# Then logout/login
```

### Port not showing up
- Check USB cable (must support data transfer)
- Try different USB port
- Check device drivers (CH340, CP210x)

## Benefits Over esptool-js

| Feature | esptool-js (Browser) | Native Binary |
|---------|---------------------|---------------|
| Auto chip detection | ❌ Complex | ✅ Built-in |
| Dependencies | ❌ Many (pako, atob-lite, tslib) | ✅ None |
| Module system | ❌ ES modules issues | ✅ Simple spawn |
| Browser APIs | ❌ Web Serial API | ✅ Node serialport |
| Offline support | ⚠️ Bundle issues | ✅ Embedded binary |
| Reliability | ⚠️ Module conflicts | ✅ Stable |
| Size | 📦 175KB bundle + node_modules | 📦 12-13MB binary |

## Migration from esptool-js

The old esptool-js implementation had critical issues:
1. Module import failures (`Transport is not defined`)
2. CommonJS/ES module conflicts
3. Import map complexities
4. Browser API limitations

The new native implementation:
1. Uses proven esptool binary
2. Simple child_process spawn
3. No browser API dependencies
4. Based on NubeFlexTerm (production-tested)

## Future Enhancements

- [ ] Add macOS binary support
- [ ] Support multiple file flashing (bootloader + partition + app)
- [ ] Add OTA update support
- [ ] Implement flash read/verify
- [ ] Add partition table editor
- [ ] Support custom chip configurations

## Credits

- **esptool**: Official Espressif flashing tool
- **NubeFlexTerm**: Reference implementation
- **Binaries**: PyInstaller standalone executables from esptool

## License

The esptool binaries are distributed under GPL v2 (Espressif license).
