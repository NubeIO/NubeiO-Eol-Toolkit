# State Diagrams

## Overview

This document contains state machine diagrams for the Brother printer integration system.

---

## 1. Printer Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Checking: Check Connection Request
    Checking --> Connecting: USB Device Found
    Checking --> Disconnected: No Device Found
    
    Connecting --> Connected: Handshake Success
    Connecting --> AccessDenied: Permission Error
    Connecting --> Disconnected: Connection Failed
    
    AccessDenied --> RetryWait: Retry Available
    AccessDenied --> Failed: Max Retries Exceeded
    
    RetryWait --> Connecting: After Delay (0.6s)
    
    Connected --> Printing: Print Request
    Connected --> Disconnected: Disconnect/Dispose
    Connected --> Checking: Re-check Request
    
    Printing --> PrintingData: Sending Raster Data
    PrintingData --> Cutting: Data Sent
    Cutting --> Complete: Cut Finished
    
    Complete --> Connected: Ready for Next
    
    Failed --> Disconnected: Reset
    
    note right of Checking
        Attempts: 0/3
        USB Scan Active
    end note
    
    note right of AccessDenied
        USB In Use
        Will Retry
    end note
    
    note right of Printing
        Label Generation
        Raster Conversion
    end note
```

---

## 2. Print Job State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Validating: Print Request Received
    
    Validating --> Invalid: Missing/Bad Data
    Validating --> GeneratingLabel: Data Valid
    
    Invalid --> Idle: Error Returned
    
    GeneratingLabel --> GeneratingBarcode: Start Image Creation
    GeneratingBarcode --> DrawingText: Barcode Created
    DrawingText --> SavingPreview: Text Added
    SavingPreview --> ConnectingPrinter: Preview Saved
    
    ConnectingPrinter --> ConfiguringRaster: Connection Established
    ConnectingPrinter --> ConnectionFailed: Cannot Connect
    
    ConnectionFailed --> Idle: Error Returned
    
    ConfiguringRaster --> ConvertingImage: Raster Ready
    ConvertingImage --> SendingData: Image Converted
    SendingData --> PrinterProcessing: Data Transmitted
    
    PrinterProcessing --> PrinterCutting: Printing Complete
    PrinterCutting --> Releasing: Cut Complete
    
    Releasing --> Success: Resources Released
    Success --> Idle: Job Complete
    
    note right of GeneratingLabel
        Create PIL Image
        120x160 pixels
        Grayscale mode
    end note
    
    note right of ConfiguringRaster
        Model: PT-P900W
        Tape: 12mm
        Quality: High
    end note
    
    note right of SendingData
        USB Bulk Transfer
        Raster Format
    end note
```

---

## 3. Application Printer Module State

```mermaid
stateDiagram-v2
    [*] --> Initializing
    
    Initializing --> CheckingExecutable: App Start
    
    CheckingExecutable --> ProductionMode: .exe Found
    CheckingExecutable --> DevelopmentMode: .exe Not Found
    
    ProductionMode --> Ready: Standalone Executable
    DevelopmentMode --> CheckingPython: Need Python
    
    CheckingPython --> Ready: Python Found
    CheckingPython --> Disabled: Python Not Found
    
    Ready --> Processing: Operation Request
    Processing --> Executing: Spawn Process
    
    Executing --> WaitingForResult: Process Running
    WaitingForResult --> ProcessingResult: Process Exit
    
    ProcessingResult --> Success: Exit Code 0
    ProcessingResult --> Error: Exit Code != 0
    
    Success --> Ready: Return Result
    Error --> Ready: Return Error
    
    Disabled --> [*]: Feature Unavailable
    
    note right of ProductionMode
        Uses .exe
        No Python required
        End-user ready
    end note
    
    note right of DevelopmentMode
        Uses Python script
        Development/debug
        Requires Python
    end note
    
    note right of Disabled
        Printer features
        not available
        Show error to user
    end note
```

---

## 4. Electron IPC Handler State

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> ReceivingRequest: IPC Invoke
    
    ReceivingRequest --> ValidatingPayload: Request Received
    
    ValidatingPayload --> PayloadValid: Check Passed
    ValidatingPayload --> PayloadInvalid: Check Failed
    
    PayloadInvalid --> SendingError: Create Error Response
    SendingError --> Idle: Error Sent
    
    PayloadValid --> PreparingArgs: Build Command
    PreparingArgs --> SpawningProcess: Args Ready
    
    SpawningProcess --> ProcessRunning: Process Started
    SpawningProcess --> SpawnFailed: Cannot Spawn
    
    SpawnFailed --> SendingError: Error Response
    
    ProcessRunning --> CollectingOutput: Listening stdout/stderr
    CollectingOutput --> ProcessExited: Process Closed
    
    ProcessExited --> AnalyzingResult: Check Exit Code
    
    AnalyzingResult --> Success: Exit 0
    AnalyzingResult --> Failure: Exit != 0
    
    Success --> SendingSuccess: Create Success Response
    Failure --> SendingError: Create Error Response
    
    SendingSuccess --> Idle: Response Sent
    
    note right of ValidatingPayload
        Check required fields:
        - barcode
        - mn
        - firmware
        - batchId
        - uid
    end note
    
    note right of CollectingOutput
        Buffer all output
        Capture errors
        Monitor exit
    end note
