# STM32 Flasher - Multi-Platform Support

The STM32 Flasher now supports **Windows** and **Linux** platforms with prebuilt OpenOCD binaries for offline usage.

## Platform Support

| Platform | Status | Binary Location |
|----------|--------|-----------------|
| Windows  | ✅ Ready | `embedded/openocd-binaries/windows/` |
| Linux    | ✅ Ready | `embedded/openocd-binaries/linux/` |
| macOS    | 🚧 Future | `embedded/openocd-binaries/macos/` |

## Quick Start

### For Windows Users

✅ **Already set up!** Windows binaries are included by default.

### For Linux Users

**Step 1: Download Linux OpenOCD binaries**

```bash
cd electron-app/embedded/openocd-binaries
chmod +x setup-linux-openocd.sh
./setup-linux-openocd.sh
```

This will download xPack OpenOCD 0.12.0 for Linux x64 (~20MB).

**Step 2: Set up USB permissions (on target system)**

Create `/etc/udev/rules.d/60-openocd.rules`:

```bash
sudo tee /etc/udev/rules.d/60-openocd.rules > /dev/null <<EOF
# ST-Link V2
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3748", MODE="0666", GROUP="plugdev"
# ST-Link V2-1
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374b", MODE="0666", GROUP="plugdev"
# ST-Link V3
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374d", MODE="0666", GROUP="plugdev"
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374e", MODE="0666", GROUP="plugdev"
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374f", MODE="0666", GROUP="plugdev"
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3753", MODE="0666", GROUP="plugdev"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Add user to plugdev group
sudo usermod -a -G plugdev $USER
```

**Note:** User needs to log out and log back in for group changes to take effect.

**Step 3: Test**

```bash
cd electron-app/embedded/openocd-binaries/linux
./bin/openocd --version
```

## How It Works

The `openocd-stm32.js` service automatically detects the platform and uses the appropriate binary:

```javascript
const platform = process.platform; // 'win32', 'linux', 'darwin'

if (platform === 'win32') {
    openocdBinary = 'embedded/openocd-binaries/windows/bin/openocd.exe';
} else if (platform === 'linux') {
    openocdBinary = 'embedded/openocd-binaries/linux/bin/openocd';
} else if (platform === 'darwin') {
    openocdBinary = 'embedded/openocd-binaries/macos/bin/openocd';
}
```

## Directory Structure

```
embedded/openocd-binaries/
├── LINUX_SETUP.md              # Linux setup guide
├── setup-linux-openocd.sh      # Automated Linux setup script
├── linux/                       # Linux binaries (download via script)
│   ├── bin/
│   │   └── openocd             # OpenOCD executable for Linux
│   └── share/
│       └── openocd/
│           └── scripts/        # OpenOCD configuration scripts
└── windows/                     # Windows binaries (included)
    ├── bin/
    │   └── openocd.exe         # OpenOCD executable for Windows
    └── openocd/
        └── scripts/            # OpenOCD configuration scripts
```

## Features

### Supported Devices
- ✅ **STM32WLE5** (Droplet) - 256KB Flash
- ✅ **STM32F030C8T6** (Zone Controller) - 64KB Flash

### Supported Operations
- ✅ Flash firmware (.bin, .hex)
- ✅ Verify flash
- ✅ Read Unique ID (UID)
- ✅ Generate LoRa Device Address (Droplet only)
- ✅ Detect ST-Link debugger
- ✅ Auto device type detection

### Platform-Specific Features

#### Windows
- Uses bundled OpenOCD binaries
- ST-Link drivers from STMicroelectronics
- Plug-and-play (no manual setup)

#### Linux
- Uses bundled OpenOCD binaries (offline capable)
- Requires udev rules for USB permissions
- Supports both ST-Link V2 and V3

## Testing

### Test ST-Link Detection

**Windows:**
```cmd
cd electron-app\embedded\openocd-binaries\windows\bin
openocd.exe -f ..\openocd\scripts\interface\stlink.cfg -f ..\openocd\scripts\target\stm32wlx.cfg -c "init" -c "shutdown"
```

