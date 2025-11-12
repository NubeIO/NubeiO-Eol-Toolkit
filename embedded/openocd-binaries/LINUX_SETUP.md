# OpenOCD Linux Binaries Setup

This guide explains how to download and set up prebuilt OpenOCD binaries for Linux (Ubuntu/Debian) to enable offline STM32 flashing.

## Quick Setup

### Option 1: Download xPack OpenOCD (Recommended)

xPack provides prebuilt OpenOCD binaries for multiple platforms including Linux x64.

```bash
cd electron-app/embedded/openocd-binaries/

# Download xPack OpenOCD for Linux x64
wget https://github.com/xpack-dev-tools/openocd-xpack/releases/download/v0.12.0-3/xpack-openocd-0.12.0-3-linux-x64.tar.gz

# Extract
tar -xzf xpack-openocd-0.12.0-3-linux-x64.tar.gz

# Rename to 'linux' for consistency
mv xpack-openocd-0.12.0-3 linux

# Clean up
rm xpack-openocd-0.12.0-3-linux-x64.tar.gz

# Verify
./linux/bin/openocd --version
```

Expected output:
```
Open On-Chip Debugger 0.12.0
```

### Option 2: Use Official OpenOCD Release

```bash
cd electron-app/embedded/openocd-binaries/

# Download official release
wget https://sourceforge.net/projects/openocd/files/openocd/0.12.0/openocd-0.12.0.tar.gz

# Extract and build (if prebuilt not available)
tar -xzf openocd-0.12.0.tar.gz
cd openocd-0.12.0
./configure --prefix=$PWD/../linux
make
make install
cd ..
rm -rf openocd-0.12.0 openocd-0.12.0.tar.gz
```

## Directory Structure

After setup, your structure should look like:

```
electron-app/embedded/openocd-binaries/
├── linux/
│   ├── bin/
│   │   └── openocd          # Linux executable
│   ├── share/
│   │   └── openocd/
│   │       └── scripts/      # OpenOCD scripts
│   └── ...
└── windows/
    ├── bin/
    │   └── openocd.exe       # Windows executable
    └── openocd/
        └── scripts/           # OpenOCD scripts
```

## Automated Script

Save this as `setup-linux-openocd.sh`:

```bash
#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=== OpenOCD Linux Setup ==="
echo "Downloading xPack OpenOCD for Linux x64..."

# Download
wget -q --show-progress https://github.com/xpack-dev-tools/openocd-xpack/releases/download/v0.12.0-3/xpack-openocd-0.12.0-3-linux-x64.tar.gz

# Extract
echo "Extracting..."
tar -xzf xpack-openocd-0.12.0-3-linux-x64.tar.gz

# Rename
echo "Setting up directory structure..."
rm -rf linux
mv xpack-openocd-0.12.0-3 linux

# Make executable
chmod +x linux/bin/openocd

# Clean up
rm xpack-openocd-0.12.0-3-linux-x64.tar.gz

# Verify
echo ""
echo "=== Setup Complete ==="
echo "OpenOCD version:"
./linux/bin/openocd --version || echo "Error: Failed to run openocd"

echo ""
echo "Directory structure:"
ls -lh linux/bin/openocd
ls -d linux/share/openocd/scripts

echo ""
echo "✅ Linux OpenOCD binaries are ready!"
```

Make it executable and run:
```bash
chmod +x setup-linux-openocd.sh
./setup-linux-openocd.sh
```

## Alternative: Extract from System Package (Ubuntu/Debian)

If you prefer to use the official Ubuntu package but extract it for bundling:

```bash
cd electron-app/embedded/openocd-binaries/

# Create temporary directory
mkdir -p temp
cd temp

# Download package (without installing)
apt download openocd

# Extract .deb
dpkg-deb -x openocd_*.deb extracted

# Copy binaries
mkdir -p ../linux/bin
mkdir -p ../linux/share/openocd
cp extracted/usr/bin/openocd ../linux/bin/
cp -r extracted/usr/share/openocd/scripts ../linux/share/openocd/

# Clean up
cd ..
rm -rf temp

# Make executable
chmod +x linux/bin/openocd
```

## USB Permissions (Important!)

For ST-Link to work on Linux without sudo, add udev rules:

```bash
# Copy udev rules (run on target system, not during bundling)
sudo cp linux/share/openocd/contrib/60-openocd.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Or manually create `/etc/udev/rules.d/60-openocd.rules`:

```
# ST-Link V2
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3748", MODE="0666", GROUP="plugdev"
# ST-Link V2-1
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374b", MODE="0666", GROUP="plugdev"
# ST-Link V3
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374d", MODE="0666", GROUP="plugdev"
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374e", MODE="0666", GROUP="plugdev"
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="374f", MODE="0666", GROUP="plugdev"
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="3753", MODE="0666", GROUP="plugdev"
```

## Testing

Test the setup:

```bash
cd electron-app/embedded/openocd-binaries/linux

# Check version
./bin/openocd --version

# Test ST-Link detection (with ST-Link connected)
./bin/openocd \
  -s share/openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "init" \
  -c "shutdown"
```

Expected output (with ST-Link connected):
```
Open On-Chip Debugger 0.12.0
Info : auto-selecting first available session transport "hla_swd". To override use 'transport select <transport>'.
Info : The selected transport took over low-level target control. The results might differ compared to plain JTAG/SWD
Info : clock speed 480 kHz
Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748
Info : Target voltage: 3.300000
Info : stm32wlx.cpu: Cortex-M4 r0p1 processor detected
Info : stm32wlx.cpu: target has 6 breakpoints, 4 watchpoints
```

## Bundling with Electron

The service will automatically use the correct binary based on platform:
- Windows: `embedded/openocd-binaries/windows/bin/openocd.exe`
- Linux: `embedded/openocd-binaries/linux/bin/openocd`
- macOS: `embedded/openocd-binaries/macos/bin/openocd` (future)

## Troubleshooting

### "Permission denied" when running openocd

```bash
chmod +x linux/bin/openocd
```

### "libusb not found" or similar errors

The xPack version includes all dependencies statically linked, so this shouldn't happen. If it does:

```bash
ldd linux/bin/openocd  # Check dependencies
```

### ST-Link not detected

1. Check USB permissions (udev rules above)
2. Check if ST-Link is connected: `lsusb | grep STMicro`
3. Try with sudo (for testing only): `sudo ./linux/bin/openocd ...`

## Version Information

- **Recommended Version**: OpenOCD 0.12.0 (xPack)
- **Minimum Version**: OpenOCD 0.11.0
- **Supported Targets**: STM32WLE5, STM32F0x

## References

- xPack OpenOCD: https://github.com/xpack-dev-tools/openocd-xpack
- Official OpenOCD: http://openocd.org/
- ST-Link drivers: https://www.st.com/en/development-tools/st-link-v2.html
