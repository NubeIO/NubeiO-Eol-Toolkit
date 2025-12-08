# ZC-Controller Factory Testing Documentation

**Device:** ZC-Controller (Zone Controller - Damper Motor Controller)  
**Generation:** GEN-2  
**Microcontroller:** ESP32  
**Communication:** UART (115200 baud)  
**Status:** Planned Device - Test Framework Documented  
**Last Updated:** December 9, 2025

---

## 📚 Quick Navigation

### By Role

**🔧 Test Operator:**
- Start here: [Quick Start Guide](#quick-start-guide)
- Then go to: [Test Cases & Procedures](./ZCController-TestCases.md)
- When issues arise: [Troubleshooting Guide](./ZCController-Troubleshooting.md)

**👨‍💻 Software Developer:**
- Start here: [Source Code Manual](./ZCController-SourceCode.md)
- Then review: [Sequence Diagrams](./ZCController-Sequence.md)
- For hardware context: [Hardware Overview](./ZCController-Overview.md)

**⚙️ Hardware Engineer:**
- Start here: [Hardware Overview](./ZCController-Overview.md)
- For test procedures: [Test Cases](./ZCController-TestCases.md)
- For diagnostics: [Troubleshooting](./ZCController-Troubleshooting.md)

**📊 Quality Assurance:**
- Start here: [Test Cases & Procedures](./ZCController-TestCases.md)
- Review flows: [Sequence Diagrams](./ZCController-Sequence.md)
- Check criteria: Pass/fail thresholds in Test Cases

---

## 📖 Documentation Files

| File | Purpose | Audience | Diagrams |
|------|---------|----------|----------|
| **[ZCController-Overview.md](./ZCController-Overview.md)** | Hardware specifications, component architecture | Hardware engineers, beginners | Component Diagram, Block Diagrams |
| **[ZCController-Sequence.md](./ZCController-Sequence.md)** | Test execution flows, message sequences | Developers, testers | 15+ Sequence Diagrams, State Diagrams |
| **[ZCController-TestCases.md](./ZCController-TestCases.md)** | Detailed test procedures, pass/fail criteria | Test operators, QA | 15+ Flowcharts, Mind Maps |
| **[ZCController-SourceCode.md](./ZCController-SourceCode.md)** | Software manual, class/method documentation | Developers, maintainers | 5+ Class Diagrams |
| **[ZCController-Troubleshooting.md](./ZCController-Troubleshooting.md)** | Issue diagnosis, solutions | Operators, support engineers | 10+ State Diagrams, Flowcharts |

---

## 🔍 Device Overview

### What is ZC-Controller?

The **ZC-Controller (Zone Controller)** is a GEN-2 ESP32-based smart damper motor controller designed for HVAC zone control applications. It provides precise motor position control, feedback sensing, and relay outputs for actuating dampers, valves, and other mechanical components in building automation systems.

### Key Features

- **Microcontroller:** ESP32 (Dual-core Xtensa LX6)
- **Motor Control:** Stepper/DC motor driver with H-bridge
- **Position Feedback:** Analog potentiometer input (0-10V or 0-5V)
- **Relay Outputs:** 2x SPDT relays for auxiliary control
- **Wireless:** WiFi 802.11b/g/n (2.4 GHz)
- **Industrial:** RS485 interface for Modbus RTU
- **Power:** 12-24V DC input
- **Mounting:** DIN-rail compatible enclosure

### Application Areas

- VAV (Variable Air Volume) damper control
- Chilled beam zone controllers
- Underfloor air distribution (UFAD) systems
- Fan coil unit (FCU) controllers
- Valve actuators for hydronic systems
- Modbus-controlled HVAC automation
- BACnet to Modbus gateway nodes

---

## ⚠️ Implementation Status

### Current Status: **Planned Device**

The ZC-Controller is listed in the EOL Toolkit device selection (v2Devices array) but **specific test implementation has not been found in the factory-testing.js service**.

**Evidence from Code:**
```javascript
// FactoryTestingPage.js, line 16
this.v2Devices = ['ZC-LCD', 'ZC-Controller', 'ACB-M', 'Droplet'];

// Line 1686
this.selectedDevice === 'ZC-Controller' ? 'Relay Testing' :
```

**UI Features Implemented:**
- Device selection dropdown includes "ZC-Controller"
- Icon: 🔌 (Power plug symbol)
- Description: "Relay Testing"
- Generation: GEN-2

**Test Implementation Status:**
- ❌ No dedicated test sequence found in factory-testing.js
- ❌ No test commands or result parsing logic
- ⚠️ Device infrastructure ready, tests not implemented yet

### Expected Test Framework

Based on the device's hardware capabilities and similar GEN-2 devices (ZC-LCD, ACB-M), the expected factory test suite would validate:

1. **Motor Control Test** - Position commands, feedback verification
2. **Relay Operation Test** - Toggle relays, verify state changes
3. **Position Feedback Test** - Analog sensor reading accuracy
4. **WiFi Connectivity Test** - Network scanning, connection validation
5. **RS485 Communication Test** - Modbus RTU interface validation
6. **Power Supply Test** - Voltage monitoring, current draw

---

## 🧪 Expected Test Summary

The ZC-Controller factory testing would validate **6 critical subsystems**:

| Test | What It Checks | Expected Pass Criteria | Estimated Duration |
|------|----------------|------------------------|-------------------|
| **WiFi** | Wireless connectivity | Networks > 1, Connected = 1 | ~10 seconds |
| **RS485** | Serial communication | Modbus response received | ~8 seconds |
| **Motor Control** | Stepper/DC motor driver | Position change > 0 | ~12 seconds |
| **Position Feedback** | Analog sensor reading | Voltage 0.1V - 9.9V | ~6 seconds |
| **Relay 1** | First relay operation | State toggles successfully | ~5 seconds |
| **Relay 2** | Second relay operation | State toggles successfully | ~5 seconds |

**Total Test Time:** ~50-60 seconds  
**Pre-Testing:** Device info read (Version, UID, Make)  
**Post-Testing:** Results saved as CSV + JSON

---

## 🚀 Quick Start Guide

### Prerequisites

1. **Hardware Setup:**
   - ZC-Controller device powered (12-24V DC)
   - USB-to-UART adapter connected to test PC
   - Motor connected to motor terminals (optional for position test)
   - Position feedback potentiometer connected (for feedback test)
   - Relay load indicators or multimeter (for relay test)

2. **Software Setup:**
   - EOL Toolkit application running
   - Factory Testing tab opened
   - Generation 2 selected
   - ZC-Controller selected from device dropdown

3. **Connection:**
   - Identify ZC-Controller UART pins (TX, RX, GND)
   - Connect USB-UART: RX → TX, TX → RX, GND → GND
   - Note: 3.3V logic level, no direct 5V connection
   - COM port detected and selected in toolkit

### Test Execution Steps

#### Step 1: Connect Device

```
1. Power on ZC-Controller (12-24V DC supply)
2. Connect USB-UART adapter:
   - ZC-Controller TX → Adapter RX
   - ZC-Controller RX → Adapter TX  
   - ZC-Controller GND → Adapter GND
3. Open EOL Toolkit → Factory Testing Tab
4. Select "Generation 2" → "ZC-Controller"
5. Click "Connect" button
6. Verify connection status: "Connected" (green indicator)
```

**Expected Output:**
```
✓ Serial port opened: COM3 @ 115200 baud
✓ Device detected: ZC-Controller GEN-2
✓ Firmware version: v2.4.1
✓ UID: 1A2B3C4D5E6F
```

#### Step 2: Read Device Info

```
1. Click "Read Device Info" button
2. Wait for device information display (~3 seconds)
3. Verify all fields populated
```

**Expected Information:**
- **Device Type:** ZC-Controller
- **Hardware Version:** 2.1
- **Firmware Version:** 2.4.x
- **UID:** 12-character hex string
- **Manufacturer:** Nube iO
- **Serial Number:** Production serial number

#### Step 3: Run Tests

```
1. Ensure motor and feedback sensor connected
2. Click "Run All Tests" button
3. Monitor test progress in real-time
4. Watch for relay clicks and motor movement
5. Wait for completion (~50-60 seconds)
```

**Test Sequence:**
1. **WiFi Test** (10s) - Scans networks, attempts connection
2. **RS485 Test** (8s) - Sends Modbus query, validates response
3. **Motor Control Test** (12s) - Commands position 0% → 50% → 100%
4. **Position Feedback Test** (6s) - Reads analog position sensor
5. **Relay 1 Test** (5s) - Toggles relay, verifies state change
6. **Relay 2 Test** (5s) - Toggles relay, verifies state change

#### Step 4: Review Results

```
1. Check test results panel (right side of screen)
2. Verify all tests show PASS status
3. Review individual test values
4. Note any FAIL or WARN results
```

**Pass Criteria:**
- WiFi: ✓ Networks detected > 1, Connected = 1
- RS485: ✓ Response received, Status = 0
- Motor Control: ✓ Position changed > 0%
- Position Feedback: ✓ Voltage 0.1V - 9.9V
- Relay 1: ✓ State toggled (ON → OFF → ON)
- Relay 2: ✓ State toggled (ON → OFF → ON)

**Fail Scenarios:**
- WiFi: ✗ No networks found, Connection failed
- RS485: ✗ No response, Timeout error
- Motor Control: ✗ Position stuck at 0%
- Position Feedback: ✗ Voltage out of range (< 0.1V or > 9.9V)
- Relay: ✗ State did not change

#### Step 5: Save Results

```
1. Click "Save Results" button
2. Choose save location (default: test-results/ folder)
3. Files generated:
   - CSV: test_results_YYYYMMDD_HHMMSS.csv
   - JSON: test_results_YYYYMMDD_HHMMSS.json
```

**Result Files Include:**
- Timestamp (date, time)
- Device information (type, version, UID)
- Individual test results (pass/fail, values)
- Test duration, operator notes

---

## 🔌 Hardware Connection Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ZC-Controller GEN-2                         │
│                                                                     │
│  ┌─────────────┐                                                   │
│  │   ESP32     │                                                   │
│  │  Module     │                                                   │
│  └──────┬──────┘                                                   │
│         │                                                          │
│    ┌────┴────┐                                                     │
│    │  UART   │◄────────────── USB-UART Adapter                     │
│    │ TX RX   │                                                     │
│    └─────────┘                                                     │
│                                                                     │
│  ┌──────────────┐          ┌──────────────┐                       │
│  │ Motor Driver │◄─────────┤ Position FB  │                       │
│  │   H-Bridge   │          │ Potentiometer│                       │
│  └──────┬───────┘          └──────────────┘                       │
│         │                                                          │
│         └─────► Stepper/DC Motor                                  │
│                                                                     │
│  ┌──────────┐   ┌──────────┐                                      │
│  │ Relay 1  │   │ Relay 2  │                                      │
│  │  SPDT    │   │  SPDT    │                                      │
│  └────┬─────┘   └────┬─────┘                                      │
│       │              │                                             │
│       └──────┬───────┘                                             │
│              │                                                     │
│         Auxiliary Loads                                            │
│                                                                     │
│  ┌──────────────┐                                                 │
│  │   RS485      │◄────────── Modbus RTU Network                   │
│  │   A  B  GND  │                                                 │
│  └──────────────┘                                                 │
│                                                                     │
│  ┌──────────────┐                                                 │
│  │ WiFi Antenna │                                                 │
│  └──────────────┘                                                 │
│                                                                     │
│  Power: 12-24V DC ──────►                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Test Data Format

### CSV Export Format

```csv
Timestamp,DeviceType,HardwareVersion,FirmwareVersion,UID,SerialNumber,WiFi_Result,WiFi_Networks,WiFi_Connected,RS485_Result,RS485_Status,MotorControl_Result,MotorControl_Position,PositionFeedback_Result,PositionFeedback_Voltage,Relay1_Result,Relay1_State,Relay2_Result,Relay2_State,OverallResult,TestDuration,Operator
2025-12-09 14:32:15,ZC-Controller,2.1,2.4.1,1A2B3C4D5E6F,ZCC-2025-001234,PASS,5,1,PASS,0,PASS,87.5,PASS,4.52,PASS,ON,PASS,OFF,PASS,52.3s,John Doe
```

### JSON Export Format

```json
{
  "testSession": {
    "timestamp": "2025-12-09T14:32:15Z",
    "operator": "John Doe",
    "testDuration": "52.3s"
  },
  "deviceInfo": {
    "type": "ZC-Controller",
    "hardwareVersion": "2.1",
    "firmwareVersion": "2.4.1",
    "uid": "1A2B3C4D5E6F",
    "serialNumber": "ZCC-2025-001234",
    "manufacturer": "Nube iO"
  },
  "testResults": {
    "wifi": {
      "result": "PASS",
      "networksFound": 5,
      "connected": 1,
      "ssid": "Factory_WiFi_5G",
      "rssi": -45,
      "duration": "9.8s"
    },
    "rs485": {
      "result": "PASS",
      "status": 0,
      "response": "OK",
      "duration": "7.5s"
    },
    "motorControl": {
      "result": "PASS",
      "targetPosition": 50,
      "actualPosition": 48.7,
      "positionError": 1.3,
      "duration": "11.2s"
    },
    "positionFeedback": {
      "result": "PASS",
      "voltage": 4.52,
      "position": 45.2,
      "duration": "5.8s"
    },
    "relay1": {
      "result": "PASS",
      "initialState": "OFF",
      "finalState": "ON",
      "toggleCount": 3,
      "duration": "4.9s"
    },
    "relay2": {
      "result": "PASS",
      "initialState": "OFF",
      "finalState": "OFF",
      "toggleCount": 2,
      "duration": "4.6s"
    }
  },
  "overallResult": "PASS"
}
```

---

## 🎯 Test Coverage

### Hardware Components Validated

| Component | Test Method | Coverage |
|-----------|-------------|----------|
| ESP32 Microcontroller | UART communication, command response | ✓ Core functionality |
| WiFi Module | Network scan, connection test | ✓ Wireless interface |
| RS485 Transceiver | Modbus query/response | ✓ Industrial comms |
| Motor Driver (H-Bridge) | Position command, movement | ✓ Motor control |
| Position Feedback (ADC) | Analog voltage reading | ✓ Sensor input |
| Relay 1 (SPDT) | Toggle command, state verify | ✓ Output control |
| Relay 2 (SPDT) | Toggle command, state verify | ✓ Output control |
| Power Supply Circuit | Operational during all tests | ✓ Power integrity |

### Software Functions Validated

| Function | Test Coverage |
|----------|---------------|
| UART communication protocol | ✓ Command parsing, response formatting |
| WiFi stack initialization | ✓ Network scanning, connection handling |
| Modbus RTU protocol | ✓ Request/response cycle |
| Motor control algorithm | ✓ Position commands, feedback loop |
| ADC sampling | ✓ Analog input reading |
| GPIO control (relays) | ✓ Digital output toggling |
| JSON message handling | ✓ Command format, result serialization |

---

## 🔧 Troubleshooting Quick Reference

### Common Issues

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Connection failed | Wrong COM port | Check Device Manager, select correct port |
| WiFi test fails | No WiFi nearby | Move to area with WiFi networks |
| Motor doesn't move | Motor not connected | Connect stepper/DC motor to terminals |
| Position feedback error | Potentiometer not connected | Connect 0-10V potentiometer |
| Relay test fails | No load connected | Connect relay load or check with multimeter |
| RS485 timeout | No Modbus device | Connect RS485 network or use loopback |

For detailed troubleshooting procedures, see [ZCController-Troubleshooting.md](./ZCController-Troubleshooting.md).

---

## 📋 Pre-Test Checklist

Before running factory tests, verify:

- [ ] ZC-Controller powered with 12-24V DC supply
- [ ] USB-UART adapter connected (TX, RX, GND)
- [ ] COM port identified and accessible
- [ ] Motor connected to motor driver terminals (for motor test)
- [ ] Position feedback potentiometer connected (for feedback test)
- [ ] Relay loads connected or multimeter ready (for relay tests)
- [ ] WiFi network available in test area
- [ ] RS485 network or loopback connected (for RS485 test)
- [ ] EOL Toolkit application running
- [ ] Generation 2 and ZC-Controller selected
- [ ] Test results folder exists and is writable

---

## 🛠️ Development Roadmap

### Phase 1: Test Implementation (Planned)

- [ ] Add ZC-Controller test sequence to factory-testing.js
- [ ] Implement motor control test commands
- [ ] Implement position feedback reading commands
- [ ] Implement relay toggle commands
- [ ] Add test result parsing logic
- [ ] Add device-specific error handling

### Phase 2: UI Enhancement

- [ ] Add motor position slider control
- [ ] Add position feedback gauge visualization
- [ ] Add relay state indicators (LED graphics)
- [ ] Add real-time motor position chart

### Phase 3: Advanced Features

- [ ] Motor calibration routine (auto-detect limits)
- [ ] Position feedback linearization
- [ ] Relay endurance test (1000+ cycles)
- [ ] Modbus register read/write testing
- [ ] WiFi signal strength heatmap

---

## 📚 Related Documentation

### Internal Documentation

- [ZCController-Overview.md](./ZCController-Overview.md) - Hardware specifications and architecture
- [ZCController-Sequence.md](./ZCController-Sequence.md) - Test sequence diagrams
- [ZCController-TestCases.md](./ZCController-TestCases.md) - Detailed test procedures
- [ZCController-SourceCode.md](./ZCController-SourceCode.md) - Software manual and API reference
- [ZCController-Troubleshooting.md](./ZCController-Troubleshooting.md) - Diagnostic procedures

### External Resources

- ESP32 Technical Reference Manual
- Modbus RTU Protocol Specification
- HVAC Damper Control Best Practices
- DIN-rail Mounting Standards

---

## 📞 Support

### Technical Support

- **Email:** support@nube-io.com
- **Documentation:** https://docs.nube-io.com
- **GitHub:** https://github.com/NubeIO/

### Reporting Issues

When reporting issues, include:
1. Device serial number and firmware version
2. Test results (CSV/JSON export)
3. Serial port log capture
4. Photos of hardware setup
5. Description of expected vs actual behavior

---

## 📜 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-09 | Initial documentation for planned ZC-Controller device |

---

## 📄 License

Copyright © 2025 Nube iO Operations Pty Ltd. All rights reserved.

This documentation is proprietary and confidential. Unauthorized reproduction or distribution is prohibited.

---

**End of ZC-Controller Factory Testing README**
