# Factory Testing - System Overview

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Communication Protocol](#communication-protocol)
5. [Testing Workflow](#testing-workflow)
6. [Data Flow](#data-flow)
7. [Hardware Integration](#hardware-integration)
8. [Software Components](#software-components)
9. [Performance Metrics](#performance-metrics)
10. [Security Considerations](#security-considerations)

---

## Introduction

The **Factory Testing** system is an Electron-based desktop application designed for automated End-of-Line (EOL) testing of NubeIO hardware devices. It provides comprehensive hardware validation through serial communication and AT command protocols.

### System Purpose

```mermaid
mindmap
  root((Factory Testing System))
    Quality Assurance
      Hardware Validation
      Functional Testing
      Performance Verification
    Documentation
      Test Results
      QR Code Labels
      Traceability Records
    Efficiency
      Automated Testing
      Batch Processing
      Quick Turnaround
    Reliability
      Consistent Tests
      Standardized Procedures
      Error Detection
```

### Key Objectives

1. **Automate Testing** - Replace manual verification with automated test sequences
2. **Ensure Quality** - Detect defective hardware before shipping
3. **Generate Documentation** - Create test records and device labels
4. **Improve Efficiency** - Reduce testing time from minutes to seconds
5. **Maintain Standards** - Apply consistent test criteria across all devices

---

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend - Renderer Process"
        UI[Factory Testing Page<br/>React-like UI]
        Module[Factory Testing Module<br/>IPC Client]
    end
    
    subgraph "Backend - Main Process"
        IPC[IPC Handlers<br/>main.js]
        Service[Factory Testing Service<br/>Core Logic]
        Serial[Serial Port Manager]
        Parser[AT Command Parser]
    end
    
    subgraph "External Systems"
        DUT[Device Under Test<br/>UART Interface]
        Printer[Brother Label Printer<br/>USB Connection]
        Storage[File System<br/>Results Storage]
    end
    
    UI --> Module
    Module <--> IPC
    IPC <--> Service
    Service --> Serial
    Serial <--> DUT
    Service --> Parser
    Parser <--> DUT
    Service --> Printer
    Service --> Storage
    
    style UI fill:#E3F2FD
    style Service fill:#FFF3E0
    style DUT fill:#E8F5E9
    style Printer fill:#FCE4EC
```

### Component Layers

```mermaid
graph LR
    subgraph "Presentation Layer"
        A1[UI Components]
        A2[Event Handlers]
        A3[State Management]
    end
    
    subgraph "Application Layer"
        B1[IPC Communication]
        B2[Business Logic]
        B3[Test Orchestration]
    end
    
    subgraph "Service Layer"
        C1[Serial Communication]
        C2[AT Command Protocol]
        C3[Result Processing]
    end
    
    subgraph "Hardware Layer"
        D1[Serial Port]
        D2[USB Devices]
        D3[DUT Board]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> C1
    B3 --> C2
    C1 --> D1
    C2 --> D1
    D1 --> D2
    D2 --> D3
    C3 --> B2
```

---

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Application Framework** | Electron | 28.0.0 | Desktop app container |
| **Frontend** | Vanilla JavaScript | ES6+ | User interface |
| **Backend Runtime** | Node.js | 20.x | Main process execution |
| **Serial Communication** | serialport | 12.0.0 | UART/USB serial access |
| **Data Parsing** | @serialport/parser-readline | 12.0.0 | AT response parsing |
| **Label Printing** | Python 3.13 | 3.13.1 | Brother printer interface |
| **Barcode Generation** | brother_ql | Latest | QR code generation |

### Architecture Pattern

```mermaid
graph TD
    A[Electron App] --> B{Process Type}
    B -->|Main Process| C[Node.js Backend]
    B -->|Renderer Process| D[Web Frontend]
    
    C --> E[IPC Main]
    D --> F[IPC Renderer]
    
    E <-->|Inter-Process<br/>Communication| F
    
    C --> G[Serial Port Access]
    C --> H[File System]
    C --> I[Python Scripts]
    
    G --> J[Hardware Devices]
    
    style A fill:#4CAF50
    style C fill:#FF9800
    style D fill:#2196F3
```

**Multi-Process Architecture:**
- **Main Process** - Backend logic, hardware access, IPC handlers
- **Renderer Process** - UI rendering, user interactions, display
- **IPC Bridge** - Async message passing between processes

---

## Communication Protocol

### AT Command Protocol

**Command Format:**
```
AT+COMMAND=PARAMETER\r\n
```

**Response Format:**
```
+PREFIX:DATA\r\n
OK\r\n

OR

ERROR\r\n
```

### Command Flow Sequence

```mermaid
sequenceDiagram
    participant App as Application
    participant Serial as Serial Port
    participant DUT as Device
    
    App->>Serial: Open port (115200, 8N1)
    Serial-->>App: Port opened
    
    App->>Serial: Write: AT+UNLOCK=N00BIO\r\n
    Serial->>DUT: Send command
    DUT-->>Serial: +UNLOCK:OK\r\n
    Serial-->>App: Response received
    
    App->>Serial: Write: AT+INFO?\r\n
    Serial->>DUT: Send query
    DUT-->>Serial: +INFO:FW=v1.2.3,HW=ACB-M\r\n
    DUT-->>Serial: OK\r\n
    Serial-->>App: Parse response
    
    App->>Serial: Write: AT+WIFISCAN\r\n
    Serial->>DUT: Send command
    Note over DUT: WiFi scan (2-3 sec)
    DUT-->>Serial: +WIFISCAN:SSID1,-45\r\n
    DUT-->>Serial: +WIFISCAN:SSID2,-52\r\n
    DUT-->>Serial: OK\r\n
    Serial-->>App: Parse scan results
```

### Command Categories

```mermaid
mindmap
  root((AT Commands))
    Device Control
      AT+UNLOCK
      AT+RESET
      AT+REBOOT
    Information
      AT+INFO?
      AT+MAC?
      AT+VERSION?
    Testing
      AT+WIFISCAN
      AT+RS485TEST
      AT+RELAYTEST
    Configuration
      AT+CONFIG
      AT+SETPARAM
```

### Protocol Specification

**Serial Port Configuration:**
```javascript
{
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: false,
    delimiter: '\n'
}
```

**Timeout Handling:**
- Command timeout: 10 seconds
- WiFi scan timeout: 15 seconds
- RS485 test timeout: 5 seconds
- Connection timeout: 3 seconds

---

## Testing Workflow

### Complete Test Sequence

```mermaid
stateDiagram-v2
    [*] --> Idle: Application Started
    Idle --> DeviceSelection: User Selects Device
    DeviceSelection --> PreTesting: Enter Info
    PreTesting --> Connecting: Start Test
    
    Connecting --> Connected: Port Opened
    Connecting --> Error: Connection Failed
    
    Connected --> Unlocking: Send Unlock
    Unlocking --> ReadingInfo: Unlock Success
    Unlocking --> Error: Unlock Failed
    
    ReadingInfo --> Testing: Info Received
    ReadingInfo --> Error: Timeout
    
    Testing --> TestWiFi: Begin Tests
    TestWiFi --> TestRS485: WiFi Pass
    TestRS485 --> TestPower: RS485 Pass
    TestPower --> TestIO: Power Pass
    TestIO --> Complete: All Pass
    
    TestWiFi --> TestFailed: WiFi Fail
    TestRS485 --> TestFailed: RS485 Fail
    TestPower --> TestFailed: Power Fail
    TestIO --> TestFailed: IO Fail
    
    Complete --> PrintLabel: Generate Label
    PrintLabel --> [*]: Test Complete
    
    TestFailed --> [*]: Mark Failed
    Error --> [*]: Abort
```

### Test Execution Flow

```mermaid
flowchart TD
    A[Start Test] --> B[Initialize Serial Port]
    B --> C{Port Available?}
    C -->|No| D[Error: No Port]
    C -->|Yes| E[Send Unlock Command]
    E --> F{Unlock OK?}
    F -->|No| G[Error: Auth Failed]
    F -->|Yes| H[Read Device Info]
    H --> I[Parse MAC, FW, HW]
    I --> J[Run WiFi Test]
    J --> K{WiFi Pass?}
    K -->|No| L[Mark Test Failed]
    K -->|Yes| M[Run RS485 Test]
    M --> N{RS485 Pass?}
    N -->|No| L
    N -->|Yes| O[Run Power Test]
    O --> P{Power Pass?}
    P -->|No| L
    P -->|Yes| Q[All Tests Pass]
    Q --> R[Generate QR Code]
    R --> S[Print Label]
    S --> T[Save Results]
    L --> T
    T --> U[End Test]
    
    style Q fill:#4CAF50
    style L fill:#F44336
    style D fill:#FF9800
    style G fill:#FF9800
```

---

## Data Flow

### Information Flow Diagram

```mermaid
graph LR
    subgraph "User Input"
        A[Device Selection]
        B[Tester Info]
        C[Batch Data]
    end
    
    subgraph "Test Execution"
        D[Serial Commands]
        E[AT Responses]
        F[Test Results]
    end
    
    subgraph "Processing"
        G[Parse Responses]
        H[Validate Results]
        I[Calculate Status]
    end
    
    subgraph "Output"
        J[UI Display]
        K[QR Code Label]
        L[JSON File]
    end
    
    A --> D
    B --> I
    C --> I
    D --> E
    E --> G
    G --> H
    H --> I
    I --> F
    F --> J
    F --> K
    F --> L
```

### Result Data Structure

```javascript
{
    "deviceInfo": {
        "type": "ACB-M",
        "generation": "Gen-2",
        "macAddress": "24:6F:28:XX:XX:XX",
        "firmware": "v1.2.3",
        "hardware": "ACB-M-v2.1"
    },
    "testSession": {
        "tester": "John Smith",
        "timestamp": "2024-12-09T14:32:10.123Z",
        "batchId": "BATCH-2024-001",
        "workOrder": "WO-12345"
    },
    "testResults": {
        "wifi": {
            "status": "PASS",
            "networks": 5,
            "rssi": -45,
            "duration": 3.2
        },
        "rs485_1": {
            "status": "PASS",
            "loopback": true,
            "baudRate": 9600
        },
        "rs485_2": {
            "status": "PASS",
            "loopback": true,
            "baudRate": 9600
        },
        "power": {
            "status": "PASS",
            "vcc": 3.31,
            "battery": 4.18
        }
    },
    "overallStatus": "PASS",
    "duration": 12.5
}
```

---

## Hardware Integration

### Device Connection Topology

```mermaid
graph TB
    PC[Test Computer] -->|USB| CH340[USB-Serial<br/>CH340/CP2102]
    CH340 -->|UART| DUT[Device Under Test]
    DUT -->|Power| PSU[Power Supply<br/>5V/12V]
    PC -->|USB| Printer[Brother Printer<br/>PT-P900W]
    
    subgraph "DUT Interfaces"
        DUT -->|RS485-1| RS1[RS485 Bus 1]
        DUT -->|RS485-2| RS2[RS485 Bus 2]
        DUT -->|WiFi| AP[WiFi Router]
        DUT -->|Relay| RELAY[Relay Outputs]
    end
    
    style PC fill:#E3F2FD
    style DUT fill:#E8F5E9
    style Printer fill:#FCE4EC
```

### Serial Port Detection

```mermaid
sequenceDiagram
    participant App
    participant SerialPort
    participant System
    participant Device
    
    App->>SerialPort: SerialPort.list()
    SerialPort->>System: Query USB devices
    System-->>SerialPort: Available ports
    SerialPort-->>App: [{path: 'COM3', ...}]
    
    App->>SerialPort: Open 'COM3'
    SerialPort->>Device: DTR/RTS signals
    Device-->>SerialPort: Device ready
    SerialPort-->>App: Port opened
    
    App->>Device: AT+UNLOCK=N00BIO
    Device-->>App: +UNLOCK:OK
    App->>App: Device identified
```

---

## Software Components

### Component Hierarchy

```mermaid
graph TD
    A[main.js<br/>Application Entry] --> B[Factory Testing Page<br/>UI Component]
    A --> C[Factory Testing Module<br/>IPC Client]
    A --> D[Factory Testing Service<br/>Core Logic]
    
    B --> C
    C --> E[IPC Handlers]
    E --> D
    
    D --> F[Serial Port Manager]
    D --> G[AT Command Parser]
    D --> H[Test Executor]
    D --> I[Label Generator]
    
    F --> J[Device Communication]
    G --> J
    H --> F
    H --> G
    I --> K[Python Print Script]
    
    style A fill:#4CAF50
    style D fill:#FF9800
    style B fill:#2196F3
```

### Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| **UI Page** | FactoryTestingPage.js | User interface, device selection, results display |
| **IPC Module** | FactoryTestingModule.js | Bridge between renderer and main process |
| **IPC Handlers** | main.js | Register handlers for factory testing commands |
| **Core Service** | factory-testing.js | Test orchestration, serial communication |
| **Serial Manager** | Built into service | Port management, data transmission |
| **AT Parser** | Built into service | Parse command responses, extract data |
| **Label Generator** | print_product_label.py | Generate and print QR code labels |

---

## Performance Metrics

### Timing Requirements

```mermaid
gantt
    title Typical Test Duration (ACB-M)
    dateFormat ss
    axisFormat %S sec
    
    section Connection
    Port Detection     :a1, 00, 1s
    Unlock Command     :a2, after a1, 1s
    Read Device Info   :a3, after a2, 1s
    
    section Tests
    WiFi Scan          :b1, after a3, 3s
    RS485-1 Test       :b2, after b1, 2s
    RS485-2 Test       :b3, after b2, 2s
    Power Test         :b4, after b3, 1s
    
    section Output
    Generate Label     :c1, after b4, 1s
    Print Label        :c2, after c1, 2s
```

**Performance Targets:**
- Connection: < 3 seconds
- Individual test: < 5 seconds
- Complete test suite: < 15 seconds
- Label printing: < 5 seconds
- **Total time per device: ~20 seconds**

### Resource Utilization

```mermaid
pie title Resource Usage
    "Serial Communication" : 40
    "Test Execution" : 30
    "UI Updates" : 15
    "Result Processing" : 10
    "Label Generation" : 5
```

---

## Security Considerations

### Access Control

```mermaid
flowchart TD
    A[Device Connection] --> B{Unlock Code}
    B -->|Correct| C[AT+UNLOCK=N00BIO]
    B -->|Incorrect| D[Access Denied]
    C --> E{Response}
    E -->|+UNLOCK:OK| F[Full Access Granted]
    E -->|ERROR| D
    F --> G[Run Tests]
    D --> H[Disconnect]
    
    style F fill:#4CAF50
    style D fill:#F44336
```

### Data Protection

- **Unlock Code Required** - Devices require unlock command before testing
- **Local Storage Only** - Test results saved locally, no cloud upload
- **Serial Port Access** - Requires user permissions on some OS
- **Limited Commands** - Only specific AT commands allowed

---

## Summary

### System Characteristics

| Aspect | Description |
|--------|-------------|
| **Architecture** | Multi-process Electron application |
| **Communication** | Serial UART with AT command protocol |
| **Testing Approach** | Automated sequential test execution |
| **User Interface** | Web-based UI in renderer process |
| **Hardware Support** | Gen-1 and Gen-2 NubeIO devices |
| **Performance** | ~20 seconds per device complete test |
| **Extensibility** | Modular design for new device types |

### Key Features

✅ Automated device detection and connection  
✅ Sequential test execution with timeout protection  
✅ Real-time progress updates in UI  
✅ QR code label generation and printing  
✅ JSON-based result storage  
✅ Support for multiple device generations  
✅ Error handling and recovery  

---

## Next Steps

For detailed implementation information:
- **Source Code:** [FactoryTesting-SourceCode.md](./FactoryTesting-SourceCode.md)
- **Getting Started:** [FactoryTesting-GettingStarted.md](./FactoryTesting-GettingStarted.md)
- **Device-Specific:** See gen-1/ and gen-2/ folders

---

## Document Information

- **Target Audience:** Developers, architects, technical staff
- **Technical Level:** Intermediate to advanced
- **Prerequisites:** Understanding of Electron, serial communication
- **Last Updated:** December 9, 2025
- **Version:** 1.0.0
