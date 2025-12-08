# Droplet Test Sequence Diagrams

**Device:** Droplet (Ultra-Compact IoT Sensor Node)  
**Generation:** GEN-2  
**Last Updated:** December 9, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Test Sequence](#complete-test-sequence)
3. [LoRa Test Sequence](#lora-test-sequence)
4. [Battery Test Sequence](#battery-test-sequence)
5. [I2C Sensor Test Sequence](#i2c-sensor-test-sequence)
6. [Error Handling Sequences](#error-handling-sequences)
7. [State Diagrams](#state-diagrams)
8. [Timing Diagrams](#timing-diagrams)

---

## Overview

This document provides comprehensive sequence diagrams for the Droplet factory testing process. Each diagram illustrates the message flow, timing relationships, and state transitions during test execution.

### Test Architecture

```mermaid
graph TB
    subgraph "Test Infrastructure"
        PC[Test PC<br/>EOL Toolkit]
        UART[USB-UART<br/>Adapter]
    end
    
    subgraph "Device Under Test"
        ESP32[ESP32<br/>Controller]
        LoRa[LoRa Module<br/>SX1276/78]
        Sensor[SHT40<br/>I2C Sensor]
        ADC[Battery<br/>Monitor]
    end
    
    subgraph "External Systems"
        GW[LoRa Gateway<br/>Test Receiver]
    end
    
    PC <-->|Serial 115200| UART
    UART <-->|3.3V TTL| ESP32
    ESP32 <-->|SPI| LoRa
    ESP32 <-->|I2C| Sensor
    ESP32 <-->|ADC| ADC
    LoRa <-.->|RF 868/915MHz| GW
    
    style ESP32 fill:#90EE90
    style LoRa fill:#FFB6C1
    style Sensor fill:#87CEEB
```

---

## Complete Test Sequence

### High-Level Test Flow

```mermaid
sequenceDiagram
    autonumber
    participant Operator as Test Operator
    participant UI as EOL Toolkit UI
    participant Service as Factory Test Service
    participant Serial as Serial Port
    participant DUT as Droplet Device
    
    Operator->>UI: Select "Droplet" device
    Operator->>UI: Select COM port
    Operator->>UI: Click "Connect"
    
    UI->>Service: initializeDevice(port, 115200)
    Service->>Serial: open(port, 115200)
    Serial-->>Service: Port opened
    
    Service->>DUT: AT\r\n
    DUT-->>Service: OK
    Service-->>UI: Device connected
    
    Operator->>UI: Click "Run Tests"
    UI->>Service: runTests(device='Droplet')
    
    Note over Service,DUT: LoRa Test Phase
    Service->>DUT: AT+TEST=lora\r\n
    DUT->>DUT: Execute LoRa TX/RX test (30s)
    DUT-->>Service: +LORA:1,1,25\r\n
    Service->>Service: Parse txDone=1, rxDone=1, valueRx=25
    Service->>UI: Update progress: LoRa PASS
    
    Note over Service,DUT: Battery Test Phase
    Service->>DUT: AT+TEST=bat\r\n
    DUT->>DUT: Read ADC voltage (1s)
    DUT-->>Service: +BAT:3.61\r\n
    Service->>Service: Parse voltage=3.61V
    Service->>UI: Update progress: Battery PASS
    
    Note over Service,DUT: I2C Sensor Test Phase
    Service->>DUT: AT+TEST=i2c\r\n
    DUT->>DUT: Read I2C sensor (2s)
    DUT-->>Service: +I2C:0x40,275,686\r\n
    Service->>Service: Parse addr=0x40, temp=275, hum=686
    Service->>UI: Update progress: I2C PASS
    
    Service->>Service: Evaluate results
    Service->>UI: Display summary: ALL TESTS PASS
    Service->>Service: saveResults(CSV + JSON)
    UI->>Operator: Show test report
    
    Operator->>UI: Click "Disconnect"
    UI->>Service: disconnect()
    Service->>Serial: close()
```

### Test Initialization Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant Serial as Serial Port
    participant ESP32 as ESP32 Controller
    participant LoRa as LoRa Module
    participant Sensor as SHT40 Sensor
    
    Note over Service,ESP32: Device Connection Phase
    Service->>Serial: open(COM3, 115200, 8N1)
    Serial-->>Service: HANDLE_OK
    
    Service->>ESP32: AT\r\n (test connectivity)
    ESP32-->>Service: OK\r\n
    Service->>Service: Device responsive
    
    Note over Service,ESP32: Read Device Information
    Service->>ESP32: AT+VER?\r\n
    ESP32-->>Service: +VER:1.2.3\r\n
    Service->>Service: Store version = "1.2.3"
    
    Service->>ESP32: AT+UID?\r\n
    ESP32-->>Service: +UID:ABC123456789\r\n
    Service->>Service: Store uid = "ABC123456789"
    
    Service->>ESP32: AT+MAKE?\r\n
    ESP32-->>Service: +MAKE:NubeIO\r\n
    Service->>Service: Store make = "NubeIO"
    
    Note over ESP32,Sensor: Internal Device Initialization
    ESP32->>LoRa: Initialize SPI interface
    LoRa-->>ESP32: LoRa module ready
    ESP32->>Sensor: Initialize I2C interface
    Sensor-->>ESP32: Sensor ready (0x40)
    
    Service->>Service: resultsDroplet = {info:{}, tests:{}, _eval:{}}
    Service-->>Service: Ready for testing
```

---

## LoRa Test Sequence

### Sequence Diagram: LoRa TX/RX Test

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant ESP32 as ESP32 Controller
    participant LoRa as LoRa Module (SX1276)
    participant Gateway as LoRa Gateway
    
    Note over Service,Gateway: LoRa Test Phase (30 seconds timeout)
    
    Service->>ESP32: AT+TEST=lora\r\n
    ESP32->>ESP32: updateProgress("LoRa test...")
    
    Note over ESP32,LoRa: Transmit Phase
    ESP32->>LoRa: Configure TX (SF7, BW125, freq 915MHz)
    LoRa-->>ESP32: Config OK
    ESP32->>LoRa: Write payload "TEST_PACKET_001"
    LoRa->>LoRa: Modulate signal
    LoRa->>Gateway: Transmit RF packet (100mW)
    LoRa->>ESP32: IRQ: TxDone
    ESP32->>ESP32: txDone = 1
    
    Note over ESP32,LoRa: Receive Phase
    ESP32->>LoRa: Configure RX (SF7, BW125, freq 915MHz)
    LoRa-->>ESP32: Enter RX mode
    LoRa->>LoRa: Listen for response
    
    Gateway->>Gateway: Receive packet (RSSI=-85dBm)
    Gateway->>Gateway: Send ACK packet
    Gateway->>LoRa: Transmit ACK (RF)
    
    LoRa->>LoRa: Demodulate signal
    LoRa->>ESP32: IRQ: RxDone
    ESP32->>ESP32: rxDone = 1
    LoRa->>ESP32: Read RSSI register
    ESP32->>ESP32: valueRx = 25 (RSSI value)
    
    ESP32->>ESP32: result = txDone=1, rxDone=1, valueRx=25
    ESP32->>Service: +LORA:1,1,25\r\n
    
    Service->>Service: Parse response
    Service->>Service: txDone = 1 (PASS)
    Service->>Service: rxDone = 1 (PASS)
    Service->>Service: valueRx = 25
    Service->>Service: test.lora.pass = true
    Service->>Service: setEval('pass_lora', true)
```

### LoRa Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: Power on
    Idle --> Configuring: AT+TEST=lora received
    
    Configuring --> TX_Ready: LoRa config success
    Configuring --> Error: Config timeout
    
    TX_Ready --> Transmitting: Start TX
    Transmitting --> TX_Done: TxDone IRQ
    Transmitting --> Error: TX timeout (5s)
    
    TX_Done --> RX_Ready: Switch to RX mode
    RX_Ready --> Receiving: Enter RX
    
    Receiving --> RX_Done: RxDone IRQ
    Receiving --> RX_Timeout: No response (20s)
    
    RX_Done --> Success: Read RSSI
    RX_Timeout --> Partial_Success: TX ok, RX fail
    
    Success --> Idle: Return +LORA:1,1,N
    Partial_Success --> Idle: Return +LORA:1,0,0
    Error --> Idle: Return ERROR
```

### LoRa Packet Structure

```mermaid
graph LR
    subgraph "LoRa TX Packet"
        P1[Preamble<br/>8 symbols]
        H1[Header<br/>Explicit mode]
        PL1[Payload<br/>TEST_PACKET_001]
        CRC1[CRC<br/>16-bit]
    end
    
    subgraph "LoRa RX Packet (ACK)"
        P2[Preamble<br/>8 symbols]
        H2[Header<br/>Explicit mode]
        PL2[Payload<br/>ACK_001]
        CRC2[CRC<br/>16-bit]
    end
    
    P1 --> H1 --> PL1 --> CRC1
    P2 --> H2 --> PL2 --> CRC2
```

### LoRa Timing Diagram

```
Time (ms): 0────────500───────1000──────1500──────2000──────────────30000
           │          │         │         │         │                 │
AT Command:├──────────┤
           AT+TEST=lora
           
Config:              ├────┤
                     Init LoRa
                     
TX Phase:                  ├─────┤
                           Transmit
                           
TX Done IRQ:                     ├┤
                                 
RX Config:                        ├───┤
                                  Enter RX
                                  
RX Phase:                             ├──────────────────────┤
                                      Wait for response (20s max)
                                      
RX Done IRQ:                                                 ├┤
                                                             
Response:                                                     ├────┤
                                                              +LORA:1,1,25
                                                              
Total Time: ~1-30 seconds (depends on gateway response)
```

---

## Battery Test Sequence

### Sequence Diagram: Battery Voltage Test

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant ESP32 as ESP32 Controller
    participant ADC as ADC Hardware
    participant Divider as Voltage Divider
    participant Battery as LiPo Battery
    
    Note over Service,Battery: Battery Test Phase (5 seconds timeout)
    
    Service->>ESP32: AT+TEST=bat\r\n
    ESP32->>ESP32: updateProgress("Battery test...")
    
    Note over ESP32,Battery: Voltage Measurement
    ESP32->>ADC: Configure ADC (GPIO34, 11dB atten)
    ADC-->>ESP32: ADC ready
    
    ESP32->>ADC: Start conversion
    Battery->>Divider: Voltage = 3.61V
    Divider->>ADC: Divided voltage = 1.805V
    ADC->>ADC: Convert to digital (12-bit)
    ADC->>ADC: adcValue = 2048 (example)
    ADC-->>ESP32: Return adcValue = 2048
    
    ESP32->>ESP32: Calculate voltage
    Note over ESP32: voltage = (2048/4095) * 3.6V * 2.0
    ESP32->>ESP32: voltage = 3.61V
    
    ESP32->>ESP32: Validate: 0 < 3.61 < 5 ✓
    ESP32->>ESP32: test.battery.pass = true
    ESP32->>Service: +BAT:3.61\r\n
    
    Service->>Service: Parse response
    Service->>Service: voltage = 3.61
    Service->>Service: Validate: 0 < voltage < 5 ✓
    Service->>Service: test.battery.pass = true
    Service->>Service: setEval('pass_battery', true)
```

### Battery Test Flowchart

```mermaid
flowchart TD
    Start([AT+TEST=bat received]) --> Init[Configure ADC<br/>GPIO34, 11dB attenuation]
    Init --> Sample[Take 10 ADC samples]
    Sample --> Average[Calculate average]
    Average --> Convert[Convert to voltage<br/>V = ADC/4095 × 3.6V × 2]
    Convert --> Check{0 < V < 5?}
    
    Check -->|Yes| Valid[voltage = V<br/>pass = true]
    Check -->|No| Invalid[voltage = V<br/>pass = false<br/>message = "Invalid voltage"]
    
    Valid --> Range{V range?}
    Range -->|V > 4.1| FullCharge[State: Fully charged]
    Range -->|3.7 < V ≤ 4.1| Good[State: Good]
    Range -->|3.4 < V ≤ 3.7| Fair[State: Fair]
    Range -->|3.0 < V ≤ 3.4| Low[State: Low battery]
    
    FullCharge --> Success[Return +BAT:V]
    Good --> Success
    Fair --> Success
    Low --> Success
    Invalid --> Error[Return +BAT:NOT VALUE]
    
    Success --> End([Test complete])
    Error --> End
    
    style Valid fill:#90EE90
    style Invalid fill:#FFB6C1
```

### ADC Conversion Detail

```mermaid
sequenceDiagram
    autonumber
    participant ESP32
    participant ADC as ADC Module
    participant MUX as Input Multiplexer
    participant SAR as SAR Converter
    participant Battery as Battery + Divider
    
    ESP32->>ADC: analogRead(GPIO34)
    ADC->>MUX: Select GPIO34 channel
    MUX->>Battery: Connect to input
    Battery-->>MUX: Analog voltage (1.805V)
    
    ADC->>ADC: Sample and hold
    ADC->>SAR: Start conversion (12-bit)
    
    loop 12 conversion cycles
        SAR->>SAR: Successive approximation
    end
    
    SAR->>ADC: Digital value = 2048
    ADC->>ESP32: Return adcValue = 2048
    
    ESP32->>ESP32: voltage = (2048 / 4095) * 3.6 * 2.0
    ESP32->>ESP32: voltage = 3.61V
```

### Battery Voltage Range Diagram

```mermaid
graph TB
    subgraph "Battery Voltage Ranges"
        R1["> 4.1V<br/>Fully Charged<br/>✓ PASS"]
        R2["3.7V - 4.1V<br/>Good<br/>✓ PASS"]
        R3["3.4V - 3.7V<br/>Fair<br/>✓ PASS"]
        R4["3.0V - 3.4V<br/>Low Battery<br/>✓ PASS<br/>⚠ Warning"]
        R5["< 3.0V<br/>Critical<br/>✗ FAIL"]
        R6["> 5.0V<br/>Over-voltage<br/>✗ FAIL"]
    end
    
    style R1 fill:#90EE90
    style R2 fill:#90EE90
    style R3 fill:#FFFFCC
    style R4 fill:#FFE4B5
    style R5 fill:#FFB6C1
    style R6 fill:#FFB6C1
```

---

## I2C Sensor Test Sequence

### Sequence Diagram: I2C Sensor Test

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant ESP32 as ESP32 Controller
    participant I2C as I2C Master
    participant SHT40 as SHT40 Sensor (0x40)
    
    Note over Service,SHT40: I2C Sensor Test Phase (5 seconds timeout)
    
    Service->>ESP32: AT+TEST=i2c\r\n
    ESP32->>ESP32: updateProgress("I2C test...")
    
    Note over ESP32,SHT40: I2C Bus Scan (Optional)
    ESP32->>I2C: i2c_scan(0x00-0x7F)
    I2C->>SHT40: Ping address 0x40
    SHT40-->>I2C: ACK
    I2C-->>ESP32: Device found at 0x40
    
    Note over ESP32,SHT40: Temperature/Humidity Measurement
    ESP32->>I2C: i2c_start()
    I2C->>SHT40: [START] 0x80 (Write to 0x40)
    SHT40-->>I2C: [ACK]
    
    I2C->>SHT40: [DATA] 0xFD (Measure T&RH, high precision)
    SHT40-->>I2C: [ACK]
    I2C->>SHT40: [STOP]
    
    Note over SHT40: Measurement in progress<br/>(8-10 ms)
    SHT40->>SHT40: Measure temperature
    SHT40->>SHT40: Measure humidity
    
    ESP32->>I2C: delay(10 ms)
    
    ESP32->>I2C: i2c_start()
    I2C->>SHT40: [START] 0x81 (Read from 0x40)
    SHT40-->>I2C: [ACK]
    
    SHT40->>I2C: [DATA] Temp MSB
    I2C-->>SHT40: [ACK]
    SHT40->>I2C: [DATA] Temp LSB
    I2C-->>SHT40: [ACK]
    SHT40->>I2C: [DATA] Temp CRC
    I2C-->>SHT40: [ACK]
    
    SHT40->>I2C: [DATA] Hum MSB
    I2C-->>SHT40: [ACK]
    SHT40->>I2C: [DATA] Hum LSB
    I2C-->>SHT40: [ACK]
    SHT40->>I2C: [DATA] Hum CRC
    I2C-->>SHT40: [NACK]
    I2C->>SHT40: [STOP]
    
    I2C-->>ESP32: 6 bytes received
    
    Note over ESP32: Data Processing
    ESP32->>ESP32: Verify CRC checksums
    ESP32->>ESP32: temp_raw = (MSB << 8) | LSB
    ESP32->>ESP32: hum_raw = (MSB << 8) | LSB
    
    ESP32->>ESP32: temp_C = -45 + 175 * (temp_raw/65535)
    ESP32->>ESP32: temp_scaled = temp_C * 10
    ESP32->>ESP32: temp_scaled = 275 (27.5°C)
    
    ESP32->>ESP32: hum_RH = -6 + 125 * (hum_raw/65535)
    ESP32->>ESP32: hum_scaled = hum_RH * 10
    ESP32->>ESP32: hum_scaled = 686 (68.6% RH)
    
    ESP32->>ESP32: Validate results
    ESP32->>ESP32: i2cAddress = "0x40" ✓
    ESP32->>ESP32: temp = 275 (finite) ✓
    ESP32->>ESP32: hum = 686 (finite) ✓
    ESP32->>ESP32: test.i2c.pass = true
    
    ESP32->>Service: +I2C:0x40,275,686\r\n
    
    Service->>Service: Parse response
    Service->>Service: Split by comma
    Service->>Service: i2cAddress = "0x40"
    Service->>Service: temperature = 275
    Service->>Service: humidity = 686
    Service->>Service: Validate all fields ✓
    Service->>Service: test.i2c.pass = true
    Service->>Service: setEval('pass_i2c', true)
```

### I2C Protocol Detail

```mermaid
sequenceDiagram
    autonumber
    participant Master as ESP32 (Master)
    participant Bus as I2C Bus (SDA/SCL)
    participant Slave as SHT40 (Slave 0x40)
    
    Note over Master,Slave: Write Command (Trigger Measurement)
    Master->>Bus: START condition
    Master->>Bus: 0x80 (0x40 << 1 | Write)
    Slave->>Bus: ACK
    Master->>Bus: 0xFD (Measure command)
    Slave->>Bus: ACK
    Master->>Bus: STOP condition
    
    Note over Slave: Measurement: 8-10 ms
    
    Note over Master,Slave: Read Data (6 bytes)
    Master->>Bus: START condition
    Master->>Bus: 0x81 (0x40 << 1 | Read)
    Slave->>Bus: ACK
    
    Slave->>Bus: Temp MSB (0xXX)
    Master->>Bus: ACK
    Slave->>Bus: Temp LSB (0xXX)
    Master->>Bus: ACK
    Slave->>Bus: Temp CRC (0xXX)
    Master->>Bus: ACK
    
    Slave->>Bus: Hum MSB (0xXX)
    Master->>Bus: ACK
    Slave->>Bus: Hum LSB (0xXX)
    Master->>Bus: ACK
    Slave->>Bus: Hum CRC (0xXX)
    Master->>Bus: NACK
    
    Master->>Bus: STOP condition
```

### I2C Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: Power on
    Idle --> Scanning: AT+TEST=i2c received
    
    Scanning --> DeviceFound: 0x40 ACK
    Scanning --> NoDevice: No ACK
    
    DeviceFound --> Commanding: Send 0xFD
    Commanding --> Waiting: Wait 10ms
    Waiting --> Reading: Read 6 bytes
    
    Reading --> CRC_Check: Data received
    Reading --> ReadError: Timeout/NACK
    
    CRC_Check --> Converting: CRC valid
    CRC_Check --> CRC_Error: CRC invalid
    
    Converting --> Validating: Calculate T & RH
    Validating --> Success: Values valid
    Validating --> InvalidData: Values out of range
    
    Success --> Idle: Return +I2C:0x40,T,H
    NoDevice --> Idle: Return +I2C:,0,0
    ReadError --> Idle: Return ERROR
    CRC_Error --> Idle: Return ERROR
    InvalidData --> Idle: Return +I2C:0x40,0,0
```

### SHT40 Data Conversion Flowchart

```mermaid
flowchart TD
    Start([Receive 6 bytes<br/>from SHT40]) --> Split[Split data:<br/>Bytes 0-2: Temp<br/>Bytes 3-5: Humidity]
    
    Split --> TempCRC{Verify<br/>Temp CRC?}
    TempCRC -->|Invalid| Error1[CRC error]
    TempCRC -->|Valid| HumCRC{Verify<br/>Hum CRC?}
    
    HumCRC -->|Invalid| Error2[CRC error]
    HumCRC -->|Valid| RawCalc[temp_raw = MSB<<8 | LSB<br/>hum_raw = MSB<<8 | LSB]
    
    RawCalc --> TempConv[temp_C = -45 + 175×raw/65535]
    TempConv --> TempScale[temp_scaled = temp_C × 10]
    TempScale --> TempInt[temp_scaled = int]
    
    TempInt --> HumConv[hum_RH = -6 + 125×raw/65535]
    HumConv --> HumScale[hum_scaled = hum_RH × 10]
    HumScale --> HumInt[hum_scaled = int]
    
    HumInt --> Result[Return: 0x40, temp_scaled, hum_scaled]
    
    Error1 --> ErrorOut[Return: ERROR]
    Error2 --> ErrorOut
    
    Result --> End([Test complete])
    ErrorOut --> End
    
    style Result fill:#90EE90
    style ErrorOut fill:#FFB6C1
```

---

## Error Handling Sequences

### Sequence: LoRa Test Timeout

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant ESP32 as ESP32 Controller
    participant LoRa as LoRa Module
    
    Service->>ESP32: AT+TEST=lora\r\n
    Service->>Service: Start 30s timeout timer
    
    ESP32->>LoRa: Configure and TX
    LoRa-->>ESP32: TxDone (txDone=1)
    ESP32->>LoRa: Enter RX mode
    
    Note over LoRa: Waiting for response...<br/>No gateway reply
    
    Service->>Service: 30 seconds elapsed
    Service->>Service: Timeout detected
    
    alt Timeout on device side
        ESP32->>ESP32: RX timeout (20s)
        ESP32->>Service: +LORA:1,0,0\r\n
        Service->>Service: Parse: TX ok, RX fail
    else Timeout on PC side
        Service->>Service: No response in 30s
        Service->>Service: throw new Error('LoRa test timeout')
    end
    
    Service->>Service: test.lora.pass = false
    Service->>Service: test.lora.message = "RX timeout"
```

### Sequence: Battery Not Connected

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant ESP32 as ESP32 Controller
    participant ADC as ADC Hardware
    
    Service->>ESP32: AT+TEST=bat\r\n
    ESP32->>ADC: Read voltage
    ADC->>ADC: ADC value = 0 or very low
    ADC-->>ESP32: adcValue = 0
    
    ESP32->>ESP32: voltage = 0.0V
    ESP32->>ESP32: Check: 0 < 0.0 < 5? ✗
    ESP32->>ESP32: Battery not detected
    ESP32->>Service: +BAT:NOT VALUE\r\n
    
    Service->>Service: Parse response
    Service->>Service: voltage = null
    Service->>Service: test.battery.pass = false
    Service->>Service: message = "No battery value"
```

### Sequence: I2C Sensor Not Found

```mermaid
sequenceDiagram
    autonumber
    participant Service as Factory Test Service
    participant ESP32 as ESP32 Controller
    participant I2C as I2C Master
    
    Service->>ESP32: AT+TEST=i2c\r\n
    ESP32->>I2C: Scan I2C bus
    
    loop Check addresses 0x00-0x7F
        I2C->>I2C: Send address
        I2C->>I2C: Wait for ACK
        I2C->>I2C: No response (NACK)
    end
    
    I2C-->>ESP32: No devices found
    ESP32->>ESP32: i2cAddress = null
    ESP32->>ESP32: test.i2c.pass = false
    ESP32->>Service: +I2C:,0,0\r\n
    
    Service->>Service: Parse response
    Service->>Service: i2cAddress = "" (empty)
    Service->>Service: addressValid = false
    Service->>Service: test.i2c.pass = false
    Service->>Service: message = "Invalid I2C values"
```

---

## State Diagrams

### Overall Test State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting: User clicks Connect
    Connecting --> Connected: Device responds OK
    Connecting --> Error: Connection timeout
    
    Connected --> Testing: User clicks Run Tests
    
    state Testing {
        [*] --> LoRa_Test
        LoRa_Test --> Battery_Test: LoRa complete
        Battery_Test --> I2C_Test: Battery complete
        I2C_Test --> [*]: I2C complete
    }
    
    Testing --> Results: All tests complete
    Results --> Saving: Generate report
    Saving --> Connected: Save complete
    
    Connected --> Disconnected: User clicks Disconnect
    Error --> Disconnected: Retry/Cancel
    
    note right of Testing
        Each test can PASS or FAIL
        Testing continues regardless
    end note
```

### LoRa Module State Diagram

```mermaid
stateDiagram-v2
    [*] --> SLEEP: Power on
    SLEEP --> STANDBY: Wakeup command
    STANDBY --> FSTX: Start TX
    FSTX --> TX: Transmit
    TX --> STANDBY: TxDone IRQ
    STANDBY --> FSRX: Start RX
    FSRX --> RXCONTINUOUS: Enter RX mode
    RXCONTINUOUS --> STANDBY: RxDone IRQ
    RXCONTINUOUS --> STANDBY: RxTimeout
    STANDBY --> SLEEP: Enter sleep
    
    note right of TX
        TX power: +14 dBm
        Duration: ~200ms
    end note
    
    note right of RXCONTINUOUS
        RX sensitivity: -137dBm
        Timeout: 20 seconds
    end note
```

---

## Timing Diagrams

### Complete Test Timing

```
Phase:          Init    LoRa Test      Battery   I2C    Results
                │       │              │         │      │
Time (s):   0───1───────────────────31─────────36────41──43
            │   │       │              │         │      │
Activity:   │   │       │              │         │      │
            │   │       ├─TX (1s)      │         │      │
Connection  │   │       ├─RX wait (30s)│         │      │
established │   │       │              ├─ADC read│      │
            │   │       │              │         ├─I2C  │
            │   Test    │              │         │      Save
            │   start   │              │         │      report
            │           │              │         │      │
            └───────────┴──────────────┴─────────┴──────┘
                        Total: ~43 seconds
```

### LoRa TX/RX Timing Detail

```
Signal      0ms    200ms   500ms   1000ms                20000ms  20200ms
            │      │       │       │                     │        │
TX_EN       ─┐     ┌───────────────┘
            └─────┘

TX_DATA         ████████
               (transmit)

IRQ_TXDONE           ─┐
                      └─

RX_EN                 ─┐                                 ┌─
                       └─────────────────────────────────┘

RX_DATA                           (waiting...)       ████████
                                                    (receive ACK)

IRQ_RXDONE                                               ─┐
                                                          └─

Legend:
─ : Signal low
┐/┘: Transitions
████: Active data
```

### I2C Communication Timing

```
Signal      0µs   10µs  20µs  30µs  40µs  50µs  60µs  70µs  80µs  90µs
            │     │     │     │     │     │     │     │     │     │
SCL         ─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─
            └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘ └┘

SDA         ─┐ 1 0 0 0 0 0 0 0│A│ 1 1 1 1 1 1 0 1│A│
            └──────────────────┘  └────────────────┘
             [START] 0x80         0xFD (cmd)  [ACK]

Timing:
- SCL frequency: 100 kHz (10µs period)
- SDA setup time: 250 ns (min)
- SDA hold time: 0 ns (min)
- START/STOP setup time: 4.7µs (min)
```

---

## Conclusion

This document provides comprehensive sequence diagrams for all phases of Droplet factory testing. Each test follows a well-defined message flow with clear success and failure paths. The timing diagrams ensure predictable test execution within the specified timeouts.

### Key Takeaways

✓ **LoRa Test:** 30-second timeout, validates TX and RX independently  
✓ **Battery Test:** 5-second timeout, validates 0-5V range  
✓ **I2C Test:** 5-second timeout, validates sensor communication and data  
✓ **Error Handling:** All failure modes are handled gracefully  
✓ **Total Time:** ~40-45 seconds for complete test sequence

---

**End of Droplet Sequence Diagrams**
