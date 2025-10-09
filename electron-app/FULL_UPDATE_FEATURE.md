# Full Update Feature - ESP32 Flasher

## Overview
The ESP32 flasher now supports **Full Update** mode, which allows flashing a complete firmware package including bootloader, partition table, OTA data, and application firmware - all in a single operation.

This feature is based on the NubeFlexTerm implementation and provides the same functionality.

## Features

### Single File Mode (Default)
- Flash a single `.bin` file to a specified address
- Default address: `0x10000` (application partition)
- Configurable flash address
- Simple and fast for updating application firmware only

### Full Update Mode (New)
- Flash complete firmware package from a folder
- Auto-discovers firmware files by naming convention
- Supports multiple file types:
  - **Bootloader** (optional): `bootloader*.bin` → 0x0 or 0x1000
  - **Partition Table** (optional): `partition*.bin` → 0x8000
  - **OTA Data** (optional): `ota_data_initial.bin` → 0xd000
  - **Firmware** (required): Any other `.bin` file → 0x10000

## Usage

### UI Changes

1. **Full Update Checkbox**
   - Located below the baud rate selector
   - Toggle between Single File and Full Update modes
   - Label: "Full Update (Complete Flash with Bootloader)"

2. **Single File Mode** (Checkbox unchecked)
   - Firmware File input with Browse button
   - Flash Address input (default: 0x10000)
   - Same as before

3. **Full Update Mode** (Checkbox checked)
   - Firmware Folder button to select directory
   - Auto-scans folder for `.bin` files
   - Shows discovered files with status:
     - ✓ Green = Found
     - Gray = Not found (optional, will skip)
     - Red = Not found (required, will fail)
   - Displays flash addresses for each file

### File Discovery

The flasher automatically searches for files in the selected folder:

**Main folder:**
```
firmware-folder/
├── bootloader.bin       → Bootloader (optional)
├── partition-table.bin  → Partition Table (optional)
├── ota_data_initial.bin → OTA Data (optional)
└── firmware.bin         → Application Firmware (required)
```

**With subfolders:**
```
firmware-folder/
├── bootloader/
│   └── bootloader.bin
├── partition_table/
│   └── partition-table.bin
├── ota_data_initial.bin
└── firmware.bin
```

### Naming Conventions

Files are identified by these patterns:

- **Bootloader**: Contains "bootloader" in filename (case-insensitive)
  - Examples: `bootloader.bin`, `Bootloader_v1.0.bin`, `esp32_bootloader.bin`

- **Partition Table**: Contains "partition" in filename
  - Examples: `partition-table.bin`, `partitions.bin`, `partition_config.bin`

- **OTA Data**: Exactly named `ota_data_initial.bin`
  - Must match exactly (case-insensitive)

- **Firmware**: Any `.bin` file not matching above patterns
  - Examples: `firmware.bin`, `app.bin`, `myproject.bin`

### Flash Addresses

Addresses are automatically determined based on chip type:

| File Type | ESP32 | ESP32-S3 | ESP32-S2/C3/C6/H2 |
|-----------|-------|----------|-------------------|
| Bootloader | 0x1000 | 0x0 | 0x0 |
| Partition Table | 0x8000 | 0x8000 | 0x8000 |
| OTA Data | 0xd000 | 0xd000 | 0xd000 |
| Firmware | 0x10000 | **0x20000** | 0x10000 |

**Important Notes**:
- ESP32-S3 uses a larger bootloader, so the firmware address is **0x20000** instead of 0x10000
- Bootloader address differs between ESP32 (0x1000) and newer chips (0x0)
- Chip type is auto-detected when you select a folder (requires port selection first)
- The UI will display the correct addresses based on detected chip type

## Backend Implementation

### New Methods in `services/esp32-flasher-native.js`

1. **`scanFolderForBinFiles(folderPath)`**
   - Scans directory for `.bin` files
   - Categorizes files by naming pattern
   - Checks subfolders (`bootloader/`, `partition_table/`)
   - Returns discovered files object

