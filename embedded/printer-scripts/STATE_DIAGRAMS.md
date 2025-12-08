# State Diagrams - Printer Module State Machines

State machine documentation for the Brother PT-P900W printer module, covering printer states, print job lifecycle, and connection management.

## Table of Contents

1. [Printer Device States](#printer-device-states)
2. [Print Job Lifecycle](#print-job-lifecycle)
3. [Connection State Machine](#connection-state-machine)
4. [Error State Management](#error-state-management)
5. [Electron Integration States](#electron-integration-states)

## Printer Device States

### Main Printer State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting: connect_printer()
    Connecting --> Connected: USB enumeration success
    Connecting --> Error: Device not found
    Connecting --> Disconnected: Timeout
    
    Connected --> Ready: Status check OK
    Connected --> Error: Status check failed
    
    Ready --> CheckingStatus: get_status()
    CheckingStatus --> Ready: Status OK
    CheckingStatus --> NoTape: Tape missing
    CheckingStatus --> CoverOpen: Cover open
    CheckingStatus --> PrinterError: Device error
    
    Ready --> Printing: send_print_job()
    Printing --> SpoolingData: Sending raster
    SpoolingData --> WaitingPrint: Data sent
    WaitingPrint --> Printing: Still printing
    WaitingPrint --> Ready: Print complete
    WaitingPrint --> PrinterError: Print failed
    
    NoTape --> Ready: Tape loaded
    CoverOpen --> Ready: Cover closed
    PrinterError --> Ready: Error cleared
    PrinterError --> Disconnected: Fatal error
    
    Ready --> Disconnected: Explicit disconnect
    Error --> Disconnected: Reset
    
    note right of Disconnected
        Initial state
        No USB connection
    end note
    
    note right of Ready
        Idle and ready
        for print jobs
    end note
    
    note right of Printing
        Active print job
        Cannot accept new jobs
    end note
```

### Detailed Status States

```mermaid
stateDiagram-v2
    [*] --> Unknown
    
    Unknown --> Querying: Request status
    Querying --> Parsing: Status received
    
    Parsing --> Idle: All bits clear
    Parsing --> Busy: Bit 3 set (printing)
    Parsing --> ErrorState: Bit 0 set (error)
    Parsing --> NoMedia: Bit 1 set (no tape)
    Parsing --> CoverOpenState: Bit 2 set (cover)
    
    Idle --> Querying: Periodic check
    Busy --> Querying: Poll until done
    ErrorState --> Querying: After error handling
    NoMedia --> Querying: After intervention
    CoverOpenState --> Querying: After fixing
    
    ErrorState --> [*]: Fatal error
    
    note right of Querying
        USB control transfer
        Timeout: 3 seconds
    end note
    
    note right of Idle
        Ready for commands
        status['ready'] = True
    end note
    
    note right of Busy
        Print in progress
        status['printing'] = True
    end note
```

## Print Job Lifecycle

### Complete Print Job State Machine

```mermaid
stateDiagram-v2
    [*] --> JobCreated
    
    JobCreated --> Validating: validate_input()
    Validating --> ValidationFailed: Invalid data
    Validating --> GeneratingLabel: Valid data
    
    GeneratingLabel --> CreatingBarcode: Start generation
    CreatingBarcode --> BuildingImage: Barcode ready
    BuildingImage --> ComposingLabel: Image created
    ComposingLabel --> LabelReady: Composition complete
    
    LabelReady --> ConnectingToPrinter: send_print_job()
    ConnectingToPrinter --> ConnectionFailed: USB error
    ConnectingToPrinter --> CheckingPrinter: Connected
    
    CheckingPrinter --> PrinterNotReady: Status error
    CheckingPrinter --> ConvertingRaster: Status OK
    
    ConvertingRaster --> SendingHeader: Raster ready
    SendingHeader --> SendingData: Header ACK
    SendingData --> SendingData: More lines
    SendingData --> SendingPrintCmd: All data sent
    
    SendingPrintCmd --> WaitingCompletion: Command sent
    WaitingCompletion --> PollingStatus: Poll start
    PollingStatus --> WaitingCompletion: Still busy
    PollingStatus --> JobComplete: Print done
    PollingStatus --> JobFailed: Error detected
    
    ValidationFailed --> JobFailed
    ConnectionFailed --> JobFailed
    PrinterNotReady --> JobFailed
    
    JobComplete --> [*]
    JobFailed --> [*]
    
    note right of JobCreated
        User initiates print
        Data collected
    end note
    
    note right of LabelReady
        PIL Image complete
        708x141 pixels
    end note
    
    note right of ConvertingRaster
        RGB to 1-bit
        Packed bytes
    end note
    
    note right of JobComplete
        Physical label
        output complete
    end note
```

### Label Generation States

```mermaid
stateDiagram-v2
    [*] --> InitGeneration
    
    InitGeneration --> CalculatingDimensions: Start
    CalculatingDimensions --> CreatingCanvas: Dimensions set
    
    CreatingCanvas --> GeneratingBarcode: Canvas ready
    state GeneratingBarcode {
        [*] --> ValidateText
        ValidateText --> EncodeCode128: Valid
        ValidateText --> BarcodeError: Invalid
        EncodeCode128 --> RenderBars: Encoded
        RenderBars --> BarcodeComplete: Rendered
        BarcodeComplete --> [*]
    }
    
    GeneratingBarcode --> BarcodeError: Generation failed
    GeneratingBarcode --> PastingBarcode: Barcode ready
    
    PastingBarcode --> LoadingFont: Barcode on canvas
    LoadingFont --> FontError: Font not found
    LoadingFont --> RenderingText: Font loaded
    
    state RenderingText {
        [*] --> DrawMN
        DrawMN --> DrawFW: Line 1 done
        DrawFW --> DrawBA: Line 2 done
        DrawBA --> DrawUID: Line 3 done
        DrawUID --> DrawDate: Line 4 done
        DrawDate --> TextComplete: Line 5 done
        TextComplete --> [*]
    }
    
    RenderingText --> ImageComplete: All text added
    
    ImageComplete --> SavingPreview: Optional save
    SavingPreview --> ImageReady: Preview saved
    ImageComplete --> ImageReady: Skip preview
    
    ImageReady --> [*]
    BarcodeError --> [*]
    FontError --> [*]
    
    note right of CreatingCanvas
        708x141 pixels
        RGB white background
    end note
    
    note right of PastingBarcode
        Position: (10, centered)
        Width: 40% of canvas
    end note
```

## Connection State Machine

### USB Connection States

```mermaid
stateDiagram-v2
    [*] --> Uninitialized
    
    Uninitialized --> Enumerating: Start connection
    
    state Enumerating {
        [*] --> ScanningPorts
        ScanningPorts --> CheckingVID: Device found
        CheckingVID --> CheckingPID: VID match
        CheckingPID --> DeviceFound: PID match
        CheckingVID --> ScanningPorts: VID mismatch
        CheckingPID --> ScanningPorts: PID mismatch
        ScanningPorts --> NoDevice: No more devices
        DeviceFound --> [*]
    }
    
    Enumerating --> NotFound: No device
    Enumerating --> Configuring: Device found
    
    state Configuring {
        [*] --> SetConfiguration
        SetConfiguration --> ClaimInterface: Config set
        ClaimInterface --> GetDescriptor: Interface claimed
        GetDescriptor --> Configured: Descriptor read
        SetConfiguration --> ConfigError: Set failed
        ClaimInterface --> ConfigError: Claim failed
        GetDescriptor --> ConfigError: Read failed
        Configured --> [*]
    }
    
    Configuring --> ConfigurationFailed: Config error
    Configuring --> Established: Successfully configured
    
    Established --> Active: Verify communication
    Active --> Monitoring: Connection stable
    
    state Monitoring {
        [*] --> PeriodicCheck
        PeriodicCheck --> Healthy: Device responds
        PeriodicCheck --> Unhealthy: No response
        Healthy --> PeriodicCheck: Continue monitoring
        Unhealthy --> Reconnecting: Attempt reconnect
        Reconnecting --> PeriodicCheck: Reconnected
        Reconnecting --> ConnectionLost: Failed
    }
    
    Monitoring --> Disconnecting: Explicit close
    Monitoring --> ConnectionLost: Unexpected loss
    
    Disconnecting --> Closed: Clean shutdown
    ConnectionLost --> Closed: Force close
    NotFound --> Closed
    ConfigurationFailed --> Closed
    
    Closed --> [*]
    
    note right of Enumerating
        VID: 0x04f9 (Brother)
        PID: 0x2085 (PT-P900W)
    end note
    
    note right of Active
        Ready for commands
        Status queries enabled
    end note
```

### Connection Retry Logic

```mermaid
stateDiagram-v2
    [*] --> Attempt
    
    state Attempt {
        [*] --> Try1
        Try1 --> Success1: Connected
        Try1 --> Wait1: Failed
        Wait1 --> Try2: After 2s
        Try2 --> Success2: Connected
        Try2 --> Wait2: Failed
        Wait2 --> Try3: After 2s
        Try3 --> Success3: Connected
        Try3 --> MaxRetries: Failed
        
        Success1 --> [*]
        Success2 --> [*]
        Success3 --> [*]
    }
    
    Attempt --> Connected: Success
    Attempt --> Failed: Max retries
    
    Connected --> [*]
    Failed --> [*]
    
    note right of Wait1
        Retry count: 1
        Delay: 2 seconds
    end note
    
    note right of MaxRetries
        Give up after 3 attempts
        Return error to user
    end note
```

## Error State Management

### Error Handling State Machine

```mermaid
stateDiagram-v2
    [*] --> NormalOperation
    
    NormalOperation --> ErrorDetected: Exception raised
    
    state ErrorDetected {
        [*] --> ClassifyError
        ClassifyError --> ValidationError: Input invalid
        ClassifyError --> USBError: USB communication
        ClassifyError --> PrinterError: Printer status
        ClassifyError --> SystemError: System/OS
        
        ValidationError --> [*]: User error
        USBError --> [*]: Device error
        PrinterError --> [*]: Printer error
        SystemError --> [*]: System error
    }
    
    ErrorDetected --> DetermineRecovery: Error classified
    
    state DetermineRecovery {
        [*] --> CheckRecoverable
        CheckRecoverable --> Recoverable: Can retry
        CheckRecoverable --> Fatal: Cannot recover
        
        Recoverable --> [*]
        Fatal --> [*]
    }
    
    DetermineRecovery --> AttemptRecovery: Recoverable
    DetermineRecovery --> ErrorHandled: Fatal
    
    state AttemptRecovery {
        [*] --> RetryAction
        RetryAction --> RecoverySuccess: Succeeded
        RetryAction --> RecoveryFailed: Failed
        RecoverySuccess --> [*]
        RecoveryFailed --> [*]
    }
    
    AttemptRecovery --> NormalOperation: Recovery success
    AttemptRecovery --> ErrorHandled: Recovery failed
    
    ErrorHandled --> LogError: Record error
    LogError --> NotifyUser: Show message
    NotifyUser --> CleanupResources: User notified
    CleanupResources --> [*]
    
    note right of ValidationError
        Bad input data
        No retry needed
        Show validation message
    end note
    
    note right of USBError
        Connection lost
        Device unplugged
        Retry possible
    end note
    
    note right of PrinterError
        No tape, cover open
        User intervention needed
        Wait and retry
    end note
```

### Error Recovery Strategies

```mermaid
stateDiagram-v2
    [*] --> ErrorOccurred
    
    ErrorOccurred --> AnalyzeError: Classify type
    
    state AnalyzeError {
        [*] --> GetErrorType
        GetErrorType --> Transient: Temporary issue
        GetErrorType --> Persistent: Consistent problem
        GetErrorType --> Critical: Fatal error
    }
    
    AnalyzeError --> SelectStrategy: Strategy determined
    
    state SelectStrategy {
        [*] --> ChooseAction
        ChooseAction --> ImmediateRetry: Transient
        ChooseAction --> DelayedRetry: Persistent
        ChooseAction --> UserIntervention: Critical
        ChooseAction --> Abort: Unrecoverable
    }
    
    SelectStrategy --> ExecuteStrategy: Strategy selected
    
    state ExecuteStrategy {
        [*] --> ApplyStrategy
        
        state ImmediateRetryState {
            [*] --> RetryNow
            RetryNow --> RetrySuccess: Worked
            RetryNow --> RetryFail: Failed
        }
        
        state DelayedRetryState {
            [*] --> Wait
            Wait --> RetryAfterDelay: After pause
            RetryAfterDelay --> DelaySuccess: Worked
            RetryAfterDelay --> DelayFail: Failed
        }
        
        state UserInterventionState {
            [*] --> NotifyUser
            NotifyUser --> WaitForFix: Show message
            WaitForFix --> CheckFixed: User action
            CheckFixed --> InterventionSuccess: Fixed
            CheckFixed --> InterventionFail: Still broken
        }
        
        ApplyStrategy --> ImmediateRetryState
        ApplyStrategy --> DelayedRetryState
        ApplyStrategy --> UserInterventionState
        ApplyStrategy --> AbortState: Unrecoverable
        
        ImmediateRetryState --> StrategyComplete
        DelayedRetryState --> StrategyComplete
        UserInterventionState --> StrategyComplete
        AbortState --> StrategyComplete
    }
    
    ExecuteStrategy --> Resolved: Success
    ExecuteStrategy --> Failed: All strategies failed
    
    Resolved --> [*]
    Failed --> [*]
    
    note right of ImmediateRetry
        Network timeout
        Temporary USB glitch
        Retry immediately
    end note
    
    note right of DelayedRetry
        Printer busy
        Wait 2 seconds
        Retry operation
    end note
    
    note right of UserIntervention
        No tape loaded
        Cover open
        User must fix
    end note
```

## Electron Integration States

### IPC Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> UIIdle
    
    UIIdle --> UITriggered: User clicks button
    UITriggered --> IPCSending: Call window.api
    
    IPCSending --> IPCTransit: Message sent
    IPCTransit --> MainReceived: Main process receives
    
    MainReceived --> ValidatingPayload: Check data
    ValidatingPayload --> PayloadInvalid: Bad data
    ValidatingPayload --> ResolvingPaths: Valid data
    
    ResolvingPaths --> SpawningProcess: Paths found
    
    state SpawningProcess {
        [*] --> CheckExecutable
        CheckExecutable --> UseExe: .exe exists
        CheckExecutable --> UsePython: .exe missing
        UseExe --> ProcessStarted
        UsePython --> ProcessStarted
        ProcessStarted --> [*]
    }
    
    SpawningProcess --> ProcessRunning: Process spawned
    
    state ProcessRunning {
        [*] --> Executing
        Executing --> CapturingOutput: stdout data
        Executing --> CapturingError: stderr data
        CapturingOutput --> Executing: More output
        CapturingError --> Executing: More errors
        Executing --> ProcessExit: Exit event
        ProcessExit --> [*]
    }
    
    ProcessRunning --> ProcessComplete: Exit received
    
    ProcessComplete --> AnalyzeResult: Check exit code
    AnalyzeResult --> ResultSuccess: Code 0
    AnalyzeResult --> ResultFailure: Code != 0
    
    ResultSuccess --> IPCReply: Send response
    ResultFailure --> IPCReply: Send error
    
    IPCReply --> UIReceived: Main → Renderer
    UIReceived --> UIUpdate: Update state
    
    UIUpdate --> UIIdle: Ready for next request
    PayloadInvalid --> UIReceived: Return error
    
    note right of IPCTransit
        IPC channel:
        printer:printLabel
        or printer:checkConnection
    end note
    
    note right of ProcessRunning
        Child process:
        print_product_label.exe
        or python script
    end note
```

### Application State Machine

```mermaid
stateDiagram-v2
    [*] --> AppStartup
    
    AppStartup --> LoadingModules: Initialize
    LoadingModules --> RegisteringIPC: Modules loaded
    RegisteringIPC --> AppReady: IPC handlers set
    
    AppReady --> Idle: Waiting for user
    
    state Idle {
        [*] --> MonitoringUI
        MonitoringUI --> UserAction: Event triggered
        UserAction --> MonitoringUI: Action complete
    }
    
    Idle --> CheckingPrinter: Check request
    Idle --> PrintingLabel: Print request
    
    state CheckingPrinter {
        [*] --> InitCheck
        InitCheck --> SpawnCheckProcess: Start check
        SpawnCheckProcess --> WaitCheckResult: Process running
        WaitCheckResult --> CheckComplete: Result received
        CheckComplete --> [*]
    }
    
    state PrintingLabel {
        [*] --> InitPrint
        InitPrint --> ValidatePrintData: Check payload
        ValidatePrintData --> SpawnPrintProcess: Valid
        ValidatePrintData --> PrintError: Invalid
        SpawnPrintProcess --> WaitPrintResult: Process running
        WaitPrintResult --> PrintComplete: Success
        WaitPrintResult --> PrintError: Failure
        PrintComplete --> [*]
        PrintError --> [*]
    }
    
    CheckingPrinter --> Idle: Check done
    PrintingLabel --> Idle: Print done
    
    Idle --> AppShutdown: Quit triggered
    AppShutdown --> CleanupResources: Shutting down
    CleanupResources --> [*]
    
    note right of AppReady
        All IPC handlers registered
        getPrinterScriptsDir() ready
        spawnPython() available
    end note
    
    note right of Idle
        Main event loop
        Responsive to user
        No active print jobs
    end note
```

### Process State Monitoring

```mermaid
stateDiagram-v2
    [*] --> NoProcess
    
    NoProcess --> ProcessSpawned: spawn() called
    
    ProcessSpawned --> ProcessStarting: OS creating process
    ProcessStarting --> ProcessRunning: PID assigned
    ProcessStarting --> SpawnFailed: Spawn error
    
    state ProcessRunning {
        [*] --> Active
        Active --> CollectingStdout: stdout event
        Active --> CollectingStderr: stderr event
        Active --> Error: error event
        CollectingStdout --> Active: Data buffered
        CollectingStderr --> Active: Error buffered
        Error --> [*]: Fatal error
        Active --> Exiting: close event
        Exiting --> [*]
    }
    
    ProcessRunning --> ProcessExited: Process terminated
    
    ProcessExited --> EvaluateResult: Check exit code
    
    state EvaluateResult {
        [*] --> CheckCode
        CheckCode --> ExitSuccess: Code = 0
        CheckCode --> ExitFailure: Code != 0
        ExitSuccess --> [*]
        ExitFailure --> [*]
    }
    
    EvaluateResult --> ResultHandled: Result processed
    SpawnFailed --> ResultHandled: Error handled
    
    ResultHandled --> NoProcess: Ready for next
    
    note right of ProcessRunning
        Monitor events:
        - stdout (data)
        - stderr (errors)
        - error (spawn fail)
        - close (exit code)
    end note
    
    note right of EvaluateResult
        Exit code 0 = success
        Exit code 1 = error
        Parse output/stderr
    end note
```

## State Transition Summary

### State Transition Table

| Current State | Event | Next State | Action |
|--------------|-------|------------|--------|
| Disconnected | connect_printer() | Connecting | Enumerate USB devices |
| Connecting | Device found | Connected | Set USB configuration |
| Connecting | Device not found | Error | Log error, notify user |
| Connected | Status OK | Ready | Enable operations |
| Ready | send_print_job() | Printing | Start print workflow |
| Printing | Data sent | WaitingPrint | Poll status |
| WaitingPrint | Print done | Ready | Complete job |
| Ready | disconnect() | Disconnected | Close USB connection |
| Any error state | clear_error() | Ready | Resume operations |

### Critical State Guards

```mermaid
stateDiagram-v2
    [*] --> StateA
    
    StateA --> CheckGuard: Transition attempt
    
    state CheckGuard {
        [*] --> EvaluateCondition
        EvaluateCondition --> ConditionMet: Guard passes
        EvaluateCondition --> ConditionFailed: Guard fails
    }
    
    CheckGuard --> StateB: Allowed
    CheckGuard --> StateA: Blocked
    
    StateB --> [*]
    
    note right of EvaluateCondition
        Guards:
        - USB connected?
        - Printer ready?
        - Valid input?
        - Not printing?
    end note
```

**Common Guards:**

1. **Can Print?**
   - Connected = true
   - Status = Ready
   - Tape loaded = true
   - Cover closed = true

2. **Can Connect?**
   - Not already connected
   - USB device available
   - Driver installed

3. **Can Disconnect?**
   - Currently connected
   - No active print job
   - Resources can be released
