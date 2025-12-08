# ACB-M Sequence Diagrams

**Device:** ACB-M (Advanced Control Board - Modbus)  
**Purpose:** Detailed test execution flows and message sequences  
**Last Updated:** December 8, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Test Sequence](#complete-test-sequence)
3. [Connection Phase](#connection-phase)
4. [Device Info Reading](#device-info-reading)
5. [Individual Test Sequences](#individual-test-sequences)
6. [Error Handling](#error-handling)
7. [State Machine](#state-machine)

---

## Overview

This document contains **15+ sequence diagrams** showing the complete flow of ACB-M factory testing, from connection through all 5 tests to result saving.

### Testing Layers

```mermaid
graph TB
    subgraph UI Layer
        PAGE[FactoryTestingPage.js<br/>User Interface]
    end
    
    subgraph Service Layer
        SERVICE[FactoryTestingService<br/>Test Orchestration]
    end
    
    subgraph Hardware Layer
        DEVICE[ACB-M Device<br/>STM32 Firmware]
    end
    
    PAGE -->|User Actions| SERVICE
    SERVICE -->|AT Commands| DEVICE
    DEVICE -->|Responses| SERVICE
    SERVICE -->|Status Updates| PAGE
    
    style SERVICE fill:#ff9999
```

---

## Complete Test Sequence

### End-to-End Flow (70+ Steps)

```mermaid
sequenceDiagram
    actor User
    participant UI as Factory Testing UI
    participant Service as FactoryTestingService
    participant Serial as SerialPort
    participant Device as ACB-M (STM32)
    
    Note over User,Device: PHASE 1: PRE-TESTING & CONNECTION
    User->>UI: Select ACB-M device
    User->>UI: Select COM port
    User->>UI: Click "Connect"
    
    UI->>Service: connect(portPath, 115200, false, 'ACB-M')
    Service->>Serial: new SerialPort(portPath, {baudRate: 115200})
    Serial-->>Service: Port opened
    
    Service->>Device: (Wait 500ms for device ready)
    Service->>Device: AT
    Device-->>Service: OK
    Note over Service: Connection established
    
    Note over User,Device: PHASE 2: DEVICE INFO READING
    Service->>UI: updateProgress('Reading device info...')
    
    Service->>Device: AT+VERSION?
    Device-->>Service: +VERSION:1.0.4\r\nOK
    Service->>Service: Parse version: "1.0.4"
    
    Service->>Device: AT+UID?
    Device-->>Service: +UID:3700310031305337\r\nOK
    Service->>Service: Parse UID: "3700310031305337"
    
    Service->>Device: AT+DEVICEMAKE?
    Device-->>Service: +DEVICEMAKE:ACB-M\r\nOK
    Service->>Service: Parse deviceMake: "ACB-M"
    
    Service->>UI: updateProgress('Device info read')
    Service->>UI: Emit 'connected' event
    UI->>UI: Show device info in panel
    
    Note over User,Device: PHASE 3: AUTOMATED TESTING
    UI->>Service: runFactoryTests('v2', 'ACB-M', preTesting)
    Service->>UI: updateProgress('ACB-M: Starting tests...')
    
    Note over Service,Device: TEST 1: UART LOOPBACK
    Service->>UI: updateProgress('ACB-M: Running UART test...')
    Service->>Device: AT+TEST=uart
    Device->>Device: Enable TX-RX loopback
    Device->>Device: Send 0xEE byte
    Device->>Device: Receive 0xEE byte
    Device-->>Service: +VALUE_UART:EE\r\nOK
    Service->>Service: Parse: value="EE", pass=true
    Service->>Service: resultsACB.tests.uart = {pass:true, value:"EE"}
    
    Note over Service,Device: TEST 2: RTC
    Service->>UI: updateProgress('ACB-M: Running RTC test...')
    Service->>Device: AT+TEST=rtc
    Device->>Device: Read RTC registers
    Device->>Device: Format timestamp
    Device-->>Service: +RTC:2001-01-01 12:34:56\r\nOK
    Service->>Service: Parse timestamp
    Service->>Service: Check within window: 2001-01-01 to 2001-01-02
    Service->>Service: resultsACB.tests.rtc = {pass:true, time:"..."}
    
    Note over Service,Device: TEST 3: WIFI
    Service->>UI: updateProgress('ACB-M: Running WiFi test...')
    Service->>Device: AT+TEST=wifi
    Device->>Device: Scan for networks (5-10 sec)
    Device->>Device: Connect to test SSID
    Device->>Device: Count networks, check connection
    Device-->>Service: +WIFI:6,1\r\nOK
    Service->>Service: Parse: networks=6, connected=1
    Service->>Service: Validate: networks>1 AND connected=1
    Service->>Service: resultsACB.tests.wifi = {pass:true, networks:6, connected:1}
    
    Note over Service,Device: TEST 4: ETHERNET
    Service->>UI: updateProgress('ACB-M: Running Ethernet test...')
    Service->>Device: AT+TEST=eth
    Device->>Device: Read MAC address from hardware
    Device->>Device: Get IP address (DHCP or static)
    Device->>Device: Check link status
    Device-->>Service: +ETH:MAC=84:1F:E8:10:9E:3B,IP=192.168.0.100\r\nOK
    Service->>Service: Parse MAC and IP
    Service->>Service: Validate: MAC valid, IP != 0.0.0.0
    Service->>Service: resultsACB.tests.eth = {pass:true, mac:"...", ip:"..."}
    
    Note over Service,Device: TEST 5: RS485-2
    Service->>UI: updateProgress('ACB-M: Running RS485-2 test...')
    Service->>Device: AT+TEST=rs4852
    Device->>Device: Send test pattern on RS485-2 TX
    Device->>Device: Receive on RS485-2 RX (loopback)
    Device->>Device: Count bytes, check integrity
    Device-->>Service: +RS485:30,0\r\nOK
    Service->>Service: Parse: count=30, status=0
    Service->>Service: Validate: status=0 (success)
    Service->>Service: resultsACB.tests.rs4852 = {pass:true, count:30, status:0}
    
    Note over Service,Device: PHASE 4: RESULT COMPILATION
    Service->>Service: Check all tests: pass_uart && pass_rtc && pass_wifi && pass_eth && pass_rs4852
    Service->>Service: resultsACB.summary = {passAll: true}
    Service->>UI: updateProgress('ACB-M tests completed')
    UI->>UI: Display results (all tests green ✅)
    
    Note over Service,Device: PHASE 5: SAVE RESULTS
    UI->>Service: saveResults()
    Service->>Service: Build CSV row
    Service->>Service: Build JSON structure
    Service->>Service: Write to logs/factory-results-acb-m.csv
    Service->>Service: Write to logs/factory-results-acb-m-[timestamp].json
    Service-->>UI: Results saved
    
    User->>UI: Review pass/fail
    User->>UI: Optional: Print label
    User->>UI: Click "Disconnect"
    UI->>Service: disconnect()
    Service->>Serial: port.close()
    Serial-->>Service: Port closed
    Service->>UI: Emit 'disconnected' event
    UI->>UI: Reset UI for next device
```

---

## Connection Phase

### Serial Port Connection (STM32)

```mermaid
sequenceDiagram
    participant Service as FactoryTestingService
    participant Serial as node-serialport
    participant Device as ACB-M STM32
    
    Service->>Serial: new SerialPort(portPath, config)
    Note over Serial: baudRate: 115200<br/>dataBits: 8<br/>stopBits: 1<br/>parity: none
    
    Serial->>Serial: Open COM port
    Serial->>Device: RTS/DTR signals
    Device->>Device: STM32 may reset (DTR toggle)
    
    alt Port Opens Successfully
        Serial-->>Service: 'open' event
        Service->>Service: Wait 500ms (device stabilization)
        Service->>Device: AT\r\n
        Device-->>Service: OK\r\n
        Service->>Service: isConnected = true
        Service-->>Service: {success: true}
    else Port Open Fails
        Serial-->>Service: 'error' event
        Service-->>Service: {success: false, error: "..."}
    end
```

**Key Differences from Micro Edge:**
- No unlock sequence required (STM32 doesn't use unlock)
- Shorter stabilization time (500ms vs 2000ms)
- Direct AT command response (no boot messages)

### Connection State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Opening: connect() called
    Opening --> Stabilizing: Port opened
    Stabilizing --> Testing: AT command OK
    Opening --> Failed: Port open error
    Testing --> Connected: Device responds
    Testing --> Failed: Timeout (no response)
    Connected --> Disconnecting: disconnect() called
    Failed --> Idle: Reset
    Disconnecting --> Idle: Port closed
    Idle --> [*]
    
    note right of Stabilizing
        Wait 500ms for
        STM32 initialization
    end note
    
    note right of Testing
        Send AT command
        Wait for OK response
    end note
```

---

## Device Info Reading

### Read Version, UID, Device Make

```mermaid
sequenceDiagram
    participant Service
    participant Device as ACB-M
    
    Note over Service: Reading device information (30s timeout per command)
    
    Service->>Device: AT+VERSION?\r\n
    Device->>Device: Read firmware version from flash
    Device-->>Service: +VERSION:1.0.4\r\nOK\r\n
    Service->>Service: deviceInfo.version = "1.0.4"
    
    Service->>Device: AT+UID?\r\n
    Device->>Device: Read STM32 unique ID (96-bit)
    Device->>Device: Format as hex string
    Device-->>Service: +UID:3700310031305337\r\nOK\r\n
    Service->>Service: deviceInfo.uid = "3700310031305337"
    
    Service->>Device: AT+DEVICEMAKE?\r\n
    Device->>Device: Read device type from config
    Device-->>Service: +DEVICEMAKE:ACB-M\r\nOK\r\n
    Service->>Service: deviceInfo.deviceMake = "ACB-M"
    
    Service->>Service: Validate device type matches 'ACB-M'
    Service-->>Service: Device info complete
```

**STM32 Unique ID:**
- 96-bit unique ID (12 bytes)
- Factory programmed by ST Microelectronics
- Cannot be modified
- Displayed as 16-character hex string (first 64 bits)

---

## Individual Test Sequences

### TEST 1: UART Loopback

```mermaid
sequenceDiagram
    participant Service
    participant Device as ACB-M
    participant UART as UART Hardware
    
    Service->>Device: AT+TEST=uart\r\n
    Note over Device: UART loopback test (30s timeout)
    
    Device->>UART: Configure loopback mode
    Note over UART: Connect TX to RX internally
    
    Device->>UART: Send 0xEE byte on TX
    UART->>UART: Internal loopback
    UART-->>Device: Receive 0xEE byte on RX
    
    alt Loopback Successful
        Device->>Device: value = "EE"
        Device-->>Service: +VALUE_UART:EE\r\nOK\r\n
        Service->>Service: Parse: value="EE"
        Service->>Service: pass = (value === "EE") ✅
    else Loopback Failed
        Device->>Device: value = "??" or timeout
        Device-->>Service: +VALUE_UART:??\r\nOK\r\n
        Service->>Service: Parse: value="??"
        Service->>Service: pass = false ❌
    end
    
    Service->>Service: resultsACB.tests.uart = {pass, value, raw, message}
```

**Pass Criteria:** Loopback value must exactly equal "EE"  
**Purpose:** Validates UART TX/RX hardware integrity, no shorts or opens

### TEST 2: RTC (Real-Time Clock)

```mermaid
sequenceDiagram
    participant Service
    participant Device as ACB-M
    participant RTC as RTC Module
    participant Battery as Backup Battery
    
    Service->>Device: AT+TEST=rtc\r\n
    Note over Device: RTC test (30s timeout)
    
    Device->>RTC: Read current time registers
    RTC->>RTC: Check battery backup status
    RTC->>Battery: Verify battery voltage > 2.5V
    Battery-->>RTC: Voltage OK
    
    RTC-->>Device: Timestamp: 2001-01-01 12:34:56
    Device->>Device: Format as string
    
    alt RTC Within Expected Window
        Device-->>Service: +RTC:2001-01-01 12:34:56\r\nOK\r\n
        Service->>Service: Parse timestamp
        Service->>Service: Convert to UTC: ts = Date.UTC(2001, 0, 1, 12, 34, 56)
        Service->>Service: Check: startWindow = 2001-01-01 00:00:30
        Service->>Service: Check: endWindow = 2001-01-02 00:00:00
        Service->>Service: Validate: ts >= startWindow && ts < endWindow
        Service->>Service: pass = true ✅
    else RTC Outside Window
        Device-->>Service: +RTC:1970-01-01 00:00:00\r\nOK\r\n
        Service->>Service: Parse timestamp (epoch start = uninitialized)
        Service->>Service: ts < startWindow
        Service->>Service: pass = false ❌
    end
    
    Service->>Service: resultsACB.tests.rtc = {pass, time, raw, message}
```

**Pass Criteria:** RTC time must be within 2001-01-01 00:00:30 to 2001-01-02 00:00:00  
**Purpose:** Validates RTC is initialized, battery backup present, timekeeping accurate

**RTC Initialization Window:**
- Devices are programmed with RTC set to 2001-01-01 at manufacturing
- Window allows for production line delays (up to 24 hours)
- If RTC shows 1970 or far future, it's uninitialized or battery dead

### TEST 3: WiFi Scan & Connect

```mermaid
sequenceDiagram
    participant Service
    participant Device as ACB-M
    participant WiFi as WiFi Module
    participant AP as Access Point
    
    Service->>Device: AT+TEST=wifi\r\n
    Note over Device: WiFi test (30s timeout)
    
    Device->>WiFi: Start network scan
    WiFi->>WiFi: Scan 2.4GHz channels 1-13
    WiFi->>AP: Probe requests
    AP-->>WiFi: Beacon responses
    WiFi->>WiFi: Build network list with RSSI
    WiFi-->>Device: Found 6 networks
    
    Device->>WiFi: Connect to test SSID
    WiFi->>AP: Association request
    AP-->>WiFi: Association response
    WiFi->>AP: DHCP request
    AP-->>WiFi: IP address assigned
    WiFi-->>Device: Connected, IP obtained
    
    alt WiFi Test Pass
        Device->>Device: networkCount = 6, connected = 1
        Device-->>Service: +WIFI:6,1\r\nOK\r\n
        Service->>Service: Parse: networks=6, connected=1
        Service->>Service: Validate: networks > 1 AND connected === 1
        Service->>Service: pass = true ✅
    else WiFi Test Fail
        Device->>Device: networkCount = 0 or connected = 0
        Device-->>Service: +WIFI:0,0\r\nOK\r\n
        Service->>Service: Parse: networks=0, connected=0
        Service->>Service: pass = false ❌
    end
    
    Service->>Service: resultsACB.tests.wifi = {pass, networks, connected, raw, message}
```

**Pass Criteria:** 
- Networks > 1 (proves WiFi radio functional)
- Connected = 1 (proves can associate to test AP)

**Purpose:** Validates WiFi module presence, RF functionality, protocol stack

### TEST 4: Ethernet Link & IP

```mermaid
sequenceDiagram
    participant Service
    participant Device as ACB-M
    participant ETH as Ethernet PHY
    participant Switch as Network Switch
    
    Service->>Device: AT+TEST=eth\r\n
    Note over Device: Ethernet test (30s timeout)
    
    Device->>ETH: Read hardware MAC address
    ETH->>ETH: MAC stored in OTP fuses or EEPROM
    ETH-->>Device: MAC = 84:1F:E8:10:9E:3B
    
    Device->>ETH: Check link status
    ETH->>Switch: Link pulse signals
    Switch-->>ETH: Link established
    ETH->>ETH: Auto-negotiate speed (10/100 Mbps)
    ETH-->>Device: Link UP, 100 Mbps Full Duplex
    
    Device->>ETH: Get IP address
    alt DHCP Enabled
        ETH->>Switch: DHCP Discover
        Switch-->>ETH: DHCP Offer (192.168.0.100)
        ETH->>Switch: DHCP Request
        Switch-->>ETH: DHCP Ack
        ETH-->>Device: IP = 192.168.0.100
    else Static IP
        ETH-->>Device: IP = (configured static)
    end
    
    Device->>Device: Format: MAC=xx:xx:xx:xx:xx:xx,IP=x.x.x.x
    Device-->>Service: +ETH:MAC=84:1F:E8:10:9E:3B,IP=192.168.0.100\r\nOK\r\n
    
    Service->>Service: Parse MAC and IP
    Service->>Service: Validate: MAC length >= 12 chars
    Service->>Service: Validate: IP !== "0.0.0.0"
    Service->>Service: pass = (MAC valid AND IP valid) ✅
    
    Service->>Service: resultsACB.tests.eth = {pass, mac, ip, linkStatus, raw, message}
```

**Pass Criteria:**
- MAC address: Valid (12+ characters, typically XX:XX:XX:XX:XX:XX format)
- IP address: Valid (not 0.0.0.0)

**Purpose:** Validates Ethernet PHY functional, MAC programmed, can obtain IP

**Alternative Response Format:**
```
+ETH:841FE8109E38,192.168.0.100,4/4
```
- Compact format: MAC (no colons), IP, link status (duplex/speed indicator)

### TEST 5: RS485-2 Loopback

```mermaid
sequenceDiagram
    participant Service
    participant Device as ACB-M
    participant RS485 as RS485 Transceiver
    participant Fixture as Test Fixture
    
    Service->>Device: AT+TEST=rs4852\r\n
    Note over Device: RS485-2 test (30s timeout)
    
    Device->>RS485: Enable RS485-2 driver
    Device->>RS485: Send test pattern (30 bytes)
    RS485->>Fixture: Differential signal A/B
    
    Note over Fixture: Loopback: A→A', B→B'<br/>(external jumper or test fixture)
    
    Fixture-->>RS485: Loopback signal
    RS485->>RS485: Receive 30 bytes
    RS485-->>Device: Data received
    
    Device->>Device: Compare TX vs RX
    Device->>Device: Count received bytes
    Device->>Device: Check data integrity
    
    alt RS485 Loopback Success
        Device->>Device: count = 30, status = 0
        Device-->>Service: +RS485:30,0\r\nOK\r\n
        Service->>Service: Parse: count=30, status=0
        Service->>Service: Validate: status === 0
        Service->>Service: pass = true ✅
    else RS485 Loopback Fail
        Device->>Device: count < 30 or status ≠ 0
        Device-->>Service: +RS485:15,1\r\nOK\r\n
        Service->>Service: Parse: count=15, status=1
        Service->>Service: pass = false ❌
    end
    
    Service->>Service: resultsACB.tests.rs4852 = {pass, count, status, raw, message}
```

**Pass Criteria:** Status = 0 (success)

**Purpose:** Validates RS485 transceiver functional, can transmit and receive

**Status Codes:**
- 0: Success (all bytes received correctly)
- 1: Partial failure (some bytes lost or corrupted)
- 2: Complete failure (no bytes received)

---

## Error Handling

### Timeout Handling

```mermaid
sequenceDiagram
    participant Service
    participant Device
    
    Service->>Device: AT+TEST=wifi\r\n
    Service->>Service: Start 30s timeout timer
    
    alt Device Responds in Time
        Device-->>Service: +WIFI:6,1\r\nOK\r\n (within 30s)
        Service->>Service: Clear timeout
        Service->>Service: Process result
    else Device Timeout
        Note over Service: 30 seconds elapsed
        Service->>Service: Timeout triggered
        Service->>Service: Reject promise with TimeoutError
        Service->>Service: resultsACB.tests.wifi = {pass:false, message:"WiFi test failed"}
    end
```

### Test Failure Recovery

```mermaid
stateDiagram-v2
    [*] --> RunningTests
    RunningTests --> TestFailed: Any test fails
    TestFailed --> ContinueTests: Continue to next test
    TestFailed --> AbortTests: Critical error
    ContinueTests --> RunningTests
    AbortTests --> SaveResults: Mark overall FAIL
    RunningTests --> AllTestsPass: All tests succeed
    AllTestsPass --> SaveResults: Mark overall PASS
    SaveResults --> [*]
    
    note right of TestFailed
        ACB-M continues all tests
        even if one fails (unlike
        some other devices)
    end note
```

**Error Recovery Strategy:**
- Continue all tests even if one fails
- Compile all results (pass and fail)
- Overall PASS requires ALL tests passing
- Save complete results for failure analysis

---

## State Machine

### Overall Test Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> PreTesting: User fills pre-test info
    PreTesting --> Connecting: User clicks "Connect"
    Connecting --> ReadingInfo: Connection successful
    ReadingInfo --> Testing: Device info read
    Connecting --> ConnectionFailed: Connection error
    ReadingInfo --> ReadInfoFailed: Timeout reading info
    
    Testing --> TestUART: Start UART test
    TestUART --> TestRTC: UART complete
    TestRTC --> TestWiFi: RTC complete
    TestWiFi --> TestEthernet: WiFi complete
    TestEthernet --> TestRS485: Ethernet complete
    TestRS485 --> EvaluatingResults: RS485 complete
    
    EvaluatingResults --> ResultsReady: All tests evaluated
    ResultsReady --> Printing: User clicks "Print Label"
    ResultsReady --> Disconnecting: User clicks "Disconnect"
    Printing --> Disconnecting: Label printed
    
    ConnectionFailed --> Idle: Reset
    ReadInfoFailed --> Idle: Reset
    Disconnecting --> Idle: Port closed
    
    Idle --> [*]
    
    note right of Testing
        5 tests run sequentially:
        1. UART Loopback
        2. RTC
        3. WiFi
        4. Ethernet
        5. RS485-2
    end note
    
    note right of EvaluatingResults
        Check all test results
        passAll = all tests passed
    end note
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-08 | Initial sequence diagram documentation |

---

## Related Documents

- [ACBM-README.md](./ACBM-README.md) - Main documentation index
- [ACBM-Overview.md](./ACBM-Overview.md) - Hardware specifications
- [ACBM-TestCases.md](./ACBM-TestCases.md) - Detailed test procedures
- [ACBM-SourceCode.md](./ACBM-SourceCode.md) - Software implementation
- [ACBM-Troubleshooting.md](./ACBM-Troubleshooting.md) - Issue resolution

---

**[← Back to ACB-M README](./ACBM-README.md)**
