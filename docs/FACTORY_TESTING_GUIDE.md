# Factory Testing Feature - Complete Guide

## Overview
The Factory Testing feature provides a comprehensive interface for testing NubeIO devices during manufacturing. It supports AT command communication via UART to verify device functionality and hardware components.

## Supported Devices

### Version 1
- **Micro Edge** ✅ Fully implemented
- **Droplet** (Coming soon)

### Version 2
- **ZC-LCD** (Coming soon)
- **ACB-M** (Coming soon)
- **Droplet** (Coming soon)
- **ZC-Controller** (Coming soon)

## Features

### 1. Version & Device Selection
- Select between Version 1 and Version 2 devices
- Choose specific device type to test
- Clean interface with visual device cards

### 2. Device Connection (Step 1)
- Connect to device via UART/Serial port
- Configurable baud rate (9600 - 921600)
- Real-time connection status indicator
- Auto-detection of available serial ports

### 3. Device Information Retrieval (Step 2)
Reads and displays device information using AT commands:
- **Firmware Version** - `AT+FWVERSION?`
- **Hardware Version** - `AT+HWVERSION?`
- **STM32 96-bit Unique ID** - `AT+UNIQUEID?`
- **Device Make** - `AT+DEVICEMAKE?`
- **Device Model** - `AT+DEVICEMODEL?`

### 4. Factory Tests (Step 3)
Comprehensive hardware testing:
- **Battery Voltage** - `AT+VALUE_VBAT?`
- **Pulses Counter** - `AT+VALUE_PULSE?`
- **DIP Switches** - `AT+VALUE_DIPSWITCHES?`
- **Analog Input 1** - `AT+VALUE_UI1_RAW?`
- **Analog Input 2** - `AT+VALUE_UI2_RAW?`
- **Analog Input 3** - `AT+VALUE_UI3_RAW?`
- **LoRa Unique Address** - `AT+LRRADDRUNQ?`
- **LoRa Detection** - `AT+LORADETECT?`
- **LoRa Raw Push Test** - `AT+LORARAWPUSH`

### 5. Automatic Report Generation
- Results automatically saved to text file
- Timestamped filename format: `factory-test-{version}-{device}-{timestamp}.txt`
  - Example: `factory-test-v1-Micro Edge-2025-11-17T10-30-45.txt`
- Saved to: `{userData}/factory-tests/` directory
- Includes all device info and test results

## Usage Instructions

### Quick Start
1. Launch Nube iO Toolkit
2. Navigate to **Factory Testing** page
3. Select device version (V1 or V2)
4. Select device type
5. Connect device via serial port
6. Click "Read Device Info"
7. Click "Run All Tests"
8. Results are automatically saved

### Detailed Workflow

#### Step 1: Connection Setup
```
1. Connect device to computer via UART
2. Select serial port from dropdown
3. Choose appropriate baud rate (default: 115200)
4. Click "Connect" button
5. Wait for connection confirmation
```

#### Step 2: Read Device Information
```
1. Ensure device is connected
2. Click "Read Device Info" button
3. System sends AT commands to read:
   - Firmware version
   - Hardware version
   - Unique ID
   - Device make
   - Device model
4. Information displayed in grid format
```

#### Step 3: Run Factory Tests
```
1. Click "Run All Tests" button
2. System executes all test commands sequentially
3. Progress shown in real-time
4. Results displayed in test grid
5. Automatic save to text file
6. File path shown in status message
```

## AT Command Reference

### Device Information Commands

| Command | Response | Description | Example |
|---------|----------|-------------|---------|
| `AT+FWVERSION?` | `+FWVERSION:<version>` | Firmware version | `+FWVERSION:4.0.0` |
| `AT+HWVERSION?` | `+HWVERSION:<version>` | Hardware version | `+HWVERSION:0.1` |
| `AT+UNIQUEID?` | `+UNIQUEID:<hex-string>` | 96-bit STM32 UID | `+UNIQUEID:0123456789ABCDEF01234567` |
| `AT+DEVICEMAKE?` | `+DEVICEMAKE:<make>` | Device manufacturer | `+DEVICEMAKE:ME` |
| `AT+DEVICEMODEL?` | `+DEVICEMODEL:<model>` | Device model code | `+DEVICEMODEL:0005` |

### Factory Test Commands

