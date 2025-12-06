# Factory Testing Updates

## Overview
Updated Factory Testing feature with device-specific UI and CSV export with folder organization by Unique ID.

## Changes Made

### 1. Export Format Changes
**Before:**
- Single text file: `factory-test-v1-MicroEdge-{timestamp}.txt`
- Saved to: `{userData}/factory-tests/`

**After:**
- Folder per device: `{userData}/factory-tests/{uniqueID}/`
- Two files per test:
  - `{uniqueID}_{timestamp}.csv` - CSV format for Excel/analysis
  - `{uniqueID}_{timestamp}.txt` - Detailed log file

### 2. CSV Format
```csv
Category,Parameter,Value
Device Info,Date,2025-11-18 10:30:45
Device Info,Version,v1
Device Info,Device Type,Micro Edge
Device Info,Firmware Version,1.3.6
Device Info,HW Version,0.0
Device Info,Unique ID,71002D000E50425937393720
Device Info,Device Make,ME
Device Info,Device Model,0005
Test Results,Battery Voltage,3.7V
Test Results,Pulses Counter,1234
Test Results,DIP Switches,0b10101010
Test Results,AIN 1 Voltage,2.5V
Test Results,AIN 2 Voltage,1.8V
Test Results,AIN 3 Voltage,3.3V
Test Results,LoRa Address,0x12345678
Test Results,LoRa Detect,OK
Test Results,LoRa Raw Push,OK
```

### 3. Device-Specific UI

#### Micro Edge Testing
**Purpose:** Test digital I/O, analog inputs, pulse counter, battery, and LoRa

**Tests Display:**
- 🔋 Battery Voltage
- ⚡ Pulse Counter
- 🎚️ DIP Switches
- 📈 AIN 1, 2, 3 (Analog Inputs)
- 📡 LoRa Address
- 📡 LoRa Detect
- 📡 LoRa Push Test

**Instructions:**
1. Connect Micro Edge device via UART (115200 baud)
2. Verify battery voltage is within acceptable range
3. Test analog inputs (AIN1, AIN2, AIN3) with known voltages
4. Verify pulse counter is counting correctly
5. Check DIP switch states for configuration
6. Test LoRa module detection and communication
7. Results saved to: `factory-tests/{uniqueID}/` as CSV + LOG

#### Droplet Testing
**Purpose:** Test environmental sensors and LoRa communication

**Tests Display:**
- 🌡️ Temperature
- 💧 Humidity
- 🌪️ Pressure
- 💨 CO2 Level
- 📡 LoRa Address
- 📡 LoRa Detect
- 📡 LoRa Push Test

**Instructions:**
1. Connect Droplet device via UART (115200 baud)
2. Read temperature sensor (verify room temperature ~20-25°C)
3. Read humidity sensor (verify normal range 30-70%)
4. Read pressure sensor (verify atmospheric ~1000 hPa)
5. Read CO2 sensor (verify indoor air quality 400-1000 ppm)
6. Test LoRa module detection and communication
7. Results saved to: `factory-tests/{uniqueID}/` as CSV + LOG

### 4. File Organization Example

```
{userData}/factory-tests/
├── 71002D000E50425937393720/          # Micro Edge #1
│   ├── 71002D000E50425937393720_2025-11-18T10-30-45.csv
│   ├── 71002D000E50425937393720_2025-11-18T10-30-45.txt
│   ├── 71002D000E50425937393720_2025-11-18T14-20-10.csv
│   └── 71002D000E50425937393720_2025-11-18T14-20-10.txt
├── 82003E001F60536048404831/          # Micro Edge #2
│   ├── 82003E001F60536048404831_2025-11-18T11-15-20.csv
│   └── 82003E001F60536048404831_2025-11-18T11-15-20.txt
└── A3004F002G71647159515942/          # Droplet #1
    ├── A3004F002G71647159515942_2025-11-18T12-00-00.csv
    └── A3004F002G71647159515942_2025-11-18T12-00-00.txt
```

## Benefits

### For Production
- **Organized by Device:** Each device has its own folder by Unique ID
- **Test History:** Multiple test runs stored with timestamps
- **CSV Export:** Easy to import into Excel, Google Sheets, or analysis tools
- **Traceability:** Unique ID in both folder name and file name

### For Quality Control
- **Batch Analysis:** Import all CSV files into spreadsheet for statistical analysis
- **Pass/Fail Tracking:** Easy to filter and sort test results
- **Device-Specific Tests:** Different test parameters for different device types
- **Visual Icons:** Quick identification of test types in UI

### For Documentation
- **Dual Format:** CSV for analysis, TXT for detailed human-readable logs
- **Complete Information:** Device info + test results in structured format
- **Timestamp Tracking:** Know exactly when each test was performed

## AT Commands by Device

### Micro Edge
- `AT+FWVERSION?` - Firmware version
- `AT+HWVERSION?` - Hardware version
- `AT+UNIQUEID?` - Unique device ID
- `AT+DEVICEMAKE?` - Device manufacturer
- `AT+DEVICEMODEL?` - Device model
- `AT+VALUE_VBAT?` - Battery voltage
- `AT+VALUE_PULSE?` - Pulse counter
- `AT+VALUE_DIPSWITCHES?` - DIP switch states
- `AT+VALUE_UI1_RAW?` - Analog input 1
- `AT+VALUE_UI2_RAW?` - Analog input 2
- `AT+VALUE_UI3_RAW?` - Analog input 3
- `AT+LRRADDRUNQ?` - LoRa address
- `AT+LORADETECT?` - LoRa module detection
- `AT+LORARAWPUSH` - LoRa transmission test

### Droplet (Future Implementation)
- Basic device info commands (same as Micro Edge)
- `AT+TEMP?` - Temperature sensor
- `AT+HUMID?` - Humidity sensor
- `AT+PRESS?` - Pressure sensor
- `AT+CO2?` - CO2 sensor
- LoRa commands (same as Micro Edge)

## Implementation Status

✅ **Completed:**
- CSV + LOG export format
- Folder organization by Unique ID
- Device-specific UI for Micro Edge
- Device-specific UI for Droplet
- Updated instructions and help text
- Enhanced visual design with icons

⏳ **Pending:**
- Droplet AT commands implementation in backend service
- Additional device types (V2 devices)
- Pass/Fail criteria and color coding
- Export all tests to single Excel workbook

## Usage

1. **Select Device:**
   - Choose V1 → Micro Edge or Droplet
   - UI adapts to show relevant tests

2. **Connect & Test:**
   - Connect via COM port
   - Read device info
   - Run factory tests

3. **Results:**
   - View results in UI
   - Files saved to: `{userData}/factory-tests/{uniqueID}/`
   - Both CSV and TXT files created

4. **Analysis:**
   - Open CSV in Excel/Google Sheets
   - Compare multiple test runs
   - Track device performance over time

## Files Modified

1. **services/factory-testing.js**
   - Updated `saveResults()` method
   - Folder creation by uniqueID
   - CSV generation
   - Device-specific test result handling

2. **renderer/pages/FactoryTestingPage.js**
   - Added `renderTestResultsByDevice()` method
   - Added `renderInstructionsByDevice()` method
   - Updated UI to show device-specific tests
   - Updated result messages to show folder path

## Testing

Test with both device types:
1. Micro Edge: Verify all 9 tests display correctly
2. Droplet: Verify environmental sensor tests display
3. Check CSV format is valid
4. Verify folder structure is created correctly
5. Confirm files are named with uniqueID + timestamp