```

---

## 5. USB Device State

```mermaid
stateDiagram-v2
    [*] --> Unplugged
    
    Unplugged --> Plugged: USB Connection
    Plugged --> Enumerating: OS Detect
    
    Enumerating --> DeviceReady: Driver Loaded
    Enumerating --> DriverError: Driver Issue
    
    DriverError --> Unplugged: User Action
    DriverError --> DeviceReady: Driver Fixed
    
    DeviceReady --> Available: Idle State
    
    Available --> InUse: App Claims Interface
    Available --> Busy: Another App Using
    
    Busy --> Available: Released by App
    
    InUse --> Printing: Receiving Data
    InUse --> Available: Released
    
    Printing --> Cutting: Print Job Done
    Cutting --> InUse: Ready for Next
    
    InUse --> Error: Communication Error
    Error --> Available: Recovered
    Error --> Unplugged: Reset Required
    
    Available --> Unplugged: USB Disconnect
    InUse --> Unplugged: USB Disconnect
    Printing --> Unplugged: USB Disconnect
    
    note right of DeviceReady
        VID: 0x04f9
        PID: 0x2085
        Brother PT-P900W
    end note
    
    note right of Busy
        Access Denied
        errno 13
        Retry possible
    end note
    
    note right of Printing
        Receiving raster
        Processing image
        Physical printing
    end note
```

---

## 6. Label Generation Workflow State

```mermaid
stateDiagram-v2
    [*] --> Init
    
    Init --> CreatingBarcode: Start Generation
    
    CreatingBarcode --> BarcodeRendering: Code128 Class
    BarcodeRendering --> BarcodeRasterizing: Render to Buffer
    BarcodeRasterizing --> BarcodeReady: PNG in Memory
    
    BarcodeReady --> CreatingCanvas: Load & Resize
    
    CreatingCanvas --> CanvasReady: Blank Image Created
    
    CanvasReady --> LoadingFonts: Create Draw Context
    
    LoadingFonts --> FontsReady: Fonts Loaded
    LoadingFonts --> FontsDefault: Arial Not Found
    
    FontsDefault --> FontsReady: Use Default
    
    FontsReady --> PastingBarcode: Fonts Available
    PastingBarcode --> DrawingMN: Barcode Placed
    DrawingMN --> DrawingSW: MN Text Added
    DrawingSW --> DrawingBA: SW Text Added
    DrawingBA --> DrawingDate: BA Text Added
    DrawingDate --> DrawingBarcodeText: Date Added
    DrawingBarcodeText --> ImageComplete: Bottom Text Added
    
    ImageComplete --> SavingPreview: All Elements Done
    SavingPreview --> ConvertingToRaster: Preview Saved
    
    ConvertingToRaster --> RasterReady: Brother QL Format
    
    RasterReady --> [*]: Return Image
    
    note right of BarcodeRendering
        Module height: 28
        Module width: 0.5
        Quiet zone: 6
    end note
    
    note right of CanvasReady
        Mode: L (grayscale)
        Size: ~600x160
        Background: white
    end note
    
    note right of DrawingMN
        Font: 44pt
        Spacing: 14px
        Format: MN:ME-05-N1
    end note
```

---

## 7. Error Recovery State Machine

```mermaid
stateDiagram-v2
    [*] --> Operating
    
    Operating --> ErrorDetected: Exception Raised
    
    ErrorDetected --> ClassifyingError: Analyze Exception
    
    ClassifyingError --> USBError: USB Exception
    ClassifyingError --> ImportError: Missing Module
    ClassifyingError --> ValueError: Invalid Input
    ClassifyingError --> IOError: File/Device Error
    ClassifyingError --> UnknownError: Other Exception
    
    USBError --> CheckingUSBType: USB Error Details
    
    CheckingUSBType --> AccessDenied: errno 13
    CheckingUSBType --> DeviceNotFound: No Device
    CheckingUSBType --> TransferError: Transfer Failed
    
    AccessDenied --> CanRetry: Check Retry Count
    CanRetry --> Retrying: Retries Available
    CanRetry --> Failed: Max Retries
    
    Retrying --> Waiting: Dispose Resources
    Waiting --> Operating: After Delay
    
    DeviceNotFound --> Failed: Cannot Recover
    TransferError --> Failed: Cannot Recover
    
    ImportError --> Failed: Missing Dependency
    ValueError --> Failed: Bad Input
    IOError --> Failed: System Issue
    UnknownError --> Logging: Log Details
    Logging --> Failed: Cannot Recover
    
    Failed --> Cleanup: Begin Cleanup
    Cleanup --> ResourceRelease: Dispose USB
    ResourceRelease --> ErrorReported: Log Error
    ErrorReported --> [*]: Exit with Code
    
    note right of CanRetry
        Max: 3 attempts
        Delay: 0.6s
        Only for errno 13
    end note
    
    note right of Cleanup
        Release USB
        Close files
        Print traceback
    end note
