# Micro Edge - Detailed Test Sequence Diagrams

## 📊 Complete Test Flow Documentation

This document provides detailed sequence diagrams showing **exactly how** the Micro Edge factory testing works, from start to finish.

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Test Sequence](#complete-test-sequence)
3. [Connection Phase](#connection-phase)
4. [Individual Test Sequences](#individual-test-sequences)
5. [Result Processing](#result-processing)
6. [Error Handling](#error-handling)

---

## Overview

### Testing Layers

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[FactoryTestingPage.js<br/>React UI]
    end
    
    subgraph "Communication Layer"
        Module[FactoryTestingModule.js<br/>IPC Client]
        IPC[IPC Handlers<br/>main.js]
    end
    
    subgraph "Business Logic Layer"
        Service[FactoryTestingService<br/>factory-testing.js]
    end
    
    subgraph "Hardware Layer"
        Serial[SerialPort<br/>Node.js]
        Device[Micro Edge<br/>ESP32 Board]
    end
    
    UI --> Module
    Module --> IPC
    IPC --> Service
    Service --> Serial
    Serial --> Device
    
    style UI fill:#E3F2FD
    style Service fill:#FFF3E0
    style Device fill:#E8F5E9
```

---

## Complete Test Sequence

### End-to-End Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as FactoryTestingPage
    participant Module as FactoryTestingModule
    participant IPC as main.js IPC
    participant Service as FactoryTestingService
    participant Serial as SerialPort
    participant Device as Micro Edge

    %% Selection Phase
    User->>UI: Select "Gen-1" → "Micro Edge"
    activate UI
    UI->>UI: Reset data, show pre-testing form
    UI-->>User: Display form
    deactivate UI

    %% Pre-Testing Phase
    User->>UI: Enter tester info, batch ID
    activate UI
    UI->>UI: Validate inputs
    UI->>UI: Save to localStorage
    UI-->>User: Show "Proceed to Testing"
    deactivate UI

    %% Proceed to Main Testing
    User->>UI: Click "Proceed to Testing"
    activate UI
    UI->>UI: Set mode = 'auto'
    UI->>UI: Set microEdgeStep = 'main'
    UI->>Module: loadSerialPorts()
    activate Module
    Module->>IPC: serialAPI.listPorts()
    IPC-->>Module: Port list
    Module->>Module: Start auto-detection loop
    Module-->>UI: Ports loaded
    deactivate Module
    UI-->>User: Show "Waiting for device..."
    deactivate UI

    %% Auto-Connection Phase
    loop Auto-Detection (every 3s)
        Module->>Module: Check if port available
        alt New Port Detected
            Module->>IPC: factoryTestingAPI.connect(port, 115200, true, 'Micro Edge')
            activate IPC
            IPC->>Service: connect(port, baudRate, useUnlock, deviceType)
            activate Service
            
            %% Connection Sequence
            Service->>Serial: new SerialPort(port, 115200)
            Service->>Serial: port.open()
            Serial->>Device: Open connection
            Device-->>Serial: Connected
            Serial-->>Service: Port opened
            
            Service->>Service: Wait 500ms
            Service->>Serial: Write "AT+UNLOCK=N00BIO\r\n"
            Serial->>Device: AT+UNLOCK=N00BIO
            Device->>Device: Process unlock command
            Device-->>Serial: OK
            Serial-->>Service: OK received
            
            Service->>Service: readDeviceInfo()
            Service->>Serial: Write "AT+WIFI?\r\n"
            Serial->>Device: AT+WIFI?
            Device-->>Serial: +WIFI:5,-45
            Serial-->>Service: WiFi info
            
            Service->>Serial: Write "AT+UNIQUEID?\r\n"
            Serial->>Device: AT+UNIQUEID?
            Device-->>Serial: +UNIQUEID:F8AC119F
            Serial-->>Service: Unique ID
            
            Service-->>IPC: {success: true, deviceInfo}
            deactivate Service
            IPC-->>Module: Connection successful
            deactivate IPC
            
            Module->>UI: Device connected event
            activate UI
            UI->>UI: Update connection status
            UI->>UI: Display device info
            UI->>UI: Show "Run Factory Tests" button
            UI-->>User: Device ready
            deactivate UI
        end
    end

    %% Test Execution Phase
    User->>UI: Click "Run Factory Tests" (Auto mode)
    activate UI
    UI->>Module: runFactoryTests('Micro Edge')
    activate Module
    Module->>IPC: factoryTestingAPI.runFactoryTests('Micro Edge')
    activate IPC
    IPC->>Service: runFactoryTests('Micro Edge')
    activate Service
    
    %% WiFi Test
    Service->>Service: updateProgress('WiFi Test')
    Service->>Serial: Write "AT+WIFI?\r\n"
    Serial->>Device: AT+WIFI?
    Device->>Device: Scan networks
    Device-->>Serial: +WIFI:5,-45
    Serial-->>Service: WiFi data
    Service->>Service: Parse: networks=5, rssi=-45
    Service->>Service: Evaluate: pass = (networks > 3 && rssi > -70)
    Service->>IPC: Progress event: "WiFi Test complete"
    IPC->>UI: Update progress bar
    UI-->>User: "WiFi Test: PASS"
    
    %% LoRa Test
    Service->>Service: updateProgress('LoRa Test')
    Service->>Serial: Write "AT+LORA?\r\n"
    Serial->>Device: AT+LORA?
    Device->>Device: Check LoRa module
    Device-->>Serial: +LORA:1,0x1234
    Serial-->>Service: LoRa data
    Service->>Service: Parse: detected=1, address=0x1234
    Service->>Service: Evaluate: pass = (detected == 1)
    Service->>IPC: Progress event: "LoRa Test complete"
    IPC->>UI: Update progress
    UI-->>User: "LoRa Test: PASS"
    
    %% More tests... (abbreviated)
    Note over Service,Device: Pulse Counter Test
    Note over Service,Device: DIP Switch Test
    Note over Service,Device: AIN1/AIN2/AIN3 Tests
    Note over Service,Device: Relay1/Relay2 Tests
    Note over Service,Device: VCC Voltage Test
    Note over Service,Device: Digital Input Test
    
    %% Results Compilation
    Service->>Service: Compile all results
    Service->>Service: Evaluate overall pass/fail
    Service-->>IPC: {success: true, data: results}
    deactivate Service
    IPC-->>Module: Test results
    deactivate IPC
    Module-->>UI: Results received
    deactivate Module
    
    UI->>UI: Display results
    UI->>UI: Show "Save & Print Label"
    UI-->>User: Results displayed
    deactivate UI
    
    %% Save and Print
    User->>UI: Click "Save & Print Label"
    activate UI
    UI->>Module: saveResults(...)
    Module->>IPC: Save to CSV and JSON
    IPC->>Service: saveResults(...)
    Service->>Service: Write to files
    Service-->>IPC: Saved
    IPC-->>Module: Success
    
    Module->>IPC: printLabel(data)
    IPC->>IPC: Call printer script
    IPC-->>Module: Label printed
    Module-->>UI: Complete
    UI-->>User: "✓ Test Complete, Label Printed"
    deactivate UI
```

---

## Connection Phase

### Detailed Connection Sequence

```mermaid
sequenceDiagram
    participant Module as FactoryTestingModule
    participant IPC as main.js
    participant Service as FactoryTestingService
    participant Serial as SerialPort
    participant Parser as ReadlineParser
    participant Device as Micro Edge

    Module->>IPC: connect(COM3, 115200, true, 'Micro Edge')
    activate IPC
    IPC->>Service: connect(COM3, 115200, true, 'Micro Edge')
    activate Service
    
    %% Initialize Port
    Service->>Service: Check if already connecting
    Service->>Service: Set isConnecting = true
    Service->>Service: Cleanup existing connections
    
    Service->>Serial: new SerialPort({path: COM3, baudRate: 115200})
    activate Serial
    Serial-->>Service: SerialPort instance
    
    Service->>Parser: port.pipe(new ReadlineParser({delimiter: '\n'}))
    activate Parser
    Parser-->>Service: Parser instance
    
    %% Open Port
    Service->>Serial: port.open()
    Serial->>Device: Open USB/UART connection
    Device-->>Serial: Connection established
    Serial-->>Service: open callback success
    Service->>Service: Set isConnected = true
    
    %% Wait for Device Ready
    Service->>Service: setTimeout(500ms)
    Note over Service: Wait for device to be ready
    
    %% Unlock Command
    Service->>Serial: Write "AT+UNLOCK=N00BIO\r\n"
    Serial->>Device: AT+UNLOCK=N00BIO
    activate Device
    Device->>Device: Validate unlock password
    Device->>Device: Enable factory test mode
    Device-->>Serial: OK\n
    deactivate Device
    
    Parser->>Parser: Parse line: "OK"
    Parser->>Service: data event: "OK"
    Service->>Service: Match "OK" response
    Service->>Service: Remove data listener
    Service->>Service: Unlock successful
    
    %% Read Device Info
    Note over Service,Device: Now read device information
    
    Service->>Serial: Write "AT+WIFI?\r\n"
    Serial->>Device: AT+WIFI?
    Device->>Device: Scan WiFi networks
    Device-->>Serial: +WIFI:5,-45\n
    Parser->>Service: data event: "+WIFI:5,-45"
    Service->>Service: Store WiFi info
    
    Service->>Serial: Write "AT+UNIQUEID?\r\n"
    Serial->>Device: AT+UNIQUEID?
    Device->>Device: Read unique ID from flash
    Device-->>Serial: +UNIQUEID:F8AC119F\n
    Parser->>Service: data event: "+UNIQUEID:F8AC119F"
    Service->>Service: Extract UID: F8AC119F
    
    Service->>Service: Set isConnecting = false
    Service-->>IPC: {success: true, port, baudRate, deviceInfo}
    deactivate Parser
    deactivate Serial
    deactivate Service
    IPC-->>Module: Connection result
    deactivate IPC
```

---

## Individual Test Sequences

### WiFi Test Sequence

```mermaid
sequenceDiagram
    participant Service as FactoryTestingService
    participant Serial as SerialPort
    participant Device as Micro Edge

    Service->>Service: updateProgress("Micro Edge: Running WiFi test...")
    Service->>Service: Start timeout timer (10000ms)
    
    Service->>Serial: Write "AT+WIFI?\r\n"
    Serial->>Device: AT+WIFI?
    
    activate Device
    Device->>Device: Start WiFi scan
    Note over Device: Scanning 2.4GHz channels<br/>Collect SSIDs and RSSI
    Device->>Device: Scan complete (2-5 seconds)
    Device-->>Serial: +WIFI:5,-45\n
    deactivate Device
    
    Serial->>Service: data event: "+WIFI:5,-45"
    Service->>Service: Clear timeout
    Service->>Service: Parse response
    Service->>Service: Extract networks = 5
    Service->>Service: Extract rssi = -45
    Service->>Service: Evaluate: pass = (5 > 3 && -45 > -70)
    Service->>Service: Store result: {pass: true, networks: 5, rssi: -45}
    Service->>Service: updateProgress("WiFi test complete: PASS")
```

### LoRa Test Sequence

```mermaid
sequenceDiagram
    participant Service as FactoryTestingService
    participant Serial as SerialPort
    participant Device as Micro Edge
    participant LoRa as LoRa Module (SX1276)

    Service->>Service: updateProgress("Micro Edge: Running LoRa test...")
    Service->>Service: Start timeout (10000ms)
    
    Service->>Serial: Write "AT+LORA?\r\n"
    Serial->>Device: AT+LORA?
    
    activate Device
    Device->>LoRa: Check SPI connection
    activate LoRa
    LoRa-->>Device: Module responds
    Device->>LoRa: Read version register
    LoRa-->>Device: Version: 0x12
    Device->>LoRa: Read device address
    LoRa-->>Device: Address: 0x1234
    deactivate LoRa
    Device->>Device: Format response
    Device-->>Serial: +LORA:1,0x1234\n
    deactivate Device
    
    Serial->>Service: data event: "+LORA:1,0x1234"
    Service->>Service: Clear timeout
    Service->>Service: Parse: detected=1, address=0x1234
    Service->>Service: Evaluate: pass = (detected == 1)
    Service->>Service: Store result: {pass: true, detected: true, address: "0x1234"}
```

### Pulse Counter Test Sequence

```mermaid
sequenceDiagram
    participant Service
    participant Serial
    participant Device
    participant Counter as Pulse Counter Circuit

    Service->>Serial: Write "AT+PULSES?\r\n"
    Serial->>Device: AT+PULSES?
    
    Device->>Counter: Read counter value
    Counter-->>Device: Current count: 0
    Device-->>Serial: +PULSES:0\n
    
    Serial->>Service: data event: "+PULSES:0"
    Service->>Service: Parse: count = 0
    Service->>Service: Evaluate: pass = (count >= 0)
    Service->>Service: Store: {pass: true, count: 0}
```

### Analog Input Test Sequence

```mermaid
sequenceDiagram
    participant Service
    participant Serial
    participant Device
    participant ADC as ADC Circuit

    %% AIN1 Test
    Service->>Serial: Write "AT+AIN1?\r\n"
    Serial->>Device: AT+AIN1?
    
    Device->>ADC: Read AIN1 channel
    ADC->>ADC: 12-bit conversion
    ADC-->>Device: Raw value: 3276 (80% of 4095)
    Device->>Device: Convert to voltage: 8.0V
    Device-->>Serial: +AIN1:8.0\n
    
    Serial->>Service: data event: "+AIN1:8.0"
    Service->>Service: Parse: voltage = 8.0
    Service->>Service: Evaluate: pass = (7.2V < 8.0V < 8.8V)
    Service->>Service: Store: {pass: true, voltage: 8.0}
    
    Note over Service,ADC: Repeat for AIN2 and AIN3
```

### Relay Control Test Sequence

```mermaid
sequenceDiagram
    participant Service
    participant Serial
    participant Device
    participant Relay1 as Relay 1 Circuit

    %% Turn Relay ON
    Service->>Serial: Write "AT+RELAY1=ON\r\n"
    Serial->>Device: AT+RELAY1=ON
    
    Device->>Relay1: Set GPIO HIGH
    Relay1->>Relay1: Energize coil
    Relay1->>Relay1: Contacts close
    Device-->>Serial: OK\n
    
    Serial->>Service: data event: "OK"
    Service->>Service: Relay ON command successful
    
    %% Read Relay Status
    Service->>Serial: Write "AT+RELAY1?\r\n"
    Serial->>Device: AT+RELAY1?
    
    Device->>Relay1: Read GPIO state
    Relay1-->>Device: State: HIGH (ON)
    Device-->>Serial: +RELAY1:ON\n
    
    Serial->>Service: data event: "+RELAY1:ON"
    Service->>Service: Parse: status = ON
    
    %% Turn Relay OFF
    Service->>Serial: Write "AT+RELAY1=OFF\r\n"
    Serial->>Device: AT+RELAY1=OFF
    
    Device->>Relay1: Set GPIO LOW
    Relay1->>Relay1: De-energize coil
    Relay1->>Relay1: Contacts open
    Device-->>Serial: OK\n
    
    Serial->>Service: data event: "OK"
    Service->>Service: Relay OFF command successful
    Service->>Service: Evaluate: pass = (ON and OFF both worked)
```

---

## Result Processing

### Compilation and Evaluation

```mermaid
flowchart TD
    Start([All Tests Complete]) --> Compile[Compile Results Object]
    
    Compile --> WiFi{WiFi Pass?}
    WiFi -->|Yes| WiFiEval[_eval.pass_wifi = true]
    WiFi -->|No| WiFiFail[_eval.pass_wifi = false]
    
    WiFiEval --> LoRa{LoRa Pass?}
    WiFiFail --> LoRa
    LoRa -->|Yes| LoRaEval[_eval.pass_lora = true]
    LoRa -->|No| LoRaFail[_eval.pass_lora = false]
    
    LoRaEval --> More[... Process all tests ...]
    LoRaFail --> More
    
    More --> EvalAll{All _eval flags true?}
    EvalAll -->|Yes| SetPass[summary.passAll = true]
    EvalAll -->|No| SetFail[summary.passAll = false]
    
    SetPass --> Return[Return results to UI]
    SetFail --> Return
    Return --> End([Complete])
    
    style Start fill:#90EE90
    style SetPass fill:#98FB98
    style SetFail fill:#FFB6C1
    style End fill:#87CEEB
```

### Result Storage Sequence

```mermaid
sequenceDiagram
    participant UI
    participant Module
    participant IPC
    participant Service
    participant FS as File System

    UI->>Module: saveResults(version, device, deviceInfo, testResults, preTesting)
    Module->>IPC: factoryTestingAPI.saveResults(...)
    IPC->>Service: saveResults(...)
    
    activate Service
    Service->>Service: Generate timestamp
    Service->>Service: Create folder: factory-test-results/Gen1/Micro-Edge/
    Service->>Service: Create filename: ME_F8AC119F_20251208_143045
    
    %% Save JSON
    Service->>FS: Write JSON file
    FS-->>Service: JSON saved
    
    %% Save/Update CSV
    Service->>Service: Format CSV row
    Service->>FS: Read existing CSV (if exists)
    FS-->>Service: Existing data
    Service->>Service: Append new row
    Service->>FS: Write updated CSV
    FS-->>Service: CSV saved
    
    %% Master CSV
    Service->>Service: Format master CSV row
    Service->>FS: Append to master.csv
    FS-->>Service: Master CSV updated
    
    Service-->>IPC: {success: true, files: [...]}
    deactivate Service
    IPC-->>Module: Save complete
    Module-->>UI: Files saved
```

---

## Error Handling

### Timeout Handling

```mermaid
stateDiagram-v2
    [*] --> SendCommand: Send AT Command
    SendCommand --> WaitingResponse: Set timeout timer
    
    state WaitingResponse {
        [*] --> Listening
        Listening --> DataReceived: Response arrives
        Listening --> Timeout: Timer expires
    }
    
    DataReceived --> ParseResponse: Clear timer
    ParseResponse --> ValidResponse: Data valid
    ParseResponse --> InvalidResponse: Data invalid
    
    ValidResponse --> [*]: Return success
    InvalidResponse --> [*]: Return error
    Timeout --> [*]: Return timeout error
    
    note right of Timeout
        Default: 5 seconds
        WiFi/LoRa: 10 seconds
        Long tests: 30 seconds
    end note
```

### Connection Error Recovery

```mermaid
flowchart TD
    Start([Connection Attempt]) --> Try{Try Connect}
    Try -->|Success| Connected([Connected])
    Try -->|Fail| Error[Connection Error]
    
    Error --> CheckRetry{Retry < 3?}
    CheckRetry -->|Yes| Wait[Wait 2 seconds]
    Wait --> Retry[Increment retry count]
    Retry --> Try
    
    CheckRetry -->|No| Failed([Connection Failed])
    
    Connected --> Unlock[Send Unlock Command]
    Unlock --> UnlockOK{Unlock OK?}
    UnlockOK -->|Yes| Success([Ready for Tests])
    UnlockOK -->|No| Cleanup[Cleanup Resources]
    Cleanup --> Failed
    
    style Connected fill:#90EE90
    style Success fill:#98FB98
    style Failed fill:#FFB6C1
```

### Test Failure Handling

```mermaid
sequenceDiagram
    participant Service
    participant Test as Test Function
    participant Error as Error Handler
    participant Results as Results Object

    Service->>Test: Run WiFi Test
    activate Test
    
    Test->>Test: Send command, wait for response
    alt Timeout
        Test-->>Error: Timeout error
        activate Error
        Error->>Results: Store {pass: false, error: "Timeout"}
        Error-->>Service: Continue to next test
        deactivate Error
    else Device Error
        Test-->>Error: Device returned ERROR
        activate Error
        Error->>Results: Store {pass: false, error: "Device error"}
        Error-->>Service: Continue to next test
        deactivate Error
    else Success
        Test->>Results: Store {pass: true, data: ...}
        Test-->>Service: Success
    end
    deactivate Test
    
    Service->>Service: Continue with remaining tests
    Note over Service: Tests are independent<br/>One failure doesn't stop others
```

---

## State Machine

### Overall Test State

```mermaid
stateDiagram-v2
    [*] --> Idle: Page Loaded
    Idle --> PreTesting: Device Selected
    PreTesting --> Connecting: Proceed Clicked
    Connecting --> Connected: Device Found
    Connecting --> Idle: Connection Failed
    Connected --> Testing: Start Tests
    Testing --> ResultsReady: Tests Complete
    ResultsReady --> Printing: Print Label
    ResultsReady --> Idle: Reset/New Device
    Printing --> Idle: Print Complete
    
    state Testing {
        [*] --> WiFiTest
        WiFiTest --> LoRaTest
        LoRaTest --> PulseTest
        PulseTest --> DIPTest
        DIPTest --> AIN_Tests
        AIN_Tests --> RelayTests
        RelayTests --> VCCTest
        VCCTest --> DigitalTest
        DigitalTest --> [*]
    }
    
    note right of Testing
        Each test is independent
        Failures logged but don't stop flow
    end note
```

---

## 📊 Summary

### Key Takeaways

1. **Connection is Critical** - Must unlock device before testing
2. **Tests are Sequential** - But independent (one fail doesn't stop others)
3. **Timeouts are Essential** - Prevent hanging on faulty devices
4. **Progress Updates** - Keep UI responsive during long tests
5. **Result Compilation** - All results stored for analysis

### Timing Breakdown

| Phase | Duration | Can Fail? |
|-------|----------|-----------|
| Connection | 2-5s | Yes - critical |
| Unlock | 1s | Yes - critical |
| Device Info | 2-3s | No - optional |
| WiFi Test | 3-5s | Yes - logged |
| LoRa Test | 2-3s | Yes - logged |
| Other Tests | 20-30s | Yes - logged |
| **Total** | **30-50s** | **Continues on failure** |

---

**Next:** See [Test Cases](./MicroEdge-TestCases.md) for detailed test specifications
