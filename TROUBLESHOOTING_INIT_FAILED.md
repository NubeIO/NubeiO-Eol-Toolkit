# STM32 Flashing Error: "init mode failed (unable to connect to the target)"

## Your Specific Error Analysis

```
Info : STLINK V2J46S7 (API v2) VID:PID 0483:3748  ✅ ST-Link detected
Info : Target voltage: 3.269380                    ✅ Target has power (3.27V)
Error: init mode failed (unable to connect to the target)  ❌ Can't connect via SWD
```

**Good News**: ST-Link is working, and your STM32 has power!
**Bad News**: OpenOCD cannot connect to the STM32 via SWD debug interface.

## Why This Happens

The STM32 firmware currently running on your chip is likely:
1. **Disabling SWD debug pins** (SWDIO/SWCLK used for other purposes)
2. **Entering low-power mode** (debug disabled)
3. **Has Read Protection enabled** (RDP Level 1 or 2)

## Solution 1: Hardware BOOT Mode (Most Reliable) ⭐

This forces the STM32 to ignore the user firmware and enter bootloader mode:

### Steps:
```
1. Power OFF the STM32 completely
2. Connect BOOT0 pin to VCC (3.3V) using a jumper wire
3. Power ON the STM32
4. Click "Flash Firmware" immediately
5. Wait for flash to complete
6. Power OFF and remove BOOT0 jumper
7. Power ON normally
```

**Why this works**: In BOOT mode, the STM32 ignores user firmware and enters system bootloader, which keeps SWD enabled.

## Solution 2: Check NRST Connection

From the error, it's trying `connect_assert_srst` which requires NRST pin. 

### Check if NRST is connected:

```
ST-Link          STM32
--------         -----
VDD         -->  VDD   ✅
GND         -->  GND   ✅
SWDIO       -->  PA13  ✅
SWCLK       -->  PA14  ✅
NRST        -->  NRST  ❓ <-- Is this connected?
```

**If NRST is NOT connected**, the hardware reset methods won't work.

### Quick test without NRST:

Try flashing with software-only reset by modifying the reset order. Create a test script:

```bash
cd electron-app/embedded/openocd-binaries/linux

# Test 1: Connect under reset (requires NRST)
./bin/openocd \
  -s openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "adapter speed 480" \
  -c "reset_config srst_only srst_nogate connect_assert_srst" \
  -c "init" \
  -c "shutdown"

# Test 2: Software reset only (no NRST needed)
./bin/openocd \
  -s openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "adapter speed 480" \
  -c "reset_config none separate" \
  -c "init" \
  -c "shutdown"
```

## Solution 3: Lower SWD Speed (If Connection Flaky)

Sometimes slower speeds work better:

```bash
./bin/openocd \
  -s openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "adapter speed 100" \  # <-- Slower speed
  -c "reset_config srst_only srst_nogate connect_assert_srst" \
  -c "init" \
  -c "shutdown"
```

## Solution 4: Erase with ST-Link Utility (Windows)

If you have Windows available, use STM32 ST-LINK Utility:

```
1. Connect on Windows
2. Target → Connect
3. Target → Erase Chip
4. Try flashing on Linux again
```

## Solution 5: Unlock Read Protection (⚠️ Erases Flash!)

If RDP is enabled:

```bash
cd electron-app/embedded/openocd-binaries/linux

./bin/openocd \
  -s openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "adapter speed 480" \
  -c "init" \
  -c "halt" \
  -c "stm32l4x unlock 0" \
  -c "reset" \
  -c "shutdown"
```

⚠️ **WARNING**: This will **ERASE ALL FLASH** including your current firmware!

## Code Modification: Add More Aggressive Reset Strategies

I can modify the service to try more aggressive connection methods. Let me add an option:

### Option A: Try Lower Speed First

The service could automatically lower speed on connection failure.

### Option B: Add "Force Connect" Mode

Add a mode that tries BOOT0 assertion via software (if supported by hardware).

### Option C: Add Manual Connect Sequence

Add a button "Connect in BOOT Mode" that waits for user to manually put device in BOOT mode.

## Recommended Immediate Action

**Try Solution 1 (BOOT Mode)**:
```
1. Power off STM32
2. Connect BOOT0 to VCC (3.3V)
3. Power on
4. Flash immediately
5. Power off, remove jumper
```

This is **100% reliable** if your hardware supports it.

## Alternative: Check Your Hardware

### Verify connections:
```bash
# Check if ST-Link sees the chip
lsusb | grep STMicro  # Should show ST-Link

# Check voltage (should be ~3.3V)
# Your log shows: Target voltage: 3.269380 ✅ Good!
```

### Verify SWD pins:
- **SWDIO (PA13)**: Must be connected, check continuity
- **SWCLK (PA14)**: Must be connected, check continuity
- **NRST**: Optional but helps a lot, check if connected

## Next Steps

1. **Try BOOT mode** (Solution 1) - Most reliable
2. **Check NRST connection** - If not connected, add it
3. **Try lower speed** (Solution 3) - Sometimes helps
4. Let me know which solution worked, and I can update the tool

## Want Me to Modify the Code?

I can add:
- ✅ **Lower speed fallback** (try 100 kHz if 480 kHz fails)
- ✅ **Better error messages** (guide user to BOOT mode)
- ✅ **BOOT mode detector** (check if device needs BOOT mode)
- ✅ **Skip hardware reset** option (for boards without NRST)

Let me know what you need!
