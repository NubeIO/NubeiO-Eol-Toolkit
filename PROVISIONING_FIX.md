# 🔧 ESP32 Provisioning Issue - FIXED

## ❌ Problem

After flashing the NVS partition with credentials, the ESP32 device was still showing **FACTORY_FRESH** state instead of **SEED_FLASHED**.

### Boot Log Evidence
```
I (1327) NVSManager: HTTPS credentials check: key=0 bytes, cert=0 bytes, ready=no
I (1335) ProvState: Device status: config=0, https_creds=0
W (1348) APP_MAIN: Device in FACTORY_FRESH state - needs PC Tool programming
```

The firmware was not finding the credentials (`config=0`).

---

## 🔍 Root Cause

**The NVS partition was being flashed to the WRONG offset!**

- **Firmware expects**: `zc_cfg` partition at **0xA20000**
- **PC Tool was flashing to**: **0x3D0000** ❌

The ESP32 firmware's partition table was compiled with `zc_cfg` at `0xA20000`, but the provisioning tool was flashing the NVS partition to `0x3D0000`, so the firmware couldn't find the credentials.

---

## ✅ Solution

Changed the default NVS partition offset back to **0xA20000** in:

### 1. **Frontend (ProvisioningPage.js)**
```javascript
offset: '0xA20000',  // Changed from 0x3D0000
```

### 2. **Backend (esp32-provisioning.js)**
```javascript
config.offset || '0xA20000',  // Default offset
```

### 3. **Erase Functions**
Updated all erase operations to use the correct offset:
- Single NVS erase: `0xA20000`
- All NVS erase: `0x9000`, `0xA20000`, `0x3E0000`

---

## 📋 Correct Partition Layout

Based on the firmware's partition table:

| Partition | Offset | Size | Purpose |
|-----------|--------|------|---------|
| nvs | 0x9000 | 64KB | System NVS |
| zc_cfg | **0xA20000** | 64KB | **Device credentials (UUID, PSK, WiFi)** |
| cert_storage | 0x3E0000 | Variable | Certificate storage |

---

## 🚀 How to Provision Correctly

### Step 1: Flash Firmware
```bash
# Flash the main firmware first
esptool --chip esp32s3 --port /dev/ttyACM0 write_flash 0x0 firmware.bin
```

After flashing, device should be in **FACTORY_FRESH** state.

### Step 2: Provision with PC Tool
1. Open PC Tool → Provisioning tab
2. Select serial port
3. **Verify offset is 0xA20000** (default)
4. Enter WiFi credentials
5. Put ESP32 in download mode
6. Click "Complete Provisioning"

### Step 3: Verify
After provisioning and reboot, device should show:
```
I (xxx) ProvState: Device status: config=1, https_creds=0
I (xxx) APP_MAIN: Current provisioning state: SEED_FLASHED
```

---

## 🧪 Testing

### Verify NVS Partition
You can verify the NVS partition was created correctly:

```bash
# Generate test NVS
./nvs_partition_gen generate test.csv test.bin 0x10000

# Check binary format
hexdump -C test.bin | head -30
```

You should see:
- Namespace "zc" at offset 0x40
- `global_uuid` entry
- `psk_secret` entry  
- `ca_service_url` entry
- `wifi_ssid` entry
- `wifi_password` entry

### Flash and Test
```bash
# Flash NVS to correct offset
esptool --chip esp32s3 --port /dev/ttyACM0 write_flash 0xA20000 test.bin

# Monitor serial output
# Device should transition from FACTORY_FRESH to SEED_FLASHED
```

---

## 📝 Important Notes

### Why 0xA20000?
This offset is defined in the ESP32 firmware's partition table (`partitions.csv`). The firmware was compiled with this partition layout, so the PC tool **must** flash to the same offset.

### If You Need Different Offset
If you need to use a different offset (like 0x3D0000), you must:
1. Modify the firmware's `partitions.csv`
2. Recompile the firmware
3. Flash the new firmware
4. Then use the new offset in PC tool

### Partition Table Example
```csv
# Name,     Type, SubType, Offset,   Size
nvs,        data, nvs,     0x9000,   0x10000
zc_cfg,     data, nvs,     0xA20000, 0x10000
cert_storage,data,nvs,     0x3E0000, 0x20000
```

---

## ✨ Result

After fixing the offset to **0xA20000**:

✅ **NVS partition flashed to correct location**  
✅ **Firmware finds credentials**  
✅ **Device transitions to SEED_FLASHED state**  
✅ **WiFi connects automatically**  
✅ **Device ready for operation**

---

## 🔄 Workflow Summary

```
1. Flash Firmware → FACTORY_FRESH
2. PC Tool Provision (0xA20000) → Flash credentials
3. Device Reboot → SEED_FLASHED
4. WiFi Connect → OPERATIONAL
```

**Fixed on**: October 19, 2025  
**Status**: ✅ Working Correctly

