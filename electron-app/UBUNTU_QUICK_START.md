# STM32 Flasher - Ubuntu/Linux Quick Start

## Prerequisites

- Ubuntu 18.04+ or compatible Linux distribution
- ST-Link V2/V3 debugger
- USB port

## Step 1: Download OpenOCD Binaries (One-time setup)

Run this script from the project root:

```bash
cd electron-app/embedded/openocd-binaries
./setup-linux-openocd.sh
```

This downloads xPack OpenOCD 0.12.0 (~20MB) for offline use.

**What it does:**
- Downloads prebuilt OpenOCD for Linux x64
- Extracts to `linux/` directory
- Makes binary executable
- Verifies installation

## Step 2: Set Up USB Permissions (Required on each system)

⚠️ **This must be done on every Linux system where you use ST-Link**

```bash
cd electron-app/scripts
./linux-setup-udev.sh
```

**What it does:**
- Creates udev rules for ST-Link (no sudo required for flashing)
- Adds your user to `plugdev` group
- Reloads udev rules

🔴 **CRITICAL: LOG OUT AND LOG BACK IN!** 🔴

**You MUST log out and log back in** after running this script!
- Group changes only take effect after logout/login
- The flasher will fail with "init mode failed" until you log out
- This is a Linux system requirement, not a bug

## Step 3: Verify Setup

After logging back in:

```bash
# Check if you're in plugdev group
groups
# Should show: ... plugdev ...

# Connect ST-Link and check if detected
lsusb | grep STMicro
# Should show: Bus XXX Device XXX: ID 0483:3748 STMicroelectronics ST-LINK/V2

# Test OpenOCD
cd electron-app/embedded/openocd-binaries/linux
./bin/openocd --version
# Should show: Open On-Chip Debugger 0.12.0
```

## Step 4: Test with Hardware

Connect your ST-Link to STM32:

```
ST-Link          STM32WLE5/STM32F030
--------         --------------------
VDD (3.3V)  -->  VDD
GND         -->  GND
SWDIO       -->  PA13 (SWDIO)
SWCLK       -->  PA14 (SWCLK)
NRST        -->  NRST (optional but recommended)
```

Test detection:

```bash
cd electron-app/embedded/openocd-binaries/linux

./bin/openocd \
  -s share/openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "init" \
  -c "shutdown"
```

Expected output:
```
Open On-Chip Debugger 0.12.0
Info : clock speed 480 kHz
Info : STLINK V2J37S7 (API v2) VID:PID 0483:3748
Info : Target voltage: 3.300000
Info : stm32wlx.cpu: Cortex-M4 r0p1 processor detected
```

✅ **Success!** You're ready to use the STM32 Flasher on Ubuntu!

## Using the Flasher

1. Launch the Electron app:
   ```bash
   cd electron-app
   npm start
   ```

2. Navigate to **STM32 Flasher** page

3. Select device type:
   - **Droplet** (STM32WLE5)
   - **Zone Controller** (STM32F030C8T6)

4. Click **"Detect ST-Link"** to verify connection

5. Select firmware file (.bin or .hex)

6. Click **"Flash Firmware"**

## Troubleshooting

### "Permission denied" error

**Problem:** Can't access ST-Link without sudo

**Solution:**
```bash
# Re-run udev setup
cd electron-app/scripts
./linux-setup-udev.sh

# Log out and log back in
# Reconnect ST-Link
```

### "ST-Link not detected"

**Problem:** lsusb doesn't show ST-Link

**Solution:**
1. Check USB cable (try different cable/port)
2. Check ST-Link LED (should be lit)
3. Try on Windows to verify ST-Link works

### "Target voltage: 0.000000"

**Problem:** Target not powered or not connected

**Solution:**
1. Verify STM32 has power (3.0V - 3.6V)
2. Check VDD and GND connections
3. Check if STM32 is properly soldered

### "init mode failed"

**Problem:** Can't connect to STM32 via SWD

**Solution:**
1. Check SWDIO and SWCLK connections
2. Try connecting NRST pin
3. Put STM32 in BOOT mode (BOOT0 to VCC)
4. See [STM32_TROUBLESHOOTING.md](../STM32_TROUBLESHOOTING.md)

## Offline Usage

✅ **The app works completely offline!**

Once you've downloaded OpenOCD binaries:
- No internet connection required
- No system package installation needed
- Portable to other Ubuntu systems (just need udev setup)

To use on another Ubuntu machine:
1. Copy entire project folder
2. Run `linux-setup-udev.sh` on that machine
3. Log out and log back in
4. Ready to use!

## Supported Devices

| Device | MCU | Flash | LoRa ID |
|--------|-----|-------|---------|
| Droplet | STM32WLE5 | 256KB | ✅ Yes |
| Zone Controller | STM32F030C8T6 | 64KB | ❌ No |

## File Size

- OpenOCD Linux binaries: ~20 MB
- Total project size increase: ~20 MB

## System Requirements

- **OS:** Ubuntu 18.04+ (or compatible distro)
- **Arch:** x86_64 (64-bit)
- **RAM:** 512 MB minimum
- **Disk:** 50 MB free space

## Notes for Developers

### Building Electron App

```bash
cd electron-app
npm install
npm start
```

### Packaging for Distribution

When building the Electron app:

1. Include `embedded/openocd-binaries/linux/` in package
2. Include `scripts/linux-setup-udev.sh` in package
3. Add to README: "Users must run linux-setup-udev.sh once"

### CI/CD

The `setup-linux-openocd.sh` script can be run in CI/CD:

```yaml
- name: Download OpenOCD for Linux
  run: |
    cd electron-app/embedded/openocd-binaries
    ./setup-linux-openocd.sh
```

## References

- [Full Setup Guide](../embedded/openocd-binaries/LINUX_SETUP.md)
- [Multi-Platform README](../embedded/openocd-binaries/README.md)
- [STM32 Troubleshooting](../STM32_TROUBLESHOOTING.md)
- [STM32 Flasher Guide](../STM32_FLASHER_README.md)

## Support

Having issues? Check:
1. This Quick Start guide
2. [LINUX_SETUP.md](../embedded/openocd-binaries/LINUX_SETUP.md) - Detailed setup
3. [STM32_TROUBLESHOOTING.md](../STM32_TROUBLESHOOTING.md) - Common errors
4. GitHub Issues

---

**Need help?** Open an issue on GitHub with:
- Output of `./bin/openocd --version`
- Output of `lsusb | grep STMicro`
- Output of `groups` command
- Full error message from the flasher
