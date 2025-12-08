# Droplet Factory Testing Documentation

**Device:** Droplet (Ultra-Compact IoT Sensor Node)  
**Generation:** GEN-2  
**Microcontroller:** ESP32  
**Communication:** UART (115200 baud), LoRa  
**Last Updated:** December 9, 2025

---

## 📚 Quick Navigation

### By Role

**🔧 Test Operator:**
- Start here: [Quick Start Guide](#quick-start-guide)
- Then go to: [Test Cases & Procedures](./Droplet-TestCases.md)
- When issues arise: [Troubleshooting Guide](./Droplet-Troubleshooting.md)

**👨‍💻 Software Developer:**
- Start here: [Source Code Manual](./Droplet-SourceCode.md)
- Then review: [Sequence Diagrams](./Droplet-Sequence.md)
- For hardware context: [Hardware Overview](./Droplet-Overview.md)

**⚙️ Hardware Engineer:**
- Start here: [Hardware Overview](./Droplet-Overview.md)
- For test procedures: [Test Cases](./Droplet-TestCases.md)
- For diagnostics: [Troubleshooting](./Droplet-Troubleshooting.md)

**📊 Quality Assurance:**
- Start here: [Test Cases & Procedures](./Droplet-TestCases.md)
- Review flows: [Sequence Diagrams](./Droplet-Sequence.md)
- Check criteria: Pass/fail thresholds in Test Cases

---

## 📖 Documentation Files

| File | Purpose | Audience | Diagrams |
|------|---------|----------|----------|
| **[Droplet-Overview.md](./Droplet-Overview.md)** | Hardware specifications, component architecture | Hardware engineers, beginners | Component Diagram, Block Diagrams |
| **[Droplet-Sequence.md](./Droplet-Sequence.md)** | Test execution flows, message sequences | Developers, testers | 15+ Sequence Diagrams, State Diagrams |
| **[Droplet-TestCases.md](./Droplet-TestCases.md)** | Detailed test procedures, pass/fail criteria | Test operators, QA | 15+ Flowcharts, Mind Maps |
| **[Droplet-SourceCode.md](./Droplet-SourceCode.md)** | Software manual, class/method documentation | Developers, maintainers | 5+ Class Diagrams |
| **[Droplet-Troubleshooting.md](./Droplet-Troubleshooting.md)** | Issue diagnosis, solutions | Operators, support engineers | 10+ State Diagrams, Flowcharts |

---

## 🔍 Device Overview

### What is Droplet?

The **Droplet** is a GEN-2 ultra-compact ESP32-based IoT sensor node designed for battery-powered environmental monitoring and long-range wireless communication. Combining LoRa connectivity, environmental sensing, and low-power operation, the Droplet is ideal for distributed sensor networks in smart buildings, agriculture, and industrial IoT applications.

### Key Features

- **Microcontroller:** ESP32 (Dual-core Xtensa LX6)
- **Wireless:** LoRa long-range radio (sub-GHz ISM bands)
- **Sensor:** I2C SHT40 temperature/humidity sensor
- **Power:** Battery-powered with voltage monitoring
- **Form Factor:** Ultra-compact design (minimal footprint)
- **Interface:** UART (115200 baud) for testing/configuration
- **Operating Range:** Up to 10+ km line-of-sight (LoRa)

### Application Areas

- Environmental monitoring (temperature/humidity)
- Agricultural sensor networks
- Cold chain monitoring
- Building automation sensors
- Industrial IoT endpoints
- Smart city sensor nodes
- Asset tracking with environmental conditions

---

## 🧪 Test Summary

The Droplet factory testing validates **3 critical subsystems**:

| Test | What It Checks | Pass Criteria | Typical Duration |
|------|----------------|---------------|------------------|
| **LoRa TX/RX** | Long-range radio communication | txDone = 1, rxDone = 1 | ~30 seconds |
| **Battery Voltage** | Power supply monitoring | 0 < voltage < 5V | ~5 seconds |
| **I2C Sensor** | Temperature/humidity sensor | Valid address (0x40), temp & humidity readings | ~5 seconds |

**Total Test Time:** ~40-45 seconds  
**Pre-Testing:** Device info read (Version, UID, Make)  
**Post-Testing:** Results saved as CSV + JSON

---

## 🚀 Quick Start Guide

### Prerequisites

1. **Hardware Setup:**
   - Droplet device powered with battery (3.0-4.2V nominal)
   - USB-to-UART adapter connected to test PC
   - LoRa antenna properly connected
   - LoRa gateway/receiver in range for RX test (within 10m for factory testing)

2. **Software Requirements:**
   - NubeIO EOL Toolkit application
   - Factory Testing tab enabled
   - Serial port drivers installed (CP210x or CH340)

3. **Environmental Conditions:**
   - Temperature: 15-35°C (for accurate sensor readings)
   - Humidity: 20-80% RH
   - Clear line-of-sight to LoRa gateway

### Test Procedure (5 Minutes)

#### Step 1: Physical Connection (1 minute)
```
1. Insert battery into Droplet device
2. Connect USB-UART adapter:
   - Adapter TX → Droplet RX
   - Adapter RX → Droplet TX
   - Adapter GND → Droplet GND
3. Verify power LED indicator (if equipped)
4. Connect adapter to test PC USB port
```

#### Step 2: Launch Test Application (30 seconds)
```
1. Open NubeIO EOL Toolkit
2. Navigate to "Factory Testing" tab
3. Select device type: "Droplet"
4. Select correct COM port from dropdown
5. Verify baud rate: 115200
6. Click "Connect" button
```

#### Step 3: Run Automated Tests (40 seconds)
```
1. Click "Run Tests" button
2. Wait for test sequence to complete:
   ✓ LoRa TX/RX test (~30s)
   ✓ Battery voltage test (~5s)
   ✓ I2C sensor test (~5s)
3. Review results in real-time progress panel
```

#### Step 4: Verify Results (1 minute)
```
1. Check overall status: PASS/FAIL
2. Verify individual test results:
   - LoRa: txDone=1, rxDone=1, valueRx displayed
   - Battery: Voltage reading (3.0-4.2V typical)
   - I2C: Address=0x40, temp & humidity values
3. Save test report (CSV + JSON)
4. Label device with test result sticker
```

#### Step 5: Disconnect Device (30 seconds)
```
1. Click "Disconnect" button
2. Remove USB-UART adapter
3. Power down device (remove battery if needed)
4. Move to packaging/shipping
```

---

## 📊 Test Details

### Test 1: LoRa TX/RX Communication

**Purpose:** Validates LoRa radio transmit and receive functionality

**AT Command:** `AT+TEST=lora`

**Response Format:** `+LORA:1,1,0`
- Field 1: txDone (1 = success, 0 = fail)
- Field 2: rxDone (1 = success, 0 = fail)
- Field 3: valueRx (received RSSI or counter value)

**Pass Criteria:**
- txDone = 1 (transmit successful)
- rxDone = 1 (receive successful)
- Response received within 30 seconds

**What It Tests:**
- LoRa module initialization
- Transmit power amplifier
- Receive sensitivity
- Antenna connection
- RF path integrity
- LoRa gateway communication

**Typical Results:**
```
Pass: +LORA:1,1,25
  - TX successful
  - RX successful
  - Received value: 25 (RSSI/counter)

Fail: +LORA:1,0,0
  - TX successful
  - RX failed (no gateway response)
  - Check gateway proximity/configuration
```

### Test 2: Battery Voltage Monitoring

**Purpose:** Validates battery voltage measurement circuit

**AT Command:** `AT+TEST=bat`

**Response Format:** `+BAT:3.61`
- Field: voltage (floating-point, 0-5V range)

**Pass Criteria:**
- 0 < voltage < 5.0V
- Finite numeric value returned
- Typical range: 3.0-4.2V (LiPo battery)

**What It Tests:**
- ADC (Analog-to-Digital Converter) functionality
- Voltage divider circuit
- Battery connection
- Power supply integrity

**Typical Results:**
```
Pass: +BAT:3.61
  - Battery voltage: 3.61V
  - Within normal operating range

Pass: +BAT:4.15
  - Battery voltage: 4.15V
  - Fully charged battery

Fail: +BAT:NOT VALUE
  - No battery connected
  - ADC read error
  - Check battery connection
```

### Test 3: I2C Temperature/Humidity Sensor

**Purpose:** Validates I2C sensor communication and readings

**AT Command:** `AT+TEST=i2c`

**Response Format:** `+I2C:0x40,275,686`
- Field 1: i2cAddress (hex format, e.g., 0x40)
- Field 2: temperature (scaled by 10, e.g., 275 = 27.5°C)
- Field 3: humidity (scaled by 10, e.g., 686 = 68.6% RH)

**Pass Criteria:**
- Valid I2C address detected (typically 0x40 for SHT40)
- Temperature value is finite number
- Humidity value is finite number
- Response received within 5 seconds

**What It Tests:**
- I2C bus functionality (SDA/SCL lines)
- Sensor power supply
- Sensor communication protocol
- Temperature reading accuracy
- Humidity reading accuracy

**Typical Results:**
```
Pass: +I2C:0x40,275,686
  - Sensor address: 0x40 (SHT40)
  - Temperature: 27.5°C
  - Humidity: 68.6% RH

Pass: +I2C:0x40,230,452
  - Sensor address: 0x40
  - Temperature: 23.0°C
  - Humidity: 45.2% RH

Fail: +I2C:,0,0
  - No I2C device detected
  - Check sensor connection/soldering
```

---

## 📁 Test Result Files

All test results are automatically saved in two formats:

### CSV Format (Excel-compatible)
**Location:** `test-results/droplet/Droplet_YYYY-MM-DD_HHmmss.csv`

**Contents:**
```csv
Device,Test,Result,Details,Timestamp
Droplet,LoRa,PASS,"txDone=1, rxDone=1, valueRx=25",2025-12-09 14:30:15
Droplet,Battery,PASS,"Voltage=3.61V",2025-12-09 14:30:20
Droplet,I2C,PASS,"Addr=0x40, Temp=27.5, Hum=68.6",2025-12-09 14:30:25
Droplet,Overall,PASS,"All tests passed",2025-12-09 14:30:25
```

### JSON Format (Machine-readable)
**Location:** `test-results/droplet/Droplet_YYYY-MM-DD_HHmmss.json`

**Contents:**
```json
{
  "device": "Droplet",
  "timestamp": "2025-12-09T14:30:25.123Z",
  "info": {
    "version": "1.2.3",
    "uid": "ABC123456789",
    "make": "NubeIO"
  },
  "tests": {
    "lora": {
      "pass": true,
      "txDone": 1,
      "rxDone": 1,
      "valueRx": 25,
      "raw": "+LORA:1,1,25",
      "message": "LoRa: TX=1, RX=1, Value=25"
    },
    "battery": {
      "pass": true,
      "voltage": 3.61,
      "raw": "+BAT:3.61",
      "message": "Battery: 3.61V"
    },
    "i2c": {
      "pass": true,
      "i2cAddress": "0x40",
      "temperature": 275,
      "humidity": 686,
      "raw": "+I2C:0x40,275,686",
      "message": "I2C: 0x40, Temp: 275, Hum: 686"
    }
  },
  "_eval": {
    "pass_lora": true,
    "pass_battery": true,
    "pass_i2c": true
  },
  "summary": {
    "passAll": true
  }
}
```

---

## ⚠️ Common Issues

### Issue 1: LoRa RX Failure (rxDone = 0)

**Symptom:** `+LORA:1,0,0` (TX success, RX fail)

**Causes:**
- LoRa gateway not in range
- Gateway not configured/powered
- Antenna not connected
- RF interference
- Wrong LoRa frequency/settings

**Solutions:**
1. Verify gateway is powered and operational
2. Move device closer to gateway (< 10m for testing)
3. Check antenna connection
4. Verify LoRa configuration matches gateway
5. Review gateway logs for received packets

### Issue 2: Battery Voltage Read Failure

**Symptom:** `+BAT:NOT VALUE` or no response

**Causes:**
- Battery not connected
- Battery fully discharged
- ADC hardware fault
- Voltage divider circuit issue

**Solutions:**
1. Verify battery is properly inserted
2. Check battery voltage with multimeter (should be > 3.0V)
3. Inspect battery connector for damage
4. Test with known-good battery
5. Check ADC reference voltage

### Issue 3: I2C Sensor Not Detected

**Symptom:** `+I2C:,0,0` or timeout

**Causes:**
- Sensor not soldered/connected
- I2C bus short or open circuit
- Wrong sensor address
- Sensor power supply issue
- SDA/SCL line faults

**Solutions:**
1. Visual inspection of sensor soldering
2. Verify sensor power supply (3.3V)
3. Test I2C bus with oscilloscope/logic analyzer
4. Try I2C bus scan: `AT+I2C=scan`
5. Check for solder bridges on I2C lines

---

## 🎯 Pass/Fail Criteria Summary

| Test | Pass Criteria | Fail Conditions |
|------|---------------|-----------------|
| **LoRa** | txDone=1 AND rxDone=1 | txDone=0 OR rxDone=0 |
| **Battery** | 0 < voltage < 5V | voltage ≤ 0 OR voltage ≥ 5 OR "NOT VALUE" |
| **I2C** | Valid address (0x40) AND finite temp AND finite humidity | Missing address OR null/NaN values |
| **Overall** | ALL tests PASS | ANY test FAIL |

---

## 📞 Support Resources

### For Test Operators:
- **Troubleshooting:** See [Droplet-Troubleshooting.md](./Droplet-Troubleshooting.md)
- **Test Procedures:** See [Droplet-TestCases.md](./Droplet-TestCases.md)
- **Hardware Info:** See [Droplet-Overview.md](./Droplet-Overview.md)

### For Developers:
- **Source Code:** See [Droplet-SourceCode.md](./Droplet-SourceCode.md)
- **Test Sequences:** See [Droplet-Sequence.md](./Droplet-Sequence.md)
- **API Reference:** `services/factory-testing.js` lines 1375-1493

### Contact Information:
- **Technical Support:** support@nube-io.com
- **Documentation Issues:** docs@nube-io.com
- **GitHub Repository:** https://github.com/NubeIO/NubeiO-Eol-Toolkit

---

## 📝 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-09 | Documentation Team | Initial release for Droplet GEN-2 |

---

## 📄 Related Documentation

- [Factory Testing Main Guide](../../../FACTORY_TESTING_GUIDE.md)
- [EOL Toolkit User Guide](../../../USER_GUIDE.md)
- [AT Command Reference](./Droplet-SourceCode.md#at-commands)
- [Hardware Specifications](./Droplet-Overview.md)

---

**End of Droplet README**
