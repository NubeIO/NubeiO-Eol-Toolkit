# ZC-LCD Troubleshooting Guide

**Device:** ZC-LCD (Zone Controller with LCD)  
**Target Audience:** Test Operators, Support Engineers, QA  
**Last Updated:** December 9, 2025

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Connection Issues](#connection-issues)
3. [WiFi Test Failures](#wifi-test-failures)
4. [RS485 Test Failures](#rs485-test-failures)
5. [I2C Sensor Test Failures](#i2c-sensor-test-failures)
6. [LCD Touch Test Failures](#lcd-touch-test-failures)
7. [State Diagrams](#state-diagrams)
8. [Root Cause Analysis](#root-cause-analysis)
9. [Escalation Procedures](#escalation-procedures)

---

## Quick Diagnostics

### 5-Minute Diagnostic Flowchart

```mermaid
flowchart TD
    START([Test Failure]) --> Q1{Device<br/>Powers On?}
    Q1 -->|No| PWR[Check Power Supply<br/>Verify 12-24V DC<br/>Check connections]
    Q1 -->|Yes| Q2{Can<br/>Connect via<br/>UART?}
    
    Q2 -->|No| UART[Check USB Cable<br/>Verify COM Port<br/>Check baud rate 115200]
    Q2 -->|Yes| Q3{Which<br/>Test Failed?}
    
    Q3 -->|WiFi| WIFI_DIAG[See WiFi Diagnostics]
    Q3 -->|RS485| RS485_DIAG[See RS485 Diagnostics]
    Q3 -->|I2C| I2C_DIAG[See I2C Diagnostics]
    Q3 -->|LCD| LCD_DIAG[See LCD Diagnostics]
    Q3 -->|Multiple| MULTI[Check Common Issues<br/>Firmware version<br/>Power stability]
    
    PWR --> END[Resolve & Retest]
    UART --> END
    WIFI_DIAG --> END
    RS485_DIAG --> END
    I2C_DIAG --> END
    LCD_DIAG --> END
    MULTI --> END
    
    style START fill:#FFB6C6
    style END fill:#90EE90
```

### Quick Reference Table

| Symptom | Most Likely Cause | Quick Fix | Section |
|---------|-------------------|-----------|---------|
| Cannot connect | Wrong COM port | Check Device Manager | [Connection](#connection-issues) |
| WiFi fails | No APs nearby | Move closer to WiFi router | [WiFi](#wifi-test-failures) |
| RS485 wrong value | No loopback | Connect RS485 test jumper | [RS485](#rs485-test-failures) |
| I2C fails | Sensor not detected | Check SHT40 soldering | [I2C](#i2c-sensor-test-failures) |
| LCD touchCount=0 | User didn't touch | Remind operator to touch screen | [LCD](#lcd-touch-test-failures) |
| All tests fail | Firmware issue | Reflash firmware, check version | [Root Cause](#root-cause-analysis) |

---

## Connection Issues

### Problem: Cannot Connect to ZC-LCD

#### State Diagram: Connection States

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Attempting : User clicks Connect
    Attempting --> Connected : Serial port opens
    Attempting --> Error_Port : Port not found
    Attempting --> Error_Busy : Port in use
    Attempting --> Error_Permission : Access denied
    
    Error_Port --> Disconnected : User fixes issue
    Error_Busy --> Disconnected : Close other app
    Error_Permission --> Disconnected : Admin rights
    
    Connected --> Testing : Start tests
    Testing --> Results : Tests complete
    Results --> Disconnected : Disconnect
    
    Connected --> Error_Lost : Device unplugged
    Testing --> Error_Lost : Connection lost
    Error_Lost --> Disconnected : Reconnect
```

#### Symptom: "Port not found" or "Cannot open port"

**Diagnostic Steps:**

1. **Check Physical Connection**
   ```
   ✓ USB cable plugged into PC
   ✓ USB cable plugged into ZC-LCD UART header
   ✓ LED on USB-UART adapter lit (if present)
   ```

2. **Verify COM Port in Device Manager (Windows)**
   ```
   Open Device Manager → Ports (COM & LPT)
   Look for: "USB Serial Port (COMx)" or "CH340" or "FTDI"
   Note the COM port number (e.g., COM3, COM15)
   ```

3. **Check for Port Conflicts**
   ```
   Close other applications that might use serial ports:
   - Arduino IDE
   - PuTTY
   - Other factory test instances
   - Serial terminal emulators
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **USB cable disconnected** | Reconnect USB cable firmly |
| **Wrong COM port selected** | Select correct COM port from dropdown |
| **Driver not installed** | Install CH340 or FTDI driver |
| **Port in use by another app** | Close conflicting application |
| **USB hub issue** | Connect directly to PC USB port |

#### Symptom: "Connection timeout"

**Diagnostic Steps:**

1. **Verify Baud Rate**
   ```
   Expected: 115200
   Check settings in application
   ```

2. **Check Device Power**
   ```
   ✓ Power LED on ZC-LCD lit
   ✓ LCD screen displays something
   ✓ Power supply 12-24V DC within spec
   ```

3. **Test UART with Serial Terminal**
   ```
   Use PuTTY or similar:
   - Port: COMx
   - Baud: 115200
   - Data: 8 bits
   - Parity: None
   - Stop bits: 1
   
   Type: AT<Enter>
   Expected response: OK
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Wrong baud rate** | Set baud rate to 115200 |
| **Device not powered** | Check power supply voltage |
| **Firmware not responding** | Reset device, reflash firmware |
| **UART hardware fault** | Check TX/RX connections, replace device |

---

## WiFi Test Failures

### Problem: WiFi Test Fails (networks ≤ 1 or connected = 0)

#### State Diagram: WiFi Test States

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Scanning : AT+TEST=wifi received
    Scanning --> Scan_Complete : Networks found
    Scanning --> Scan_Failed : Timeout / No networks
    
    Scan_Complete --> Connecting : Attempt connection
    Connecting --> Connected : Auth successful
    Connecting --> Connect_Failed : Auth failed
    
    Connected --> Pass : Report success
    Scan_Failed --> Fail : Report failure
    Connect_Failed --> Fail : Report partial
    
    Pass --> [*] : +WIFI:6,1
    Fail --> [*] : +WIFI:0,0 or +WIFI:5,0
```

#### Symptom: networks = 0 (No networks detected)

**Diagnostic Steps:**

1. **Check WiFi Environment**
   ```
   Test with phone:
   - Open WiFi settings on smartphone
   - Count visible 2.4 GHz networks
   - Should see at least 2 networks
   ```

2. **Check Antenna Connection**
   ```
   ✓ Antenna cable connected to U.FL connector
   ✓ Antenna not damaged or bent excessively
   ✓ Connector clicked into place (not loose)
   ```

3. **Verify WiFi Module Power**
   ```
   Measure: 3.3V at WiFi module power pin
   Check: ESP32 power LED (if present)
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **No WiFi APs in range** | Move test station closer to router (< 3 meters) |
| **Antenna disconnected** | Reconnect antenna U.FL connector |
| **Antenna damaged** | Replace antenna |
| **Shielded environment** | Move out of metal enclosure |
| **WiFi module fault** | Reflash firmware, replace module if needed |

#### Symptom: networks = 1 (Only one network)

**Diagnostic Steps:**

1. **Survey WiFi Environment**
   ```
   Use WiFi analyzer app:
   - Scan for 2.4 GHz networks
   - Should detect 2+ networks minimum
   ```

2. **Move Test Station**
   ```
   Relocate to area with more APs:
   - Near office areas
   - Near public spaces
   - Away from isolated rooms
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Isolated location** | Move test bench to area with multiple APs |
| **Weak antenna** | Replace antenna, check connection |
| **Test environment issue** | Add additional AP for testing |

#### Symptom: connected = 0 (Cannot connect)

**Diagnostic Steps:**

1. **Verify Test AP Configuration**
   ```
   Check firmware configuration:
   - Test SSID matches actual AP
   - Password is correct
   - AP is 2.4 GHz (not 5 GHz only)
   - AP security is WPA2-PSK (not Enterprise)
   ```

2. **Check AP Status**
   ```
   ✓ AP powered on and broadcasting
   ✓ AP not at client limit
   ✓ AP not MAC filtering
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Wrong SSID in firmware** | Update firmware with correct test SSID |
| **Wrong password** | Update firmware with correct password |
| **AP not available** | Check AP is powered and working |
| **AP security incompatible** | Use WPA2-PSK, not WPA-Enterprise |

#### WiFi Failure Decision Tree

```mermaid
graph TD
    A[WiFi Test Failed] --> B{Response<br/>Received?}
    B -->|No| C[Timeout<br/>→ Check power, firmware]
    B -->|Yes| D{Parse<br/>Success?}
    D -->|No| E[Format Error<br/>→ Firmware bug]
    D -->|Yes| F{networks?}
    F -->|0| G[No APs detected<br/>→ Check antenna, environment]
    F -->|1| H[Only 1 AP<br/>→ Move to better location]
    F -->|>1| I{connected?}
    I -->|0| J[Connection failed<br/>→ Check SSID/password]
    I -->|1| K[Should PASS<br/>→ Check pass logic]
    
    style C fill:#FFB6C6
    style E fill:#FFB6C6
    style G fill:#FFB6C6
    style H fill:#FFB6C6
    style J fill:#FFB6C6
    style K fill:#90EE90
```

---

## RS485 Test Failures

### Problem: RS485 Test Fails (value ≠ 4096)

#### State Diagram: RS485 Test States

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Transmitting : AT+TEST=rs485 received
    Transmitting --> Loopback : Send value 4096
    Loopback --> Receiving : Switch to RX mode
    
    Receiving --> Received : Data captured
    Receiving --> Timeout : No data
    
    Received --> Comparing : Parse value
    Comparing --> Pass : value == 4096
    Comparing --> Fail : value != 4096
    
    Timeout --> Fail : Report timeout
    
    Pass --> [*] : +RS485:4096
    Fail --> [*] : +RS485:xxxx
```

#### Symptom: value = 0

**Diagnostic Steps:**

1. **Check Loopback Connection**
   ```
   Verify test fixture:
   ✓ A line connected: TX-A to RX-A
   ✓ B line connected: TX-B to RX-B
   ✓ Jumper wires secure
   ✓ No broken traces on fixture
   ```

2. **Verify RS485 Transceiver Power**
   ```
   Measure: 5V or 3.3V at RS485 IC power pin
   Check: IC not overheating
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **No loopback connected** | Connect A-to-A, B-to-B jumper wires |
| **Broken fixture** | Repair or replace test fixture |
| **RS485 IC not powered** | Check power supply to transceiver |

#### Symptom: value ≠ 4096 (wrong value)

**Diagnostic Steps:**

1. **Identify Value Pattern**
   ```
   Common patterns:
   - value = 0:      No loopback
   - value = 65535:  Inverted (A/B swapped)
   - value = 4095:   Single bit error
   - Random value:   Noise, baud rate mismatch
   ```

2. **Check Differential Signaling**
   ```
   With oscilloscope:
   - Measure A-B differential voltage
   - Should see ±1.5V to ±5V
   - Clean square waves, no ringing
   ```

**Solutions:**

| Value Received | Likely Cause | Solution |
|----------------|--------------|----------|
| **0** | No loopback | Connect A/B loopback |
| **65535 (0xFFFF)** | A/B lines swapped | Swap A and B connections |
| **4095** | Single bit flip | Check for noise, grounding |
| **Random** | Baud rate mismatch | Verify UART baud rate config |

#### Symptom: Timeout (no response)

**Diagnostic Steps:**

1. **Check UART Configuration**
   ```
   Verify RS485 UART settings:
   - Baud rate: 9600 or 115200
   - Data: 8 bits
   - Parity: None
   - Stop bits: 1
   ```

2. **Check Direction Control**
   ```
   RS485 transceiver has DE (Driver Enable) pin:
   ✓ DE pin connected to GPIO
   ✓ DE toggles TX→RX correctly
   ✓ Timing: DE before TX, !DE after TX
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **RS485 IC fault** | Replace RS485 transceiver |
| **DE pin not working** | Check GPIO configuration |
| **UART not configured** | Reflash firmware |

---

## I2C Sensor Test Failures

### Problem: I2C Test Fails (sensor not detected or invalid data)

#### State Diagram: I2C Test States

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Addressing : AT+TEST=i2c received
    Addressing --> ACK : Sensor responds
    Addressing --> NACK : Sensor not found
    
    ACK --> Measuring : Send measure command
    Measuring --> Reading : Wait conversion
    Reading --> Data_Valid : Parse temp/hum
    Reading --> Data_Invalid : CRC error
    
    Data_Valid --> Pass : Values in range
    Data_Invalid --> Fail : Report error
    NACK --> Fail : Sensor not detected
    
    Pass --> [*] : +I2C:0x40,266,671
    Fail --> [*] : Timeout or error
```

#### Symptom: Timeout / No response

**Diagnostic Steps:**

1. **Check SHT40 Sensor Presence**
   ```
   Visual inspection:
   ✓ SHT40 IC soldered on PCB
   ✓ Part number matches: SHT40 (not SHT30, SHT31)
   ✓ No visible solder bridges
   ✓ Orientation correct (pin 1 marker)
   ```

2. **Verify I2C Bus**
   ```
   Measure with multimeter (power off):
   - SDA line continuity: ESP32 GPIO21 to SHT40 SDA
   - SCL line continuity: ESP32 GPIO22 to SHT40 SCL
   - Pull-up resistors: 4.7kΩ on SDA and SCL to 3.3V
   ```

3. **Check Sensor Power**
   ```
   Measure (power on):
   - VDD at SHT40: 3.3V ±0.3V
   - GND at SHT40: 0V
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Sensor not soldered** | Solder SHT40 sensor |
| **Wrong sensor model** | Replace with SHT40 (not SHT30/31) |
| **I2C bus open circuit** | Check traces, repair if broken |
| **Missing pull-ups** | Add 4.7kΩ resistors to SDA/SCL |
| **Sensor damaged** | Replace SHT40 sensor |

#### Symptom: Wrong address (not 0x40)

**Diagnostic Steps:**

1. **Identify Actual Address**
   ```
   From response:
   +I2C:0x44,250,500  → Address is 0x44
   
   I2C address table:
   0x40: SHT40 (correct)
   0x44: SHT30/SHT31 (wrong part)
   0x45: SHT35 (wrong part)
   ```

2. **Verify Part Number**
   ```
   Check IC markings:
   - SHT40: Correct sensor
   - SHT30/31/35: Wrong sensor family
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Wrong sensor installed** | Replace with SHT40 (address 0x40) |
| **BOM error** | Update BOM to specify SHT40 |

#### Symptom: Invalid temperature or humidity values

**Diagnostic Steps:**

1. **Identify Value Pattern**
   ```
   Common patterns:
   - temp = 0, hum = 0:      Sensor not measuring
   - temp = -40, hum = 0:    Sensor returning default
   - temp = 999, hum = 999:  Communication error
   - Values out of range:    CRC error, bad data
   ```

2. **Check Environmental Conditions**
   ```
   Expected ranges (factory floor):
   - Temperature: 200-300 (20-30°C)
   - Humidity: 300-700 (30-70% RH)
   
   If outside:
   - Too cold: < 150 (15°C) → Check HVAC
   - Too hot: > 350 (35°C) → Check HVAC
   ```

**Solutions:**

| Value Pattern | Cause | Solution |
|---------------|-------|----------|
| **0, 0** | Sensor not initialized | Reset device, reflash firmware |
| **-400, 0** | Sensor fault | Replace SHT40 |
| **Out of range** | Environmental issue | Move to normal temp/humidity area |
| **Random** | I2C bus noise | Add capacitors, check grounding |

#### I2C Troubleshooting Flowchart

```mermaid
graph TD
    A[I2C Test Failed] --> B{Timeout?}
    B -->|Yes| C[Check sensor present<br/>Check I2C bus continuity]
    B -->|No| D{Wrong<br/>address?}
    D -->|Yes| E[Wrong sensor model<br/>→ Replace with SHT40]
    D -->|No| F{Invalid<br/>values?}
    F -->|Yes| G{Values = 0?}
    G -->|Yes| H[Sensor not measuring<br/>→ Check power, reset]
    G -->|No| I{Out of<br/>range?}
    I -->|Yes| J[Environmental issue<br/>→ Check temp/humidity]
    I -->|No| K[Communication error<br/>→ Check I2C bus integrity]
    
    style C fill:#FFB6C6
    style E fill:#FFB6C6
    style H fill:#FFB6C6
    style J fill:#FFB6C6
    style K fill:#FFB6C6
```

---

## LCD Touch Test Failures

### Problem: LCD Touch Test Fails (touchCount ≤ 2)

#### State Diagram: LCD Touch Test States

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Displaying : AT+TEST=lcd received
    Displaying --> Waiting : Show "Touch screen" message
    
    state Waiting {
        [*] --> No_Touch
        No_Touch --> Touch_1 : Touch event
        Touch_1 --> Touch_2 : Touch event
        Touch_2 --> Touch_3 : Touch event
        Touch_3 --> Touch_More : Touch events...
    }
    
    Waiting --> Evaluating : 10 seconds elapsed
    
    Evaluating --> Pass : touchCount > 2
    Evaluating --> Fail : touchCount <= 2
    
    Pass --> [*] : +LCD:5
    Fail --> [*] : +LCD:0,1,2
```

#### Symptom: touchCount = 0 (No touches detected)

**Diagnostic Steps:**

1. **Operator Training Issue**
   ```
   Interview operator:
   - Did you see the test message?
   - Did you touch the screen?
   - Did you touch 3 or more times?
   - Was there visual feedback?
   ```

2. **Check LCD Display**
   ```
   Visual verification:
   ✓ LCD screen powered on (backlight lit)
   ✓ Message "Touch screen..." visible
   ✓ Touch counter updates on screen
   ```

3. **Test Touch Manually**
   ```
   During test:
   - Touch screen firmly 5+ times
   - Touch different areas (center, corners)
   - Watch for counter increment
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Operator didn't touch** | Re-run test, remind operator |
| **Operator too slow** | Train: touch quickly, 3-5 times |
| **Screen not responding** | Check touch controller (next section) |

#### Symptom: touchCount = 0 (repeated failures)

**Diagnostic Steps:**

1. **Check Touch Controller Power**
   ```
   Measure:
   - Touch controller VDD: 3.3V
   - I2C bus voltage: 3.3V on SDA/SCL
   ```

2. **Test Touch Controller I2C**
   ```
   Expected:
   - Touch controller at I2C address (e.g., 0x38)
   - Responds to I2C scan
   - Generates interrupt on touch
   ```

3. **Check Touch Panel Connection**
   ```
   Inspect:
   ✓ Flex cable from touch panel to PCB
   ✓ FPC connector locked (flip down)
   ✓ No torn flex cable
   ✓ Proper contact at all pins
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Touch controller not powered** | Check 3.3V supply |
| **I2C bus fault** | Check SDA/SCL connections |
| **Flex cable disconnected** | Reconnect flex cable, lock connector |
| **Touch panel damaged** | Replace LCD module |
| **Touch controller IC fault** | Replace touch controller IC |

#### Symptom: touchCount = 1 or 2 (Insufficient touches)

**Diagnostic Steps:**

1. **Operator Behavior**
   ```
   Observe:
   - Is operator touching quickly enough?
   - Are touches registering (counter updating)?
   - Is debounce too aggressive?
   ```

2. **Touch Sensitivity**
   ```
   Test with different finger pressures:
   - Light touch: May not register
   - Firm touch: Should register reliably
   - Very firm: Risk damaging screen
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Operator too cautious** | Train: 3-5 quick touches |
| **Low sensitivity** | Adjust touch threshold in firmware |
| **Screen dirty** | Clean screen with microfiber cloth |

#### Symptom: Intermittent touch detection

**Diagnostic Steps:**

1. **Check Physical Condition**
   ```
   Inspect touch panel:
   ✓ No cracks or scratches
   ✓ No air bubbles (if laminated)
   ✓ No moisture ingress
   ✓ Clean surface
   ```

2. **Test Different Areas**
   ```
   Touch mapping:
   - Center: Works / Doesn't work
   - Top-left: Works / Doesn't work
   - Top-right: Works / Doesn't work
   - Bottom-left: Works / Doesn't work
   - Bottom-right: Works / Doesn't work
   
   Identify dead zones
   ```

**Solutions:**

| Cause | Solution |
|-------|----------|
| **Screen damaged** | Replace LCD module |
| **Dead zones** | RMA, manufacturing defect |
| **Calibration issue** | Recalibrate touch (if supported) |
| **EMI interference** | Check grounding, shielding |

#### LCD Touch Failure Flowchart

```mermaid
graph TD
    A[LCD Touch Failed] --> B{touchCount?}
    B -->|0| C{Operator<br/>touched?}
    C -->|No| D[Operator error<br/>→ Retrain, retest]
    C -->|Yes| E[Hardware issue<br/>→ Check touch controller]
    
    B -->|1 or 2| F{Operator<br/>rushed?}
    F -->|Yes| G[Operator training<br/>→ Touch 3-5 times]
    F -->|No| H[Sensitivity issue<br/>→ Adjust firmware threshold]
    
    E --> I{I2C<br/>responds?}
    I -->|No| J[Touch controller fault<br/>→ Check power, I2C bus]
    I -->|Yes| K[Panel damaged<br/>→ Replace LCD]
    
    style D fill:#FFB74D
    style G fill:#FFB74D
    style J fill:#FFB6C6
    style K fill:#FFB6C6
```

---

## State Diagrams

### Overall Device Test State Machine

```mermaid
stateDiagram-v2
    [*] --> PowerOff
    
    PowerOff --> Booting : Apply power
    Booting --> Idle : Firmware ready
    
    Idle --> Testing : AT+TEST commands
    
    state Testing {
        [*] --> WiFi
        WiFi --> RS485 : Test complete
        RS485 --> I2C : Test complete
        I2C --> LCD : Test complete
        LCD --> [*] : All complete
    }
    
    Testing --> Results : All tests done
    Results --> Idle : Ready for next unit
    
    Idle --> PowerOff : Remove power
    
    Testing --> Error : Critical failure
    Error --> Idle : Reset/Reflash
    
    note right of Testing
        Each test can fail
        independently without
        halting the sequence
    end note
    
    note right of Error
        Critical errors:
        - Firmware crash
        - Watchdog reset
        - Hardware fault
    end note
```

### Test Failure Recovery State Machine

```mermaid
stateDiagram-v2
    [*] --> First_Failure
    
    First_Failure --> Retry_1 : Operator retries
    Retry_1 --> Pass : Test passes
    Retry_1 --> Second_Failure : Test fails again
    
    Second_Failure --> Check_Fixture : Inspect connections
    Check_Fixture --> Retry_2 : Fixture OK
    Check_Fixture --> Fix_Fixture : Fixture problem
    Fix_Fixture --> Retry_2 : Repaired
    
    Retry_2 --> Pass : Test passes
    Retry_2 --> Third_Failure : Test fails again
    
    Third_Failure --> Engineering : Escalate
    Engineering --> RMA : Hardware defect
    Engineering --> Firmware_Update : Software issue
    Engineering --> Pass : Resolved
    
    Pass --> [*]
    RMA --> [*]
    Firmware_Update --> Retry_2
```

---

## Root Cause Analysis

### Failure Pattern Analysis

#### Pattern 1: All Tests Fail

**Symptoms:**
- WiFi: timeout
- RS485: timeout  
- I2C: timeout
- LCD: timeout

**Root Causes:**
1. Device not powered
2. UART connection broken
3. Firmware not loaded/corrupted
4. Wrong baud rate

**Diagnostic Tree:**
```mermaid
graph TD
    A[All Tests Fail] --> B{Power LED<br/>On?}
    B -->|No| C[Check power supply<br/>Verify 12-24V DC]
    B -->|Yes| D{LCD<br/>Display On?}
    D -->|No| E[Check 5V rail<br/>LCD backlight fault]
    D -->|Yes| F{UART<br/>responds to AT?}
    F -->|No| G[Check UART connection<br/>Verify baud rate]
    F -->|Yes| H[Firmware issue<br/>Reflash firmware]
```

#### Pattern 2: WiFi-Only Failure

**Symptoms:**
- WiFi: networks=0 or connected=0
- RS485: pass
- I2C: pass
- LCD: pass

**Root Causes:**
1. Antenna problem
2. WiFi module fault
3. RF shielding issue
4. Test environment (no APs)

#### Pattern 3: Touch-Only Failure

**Symptoms:**
- WiFi: pass
- RS485: pass
- I2C: pass
- LCD: touchCount=0

**Root Causes:**
1. Operator error (most common)
2. Touch controller fault
3. Flex cable disconnected
4. Touch panel damaged

### Common Failure Modes

| Failure Mode | Frequency | Impact | Fix Time |
|--------------|-----------|--------|----------|
| **Operator error (LCD)** | 40% | Low | <1 min (retrain) |
| **WiFi environment** | 20% | Medium | 5 min (relocate) |
| **RS485 loopback** | 15% | Low | 2 min (reconnect) |
| **I2C sensor fault** | 10% | High | 30 min (replace) |
| **Antenna disconnected** | 8% | Medium | 5 min (reconnect) |
| **Firmware issue** | 5% | Medium | 10 min (reflash) |
| **Hardware defect** | 2% | Critical | RMA |

---

## Escalation Procedures

### Escalation Levels

```mermaid
graph TD
    L1[Level 1: Operator<br/>Self-Service] --> L2[Level 2: Lead Technician<br/>Advanced Diagnostics]
    L2 --> L3[Level 3: Engineering<br/>Hardware/Firmware]
    L3 --> L4[Level 4: RMA/Vendor<br/>Defective Units]
    
    L1 -.Timeout: 5 min.-> L2
    L2 -.Timeout: 15 min.-> L3
    L3 -.Timeout: 1 hour.-> L4
    
    style L1 fill:#90EE90
    style L2 fill:#FFB74D
    style L3 fill:#FFB6C6
    style L4 fill:#E57373
```

### Level 1: Operator Self-Service (0-5 minutes)

**Operator Actions:**
1. Retry test once
2. Check obvious issues:
   - Power connected?
   - USB cable connected?
   - WiFi AP nearby?
   - Did I touch the screen?
3. Refer to quick reference table
4. If unresolved → Escalate to Level 2

### Level 2: Lead Technician (5-15 minutes)

**Lead Technician Actions:**
1. Review test logs
2. Check test fixture:
   - RS485 loopback connected?
   - All connections secure?
3. Inspect DUT visually:
   - SHT40 sensor present?
   - Antenna connected?
   - LCD screen intact?
4. Test with known-good fixture
5. If unresolved → Escalate to Level 3

### Level 3: Engineering (15-60 minutes)

**Engineering Actions:**
1. Analyze failure patterns
2. Check firmware version
3. Reflash firmware if needed
4. Test individual subsystems:
   - WiFi module
   - RS485 transceiver
   - I2C sensor
   - Touch controller
5. Determine: Rework or RMA
6. If defective → Escalate to Level 4

### Level 4: RMA/Vendor (>1 hour)

**RMA Process:**
1. Document failure mode
2. Tag device with RMA number
3. Return to vendor or rework station
4. Root cause analysis by vendor

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-09 | Initial troubleshooting guide for ZC-LCD | Documentation Team |

---

**Related Documentation:**
- [← Back to ZC-LCD README](./ZCLCD-README.md)
- [← Hardware Overview](./ZCLCD-Overview.md)
- [← Sequence Diagrams](./ZCLCD-Sequence.md)
- [← Test Cases](./ZCLCD-TestCases.md)
- [← Source Code Manual](./ZCLCD-SourceCode.md)
