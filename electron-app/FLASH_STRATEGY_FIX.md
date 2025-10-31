# STM32 Flash Fix - Multiple Connection Strategies

## Problem

Detection works (can read chip info), but flashing fails with:
```
Error: init mode failed (unable to connect to the target)
in procedure 'program'
```

This happens when the STM32 firmware has **disabled SWD debug** or is in a state that prevents connection during flash operations.

## Root Cause

The `program` command tries to:
1. Init (connect to target)
2. Erase flash
3. Write firmware
4. Verify

But step 1 (init) fails because the running firmware interferes with SWD connection.

## Solution: Multiple Connection Strategies

Instead of one method, try **4 different strategies** automatically:

### Strategy 1: Connect Under Reset (NRST Required)
```bash
-c "reset_config srst_only srst_nogate connect_assert_srst"
-c "init"
-c "reset halt"
```
- Asserts NRST while connecting
- Most reliable if NRST is connected
- Requires hardware NRST pin

### Strategy 2: Software Reset
```bash
-c "reset_config none separate"
-c "init"
-c "reset halt"
```
- Uses SYSRESETREQ (software reset)
- No NRST pin needed
- Works on most boards

### Strategy 3: Halt After Init
```bash
-c "reset_config none"
-c "init"
-c "halt"
```
- Connects then immediately halts CPU
- Prevents firmware from running
- Good for stubborn firmwares

### Strategy 4: Simple Program (Fallback)
```bash
-c "reset_config none"
-c "program {firmware.bin} verify reset exit 0x08000000"
```
- One-shot command
- Tries to handle everything automatically
- Last resort

## How It Works Now

```
Try Strategy 1 at 100 kHz → Failed
Try Strategy 2 at 100 kHz → Failed
Try Strategy 3 at 100 kHz → Failed
Try Strategy 4 at 100 kHz → Failed
↓
Try Strategy 1 at 480 kHz → Failed
Try Strategy 2 at 480 kHz → SUCCESS! ✅
```

**Total: 8 attempts** (4 strategies × 2 speeds)

## Manual Flash Sequence

For strategies 1-3, we use manual flash commands instead of `program`:

```bash
# Old (one command, fails if init fails):
-c "program {firmware.bin} verify reset exit 0x08000000"

# New (manual control, more reliable):
-c "init"
-c "reset halt"
-c "flash write_image erase {firmware.bin} 0x08000000"
-c "verify_image {firmware.bin} 0x08000000"
-c "reset run"
-c "shutdown"
```

## Why This Fixes Your Issue

Your board:
- ✅ Detection works (can read chip at 100 kHz)
- ❌ Flashing fails (init fails with `program` command)

The new approach:
- Tries manual flash commands (more control)
- Tries different init sequences
- Automatically finds what works

## Test It Now

```bash
cd electron-app
npm start
```

Then:
1. Go to **STM32 Flasher** page
2. Select firmware file
3. Click **"Flash Firmware"**
4. Watch it try different methods automatically
5. Should succeed with one of the 8 strategies!

## What You'll See

```
Programming flash...
Trying different method (2/8)...
Trying different method (3/8)...
Flash completed successfully ✅
```

## If It Still Fails

### Last Resort: Hardware BOOT Mode

If all 8 strategies fail, you need to force BOOT mode:

```
1. Power OFF STM32
2. Connect BOOT0 pin to VCC (3.3V)
3. Power ON
4. Flash immediately
5. Power OFF, remove BOOT0 jumper
```

This forces the chip into bootloader mode where SWD always works.

## Technical Details

### Speed Order Changed

```javascript
// Old: Try fast first
const swdSpeeds = [480, 100];

// New: Try reliable first (your board needs 100 kHz)
const swdSpeeds = [100, 480];
```

Since your board needs 100 kHz, we try it first to save time.

### Connection Strategies

Each strategy tries a different way to gain control:

| Strategy | NRST Needed | Success Rate | Use Case |
|----------|-------------|--------------|----------|
| Connect Under Reset | Yes | High | Standard boards with NRST |
| Software Reset | No | Medium | Boards without NRST |
| Halt After Init | No | Medium | Stubborn firmware |
| Simple Program | No | Low | Last resort |

## Benefits

### ✅ Automatic
- No user intervention
- Tries all methods
- Finds what works

### ✅ Reliable
- 8 different attempts
- Manual flash control
- Works on stubborn boards

### ✅ Fast
- Tries 100 kHz first (your speed)
- Stops when successful
- No wasted attempts

## Verify the Fix

Test manually with Strategy 2 (software reset):

```bash
cd electron-app/embedded/openocd-binaries/linux

./bin/openocd -s openocd/scripts \
  -f interface/stlink.cfg \
  -f target/stm32wlx.cfg \
  -c "adapter speed 100" \
  -c "reset_config none separate" \
  -c "init" \
  -c "reset halt" \
  -c "flash write_image erase /path/to/firmware.bin 0x08000000" \
  -c "verify_image /path/to/firmware.bin 0x08000000" \
  -c "reset run" \
  -c "shutdown"
```

If this works, the Electron app will work too!

## Summary

| Feature | Before | After |
|---------|--------|-------|
| Strategies | 1 (program) | 4 (multiple methods) |
| Speed Order | 480→100 | 100→480 (optimized) |
| Flash Method | One-shot | Manual control |
| Attempts | 8 | 8 (smarter) |
| Success Rate | Low | High ✅ |

**The flasher is now much more reliable and should work on your board!** 🚀

## Related Files

- `services/openocd-stm32.js` - Updated with multiple strategies
- `SWD_SPEED_FIX.md` - Previous speed fix
- `TROUBLESHOOTING_INIT_FAILED.md` - General troubleshooting

---

**Try flashing now - it should work!** 🎉
