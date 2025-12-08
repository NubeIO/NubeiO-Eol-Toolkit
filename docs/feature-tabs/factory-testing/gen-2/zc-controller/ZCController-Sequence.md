# ZC-Controller Test Sequence Diagrams

**Device:** ZC-Controller (Zone Controller - Damper Motor Controller)  
**Generation:** GEN-2  
**Document Type:** Test Execution Flows & Message Sequences  
**Last Updated:** December 9, 2025

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Test Execution Flow](#test-execution-flow)
3. [WiFi Test Sequences](#wifi-test-sequences)
4. [RS485 Test Sequences](#rs485-test-sequences)
5. [Motor Control Test Sequences](#motor-control-test-sequences)
6. [Position Feedback Test Sequences](#position-feedback-test-sequences)
7. [Relay Test Sequences](#relay-test-sequences)
8. [Error Handling Sequences](#error-handling-sequences)
9. [State Diagrams](#state-diagrams)

---

## 📋 Overview

This document provides comprehensive sequence diagrams for the ZC-Controller factory testing process. Each diagram illustrates the message flow, timing, and decision logic for test execution.

### Diagram Legend

```mermaid
sequenceDiagram
    participant A as Component A
    participant B as Component B
    
    Note over A,B: Information Note
    A->>B: Synchronous Call
    A-->>B: Asynchronous Message
    A->>A: Self Call
    alt Success Case
        B->>A: Success Response
    else Error Case
        B->>A: Error Response
    end
    activate A
    Note right of A: Activated State
    deactivate A
```

---

## 🔄 Test Execution Flow

### Master Test Sequence

```mermaid
sequenceDiagram
    participant UI as Test UI
    participant FT as Factory Testing Service
    participant UART as UART Interface
    participant DUT as ZC-Controller Device
    
    UI->>FT: Start Test Session
    activate FT
    
    FT->>UART: Open Serial Port
    activate UART
    UART-->>FT: Port Opened
    
    FT->>DUT: Read Device Info
    activate DUT
    DUT-->>FT: Device Info (Version, UID, Make)
    deactivate DUT
    
    FT->>UI: Display Device Info
    
    Note over FT,DUT: WiFi Test
    FT->>DUT: {cmd: "wifi_test"}
    activate DUT
    DUT-->>FT: {status: "scanning"}
    DUT-->>FT: {networks: 5, connected: 1}
    deactivate DUT
    FT->>UI: WiFi Test: PASS
    
    Note over FT,DUT: RS485 Test
    FT->>DUT: {cmd: "rs485_test"}
    activate DUT
    DUT-->>FT: {status: 0, response: "OK"}
    deactivate DUT
    FT->>UI: RS485 Test: PASS
    
    Note over FT,DUT: Motor Control Test
    FT->>DUT: {cmd: "motor_test", position: 50}
    activate DUT
    DUT-->>FT: {position: 48.7, status: "moving"}
    DUT-->>FT: {position: 50.2, status: "complete"}
    deactivate DUT
    FT->>UI: Motor Test: PASS
    
    Note over FT,DUT: Position Feedback Test
    FT->>DUT: {cmd: "feedback_test"}
    activate DUT
    DUT-->>FT: {voltage: 4.52, position: 45.2}
    deactivate DUT
    FT->>UI: Feedback Test: PASS
    
    Note over FT,DUT: Relay 1 Test
    FT->>DUT: {cmd: "relay_test", relay: 1}
    activate DUT
    DUT-->>FT: {relay: 1, state: "ON"}
    DUT-->>FT: {relay: 1, state: "OFF"}
    deactivate DUT
    FT->>UI: Relay 1 Test: PASS
    
    Note over FT,DUT: Relay 2 Test
    FT->>DUT: {cmd: "relay_test", relay: 2}
    activate DUT
    DUT-->>FT: {relay: 2, state: "ON"}
    DUT-->>FT: {relay: 2, state: "OFF"}
    deactivate DUT
    FT->>UI: Relay 2 Test: PASS
    
    FT->>UI: All Tests Complete: PASS
    FT->>FT: Save Results (CSV, JSON)
    
    deactivate UART
    deactivate FT
```

### Test Initialization Sequence

```mermaid
sequenceDiagram
    participant UI as Test Operator
    participant APP as EOL Toolkit
    participant FT as Factory Testing Service
    participant UART as Serial Port
    participant DUT as ZC-Controller
    
    UI->>APP: Click "Connect"
    activate APP
    
    APP->>FT: initializeConnection()
    activate FT
    
    FT->>UART: serialPort.open(COM3, 115200)
    activate UART
    
    UART->>UART: Configure 8N1
    UART-->>FT: port_opened
    
    FT->>DUT: Send: {cmd: "ping"}
    activate DUT
    
    DUT-->>FT: Response: {status: "pong"}
    deactivate DUT
    
    FT-->>APP: connection_success
    deactivate FT
    
    APP->>UI: Display "Connected" (Green)
    deactivate APP
    
    Note over UI,DUT: Connection Established
    
    UI->>APP: Click "Read Device Info"
    activate APP
    
    APP->>FT: readDeviceInfo()
    activate FT
    
    FT->>DUT: {cmd: "get_info"}
    activate DUT
    
    DUT-->>FT: {type: "ZC-Controller", hw_ver: "2.1", fw_ver: "2.4.1", uid: "1A2B3C4D5E6F"}
    deactivate DUT
    
    FT-->>APP: deviceInfo
    deactivate FT
    
    APP->>UI: Display Device Info Panel
    deactivate APP
```

---

## 📡 WiFi Test Sequences

### WiFi Network Scan Sequence

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant WiFi as WiFi Module
    participant AP as Access Points
    
    FT->>DUT: {cmd: "wifi_test"}
    activate DUT
    
    DUT->>WiFi: wifi_scan_start()
    activate WiFi
    
    WiFi->>AP: Broadcast Probe Request
    AP-->>WiFi: Probe Response (SSID, RSSI)
    AP-->>WiFi: Probe Response (SSID, RSSI)
    AP-->>WiFi: Probe Response (SSID, RSSI)
    
    WiFi->>WiFi: Compile Scan Results
    WiFi-->>DUT: {networks: 5, strongest_rssi: -42}
    deactivate WiFi
    
    alt Networks Found > 1
        DUT->>DUT: Test Result: PASS
        DUT-->>FT: {result: "PASS", networks: 5}
    else No Networks Found
        DUT->>DUT: Test Result: FAIL
        DUT-->>FT: {result: "FAIL", networks: 0}
    end
    
    deactivate DUT
```

### WiFi Connection Sequence

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant WiFi as WiFi Module
    participant AP as Test Access Point
    
    FT->>DUT: {cmd: "wifi_connect", ssid: "Factory_Test", pass: "test1234"}
    activate DUT
    
    DUT->>WiFi: wifi_connect(ssid, password)
    activate WiFi
    
    WiFi->>AP: Authentication Request
    AP-->>WiFi: Authentication Challenge
    
    WiFi->>AP: Authentication Response (WPA2-PSK)
    AP-->>WiFi: Authentication Success
    
    WiFi->>AP: Association Request
    AP-->>WiFi: Association Response
    
    WiFi->>AP: 4-Way Handshake (EAPOL)
    AP-->>WiFi: 4-Way Handshake Complete
    
    WiFi->>AP: DHCP Discover
    AP-->>WiFi: DHCP Offer (192.168.1.100)
    
    WiFi->>AP: DHCP Request
    AP-->>WiFi: DHCP ACK
    
    WiFi->>WiFi: Link Established
    WiFi-->>DUT: {connected: 1, ip: "192.168.1.100"}
    deactivate WiFi
    
    alt Connection Successful
        DUT-->>FT: {result: "PASS", connected: 1, ip: "192.168.1.100", rssi: -45}
    else Connection Failed
        DUT-->>FT: {result: "FAIL", connected: 0, error: "Auth failed"}
    end
    
    deactivate DUT
```

### WiFi Signal Strength Test

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant WiFi as WiFi Module
    
    FT->>DUT: {cmd: "wifi_rssi"}
    activate DUT
    
    loop Every 100ms for 3 seconds
        DUT->>WiFi: get_rssi()
        WiFi-->>DUT: rssi_value
        DUT->>DUT: Store RSSI sample
    end
    
    DUT->>DUT: Calculate Statistics
    Note right of DUT: Average: -45 dBm<br/>Min: -50 dBm<br/>Max: -40 dBm
    
    alt RSSI > -70 dBm
        DUT-->>FT: {result: "PASS", rssi_avg: -45, rssi_min: -50, rssi_max: -40}
    else RSSI ≤ -70 dBm
        DUT-->>FT: {result: "FAIL", rssi_avg: -75, note: "Weak signal"}
    end
    
    deactivate DUT
```

---

## 🔌 RS485 Test Sequences

### RS485 Loopback Test

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant RS485 as RS485 Transceiver
    participant LOOP as External Loopback
    
    FT->>DUT: {cmd: "rs485_test", mode: "loopback"}
    activate DUT
    
    DUT->>RS485: Enable Transmitter
    activate RS485
    
    DUT->>RS485: Send Test Pattern: 0x55 0xAA
    RS485->>LOOP: Transmit on A/B lines
    
    Note over LOOP: A and B shorted<br/>externally
    
    LOOP-->>RS485: Echo on A/B lines
    
    RS485->>DUT: Receive: 0x55 0xAA
    deactivate RS485
    
    DUT->>DUT: Compare Sent vs Received
    
    alt Data Match
        DUT-->>FT: {result: "PASS", status: 0}
    else Data Mismatch
        DUT-->>FT: {result: "FAIL", status: 1, error: "Loopback failed"}
    end
    
    deactivate DUT
```

### RS485 Modbus RTU Test

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller (Slave ID 1)
    participant RS485 as RS485 Transceiver
    participant MASTER as Modbus Master (Test Device)
    
    FT->>DUT: {cmd: "rs485_test", mode: "modbus"}
    activate DUT
    
    DUT->>DUT: Configure Modbus Slave (ID=1)
    DUT-->>FT: {status: "listening"}
    
    MASTER->>RS485: Read Holding Registers (FC=03)
    Note right of MASTER: Request:<br/>Slave ID: 0x01<br/>Function: 0x03<br/>Start Addr: 0x0000<br/>Count: 0x0002<br/>CRC: 0xXXXX
    
    activate RS485
    RS485->>DUT: Forward Modbus Request
    deactivate RS485
    
    DUT->>DUT: Parse Request
    DUT->>DUT: Read Registers 0x0000, 0x0001
    DUT->>DUT: Build Response
    
    activate RS485
    DUT->>RS485: Send Response
    Note left of DUT: Response:<br/>Slave ID: 0x01<br/>Function: 0x03<br/>Byte Count: 0x04<br/>Data: 0x1000 0x2000<br/>CRC: 0xYYYY
    
    RS485->>MASTER: Forward Response
    deactivate RS485
    
    MASTER->>MASTER: Validate CRC
    
    alt CRC Valid
        MASTER-->>FT: {result: "PASS", registers: [0x1000, 0x2000]}
        FT->>DUT: {cmd: "stop_rs485_test"}
        DUT-->>FT: {result: "PASS", status: 0}
    else CRC Invalid or Timeout
        MASTER-->>FT: {result: "FAIL", error: "No response"}
        FT->>DUT: {cmd: "stop_rs485_test"}
        DUT-->>FT: {result: "FAIL", status: 1}
    end
    
    deactivate DUT
```

### RS485 Timing Diagram

```mermaid
sequenceDiagram
    participant TX as Transmitter
    participant BUS as RS485 Bus
    participant RX as Receiver
    
    Note over TX,RX: Idle State (Mark)
    
    TX->>BUS: Start Bit (Space)
    Note right of TX: t = 0 µs
    
    TX->>BUS: Data Bit 0
    Note right of TX: t = 8.68 µs (115200 baud)
    
    TX->>BUS: Data Bit 1
    TX->>BUS: Data Bit 2
    TX->>BUS: Data Bit 3
    TX->>BUS: Data Bit 4
    TX->>BUS: Data Bit 5
    TX->>BUS: Data Bit 6
    TX->>BUS: Data Bit 7
    
    TX->>BUS: Stop Bit (Mark)
    Note right of TX: t = 86.8 µs
    
    BUS->>RX: Propagated Signal (< 1 µs delay)
    
    RX->>RX: Sample Data Bits
    RX->>RX: Validate Stop Bit
    
    Note over TX,RX: Byte Transmitted Successfully
```

---

## 🎛️ Motor Control Test Sequences

### Motor Position Command Sequence

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant MOTOR_CTL as Motor Controller
    participant DRIVER as Motor Driver
    participant MOTOR as Stepper Motor
    
    FT->>DUT: {cmd: "motor_test", position: 50}
    activate DUT
    
    DUT->>MOTOR_CTL: set_target_position(50%)
    activate MOTOR_CTL
    
    MOTOR_CTL->>MOTOR_CTL: Calculate Steps
    Note right of MOTOR_CTL: Target: 50%<br/>Current: 0%<br/>Steps: 1000
    
    MOTOR_CTL->>DRIVER: Enable Motor
    activate DRIVER
    
    loop 1000 steps
        MOTOR_CTL->>DRIVER: STEP Pulse (2 µs)
        DRIVER->>MOTOR: Energize Coils
        MOTOR->>MOTOR: Rotate 1.8° (1 step)
        
        alt Every 100 steps
            MOTOR_CTL->>DUT: {status: "moving", position: 10%}
            DUT-->>FT: Progress Update
        end
    end
    
    MOTOR_CTL->>DRIVER: Disable Motor (Hold)
    deactivate DRIVER
    
    MOTOR_CTL->>MOTOR_CTL: Read Position Feedback
    MOTOR_CTL->>MOTOR_CTL: Verify Position
    
    alt Position Error < 2%
        MOTOR_CTL-->>DUT: {position: 50.1, status: "complete"}
        DUT-->>FT: {result: "PASS", position: 50.1}
    else Position Error ≥ 2%
        MOTOR_CTL-->>DUT: {position: 45.0, status: "error"}
        DUT-->>FT: {result: "FAIL", position: 45.0, error: "Position error"}
    end
    
    deactivate MOTOR_CTL
    deactivate DUT
```

### Motor Calibration Sequence

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant MOTOR_CTL as Motor Controller
    participant MOTOR as Motor
    participant LIMIT as Limit Switches
    
    FT->>DUT: {cmd: "motor_calibrate"}
    activate DUT
    
    DUT->>MOTOR_CTL: start_calibration()
    activate MOTOR_CTL
    
    Note over MOTOR_CTL,LIMIT: Step 1: Find Minimum Limit
    
    MOTOR_CTL->>MOTOR: Move Reverse (slow speed)
    
    loop Until Limit Reached
        MOTOR->>LIMIT: Check Limit Switch
        LIMIT-->>MOTOR: Not Reached
    end
    
    LIMIT-->>MOTOR: Minimum Limit Reached
    MOTOR_CTL->>MOTOR_CTL: Set Position = 0
    MOTOR_CTL->>DUT: {status: "min_limit_found"}
    DUT-->>FT: Calibration: 25%
    
    Note over MOTOR_CTL,LIMIT: Step 2: Find Maximum Limit
    
    MOTOR_CTL->>MOTOR: Move Forward (slow speed)
    MOTOR_CTL->>MOTOR_CTL: Count Steps
    
    loop Until Limit Reached
        MOTOR->>LIMIT: Check Limit Switch
        LIMIT-->>MOTOR: Not Reached
    end
    
    LIMIT-->>MOTOR: Maximum Limit Reached
    MOTOR_CTL->>MOTOR_CTL: Set Position = 100
    Note right of MOTOR_CTL: Total Steps: 2000
    MOTOR_CTL->>DUT: {status: "max_limit_found", total_steps: 2000}
    DUT-->>FT: Calibration: 75%
    
    Note over MOTOR_CTL,LIMIT: Step 3: Move to Home (50%)
    
    MOTOR_CTL->>MOTOR: Move to Position 50%
    MOTOR_CTL->>MOTOR_CTL: Verify Position
    
    MOTOR_CTL-->>DUT: {status: "calibration_complete"}
    DUT-->>FT: {result: "PASS", range: "0-2000 steps"}
    
    deactivate MOTOR_CTL
    deactivate DUT
```

### Motor Speed Profile

```mermaid
sequenceDiagram
    participant MOTOR_CTL as Motor Controller
    participant ACCEL as Acceleration Profile
    participant MOTOR as Motor Driver
    
    Note over MOTOR_CTL,MOTOR: Movement Start
    
    MOTOR_CTL->>ACCEL: Calculate Profile
    Note right of ACCEL: Acceleration: 1000 steps/s²<br/>Max Speed: 2000 steps/s<br/>Deceleration: 1000 steps/s²
    
    activate ACCEL
    
    loop Acceleration Phase (0-2s)
        ACCEL->>MOTOR: Step Pulse (increasing frequency)
        Note right of ACCEL: Speed: 0 → 2000 steps/s
    end
    
    loop Constant Speed Phase (2-8s)
        ACCEL->>MOTOR: Step Pulse (constant frequency)
        Note right of ACCEL: Speed: 2000 steps/s
    end
    
    loop Deceleration Phase (8-10s)
        ACCEL->>MOTOR: Step Pulse (decreasing frequency)
        Note right of ACCEL: Speed: 2000 → 0 steps/s
    end
    
    ACCEL->>MOTOR_CTL: Movement Complete
    deactivate ACCEL
    
    Note over MOTOR_CTL,MOTOR: Target Position Reached
```

---

## 📊 Position Feedback Test Sequences

### Analog Position Feedback Sequence

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant ADC as ADC Module
    participant POT as Potentiometer
    
    FT->>DUT: {cmd: "feedback_test"}
    activate DUT
    
    DUT->>ADC: Configure ADC (12-bit, 0-10V range)
    activate ADC
    
    loop 10 samples at 100 Hz
        ADC->>POT: Sample Voltage
        POT-->>ADC: Analog Voltage (4.52V)
        ADC->>ADC: Convert to Digital (1853 / 4096)
        ADC->>DUT: ADC Value: 1853
        DUT->>DUT: Convert to Percentage: 45.2%
    end
    
    DUT->>DUT: Calculate Statistics
    Note right of DUT: Average: 4.52V (45.2%)<br/>Std Dev: 0.02V<br/>Noise: 0.1%
    
    deactivate ADC
    
    alt Voltage in Range (0.1V - 9.9V)
        DUT-->>FT: {result: "PASS", voltage: 4.52, position: 45.2}
    else Voltage Out of Range
        DUT-->>FT: {result: "FAIL", voltage: 0.05, error: "Sensor fault"}
    end
    
    deactivate DUT
```

### Position Feedback Calibration

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant MOTOR as Motor Controller
    participant ADC as ADC Module
    participant POT as Potentiometer
    
    FT->>DUT: {cmd: "calibrate_feedback"}
    activate DUT
    
    Note over DUT,POT: Step 1: Minimum Position
    
    DUT->>MOTOR: Move to 0%
    MOTOR-->>DUT: Position Reached
    
    DUT->>ADC: Read Voltage
    ADC->>POT: Sample
    POT-->>ADC: 0.25V
    ADC-->>DUT: min_voltage = 0.25V
    
    DUT->>DUT: Store Calibration Point (0%, 0.25V)
    DUT-->>FT: {status: "min_calibrated", voltage: 0.25}
    
    Note over DUT,POT: Step 2: Maximum Position
    
    DUT->>MOTOR: Move to 100%
    MOTOR-->>DUT: Position Reached
    
    DUT->>ADC: Read Voltage
    ADC->>POT: Sample
    POT-->>ADC: 9.78V
    ADC-->>DUT: max_voltage = 9.78V
    
    DUT->>DUT: Store Calibration Point (100%, 9.78V)
    DUT-->>FT: {status: "max_calibrated", voltage: 9.78}
    
    Note over DUT,POT: Step 3: Linearization
    
    loop 5 intermediate points (20%, 40%, 60%, 80%)
        DUT->>MOTOR: Move to Position
        MOTOR-->>DUT: Position Reached
        DUT->>ADC: Read Voltage
        ADC-->>DUT: voltage
        DUT->>DUT: Store Calibration Point
    end
    
    DUT->>DUT: Calculate Linear Fit
    Note right of DUT: y = mx + b<br/>m = 0.0953<br/>b = 0.25
    
    DUT-->>FT: {result: "PASS", calibration: "complete", linearity: 0.98}
    
    deactivate DUT
```

### Feedback Noise Analysis

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant ADC as ADC Module
    participant FILTER as Digital Filter
    
    FT->>DUT: {cmd: "feedback_noise_test"}
    activate DUT
    
    DUT->>ADC: Enable High-Speed Sampling (1 kHz)
    activate ADC
    
    loop 1000 samples over 1 second
        ADC->>ADC: Sample Voltage
        ADC->>DUT: Raw ADC Value
        DUT->>FILTER: Input Sample
        FILTER->>FILTER: Moving Average (n=10)
        FILTER->>DUT: Filtered Value
        DUT->>DUT: Store Sample
    end
    
    deactivate ADC
    
    DUT->>DUT: Calculate Noise Metrics
    Note right of DUT: Mean: 4.520V<br/>Std Dev: 0.012V<br/>Peak-Peak: 0.048V<br/>SNR: 72 dB
    
    alt Noise < 0.1% FSR
        DUT-->>FT: {result: "PASS", noise_rms: 0.012, snr: 72}
    else Noise ≥ 0.1% FSR
        DUT-->>FT: {result: "FAIL", noise_rms: 0.150, snr: 45}
    end
    
    deactivate DUT
```

---

## 🔌 Relay Test Sequences

### Relay Toggle Test

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant GPIO as GPIO Controller
    participant RELAY as Relay Module
    participant LOAD as Load
    
    FT->>DUT: {cmd: "relay_test", relay: 1}
    activate DUT
    
    Note over DUT,LOAD: Initial State: OFF
    
    DUT->>GPIO: Read Relay State
    GPIO-->>DUT: state = OFF
    DUT-->>FT: {relay: 1, initial_state: "OFF"}
    
    Note over DUT,LOAD: Toggle 1: OFF → ON
    
    DUT->>GPIO: Set GPIO HIGH
    GPIO->>RELAY: Energize Coil
    activate RELAY
    RELAY->>RELAY: Switch Contacts (NC → NO)
    RELAY->>LOAD: Close Circuit
    deactivate RELAY
    
    DUT->>DUT: Wait 100ms (debounce)
    
    DUT->>GPIO: Read Relay State
    GPIO-->>DUT: state = ON
    DUT-->>FT: {relay: 1, state: "ON"}
    
    Note over DUT,LOAD: Toggle 2: ON → OFF
    
    DUT->>GPIO: Set GPIO LOW
    GPIO->>RELAY: De-energize Coil
    activate RELAY
    RELAY->>RELAY: Switch Contacts (NO → NC)
    RELAY->>LOAD: Open Circuit
    deactivate RELAY
    
    DUT->>DUT: Wait 100ms (debounce)
    
    DUT->>GPIO: Read Relay State
    GPIO-->>DUT: state = OFF
    DUT-->>FT: {relay: 1, state: "OFF"}
    
    Note over DUT,LOAD: Toggle 3: OFF → ON
    
    DUT->>GPIO: Set GPIO HIGH
    GPIO->>RELAY: Energize Coil
    RELAY->>LOAD: Close Circuit
    
    DUT->>GPIO: Read Relay State
    GPIO-->>DUT: state = ON
    DUT-->>FT: {relay: 1, state: "ON", toggle_count: 3}
    
    alt All Toggles Successful
        DUT-->>FT: {result: "PASS", final_state: "ON"}
    else Toggle Failed
        DUT-->>FT: {result: "FAIL", error: "Relay stuck"}
    end
    
    deactivate DUT
```

### Relay Endurance Test

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant RELAY as Relay Module
    participant COUNTER as Cycle Counter
    
    FT->>DUT: {cmd: "relay_endurance_test", cycles: 1000}
    activate DUT
    
    DUT->>COUNTER: Initialize Counter = 0
    activate COUNTER
    
    loop 1000 cycles
        DUT->>RELAY: Set ON
        RELAY->>RELAY: Switch Contacts
        DUT->>DUT: Wait 50ms
        
        DUT->>RELAY: Set OFF
        RELAY->>RELAY: Switch Contacts
        DUT->>DUT: Wait 50ms
        
        COUNTER->>COUNTER: Increment Counter
        
        alt Every 100 cycles
            DUT-->>FT: {progress: 10%, cycles: 100}
        end
    end
    
    COUNTER->>COUNTER: Final Count = 1000
    deactivate COUNTER
    
    DUT->>DUT: Test Relay Operation
    
    alt Relay Still Functional
        DUT-->>FT: {result: "PASS", cycles: 1000, status: "operational"}
    else Relay Failed
        DUT-->>FT: {result: "FAIL", cycles: 850, error: "Contact degradation"}
    end
    
    deactivate DUT
```

### Relay Timing Measurement

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant GPIO as GPIO Controller
    participant RELAY as Relay Module
    participant TIMER as High-Res Timer
    
    FT->>DUT: {cmd: "relay_timing_test", relay: 1}
    activate DUT
    
    DUT->>TIMER: Start Timer
    activate TIMER
    
    DUT->>GPIO: Set GPIO HIGH
    GPIO->>RELAY: Energize Coil (t=0)
    
    activate RELAY
    Note right of RELAY: Coil Energizing (5ms)
    
    RELAY->>RELAY: Armature Moving
    Note right of RELAY: Mechanical Motion (3ms)
    
    RELAY->>RELAY: Contacts Close (t=8ms)
    deactivate RELAY
    
    DUT->>GPIO: Read Contact State
    GPIO-->>DUT: Contact Closed
    
    DUT->>TIMER: Stop Timer
    TIMER-->>DUT: elapsed_time = 8.2ms
    deactivate TIMER
    
    alt Switching Time < 15ms
        DUT-->>FT: {result: "PASS", switch_time_ms: 8.2}
    else Switching Time ≥ 15ms
        DUT-->>FT: {result: "FAIL", switch_time_ms: 18.5, error: "Slow relay"}
    end
    
    deactivate DUT
```

---

## ⚠️ Error Handling Sequences

### Communication Timeout Handling

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant TIMEOUT as Timeout Timer
    
    FT->>DUT: {cmd: "motor_test"}
    activate FT
    activate DUT
    
    FT->>TIMEOUT: Start Timeout (10 seconds)
    activate TIMEOUT
    
    Note over DUT: Device Not Responding<br/>(Hardware Fault)
    
    loop Every 1 second
        TIMEOUT->>TIMEOUT: Check Elapsed Time
        TIMEOUT-->>FT: time_remaining
        
        alt time_remaining > 0
            FT->>FT: Wait for response
        end
    end
    
    TIMEOUT->>TIMEOUT: Timeout Expired
    TIMEOUT-->>FT: timeout_error
    deactivate TIMEOUT
    
    FT->>FT: Abort Test
    FT->>FT: Log Error
    
    FT->>DUT: {cmd: "abort"}
    Note over DUT: No Response
    
    FT->>FT: Mark Test as FAIL
    FT->>FT: Record Error: "Communication timeout"
    
    deactivate DUT
    deactivate FT
```

### Device Not Found Error

```mermaid
sequenceDiagram
    participant UI as Test Operator
    participant FT as Factory Testing
    participant UART as Serial Port
    participant DUT as ZC-Controller
    
    UI->>FT: Connect to Device
    activate FT
    
    FT->>UART: Open Serial Port (COM3)
    activate UART
    
    UART->>UART: Check Port Availability
    
    alt Port Not Available
        UART-->>FT: error: "Port in use or not found"
        deactivate UART
        FT-->>UI: Error: "Cannot open COM3"
        
        FT->>FT: Suggest Actions
        FT-->>UI: "1. Check COM port in Device Manager<br/>2. Close other applications<br/>3. Reconnect USB adapter"
    else Port Available
        UART-->>FT: port_opened
        
        FT->>DUT: {cmd: "ping"}
        
        activate DUT
        Note over DUT: Device Powered Off<br/>or Not Connected
        deactivate DUT
        
        FT->>FT: Wait for Response (5 seconds)
        
        alt No Response
            FT-->>UI: Error: "Device not responding"
            FT->>FT: Suggest Actions
            FT-->>UI: "1. Check power supply (12-24V)<br/>2. Verify UART connections<br/>3. Check RX/TX not swapped"
        else Response Received
            DUT-->>FT: {status: "pong"}
            FT-->>UI: Connected Successfully
        end
        
        deactivate UART
    end
    
    deactivate FT
```

### Test Failure Recovery

```mermaid
sequenceDiagram
    participant FT as Factory Testing
    participant DUT as ZC-Controller
    participant RECOVERY as Recovery Handler
    
    FT->>DUT: {cmd: "motor_test"}
    activate FT
    activate DUT
    
    DUT-->>FT: {result: "FAIL", error: "Motor stuck"}
    deactivate DUT
    
    FT->>RECOVERY: Handle Test Failure
    activate RECOVERY
    
    RECOVERY->>RECOVERY: Analyze Error Type
    Note right of RECOVERY: Error: "Motor stuck"<br/>Category: Hardware Fault
    
    RECOVERY->>RECOVERY: Determine Recovery Action
    
    alt Recoverable Error
        RECOVERY->>DUT: {cmd: "motor_reset"}
        activate DUT
        DUT->>DUT: Reset Motor Controller
        DUT->>DUT: Home Motor
        DUT-->>RECOVERY: {status: "reset_complete"}
        deactivate DUT
        
        RECOVERY->>FT: Retry Test (Attempt 2 of 3)
        FT->>DUT: {cmd: "motor_test"}
        activate DUT
        DUT-->>FT: {result: "PASS", position: 50.1}
        deactivate DUT
        
        RECOVERY-->>FT: Recovery Successful
    else Non-Recoverable Error
        RECOVERY->>RECOVERY: Log Failure Details
        RECOVERY-->>FT: Recovery Not Possible
        
        FT->>FT: Mark Test as FAIL
        FT->>FT: Suggest Manual Inspection
    end
    
    deactivate RECOVERY
    deactivate FT
```

---

## 🔄 State Diagrams

### Device Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting : User clicks "Connect"
    Connecting --> Connected : Connection success
    Connecting --> Error : Connection failed
    Error --> Disconnected : Retry
    
    Connected --> ReadingInfo : User clicks "Read Info"
    ReadingInfo --> InfoReady : Info received
    ReadingInfo --> Error : Timeout
    InfoReady --> Connected : Continue
    
    Connected --> Testing : User clicks "Run Tests"
    Testing --> TestComplete : All tests done
    Testing --> Error : Test error
    TestComplete --> Connected : View results
    
    Connected --> Disconnecting : User clicks "Disconnect"
    Disconnecting --> Disconnected : Port closed
    
    Error --> [*] : Fatal error
```

### Test Execution State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> WiFiTest : Start tests
    WiFiTest --> RS485Test : WiFi PASS
    WiFiTest --> Failed : WiFi FAIL
    
    RS485Test --> MotorTest : RS485 PASS
    RS485Test --> Failed : RS485 FAIL
    
    MotorTest --> FeedbackTest : Motor PASS
    MotorTest --> Failed : Motor FAIL
    
    FeedbackTest --> Relay1Test : Feedback PASS
    FeedbackTest --> Failed : Feedback FAIL
    
    Relay1Test --> Relay2Test : Relay1 PASS
    Relay1Test --> Failed : Relay1 FAIL
    
    Relay2Test --> Passed : Relay2 PASS
    Relay2Test --> Failed : Relay2 FAIL
    
    Passed --> SavingResults : Save results
    SavingResults --> Idle : Results saved
    
    Failed --> Idle : Abort tests
```

### Motor Control State Machine

```mermaid
stateDiagram-v2
    [*] --> Stopped
    
    Stopped --> Homing : Calibrate command
    Homing --> Stopped : Home complete
    Homing --> Error : Home failed
    
    Stopped --> Accelerating : Move command
    Accelerating --> Running : Target speed reached
    Running --> Decelerating : Near target position
    Decelerating --> Stopped : Target reached
    
    Accelerating --> Error : Motor fault
    Running --> Error : Motor fault
    Decelerating --> Error : Motor fault
    
    Error --> Stopped : Reset command
    Error --> [*] : Fatal error
```

### Relay State Machine

```mermaid
stateDiagram-v2
    [*] --> OFF
    
    OFF --> Energizing : Set ON command
    Energizing --> ON : Coil energized (8ms)
    
    ON --> De_energizing : Set OFF command
    De_energizing --> OFF : Coil de-energized (5ms)
    
    Energizing --> Error : Coil fault
    De_energizing --> Error : Contact stuck
    
    Error --> OFF : Reset
    Error --> [*] : Replace relay
```

---

## 📚 References

### Related Documentation

- [ZCController-README.md](./ZCController-README.md) - Master device index
- [ZCController-Overview.md](./ZCController-Overview.md) - Hardware specifications
- [ZCController-TestCases.md](./ZCController-TestCases.md) - Test procedures
- [ZCController-SourceCode.md](./ZCController-SourceCode.md) - Software manual
- [ZCController-Troubleshooting.md](./ZCController-Troubleshooting.md) - Diagnostic guide

---

**End of ZC-Controller Test Sequence Diagrams**
