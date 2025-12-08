# ZC-LCD Sequence Diagrams

**Device:** ZC-LCD (Zone Controller with LCD)  
**Purpose:** Test execution flows and message sequences  
**Last Updated:** December 9, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Test Sequence](#complete-test-sequence)
3. [Connection Sequence](#connection-sequence)
4. [Device Info Reading](#device-info-reading)
5. [WiFi Test Sequence](#wifi-test-sequence)
6. [RS485 Test Sequence](#rs485-test-sequence)
7. [I2C Sensor Test Sequence](#i2c-sensor-test-sequence)
8. [LCD Touch Test Sequence](#lcd-touch-test-sequence)
9. [Results Processing](#results-processing)
10. [Error Handling Flows](#error-handling-flows)
11. [State Diagrams](#state-diagrams)
12. [Timing Diagrams](#timing-diagrams)

---

## Overview

This document contains **15+ sequence diagrams** showing the interaction between the Test PC (EOL Toolkit), the ZC-LCD device firmware, and hardware subsystems during factory testing. These diagrams help developers and testers understand the test flow and timing requirements.

### Diagram Legend

```mermaid
graph LR
    A[Test PC] -->|AT Command| B[ZC-LCD]
    B -->|Response| A
    B -->|Internal| C[Hardware]
    
    style A fill:#99ff99
    style B fill:#ff9999
    style C fill:#99ccff
```

- **Green:** Test equipment (PC, EOL Toolkit)
- **Red:** ZC-LCD firmware/software
- **Blue:** Hardware subsystems

---

## Complete Test Sequence

### High-Level Test Flow

```mermaid
sequenceDiagram
    participant PC as Test PC<br/>(EOL Toolkit)
    participant UART as UART Interface
    participant FW as ZC-LCD Firmware
    participant WIFI as WiFi Module
    participant RS485 as RS485 Port
    participant I2C as I2C Sensor
    participant LCD as LCD Display
    
    Note over PC,LCD: Factory Testing Complete Sequence
    
    PC->>UART: Connect (115200 baud)
    UART->>FW: Connection established
    FW-->>PC: OK
    
    Note over PC,FW: Phase 1: Device Info
    PC->>FW: AT+VERSION?
    FW-->>PC: +VERSION:2.1.0
    PC->>FW: AT+UID?
    FW-->>PC: +UID:A4B1C8D2E3F4A1B2
    PC->>FW: AT+DEVICEMAKE?
    FW-->>PC: +DEVICEMAKE:ZC-LCD
    
    Note over PC,LCD: Phase 2: Run Tests
    
    rect rgb(200, 220, 255)
        Note over PC,WIFI: Test 1: WiFi
        PC->>FW: AT+TEST=wifi
        FW->>WIFI: Scan networks
        WIFI-->>FW: 6 networks found
        FW->>WIFI: Connect to test SSID
        WIFI-->>FW: Connected
        FW-->>PC: +WIFI:6,1
    end
    
    rect rgb(255, 220, 200)
        Note over PC,RS485: Test 2: RS485
        PC->>FW: AT+TEST=rs485
        FW->>RS485: Send test pattern (4096)
        RS485-->>FW: Loopback received (4096)
        FW-->>PC: +RS485:4096
    end
    
    rect rgb(220, 255, 200)
        Note over PC,I2C: Test 3: I2C Sensor
        PC->>FW: AT+TEST=i2c
        FW->>I2C: Read sensor (0x40)
        I2C-->>FW: Temp=266, Hum=671
        FW-->>PC: +I2C:0x40,266,671
    end
    
    rect rgb(255, 240, 200)
        Note over PC,LCD: Test 4: LCD Touch
        PC->>FW: AT+TEST=lcd
        FW->>LCD: Display "Touch screen..."
        Note over LCD: User touches 5 times
        LCD-->>FW: Touch events captured
        FW-->>PC: +LCD:5
    end
    
    Note over PC,FW: Phase 3: Results
    PC->>PC: Evaluate all tests
    PC->>PC: Save results (CSV + JSON)
    PC->>UART: Disconnect
```

### Test Timeline

```mermaid
gantt
    title ZC-LCD Factory Testing Timeline
    dateFormat ss
    axisFormat %S
    
    section Connection
    Connect to device     :a1, 00, 3s
    
    section Device Info
    Read VERSION          :a2, 03, 2s
    Read UID              :a3, 05, 2s
    Read DEVICEMAKE       :a4, 07, 2s
    
    section Tests
    WiFi Test             :a5, 09, 10s
    RS485 Test            :a6, 19, 8s
    I2C Sensor Test       :a7, 27, 5s
    LCD Touch Test        :a8, 32, 10s
    
    section Finalization
    Process Results       :a9, 42, 2s
    Save Logs             :a10, 44, 1s
```

**Total Duration:** ~45 seconds (including user interaction)

---

## Connection Sequence

### Initial Connection

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant Driver as USB-UART Driver
    participant UART as ZC-LCD UART
    participant FW as Firmware
    
    Note over PC,FW: Connection Establishment
    
    PC->>Driver: Open COM port (115200, 8N1)
    activate Driver
    Driver->>UART: Initialize serial port
    activate UART
    UART->>FW: Signal DTR/RTS
    activate FW
    
    FW->>FW: Initialize AT command parser
    FW->>UART: Ready for commands
    UART->>Driver: Port ready
    Driver-->>PC: Connection successful
    deactivate FW
    deactivate UART
    deactivate Driver
    
    Note over PC: Update UI: "Connected"
    
    PC->>FW: AT (test command)
    FW-->>PC: OK
    
    Note over PC: Connection verified
```

### Connection State Diagram

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting : User clicks "Connect"
    Connecting --> Connected : Serial port opens successfully
    Connecting --> Disconnected : Connection failed
    
    Connected --> Reading_Info : Auto-start device info read
    Reading_Info --> Running_Tests : Info read complete
    Running_Tests --> Connected : Tests complete
    
    Connected --> Disconnecting : User clicks "Disconnect"
    Disconnecting --> Disconnected : Port closed
    
    Running_Tests --> Error : Test timeout/error
    Error --> Connected : Retry
    Error --> Disconnected : Fatal error
```

---

## Device Info Reading

### Version, UID, and Device Make

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant FW as ZC-LCD Firmware
    participant FLASH as Flash Memory
    
    Note over PC,FLASH: Device Information Reading
    
    rect rgb(230, 230, 255)
        Note over PC,FW: Read VERSION
        PC->>FW: AT+VERSION?
        activate FW
        FW->>FLASH: Read firmware version
        FLASH-->>FW: "2.1.0"
        FW-->>PC: +VERSION:2.1.0
        FW-->>PC: OK
        deactivate FW
        Note over PC: Store version
    end
    
    rect rgb(230, 255, 230)
        Note over PC,FW: Read UID
        PC->>FW: AT+UID?
        activate FW
        FW->>FLASH: Read unique ID
        FLASH-->>FW: "A4B1C8D2E3F4A1B2"
        FW-->>PC: +UID:A4B1C8D2E3F4A1B2
        FW-->>PC: OK
        deactivate FW
        Note over PC: Store UID
    end
    
    rect rgb(255, 240, 230)
        Note over PC,FW: Read DEVICEMAKE
        PC->>FW: AT+DEVICEMAKE?
        activate FW
        FW->>FLASH: Read device type
        FLASH-->>FW: "ZC-LCD"
        FW-->>PC: +DEVICEMAKE:ZC-LCD
        FW-->>PC: OK
        deactivate FW
        Note over PC: Store device make
    end
    
    Note over PC: Verify: Make == "ZC-LCD"
    
    alt Device Make Matches
        Note over PC: Proceed to tests
    else Wrong Device
        Note over PC: Show error: "Wrong device type"
    end
```

---

## WiFi Test Sequence

### WiFi Scan and Connect

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant FW as ZC-LCD Firmware
    participant WIFI as WiFi Module
    participant AP as WiFi Access Point
    
    Note over PC,AP: WiFi Test Sequence
    
    PC->>FW: AT+TEST=wifi
    activate FW
    Note over FW: Parse command
    
    FW->>WIFI: wifi_scan_start()
    activate WIFI
    Note over WIFI: Start passive scan
    
    WIFI->>AP: Scan request (broadcast)
    AP-->>WIFI: Beacon frames
    
    Note over WIFI: Collect SSIDs
    WIFI->>WIFI: Build network list
    WIFI-->>FW: Scan complete (6 networks)
    deactivate WIFI
    
    Note over FW: Count networks
    Note over FW: networkCount = 6
    
    FW->>WIFI: wifi_connect("TestSSID", "password")
    activate WIFI
    WIFI->>AP: Authentication request
    AP-->>WIFI: Authentication success
    WIFI->>AP: Association request
    AP-->>WIFI: Association success
    WIFI->>AP: DHCP request
    AP-->>WIFI: IP address assigned
    WIFI-->>FW: Connected (IP: 192.168.1.x)
    deactivate WIFI
    
    Note over FW: connected = 1
    
    FW->>FW: Format response
    FW-->>PC: +WIFI:6,1
    FW-->>PC: OK
    deactivate FW
    
    Note over PC: Parse response
    Note over PC: networks=6, connected=1
    Note over PC: PASS (networks>1 && connected==1)
```

### WiFi Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Scanning : AT+TEST=wifi received
    Scanning --> Scan_Complete : Networks found
    Scanning --> Scan_Failed : Timeout / No networks
    
    Scan_Complete --> Connecting : Attempt connection
    Connecting --> Connected : Authentication success
    Connecting --> Connect_Failed : Authentication failed
    
    Connected --> Reporting : Build response
    Scan_Failed --> Reporting : Report failure
    Connect_Failed --> Reporting : Report partial success
    
    Reporting --> [*] : Send +WIFI:count,status
```

### WiFi Test Flowchart

```mermaid
graph TD
    A[Receive AT+TEST=wifi] --> B[Initialize WiFi]
    B --> C[Start Scan]
    C --> D{Scan Timeout?}
    D -->|Yes| E[networkCount = 0]
    D -->|No| F[Collect Networks]
    F --> G[Count SSIDs]
    G --> H{Networks > 0?}
    H -->|No| E
    H -->|Yes| I[Attempt Connection]
    I --> J{Connect Success?}
    J -->|Yes| K[connected = 1]
    J -->|No| L[connected = 0]
    K --> M[Format Response]
    L --> M
    E --> M
    M --> N[Send +WIFI:count,status]
    N --> O{networks>1 && connected==1?}
    O -->|Yes| P[Test PASS]
    O -->|No| Q[Test FAIL]
    
    style P fill:#90EE90
    style Q fill:#FFB6C6
```

---

## RS485 Test Sequence

### RS485 Loopback Test

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant FW as ZC-LCD Firmware
    participant RS485 as RS485 Transceiver
    participant LOOP as Loopback Fixture
    
    Note over PC,LOOP: RS485 Loopback Test
    
    PC->>FW: AT+TEST=rs485
    activate FW
    Note over FW: Parse command
    
    FW->>RS485: Configure UART (9600 baud)
    Note over RS485: Set to transmit mode
    
    FW->>FW: Prepare test pattern
    Note over FW: value = 4096 (0x1000)
    
    FW->>RS485: Send data (4096)
    activate RS485
    RS485->>LOOP: TX differential signal (A/B)
    Note over LOOP: Loopback: A→A, B→B
    LOOP-->>RS485: RX differential signal
    deactivate RS485
    
    Note over RS485: Switch to receive mode
    RS485->>FW: Data received
    
    FW->>FW: Read received data
    Note over FW: receivedValue = 4096
    
    FW->>FW: Compare sent vs received
    
    alt Value Matches
        Note over FW: pass = true
        FW-->>PC: +RS485:4096
    else Value Mismatch
        Note over FW: pass = false
        FW-->>PC: +RS485:<wrong_value>
    end
    
    FW-->>PC: OK
    deactivate FW
    
    Note over PC: Parse response
    Note over PC: PASS if value == 4096
```

### RS485 Internal Flow

```mermaid
graph TD
    A[AT+TEST=rs485] --> B[Configure RS485 UART]
    B --> C[Enable TX mode]
    C --> D[Send test pattern<br/>value=4096]
    D --> E[Wait for transmission<br/>complete]
    E --> F[Switch to RX mode]
    F --> G[Wait for data<br/>timeout=8s]
    G --> H{Data Received?}
    H -->|No| I[value = null<br/>FAIL]
    H -->|Yes| J[Read received value]
    J --> K{value == 4096?}
    K -->|Yes| L[PASS<br/>Send +RS485:4096]
    K -->|No| M[FAIL<br/>Send +RS485:value]
    I --> N[Send Error]
    L --> O[End]
    M --> O
    N --> O
    
    style L fill:#90EE90
    style M fill:#FFB6C6
    style I fill:#FFB6C6
```

### RS485 Timing Diagram

```mermaid
sequenceDiagram
    participant FW as Firmware
    participant TX as TX Pin
    participant RX as RX Pin
    
    Note over FW,RX: RS485 Loopback Timing
    
    FW->>TX: Enable TX driver
    Note over TX: DE=1 (Driver Enable)
    
    FW->>TX: Send 0x10 (MSB)
    Note over TX: 8 bits @ 9600 baud
    FW->>TX: Send 0x00 (LSB)
    Note over TX: Total: 4096 (0x1000)
    
    Note over TX: Transmission time: ~2ms
    
    FW->>TX: Disable TX driver
    Note over TX: DE=0
    
    FW->>RX: Enable RX mode
    Note over RX: RE=0 (Receiver Enable)
    
    Note over RX: Loopback delay: <1ms
    
    RX->>FW: Receive 0x10 (MSB)
    RX->>FW: Receive 0x00 (LSB)
    
    Note over FW: Data received: 4096
    Note over FW: Compare: MATCH
```

---

## I2C Sensor Test Sequence

### SHT40 Sensor Reading

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant FW as ZC-LCD Firmware
    participant I2C as I2C Bus
    participant SHT40 as SHT40 Sensor (0x40)
    
    Note over PC,SHT40: I2C Sensor Test Sequence
    
    PC->>FW: AT+TEST=i2c
    activate FW
    Note over FW: Parse command
    
    FW->>I2C: i2c_start()
    FW->>I2C: Send address: 0x40 (write)
    I2C->>SHT40: Address byte
    SHT40-->>I2C: ACK
    
    FW->>I2C: Send command: 0xFD (measure high precision)
    I2C->>SHT40: Command byte
    SHT40-->>I2C: ACK
    FW->>I2C: i2c_stop()
    
    Note over SHT40: Sensor measuring<br/>Conversion time: ~8ms
    
    FW->>FW: delay(10ms)
    
    FW->>I2C: i2c_start()
    FW->>I2C: Send address: 0x40 (read)
    I2C->>SHT40: Address byte
    SHT40-->>I2C: ACK
    
    SHT40->>I2C: Temp MSB
    SHT40->>I2C: Temp LSB
    SHT40->>I2C: Temp CRC
    SHT40->>I2C: Hum MSB
    SHT40->>I2C: Hum LSB
    SHT40->>I2C: Hum CRC
    I2C-->>FW: 6 bytes received
    FW->>I2C: i2c_stop()
    
    Note over FW: Calculate temperature
    Note over FW: Calculate humidity
    Note over FW: temp = 266 (26.6°C)
    Note over FW: hum = 671 (67.1% RH)
    
    FW->>FW: Validate values
    
    alt Valid Sensor Data
        FW-->>PC: +I2C:0x40,266,671
    else Invalid Data
        FW-->>PC: +I2C:error
    end
    
    FW-->>PC: OK
    deactivate FW
    
    Note over PC: Parse: address, temp, hum
    Note over PC: PASS if all valid
```

### I2C Communication Flowchart

```mermaid
graph TD
    A[AT+TEST=i2c] --> B[Initialize I2C Bus<br/>400 kHz]
    B --> C[Send Measure Command<br/>Address 0x40, Cmd 0xFD]
    C --> D{ACK Received?}
    D -->|No| E[Sensor not found<br/>FAIL]
    D -->|Yes| F[Wait 10ms<br/>for conversion]
    F --> G[Read 6 bytes<br/>from sensor]
    G --> H{Data Valid?}
    H -->|No| I[CRC Error<br/>FAIL]
    H -->|Yes| J[Parse Temperature<br/>and Humidity]
    J --> K[Multiply by 10<br/>for integer format]
    K --> L{Values in Range?}
    L -->|No| M[Out of range<br/>FAIL]
    L -->|Yes| N[Format Response<br/>+I2C:0x40,temp,hum]
    N --> O[PASS]
    E --> P[Send Error]
    I --> P
    M --> P
    O --> Q[End]
    P --> Q
    
    style O fill:#90EE90
    style E fill:#FFB6C6
    style I fill:#FFB6C6
    style M fill:#FFB6C6
```

### SHT40 Data Conversion

```mermaid
graph LR
    A[Raw 16-bit Temp<br/>0x5F83] --> B[Convert to Celsius<br/>-45 + 175*(raw/65535)]
    B --> C[Result: 26.6°C]
    C --> D[Multiply by 10<br/>266]
    D --> E[Send to PC<br/>temp=266]
    
    F[Raw 16-bit Hum<br/>0xABCD] --> G[Convert to %RH<br/>100*(raw/65535)]
    G --> H[Result: 67.1% RH]
    H --> I[Multiply by 10<br/>671]
    I --> J[Send to PC<br/>hum=671]
    
    style E fill:#90EE90
    style J fill:#90EE90
```

---

## LCD Touch Test Sequence

### Touch Detection and Counting

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant FW as ZC-LCD Firmware
    participant LCD as LCD Display
    participant TOUCH as Touch Controller
    participant USER as Test Operator
    
    Note over PC,USER: LCD Touch Test Sequence
    
    PC->>FW: AT+TEST=lcd
    activate FW
    Note over FW: Parse command
    
    FW->>FW: Initialize touch counter = 0
    FW->>LCD: Clear screen
    FW->>LCD: Display message:<br/>"Touch the screen 3+ times"
    
    Note over FW: Start 10-second timer
    
    loop Touch Detection Loop (10 seconds)
        USER->>TOUCH: Touch screen
        TOUCH->>TOUCH: Detect capacitance change
        TOUCH->>FW: Interrupt signal (GPIO)
        FW->>TOUCH: Read touch coordinates (I2C)
        TOUCH-->>FW: X=160, Y=240 (example)
        FW->>FW: Increment counter
        Note over FW: touchCount++
        FW->>LCD: Update display<br/>"Touches: X"
        Note over FW: Debounce delay (200ms)
    end
    
    Note over FW: Timer expired
    Note over FW: Final touchCount = 5
    
    FW->>FW: Evaluate result
    
    alt touchCount > 2
        Note over FW: pass = true
        FW-->>PC: +LCD:5
    else touchCount <= 2
        Note over FW: pass = false
        FW-->>PC: +LCD:1 (insufficient)
    end
    
    FW-->>PC: OK
    deactivate FW
    
    Note over PC: Parse touchCount
    Note over PC: PASS if count > 2
```

### Touch Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Initializing : AT+TEST=lcd received
    Initializing --> Waiting_For_Touch : Display message
    
    Waiting_For_Touch --> Touch_Detected : Touch event
    Touch_Detected --> Debouncing : Increment counter
    Debouncing --> Waiting_For_Touch : After 200ms
    
    Waiting_For_Touch --> Timeout : 10 seconds elapsed
    Touch_Detected --> Timeout : 10 seconds elapsed
    Debouncing --> Timeout : 10 seconds elapsed
    
    Timeout --> Evaluating : Count touches
    Evaluating --> Pass : touchCount > 2
    Evaluating --> Fail : touchCount <= 2
    
    Pass --> [*] : Send +LCD:count
    Fail --> [*] : Send +LCD:count
```

### Touch Test Flowchart

```mermaid
graph TD
    A[AT+TEST=lcd] --> B[Clear LCD screen]
    B --> C[Display instruction<br/>"Touch screen 3+ times"]
    C --> D[Initialize counter = 0]
    D --> E[Start 10-second timer]
    E --> F{Touch Event?}
    F -->|Yes| G[Read touch coordinates]
    G --> H[Increment counter]
    H --> I[Update display<br/>show count]
    I --> J[Debounce delay 200ms]
    J --> F
    F -->|No, Timer| K{Timeout?}
    K -->|No| F
    K -->|Yes| L{touchCount > 2?}
    L -->|Yes| M[PASS<br/>Send +LCD:count]
    L -->|No| N[FAIL<br/>Send +LCD:count]
    M --> O[End]
    N --> O
    
    style M fill:#90EE90
    style N fill:#FFB6C6
```

### Touch Event Timing

```mermaid
sequenceDiagram
    participant TOUCH as Touch Controller
    participant INT as Interrupt Pin
    participant FW as Firmware
    participant LCD as Display
    
    Note over TOUCH,LCD: Touch Event Timing
    
    Note over TOUCH: Idle (scanning at 100 Hz)
    
    TOUCH->>TOUCH: Detect touch
    Note over TOUCH: Capacitance threshold exceeded
    
    TOUCH->>INT: Assert interrupt (LOW)
    Note over INT: GPIO interrupt triggered
    
    INT->>FW: ISR called
    activate FW
    FW->>TOUCH: Read touch data (I2C)
    TOUCH-->>FW: X=160, Y=240
    FW->>FW: Increment counter
    FW->>LCD: Update display
    deactivate FW
    
    Note over FW: Debounce period: 200ms
    Note over FW: Ignore further touches
    
    TOUCH->>INT: De-assert interrupt (HIGH)
    Note over INT: Ready for next touch
```

---

## Results Processing

### Test Results Aggregation

```mermaid
sequenceDiagram
    participant FW as ZC-LCD Firmware
    participant PC as Test PC
    participant UI as User Interface
    participant LOGGER as File Logger
    
    Note over FW,LOGGER: Results Processing
    
    FW-->>PC: All tests complete
    
    PC->>PC: Aggregate results object
    
    Note over PC: resultsZC = {<br/>  info: {version, uid, make},<br/>  tests: {wifi, rs485, i2c, lcd},<br/>  _eval: {pass_wifi, pass_rs485, etc}<br/>}
    
    PC->>PC: Evaluate pass/fail
    
    loop For each test
        PC->>PC: Check _eval[test] == true
    end
    
    PC->>PC: allPass = all tests passed?
    
    alt All Tests Passed
        PC->>UI: Update status: ✅ PASS
        Note over UI: Green indicator
    else Any Test Failed
        PC->>UI: Update status: ❌ FAIL
        Note over UI: Red indicator
    end
    
    PC->>LOGGER: Save CSV row
    Note over LOGGER: Append to factory-results-zc-lcd.csv
    
    PC->>LOGGER: Save JSON file
    Note over LOGGER: Create factory-results-zc-lcd-[timestamp].json
    
    PC->>UI: Display detailed results
    Note over UI: Show all test outcomes
```

### Results Evaluation Logic

```mermaid
graph TD
    A[All tests completed] --> B{WiFi Test}
    B -->|networks>1 && connected==1| C{RS485 Test}
    B -->|FAIL| Z[Overall FAIL]
    
    C -->|value==4096| D{I2C Test}
    C -->|FAIL| Z
    
    D -->|Valid address & readings| E{LCD Test}
    D -->|FAIL| Z
    
    E -->|touchCount>2| F[All tests PASS]
    E -->|FAIL| Z
    
    F --> G[Set passAll = true]
    Z --> H[Set passAll = false]
    
    G --> I[Save results]
    H --> I
    
    I --> J[Update UI]
    J --> K[Log to file]
    
    style F fill:#90EE90
    style Z fill:#FFB6C6
```

---

## Error Handling Flows

### Timeout Handling

```mermaid
sequenceDiagram
    participant PC as Test PC
    participant FW as ZC-LCD Firmware
    
    Note over PC,FW: Command Timeout Handling
    
    PC->>FW: AT+TEST=wifi
    Note over PC: Start 30-second timeout timer
    
    alt Normal Response
        FW-->>PC: +WIFI:6,1 (within 10s)
        FW-->>PC: OK
        Note over PC: Cancel timeout timer
        Note over PC: Process result
    else Timeout Occurs
        Note over FW: Device not responding
        Note over PC: 30 seconds elapsed
        Note over PC: Timeout timer fires
        PC->>PC: Mark test as FAILED
        Note over PC: Error: "WiFi test timeout"
        PC->>PC: Continue to next test
    end
```

### Connection Loss Handling

```mermaid
stateDiagram-v2
    [*] --> Connected
    
    Connected --> Running_Test : Test command sent
    Running_Test --> Test_Complete : Response received
    Test_Complete --> Connected : Ready for next test
    
    Running_Test --> Connection_Lost : Serial error
    Connected --> Connection_Lost : Serial error
    
    Connection_Lost --> Reconnecting : Auto-reconnect attempt
    Reconnecting --> Connected : Success
    Reconnecting --> Failed : Max retries exceeded
    
    Failed --> [*] : Abort testing
```

### Error Response Handling

```mermaid
graph TD
    A[Send AT Command] --> B[Wait for Response]
    B --> C{Response Type?}
    
    C -->|+PREFIX:data| D[Expected response]
    C -->|ERROR| E[Device error]
    C -->|Unknown command| F[Unsupported command]
    C -->|Timeout| G[No response]
    
    D --> H[Parse data]
    H --> I[Mark test result]
    
    E --> J[Log error message]
    J --> K[Mark test FAIL]
    
    F --> L[Check firmware version]
    L --> M[Mark test FAIL]
    
    G --> N[Retry command]
    N --> O{Retry < 3?}
    O -->|Yes| A
    O -->|No| P[Mark test FAIL]
    
    I --> Q[Continue to next test]
    K --> Q
    M --> Q
    P --> Q
    
    style I fill:#90EE90
    style K fill:#FFB6C6
    style M fill:#FFB6C6
    style P fill:#FFB6C6
```

---

## State Diagrams

### Overall Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting : User action
    Connecting --> Connected : Serial port opened
    Connecting --> Error : Connection failed
    
    Connected --> Reading_Info : Auto-start
    Reading_Info --> Info_Complete : VERSION, UID, MAKE read
    Reading_Info --> Error : Timeout / Parse error
    
    Info_Complete --> Test_WiFi : Start tests
    Test_WiFi --> Test_RS485 : WiFi complete
    Test_RS485 --> Test_I2C : RS485 complete
    Test_I2C --> Test_LCD : I2C complete
    Test_LCD --> Processing_Results : LCD complete
    
    Test_WiFi --> Error : Test failed critically
    Test_RS485 --> Error : Test failed critically
    Test_I2C --> Error : Test failed critically
    Test_LCD --> Error : Test failed critically
    
    Processing_Results --> Results_Ready : Evaluation complete
    Results_Ready --> Connected : Stay connected
    Results_Ready --> Disconnecting : Auto-disconnect
    
    Error --> Recovering : Retry
    Recovering --> Connected : Recovered
    Recovering --> Disconnected : Fatal error
    
    Disconnecting --> Disconnected : Port closed
    
    Connected --> Disconnecting : User action
```

### Individual Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Command_Sent : AT+TEST=X received
    Command_Sent --> Executing : Firmware processing
    
    Executing --> Hardware_Active : Interact with hardware
    Hardware_Active --> Response_Building : Data collected
    Response_Building --> Response_Sent : +PREFIX:data sent
    
    Response_Sent --> Pass : Criteria met
    Response_Sent --> Fail : Criteria not met
    
    Executing --> Timeout : Time exceeded
    Hardware_Active --> Timeout : Time exceeded
    
    Timeout --> Fail : Mark as failed
    
    Pass --> [*]
    Fail --> [*]
```

---

## Timing Diagrams

### Complete Test Timing

```
Time (s)  0    5    10   15   20   25   30   35   40   45
          |----|----|----|----|----|----|----|----|----|----|
Connect   [===]
Info Read      [===]
WiFi           [==========]
RS485                    [========]
I2C                              [====]
LCD                                   [==========]
Results                                         [==]
          |----|----|----|----|----|----|----|----|----|----|

Legend:
[===]  Activity period
|      Time marker (5 seconds)
```

### Detailed WiFi Test Timing

```
Time (ms) 0    2000  4000  6000  8000  10000
          |-----|-----|-----|-----|-----|
Scan Start[
Scanning       [===============]
Scan Done                      *
Connect Start                   [
Connecting                       [======]
Connected                               *
Response                                 [==]
          |-----|-----|-----|-----|-----|

* = Event marker
[ = Start of activity
] = End of activity
```

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-09 | Initial sequence diagrams for ZC-LCD testing | Documentation Team |

---

**Related Documentation:**
- [← Back to ZC-LCD README](./ZCLCD-README.md)
- [← Hardware Overview](./ZCLCD-Overview.md)
- [Next: Test Cases →](./ZCLCD-TestCases.md)
- [Source Code Manual](./ZCLCD-SourceCode.md)
- [Troubleshooting](./ZCLCD-Troubleshooting.md)