```

---

## 8. System Lifecycle State

```mermaid
stateDiagram-v2
    [*] --> AppStarting
    
    AppStarting --> LoadingConfig: Electron Init
    LoadingConfig --> RegisteringHandlers: Config Loaded
    RegisteringHandlers --> CheckingPrinterModule: IPC Ready
    
    CheckingPrinterModule --> ModuleAvailable: .exe or Python Found
    CheckingPrinterModule --> ModuleUnavailable: Not Found
    
    ModuleAvailable --> Operational: System Ready
    ModuleUnavailable --> LimitedMode: Printer Disabled
    
    Operational --> FactoryTestingActive: User Opens Page
    FactoryTestingActive --> TestingDevice: Running Tests
    TestingDevice --> TestsPassed: All Pass
    TestsPassed --> PrinterRequested: User Clicks Print
    
    PrinterRequested --> PrintingLabel: Invoke Printer
    PrintingLabel --> LabelPrinted: Print Complete
    LabelPrinted --> FactoryTestingActive: Ready for Next
    
    FactoryTestingActive --> Operational: User Closes Page
    
    LimitedMode --> Operational: Module Fixed
    
    Operational --> ShuttingDown: App Close
    ShuttingDown --> CleaningUp: Save State
    CleaningUp --> [*]: Exit
    
    note right of ModuleAvailable
        Production: .exe
        Development: Python
        Features: Full
    end note
    
    note right of ModuleUnavailable
        No .exe
        No Python
        Features: Limited
    end note
    
    note right of LimitedMode
        Factory testing works
        Printer disabled
        Show warning
    end note
```

---

## State Transition Summary

### Key States

| State | Description | Duration | Next States |
|-------|-------------|----------|-------------|
| **Disconnected** | No printer connection | Indefinite | Checking, [*] |
| **Checking** | Scanning for USB device | <500ms | Connecting, Disconnected |
| **Connected** | Printer ready for operations | Stable | Printing, Disconnected |
| **Printing** | Active print job | 3-5s | Complete, Error |
| **Failed** | Unrecoverable error | Terminal | Disconnected |

### Critical Transitions

```mermaid
stateDiagram-v2
    Connected --> Printing: CRITICAL
    Printing --> Complete: CRITICAL
    AccessDenied --> Retrying: AUTO-RETRY
    Failed --> Cleanup: MANDATORY
```

### State Persistence

- **Connection state**: Not persisted (check on demand)
- **Print jobs**: Not queued (one at a time)
- **Errors**: Logged to console
- **Success count**: Tracked in UI only

---

## Timing Diagrams

### Connection Retry Timing

```
Attempt 1:  t=0s        → Fail (errno 13)
Wait:       t=0.6s
Attempt 2:  t=0.6s      → Fail (errno 13)
Wait:       t=1.2s
Attempt 3:  t=1.2s      → Success/Fail
Result:     t=1.2-1.5s
```

### Print Job Timing

```
Request:    t=0s
Generate:   t=0s-0.2s   (label creation)
Connect:    t=0.2s-0.7s (USB handshake)
Convert:    t=0.7s-0.9s (raster conversion)
Send:       t=0.9s-1.5s (data transfer)
Print:      t=1.5s-5.5s (physical printing)
Cut:        t=5.5s-6.0s (tape cutting)
Complete:   t=6.0s
```

---

## Notes

### State Storage

- States are **runtime only** (not persisted)
- Each operation starts fresh
- No state carried between print jobs

### Concurrency

- **Single-threaded**: One operation at a time
- **No queuing**: Reject concurrent requests
- **Resource locking**: USB device exclusive access

### Error Handling

- **Transient errors**: Retry (errno 13)
- **Permanent errors**: Fail fast
- **Resource cleanup**: Always executed

### Recovery Strategy

1. Identify error type
2. Determine if recoverable
3. Retry if appropriate
4. Clean up resources
5. Report to user
