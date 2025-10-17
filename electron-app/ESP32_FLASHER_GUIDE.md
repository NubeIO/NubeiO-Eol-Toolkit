# ESP32 Flasher Guide

The FGA AC Simulator includes a built-in ESP32 Firmware Flasher that allows you to flash firmware to ESP32 devices directly from the application.

## Features

- 🔍 **Auto-detect serial ports** - Automatically finds connected ESP32 devices
- 📁 **File browser** - Select .bin or .elf firmware files
- ✅ **Firmware verification** - Validates firmware before flashing
- ⚡ **Fast flashing** - Supports high baud rates (up to 921600)
- 📊 **Progress tracking** - Real-time progress display
- 🗑️ **Optional erase** - Choose to erase flash before writing
- 🎯 **Easy to use** - Step-by-step UI guide

## Requirements

### System Requirements

- **Linux**: `esptool.py` (install via pip)
- **Windows**: `esptool.exe` (bundled with app)
- **USB drivers**: CH340/CP2102 drivers for ESP32

### Installing esptool (Linux/macOS)

```bash
# Install via pip
pip3 install esptool

# Verify installation
esptool.py --help
```

### USB Permissions (Linux)

Add your user to the dialout group to access serial ports:

```bash
sudo usermod -a -G dialout $USER
sudo chmod 666 /dev/ttyUSB0  # Or your specific port
```

## How to Use

### Step 1: Connect ESP32

1. Connect your ESP32 device via USB cable
2. Wait for the device to be recognized by your system
3. On Linux, it usually appears as `/dev/ttyUSB0` or `/dev/ttyACM0`
4. On Windows, it appears as `COM3`, `COM4`, etc.

### Step 2: Open Flasher

1. Launch the FGA AC Simulator
2. Click the **⚡ ESP32 Flasher** tab in the navigation bar
3. Click **🔄 Refresh Ports** to scan for connected devices

### Step 3: Select Serial Port

1. You'll see a list of available serial ports
2. Each port shows:
   - **Port path** (e.g., /dev/ttyUSB0)
   - **Manufacturer** (e.g., Silicon Labs)
   - **Serial number** (if available)
3. Click on the port connected to your ESP32
4. The selected port will be highlighted in blue with a checkmark

### Step 4: Select Firmware

1. Click **📁 Browse Firmware (.bin / .elf)**
2. Navigate to your firmware file
3. Select a `.bin` or `.elf` file
4. The app will automatically verify the firmware
5. You'll see a confirmation with file details (size, type)

### Step 5: Configure Flash Options

**Baud Rate:**
- `115200` - Safe, slower
- `460800` - **Default**, balanced speed
- `921600` - Fastest, may fail on some systems

**Erase Flash:**
- ☐ **Unchecked** (default) - Preserves existing data
- ☑ **Checked** - Completely erases flash before writing (recommended for major updates)

### Step 6: Flash!

1. Click the big **⚡ FLASH ESP32 FIRMWARE** button
2. Confirm the operation in the dialog
3. Wait for the process to complete (1-2 minutes)
4. You'll see real-time progress:
   - 🔌 Connecting to ESP32...
   - 🗑️ Erasing flash memory... (if enabled)
   - 📝 Writing firmware... (with % progress)
   - ✅ Verifying...
   - 🎉 Flash Complete!

### Step 7: Verify Success

After flashing completes:
1. You'll see a **✅ Firmware flashed successfully!** message
2. The ESP32 will automatically reset
3. Your device is ready to use!

## Troubleshooting

### Port Not Detected

**Problem:** No serial ports appear in the list.

**Solutions:**
- Check USB cable connection
- Try a different USB port
- Install USB drivers (CH340/CP2102)
- On Linux, check permissions: `ls -l /dev/ttyUSB*`
- Click **Refresh Ports** button

### Flash Failed - Permission Denied

**Problem:** "Permission denied" error when flashing.