2. **`flashComplete(options)`**
   - Flashes multiple files in single operation
   - Builds esptool command with multiple addresses
   - Options:
     ```javascript
     {
       port: '/dev/ttyUSB0',
       baudRate: 460800,
       bootloaderPath: '/path/to/bootloader.bin',  // optional
       partitionPath: '/path/to/partition.bin',    // optional
       otaDataPath: '/path/to/ota_data_initial.bin', // optional
       firmwarePath: '/path/to/firmware.bin',      // required
       eraseFlash: true,
       chipType: 'ESP32-S3',  // optional, auto-detected if null
       onProgress: (progress) => { }
     }
     ```

### New IPC Handlers in `main.js`

- **`flasher:showFolderDialog`**: Opens folder selection dialog
- **`flasher:scanFolder`**: Scans folder and returns discovered files
- **`flasher:flashComplete`**: Performs complete flash operation

### New Preload Methods in `preload.js`

- `showFolderDialog()`: Show folder picker
- `scanFolder(folderPath)`: Scan folder for firmware files
- `flashComplete(options)`: Flash complete firmware package

## Example esptool Commands

The flasher uses ESP-IDF format commands with proper flash configuration.

### For ESP32
```bash
esptool.py \
  --port /dev/ttyUSB0 \
  --baud 460800 \
  --before default_reset \
  --after hard_reset \
  --chip esp32 \
  write_flash \
  --flash_mode dio \
  --flash_freq 80m \
  --flash_size 4MB \
  0x1000 bootloader/bootloader.bin \
  0x8000 partition_table/partition-table.bin \
  0x10000 firmware.bin
```

### For ESP32-S3 (Matches ESP-IDF)
```bash
esptool.py \
  --port /dev/ttyACM1 \
  --baud 460800 \
  --before default_reset \
  --after hard_reset \
  --chip esp32s3 \
  write_flash \
  --flash_mode dio \
  --flash_freq 80m \
  --flash_size 4MB \
  0x0 bootloader/bootloader.bin \
  0x8000 partition_table/partition-table.bin \
  0x20000 firmware.bin
```

**Key Differences from Basic esptool:**
- Added `--before default_reset` and `--after hard_reset` for proper reset handling
- Added `--flash_mode dio` (Dual I/O mode for flash access)
- Added `--flash_freq 80m` (80MHz flash frequency)
- Added `--flash_size 4MB` (Flash chip size - auto-detected if needed)
- OTA data file is optional (not included in standard ESP-IDF commands)

**Note**: The firmware address for ESP32-S3 is 0x20000 (not 0x10000) due to its larger bootloader.

## Benefits

1. **Complete Flash**: Updates all firmware components in one operation
2. **Auto-Discovery**: No need to manually specify each file and address
3. **Flexible**: Optional files are skipped automatically
4. **Safe**: Verifies required files exist before flashing
5. **Consistent**: Matches NubeFlexTerm behavior exactly

## Testing

### Test Cases

1. **Single File Mode**
   - Select single `.bin` file
   - Flash to custom address
   - Verify flash successful

2. **Full Update - Complete Package**
   - Folder with all 4 files
   - Verify all files detected
   - Flash and verify successful

3. **Full Update - Minimal Package**
   - Folder with only firmware.bin
   - Verify optional files skipped
   - Flash and verify successful

4. **Full Update - With Subfolders**
   - Bootloader in `bootloader/` subfolder
   - Partition in `partition_table/` subfolder
   - Firmware in main folder
   - Verify all files discovered

5. **Error Cases**
   - No firmware file in folder → Should fail
   - Empty folder → Should fail
   - Missing port → Should fail

## Future Enhancements

- [ ] Support custom flash addresses in Full Update mode
- [ ] Add validation for file sizes
- [ ] Support `.elf` files
- [ ] Add option to verify flash after writing
- [ ] Support flashing from ZIP file
- [ ] Remember last used folder path