**Linux:**
```bash
cd electron-app/embedded/openocd-binaries/linux
./bin/openocd -s share/openocd/scripts -f interface/stlink.cfg -f target/stm32wlx.cfg -c "init" -c "shutdown"
```

### Expected Output

```
Open On-Chip Debugger 0.12.0
Info : auto-selecting first available session transport "hla_swd"
Info : clock speed 480 kHz
Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748
Info : Target voltage: 3.300000
Info : stm32wlx.cpu: Cortex-M4 r0p1 processor detected
```

## Troubleshooting

### Linux: "Permission denied" when accessing ST-Link

**Cause:** USB permissions not set up

**Solution:**
1. Set up udev rules (see Quick Start above)
2. Add user to plugdev group: `sudo usermod -a -G plugdev $USER`
3. Log out and log back in
4. Reconnect ST-Link

### Linux: "libusb not found"

**Cause:** Missing libusb library (shouldn't happen with xPack)

**Solution:**
```bash
# Check dependencies
ldd electron-app/embedded/openocd-binaries/linux/bin/openocd

# If needed, install libusb
sudo apt-get install libusb-1.0-0
```

### Any Platform: "OpenOCD binary not found"

**Cause:** Binaries not downloaded or in wrong location

**Solution:**
- Windows: Check that `embedded/openocd-binaries/windows/bin/openocd.exe` exists
- Linux: Run `setup-linux-openocd.sh` script

### Any Platform: "Failed to connect to target"

**Causes:**
1. ST-Link not connected
2. Target not powered
3. Wrong device type selected
4. SWD pins not connected properly

**Solutions:**
1. Check USB connection
2. Verify target voltage (3.0V - 3.6V)
3. Select correct device type (Droplet or Zone Controller)
4. Check SWDIO, SWCLK, GND, VDD, NRST connections

## Distribution

### For End Users

When distributing the Electron app:

**Windows:**
- Include `embedded/openocd-binaries/windows/` in the app bundle
- No additional setup required

**Linux:**
- Include `embedded/openocd-binaries/linux/` in the app bundle
- Provide setup script for udev rules: `scripts/linux-setup-udev.sh`
- Document USB permissions requirement in README

### Package Size

- Windows OpenOCD: ~15 MB
- Linux OpenOCD: ~20 MB
- Total (both platforms): ~35 MB

## Developer Notes

### Adding macOS Support

To add macOS support in the future:

1. Download xPack OpenOCD for macOS:
   ```bash
   wget https://github.com/xpack-dev-tools/openocd-xpack/releases/download/v0.12.0-3/xpack-openocd-0.12.0-3-darwin-x64.tar.gz
   ```

2. Extract to `embedded/openocd-binaries/macos/`

3. The service already has the code path ready (see `openocd-stm32.js`)

### Updating OpenOCD Version

To update to a newer OpenOCD version:

1. Download new xPack release from: https://github.com/xpack-dev-tools/openocd-xpack/releases
2. Extract to respective platform directory
3. Test with all target devices
4. Update version number in documentation

## References

- **xPack OpenOCD**: https://github.com/xpack-dev-tools/openocd-xpack
- **OpenOCD Official**: http://openocd.org/
- **ST-Link**: https://www.st.com/en/development-tools/st-link-v2.html
- **STM32WLE5**: https://www.st.com/en/microcontrollers-microprocessors/stm32wle5jc.html
- **STM32F030**: https://www.st.com/en/microcontrollers-microprocessors/stm32f030c8.html

## License

OpenOCD is licensed under GPL v2. The bundled binaries are from xPack OpenOCD, which provides prebuilt binaries of the official OpenOCD project.

## Support

For issues specific to:
- **OpenOCD usage**: See [STM32_TROUBLESHOOTING.md](../../STM32_TROUBLESHOOTING.md)
- **Linux setup**: See [LINUX_SETUP.md](LINUX_SETUP.md)
- **General STM32 flashing**: See [STM32_FLASHER_README.md](../../STM32_FLASHER_README.md)