**Solutions (Linux):**
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Temporarily change permissions
sudo chmod 666 /dev/ttyUSB0

# Log out and log back in for group changes to take effect
```

### Flash Failed - Device Not Responding

**Problem:** Can't connect to ESP32.

**Solutions:**
- Hold the **BOOT** button on ESP32 while clicking flash
- Try a lower baud rate (115200)
- Check if ESP32 is in bootloader mode
- Press RESET button on ESP32 and try again

### Verification Failed

**Problem:** Hash verification failed after writing.

**Solutions:**
- Try with "Erase Flash" enabled
- Use a lower baud rate
- Check firmware file integrity
- Try a different USB cable

### esptool.py Not Found

**Problem:** "esptool.py command not found"

**Solutions:**
```bash
# Install esptool
pip3 install esptool

# Or use pipx
pipx install esptool
```

## Advanced Options

### Custom Flash Address

By default, firmware is flashed to `0x10000`. To change this:

1. Edit `electron-app/services/esp32-flasher.js`
2. Modify the `address` parameter in `flashFirmware()`
3. Common addresses:
   - `0x1000` - Bootloader
   - `0x8000` - Partition table
   - `0x10000` - Application (default)

### Multiple Partitions

To flash multiple partitions:

1. Flash bootloader: `0x1000`
2. Flash partition table: `0x8000`
3. Flash application: `0x10000`

Each requires a separate flash operation.

## Feature Toggle

To disable the ESP32 Flasher:

1. Edit `electron-app/config/features.json`
2. Set `esp32Flasher.enabled` to `false`:

```json
{
  "esp32Flasher": {
    "enabled": false
  }
}
```

3. Restart the application
4. The ESP32 Flasher tab will not appear

## Supported ESP32 Chips

- ESP32 (original)
- ESP32-S2
- ESP32-S3
- ESP32-C3
- ESP32-C6
- ESP32-H2

## Command Line Alternative

If you prefer command line:

```bash
# Basic flash
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 460800 \
  write-flash 0x10000 firmware.bin

# Full erase first
esptool.py --chip esp32 --port /dev/ttyUSB0 erase_flash

# Flash with options
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 460800 \
  write-flash --flash-mode dio --flash-freq 40m --flash-size 4MB \
  0x10000 firmware.bin
```

## Security Notes

- The flasher requires physical USB access
- Firmware files are not validated for authenticity
- Only flash firmware from trusted sources
- Flashing can brick your device if done incorrectly
- Always keep a backup of working firmware

## Technical Details

### Architecture

The ESP32 Flasher consists of:

1. **Backend Service** (`services/esp32-flasher.js`)
   - SerialPort detection
   - esptool.py integration
   - Progress parsing
   - Error handling

2. **Frontend UI** (`renderer/app.js`)
   - Port selection interface
   - File browser
   - Progress display
   - Status feedback

3. **IPC Communication** (`main.js`, `preload.js`)
   - Secure channel between renderer and main process
   - File dialog handling
   - Flash operation execution

### Offline Usage

The flasher is designed for offline use:
- No internet connection required
- esptool.py bundled with app (coming soon)
- All dependencies included
- Works in air-gapped environments

## FAQs

**Q: Can I flash multiple ESP32s at once?**
A: No, flash one device at a time.

**Q: How long does flashing take?**
A: Usually 1-2 minutes at 460800 baud.

**Q: Can I cancel during flashing?**
A: Not recommended. Wait for completion or restart ESP32.

**Q: Will this work with Arduino boards?**
A: Only ESP32-based boards. Not Arduino Uno/Mega.

**Q: Do I need to install drivers?**
A: Yes, CH340 or CP2102 drivers depending on your ESP32 board.

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review esptool.py documentation
- Check ESP32 datasheet for your specific chip

## Credits

This flasher uses [esptool.py](https://github.com/espressif/esptool) by Espressif Systems.