| Command | Response | Description | Example |
|---------|----------|-------------|---------|
| `AT+VALUE_VBAT?` | `+VALUE_VBAT:<voltage>` | Battery voltage | `+VALUE_VBAT:4.63` |
| `AT+VALUE_PULSE?` | `+VALUE_PULSE:<count>` | Pulse counter | `+VALUE_PULSE:1234` |
| `AT+VALUE_DIPSWITCHES?` | `+VALUE_DIPSWITCHES:<array>` | DIP switch states | `+VALUE_DIPSWITCHES:[0,0,1,0,0,1,0,1]` |
| `AT+VALUE_UI1_RAW?` | `+VALUE_UI1_RAW:<voltage>` | AIN 1 normalized | `+VALUE_UI1_RAW:0.42` |
| `AT+VALUE_UI2_RAW?` | `+VALUE_UI2_RAW:<voltage>` | AIN 2 normalized | `+VALUE_UI2_RAW:0.00` |
| `AT+VALUE_UI3_RAW?` | `+VALUE_UI3_RAW:<voltage>` | AIN 3 normalized | `+VALUE_UI3_RAW:1.00` |
| `AT+LRRADDRUNQ?` | `+LORAADDRUNQ:<address>` | LoRa raw address | `+LORAADDUNQ:00C01234` |
| `AT+LORADETECT?` | `+LORADETECT:<0|1>` | LoRa module present | `+LORADETECT:1` |
| `AT+LORARAWPUSH` | `OK` or `ERROR` | Test LoRa packet | `OK` |

## File Output Format

### Sample Report
```
============================================================
NUBE IO FACTORY TEST RESULTS
============================================================
Date: 2025-11-17 10:30:45
Version: v1
Device: Micro Edge
============================================================

DEVICE INFORMATION
------------------------------------------------------------
Firmware Version:  4.0.0
HW Version:        0.1
Unique ID:         0123456789ABCDEF01234567
Device Make:       ME
Device Model:      0005

FACTORY TEST RESULTS
------------------------------------------------------------
Battery Voltage:   4.63 V
Pulses Counter:    1234
DIP Switches:      [0,0,1,0,0,1,0,1]
AIN 1 Voltage:     0.42 V
AIN 2 Voltage:     0.00 V
AIN 3 Voltage:     1.00 V
LoRa Address:      00C01234
LoRa Detect:       Detected
LoRa Raw Push:     OK

============================================================
END OF REPORT
============================================================
```

## Technical Architecture

### Frontend Components
- **FactoryTestingPage.js** - Main UI page with version/device selection and test interface
- **FactoryTestingModule.js** - UI interaction handler and API bridge

### Backend Service
- **factory-testing.js** - Core service handling:
  - Serial port communication
  - AT command protocol
  - Response parsing
  - Result file generation

### IPC Communication
- `factoryTesting:connect` - Connect to serial port
- `factoryTesting:disconnect` - Disconnect from port
- `factoryTesting:readDeviceInfo` - Read device information
- `factoryTesting:runFactoryTests` - Execute all tests
- `factoryTesting:saveResults` - Save results to file
- `factoryTesting:progress` - Progress updates (event)

## Troubleshooting

### Connection Issues
```
Problem: Cannot connect to serial port
Solutions:
- Verify device is powered on
- Check USB cable connection
- Ensure correct serial port selected
- Try different baud rate
- Close other programs using the port
```

### AT Command Timeout
```
Problem: Commands timing out
Solutions:
- Check device firmware supports AT commands
- Verify baud rate matches device settings
- Ensure device is not in sleep mode
- Try increasing timeout (5s default)
```

### Missing Test Results
```
Problem: Some tests show ERROR
Solutions:
- Check hardware connections
- Verify sensors/modules are installed
- Review device specifications
- Test individual components manually
```

## Future Enhancements
- [ ] Support for Version 1 Micro Edge
- [ ] Support for all Version 2 devices
- [ ] Custom test sequences
- [ ] Pass/Fail criteria configuration
- [ ] Export to CSV/JSON formats
- [ ] Batch testing mode
- [ ] Test history tracking
- [ ] Graphical result visualization

## API Reference

### JavaScript API
```javascript
// Connect to device
await window.factoryTestingAPI.connect(port, baudRate);

// Read device information
const deviceInfo = await window.factoryTestingAPI.readDeviceInfo();

// Run factory tests
const results = await window.factoryTestingAPI.runFactoryTests();

// Save results
await window.factoryTestingAPI.saveResults(version, device, deviceInfo, results);

// Listen for progress updates
window.factoryTestingAPI.onProgress((message) => {
  console.log('Progress:', message);
});
```

## License
This feature is part of the Nube iO Toolkit.
Copyright © 2025 Nube iO
