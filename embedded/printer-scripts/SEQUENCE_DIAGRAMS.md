# Sequence Diagrams - Printer Module Workflows

Detailed interaction flows for all major operations in the Brother PT-P900W printer module.

## Table of Contents

1. [Complete Print Workflow](#complete-print-workflow)
2. [Printer Connection Check](#printer-connection-check)
3. [Label Generation Process](#label-generation-process)
4. [USB Communication](#usb-communication)
5. [Error Handling Flows](#error-handling-flows)
6. [Electron Integration](#electron-integration)

## Complete Print Workflow

### End-to-End Print Process

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Factory Testing Page
    participant API as window.api
    participant IPC as IPC Handler
    participant Main as main.js
    participant Spawn as spawnPython()
    participant Exe as print_product_label.exe
    participant Script as Python Script
    participant Gen as Label Generator
    participant USB as USB Layer
    participant Printer as PT-P900W
    
    U->>UI: Click "Print Label"
    UI->>UI: Collect device data
    activate UI
    UI->>API: printLabel(data)
    activate API
    API->>IPC: Send IPC message
    activate IPC
    IPC->>Main: printer:printLabel handler
    activate Main
    Main->>Main: getPrinterScriptsDir()
    Main->>Spawn: spawnPython(script, args)
    activate Spawn
    Spawn->>Spawn: Check .exe exists
    Spawn->>Exe: Execute with args
    activate Exe
    Exe->>Script: Load and run
    activate Script
    
    Script->>Script: Parse arguments
    Script->>Script: validate_input()
    
    alt Invalid Input
        Script-->>Exe: Exit 1: Validation error
        Exe-->>Spawn: Process exit
        Spawn-->>Main: Error code 1
        Main-->>IPC: {success: false}
        IPC-->>API: Error response
        API-->>UI: Print failed
        UI->>U: Show error message
    else Valid Input
        Script->>Gen: create_label_image(data)
        activate Gen
        Gen->>Gen: create_barcode()
        Gen->>Gen: Build image canvas
        Gen->>Gen: Paste barcode
        Gen->>Gen: Add text fields
        Gen-->>Script: Return PIL Image
        deactivate Gen
        
        Script->>USB: connect_printer()
        activate USB
        USB->>USB: Find USB device (VID:PID)
        USB->>Printer: Enumerate USB
        Printer-->>USB: Device info
        USB-->>Script: Printer object
        
        Script->>USB: get_printer_status()
        USB->>Printer: Query status
        Printer-->>USB: Status byte
        USB-->>Script: Status OK
        
        Script->>USB: send_print_job(image)
        USB->>USB: Convert to raster
        USB->>Printer: Send raster data
        Printer->>Printer: Process and print
        Printer-->>USB: ACK
        USB-->>Script: Print success
        deactivate USB
        
        Script-->>Exe: Exit 0: Success
        deactivate Script
        Exe-->>Spawn: Process exit
        deactivate Exe
        Spawn-->>Main: Exit code 0
        deactivate Spawn
        Main-->>IPC: {success: true}
        deactivate Main
        IPC-->>API: Success response
        deactivate IPC
        API-->>UI: Print succeeded
        deactivate API
        UI->>U: Show success message
        deactivate UI
        
        Note over Printer: Physical label<br/>printed
    end
```

## Printer Connection Check

### Simple Connection Verification

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI Component
    participant API as window.api
    participant Main as main.js
    participant Exe as Executable
    participant USB as USB Interface
    participant Printer as PT-P900W
    
    U->>UI: Click "Check Printer"
    activate UI
    UI->>API: checkPrinterConnection()
    activate API
    API->>Main: IPC: printer:checkConnection
    activate Main
    Main->>Main: getPrinterScriptsDir()
    Main->>Main: spawnPython(script, ['--check'])
    Main->>Exe: Execute --check
    activate Exe
    
    Exe->>Exe: Parse --check flag
    Exe->>USB: Find device (VID:0x04f9, PID:0x2085)
    activate USB
    
    alt Device Found
        USB->>Printer: Connect via USB
        activate Printer
        Printer-->>USB: Connection established
        USB->>Printer: Request status
        Printer-->>USB: Status response
        deactivate Printer
        USB-->>Exe: Device OK
        deactivate USB
        Exe->>Exe: Print "CHECK_STATUS_OK"
        Exe-->>Main: Exit 0
        deactivate Exe
        Main-->>API: {connected: true, output: "...OK"}
        deactivate Main
        API-->>UI: Connection success
        deactivate API
        UI->>U: Show "✓ Printer Connected"
        deactivate UI
    else Device Not Found
        USB-->>Exe: Device not found
        deactivate USB
        Exe->>Exe: Print "CHECK_FAILED"
        Exe-->>Main: Exit 1
        deactivate Exe
        Main-->>API: {connected: false, output: "...FAILED"}
        deactivate Main
        API-->>UI: Connection failed
        deactivate API
        UI->>U: Show "✗ Printer Not Found"
        deactivate UI
    end
```

### Detailed Connection Process

```mermaid
sequenceDiagram
    participant Script as Python Script
    participant USBCore as usb.core
    participant USBUtil as usb.util
    participant LibUSB as libusb-1.0.dll
    participant WinUSB as Windows USB Driver
    participant Device as PT-P900W
    
    Script->>USBCore: usb.core.find(idVendor=0x04f9, idProduct=0x2085)
    activate USBCore
    USBCore->>LibUSB: Enumerate devices
    activate LibUSB
    LibUSB->>WinUSB: Get device list
    activate WinUSB
    WinUSB->>WinUSB: Scan USB ports
    WinUSB-->>LibUSB: Device list
    deactivate WinUSB
    LibUSB->>LibUSB: Filter by VID:PID
    
    alt Device Found
        LibUSB-->>USBCore: Device handle
        deactivate LibUSB
        USBCore-->>Script: Device object
        deactivate USBCore
        
        Script->>USBUtil: dev.set_configuration()
        activate USBUtil
        USBUtil->>Device: Set USB configuration
        activate Device
        Device-->>USBUtil: Configuration set
        deactivate Device
        USBUtil-->>Script: Configuration OK
        deactivate USBUtil
        
        Script->>USBCore: Get active configuration
        activate USBCore
        USBCore->>Device: Read configuration descriptor
        activate Device
        Device-->>USBCore: Configuration data
        deactivate Device
        USBCore-->>Script: Configuration info
        deactivate USBCore
        
        Script->>Script: Connection successful
    else Device Not Found
        LibUSB-->>USBCore: None
        deactivate LibUSB
        USBCore-->>Script: None
        deactivate USBCore
        Script->>Script: Raise ValueError
    end
```

## Label Generation Process

### Image Creation Workflow

```mermaid
sequenceDiagram
    participant Script as print_label()
    participant Gen as create_label_image()
    participant Barcode as python-barcode
    participant PIL as Pillow (PIL)
    participant Font as ImageFont
    participant Draw as ImageDraw
    
    Script->>Gen: create_label_image(data)
    activate Gen
    
    Gen->>Gen: Calculate dimensions
    Note over Gen: width = 708px (60mm)<br/>height = 141px (12mm)
    
    Gen->>Barcode: Code128(barcode_text)
    activate Barcode
    Barcode->>Barcode: Validate text
    Barcode->>Barcode: Generate bars
    Barcode->>Barcode: Create image writer
    Barcode-->>Gen: Barcode object
    deactivate Barcode
    
    Gen->>Barcode: barcode.render(options)
    activate Barcode
    Barcode->>PIL: Create barcode image
    activate PIL
    PIL-->>Barcode: Image object
    deactivate PIL
    Barcode-->>Gen: Barcode image
    deactivate Barcode
    
    Gen->>PIL: Image.new('RGB', (708, 141), 'white')
    activate PIL
    PIL-->>Gen: Blank canvas
    
    Gen->>Gen: Calculate barcode position
    Note over Gen: x=10, y=centered<br/>width=40% of canvas
    
    Gen->>PIL: canvas.paste(barcode_img, position)
    PIL->>PIL: Composite images
    PIL-->>Gen: Updated canvas
    
    Gen->>Draw: ImageDraw.Draw(canvas)
    Draw-->>Gen: Drawing context
    
    Gen->>Font: ImageFont.truetype('arial.ttf', 24)
    activate Font
    Font-->>Gen: Font object
    deactivate Font
    
    Gen->>Gen: Calculate text position
    Note over Gen: x = barcode_width + 20<br/>y = 10, line_height = 30
    
    loop For each text field
        Gen->>Draw: draw.text((x, y), text, fill='black', font=font)
        activate Draw
        Draw->>PIL: Render text
        PIL-->>Draw: Text drawn
        Draw-->>Gen: Field added
        deactivate Draw
        Gen->>Gen: y += line_height
    end
    
    Gen->>PIL: Save preview (optional)
    PIL->>PIL: Write PNG file
    PIL-->>Gen: Preview saved
    deactivate PIL
    
    Gen-->>Script: Complete label image
    deactivate Gen
```

### Barcode Generation Detail

```mermaid
sequenceDiagram
    participant Caller as create_label_image()
    participant BC as barcode.get_barcode_class()
    participant Code128 as Code128
    participant Writer as ImageWriter
    participant Render as Render Engine
    
    Caller->>BC: get_barcode_class('code128')
    activate BC
    BC-->>Caller: Code128 class
    deactivate BC
    
    Caller->>Code128: Code128(text, writer=ImageWriter())
    activate Code128
    Code128->>Code128: Validate character set
    Code128->>Code128: Optimize encoding (A/B/C)
    Code128->>Code128: Calculate checksum
    Code128->>Writer: Initialize writer
    activate Writer
    Writer-->>Code128: Writer ready
    deactivate Writer
    Code128-->>Caller: Barcode instance
    deactivate Code128
    
    Caller->>Code128: barcode.render(options)
    activate Code128
    Code128->>Code128: Parse options
    Note over Code128: module_height: 6.0mm<br/>module_width: 0.15mm<br/>quiet_zone: 2.0mm
    
    Code128->>Render: Generate bar pattern
    activate Render
    Render->>Render: Convert to binary
    Note over Render: 1 = black bar<br/>0 = white space
    
    Render->>Writer: Create image
    activate Writer
    Writer->>Writer: Calculate dimensions
    Writer->>Writer: Create PIL Image
    Writer->>Writer: Draw bars
    
    loop For each module
        Writer->>Writer: Draw vertical line
        Note over Writer: Width: module_width<br/>Height: module_height
    end
    
    Writer-->>Render: Image object
    deactivate Writer
    Render-->>Code128: Rendered barcode
    deactivate Render
    Code128-->>Caller: Barcode image
    deactivate Code128
```

## USB Communication

### Print Job Transmission

```mermaid
sequenceDiagram
    participant Script as Python Script
    participant BL as brotherlabel
    participant Convert as Raster Converter
    participant USB as USB Interface
    participant Printer as PT-P900W
    
    Script->>BL: send_print_job(image)
    activate BL
    
    BL->>BL: Validate image dimensions
    Note over BL: Check 708x141 pixels<br/>12mm tape width
    
    BL->>Convert: convert_to_raster(image)
    activate Convert
    Convert->>Convert: Convert RGB to 1-bit
    Note over Convert: Threshold: 128<br/>Black/White only
    
    Convert->>Convert: Rotate 90° if needed
    Convert->>Convert: Add padding
    Convert->>Convert: Pack bits
    Note over Convert: 8 pixels per byte<br/>MSB first
    
    Convert-->>BL: Raster data array
    deactivate Convert
    
    BL->>BL: Build print command
    Note over BL: ESC/P commands<br/>Header + raster data
    
    BL->>USB: Send command header
    activate USB
    USB->>Printer: 0x1B 0x69 0x7A ... (initialize)
    Printer-->>USB: ACK
    
    BL->>USB: Send raster lines
    loop For each raster line
        USB->>Printer: Raster data packet
        Printer->>Printer: Buffer line
        Printer-->>USB: ACK
    end
    
    BL->>USB: Send print command
    USB->>Printer: 0x1A (print & feed)
    Printer->>Printer: Start printing
    Printer-->>USB: Status OK
    USB-->>BL: Print initiated
    deactivate USB
    
    BL->>BL: Wait for completion
    Note over BL: Poll status every 500ms<br/>Timeout: 10s
    
    loop Status check
        BL->>USB: Query status
        activate USB
        USB->>Printer: Status request
        Printer-->>USB: Status byte
        USB-->>BL: Status response
        deactivate USB
        
        alt Printing
            BL->>BL: Continue waiting
        else Complete
            BL->>BL: Break loop
        else Error
            BL-->>Script: Print error
        end
    end
    
    BL-->>Script: Print success
    deactivate BL
    
    Note over Printer: Physical label<br/>output complete
```

### Status Query Flow

```mermaid
sequenceDiagram
    participant Script as Python Script
    participant BL as brotherlabel
    participant USB as USB Layer
    participant Printer as PT-P900W
    
    Script->>BL: get_printer_status()
    activate BL
    
    BL->>USB: Send status request
    activate USB
    USB->>USB: Build request packet
    Note over USB: Request type: 0xA1<br/>Request: GET_STATUS
    
    USB->>Printer: Control transfer
    activate Printer
    Printer->>Printer: Read internal status
    Printer->>Printer: Check tape sensor
    Printer->>Printer: Check cover sensor
    Printer->>Printer: Check error flags
    
    Printer-->>USB: Status byte
    Note over Printer: Bit 0: Error<br/>Bit 1: No tape<br/>Bit 2: Cover open<br/>Bit 3: Printing
    deactivate Printer
    
    USB-->>BL: Raw status data
    deactivate USB
    
    BL->>BL: Parse status byte
    
    alt Bit 0 set
        BL->>BL: status['error'] = True
    end
    
    alt Bit 1 set
        BL->>BL: status['no_tape'] = True
    end
    
    alt Bit 2 set
        BL->>BL: status['cover_open'] = True
    end
    
    alt Bit 3 set
        BL->>BL: status['printing'] = True
    end
    
    BL->>BL: Determine ready state
    Note over BL: ready = !error &&<br/>!no_tape &&<br/>!cover_open &&<br/>!printing
    
    BL-->>Script: Status dictionary
    deactivate BL
    
    Script->>Script: Evaluate status
    
    alt Status ready
        Script->>Script: Proceed with print
    else Status error
        Script->>Script: Return error message
    end
```

## Error Handling Flows

### Connection Error Recovery

```mermaid
sequenceDiagram
    participant User as User Action
    participant Script as Python Script
    participant USB as USB Layer
    participant Retry as Retry Logic
    participant Log as Error Logger
    
    User->>Script: Attempt print
    activate Script
    
    Script->>USB: connect_printer()
    activate USB
    USB->>USB: Find device
    USB-->>Script: DeviceNotFound error
    deactivate USB
    
    Script->>Log: Log error details
    activate Log
    Log->>Log: Write to stderr
    Log-->>Script: Logged
    deactivate Log
    
    Script->>Retry: Check retry count
    activate Retry
    
    alt Retries remaining
        Retry->>Retry: Increment count
        Retry->>Retry: Wait 2 seconds
        Retry-->>Script: Retry
        deactivate Retry
        
        Script->>USB: connect_printer() (retry)
        activate USB
        
        alt Success
            USB-->>Script: Device object
            deactivate USB
            Script->>Script: Proceed with print
        else Still failed
            USB-->>Script: Error
            deactivate USB
            Script->>Retry: Check retry count
            activate Retry
            Note over Retry: Loop continues...
            deactivate Retry
        end
        
    else Max retries exceeded
        Retry-->>Script: Give up
        deactivate Retry
        Script->>Log: Log final error
        activate Log
        Log-->>Script: Logged
        deactivate Log
        Script-->>User: Return error
        deactivate Script
    end
```

### Print Job Error Handling

```mermaid
sequenceDiagram
    participant Script as Python Script
    participant Validate as Input Validator
    participant Printer as Printer Module
    participant Error as Error Handler
    participant User as User Feedback
    
    Script->>Validate: validate_input(data)
    activate Validate
    
    alt Invalid barcode
        Validate-->>Script: ValidationError("Invalid barcode format")
        Script->>Error: Handle validation error
        activate Error
        Error->>Error: Format user message
        Error-->>User: "Barcode must be alphanumeric"
        deactivate Error
    else Invalid date
        Validate-->>Script: ValidationError("Invalid date format")
        Script->>Error: Handle validation error
        activate Error
        Error-->>User: "Date must be YYYY/MM/DD"
        deactivate Error
    else Valid input
        Validate-->>Script: (True, None)
        deactivate Validate
        
        Script->>Printer: print_label(data)
        activate Printer
        
        alt Printer not found
            Printer-->>Script: PrinterNotFoundError
            Script->>Error: Handle printer error
            activate Error
            Error-->>User: "Printer not connected"
            deactivate Error
            
        else No tape loaded
            Printer-->>Script: PrinterError("No tape")
            Script->>Error: Handle tape error
            activate Error
            Error-->>User: "Please load tape cartridge"
            deactivate Error
            
        else Cover open
            Printer-->>Script: PrinterError("Cover open")
            Script->>Error: Handle cover error
            activate Error
            Error-->>User: "Please close printer cover"
            deactivate Error
            
        else USB error
            Printer-->>Script: USBError("Communication failed")
            Script->>Error: Handle USB error
            activate Error
            Error-->>User: "USB communication error"
            deactivate Error
            
        else Success
            Printer-->>Script: Print success
            deactivate Printer
            Script-->>User: "Print succeeded!"
        end
    end
```

## Electron Integration

### IPC Communication Flow

```mermaid
sequenceDiagram
    participant Renderer as Renderer Process
    participant Preload as Preload Script
    participant Context as contextBridge
    participant IPCRend as ipcRenderer
    participant IPCMain as ipcMain
    participant Handler as Handler Function
    participant Child as Child Process
    
    Renderer->>Preload: window.api.printLabel(data)
    activate Preload
    
    Preload->>Context: Expose via contextBridge
    activate Context
    Context->>IPCRend: ipcRenderer.invoke('printer:printLabel', data)
    activate IPCRend
    
    IPCRend->>IPCRend: Serialize data
    IPCRend->>IPCMain: Send IPC message
    activate IPCMain
    
    IPCMain->>Handler: Trigger handler function
    activate Handler
    
    Handler->>Handler: Extract data from event
    Handler->>Handler: Validate payload
    Handler->>Handler: Build command arguments
    Handler->>Child: spawnPython(script, args)
    activate Child
    
    Child->>Child: Execute print_product_label.exe
    Child->>Child: Capture stdout/stderr
    
    alt Success
        Child-->>Handler: Exit code 0, output
        Handler->>Handler: Parse output
        Handler-->>IPCMain: {success: true, output: "..."}
    else Failure
        Child-->>Handler: Exit code 1, error
        Handler->>Handler: Parse error
        Handler-->>IPCMain: {success: false, error: "..."}
    end
    
    deactivate Child
    deactivate Handler
    
    IPCMain-->>IPCRend: Return result object
    deactivate IPCMain
    
    IPCRend->>IPCRend: Deserialize result
    IPCRend-->>Context: Promise resolved
    deactivate IPCRend
    
    Context-->>Preload: Return value
    deactivate Context
    
    Preload-->>Renderer: Result object
    deactivate Preload
    
    Renderer->>Renderer: Update UI based on result
```

### Process Spawning Detail

```mermaid
sequenceDiagram
    participant Handler as IPC Handler
    participant Path as Path Resolver
    participant FS as File System
    participant Spawn as spawnPython()
    participant ChildProc as child_process
    participant Exe as Executable
    participant Callback as Event Callbacks
    
    Handler->>Path: getPrinterScriptsDir()
    activate Path
    Path->>Path: Check app.isPackaged
    
    alt Development mode
        Path-->>Handler: embedded/printer-scripts/
    else Production mode
        Path->>FS: Check ASAR unpacked path
        activate FS
        FS-->>Path: Path exists
        deactivate FS
        Path-->>Handler: app.asar.unpacked/.../
    end
    deactivate Path
    
    Handler->>Spawn: spawnPython(scriptPath, args)
    activate Spawn
    
    Spawn->>FS: Check .exe exists
    activate FS
    FS-->>Spawn: File exists: true
    deactivate FS
    
    alt Executable exists
        Spawn->>ChildProc: spawn(exePath, args)
        activate ChildProc
        ChildProc->>Exe: Start process
        activate Exe
        ChildProc-->>Spawn: ChildProcess object
        deactivate ChildProc
    else Executable missing
        Spawn->>ChildProc: spawn('python', [script, ...args])
        activate ChildProc
        ChildProc-->>Spawn: ChildProcess object
        deactivate ChildProc
    end
    
    Spawn->>Callback: Set up event listeners
    activate Callback
    
    Callback->>Callback: on('stdout', handler)
    Note over Callback: Collect output lines
    
    Callback->>Callback: on('stderr', handler)
    Note over Callback: Collect error lines
    
    Callback->>Callback: on('error', handler)
    Note over Callback: Handle spawn errors
    
    Callback->>Callback: on('close', handler)
    Note over Callback: Process exit code
    
    Callback-->>Spawn: Listeners attached
    deactivate Callback
    
    Spawn-->>Handler: Promise (pending)
    deactivate Spawn
    
    Note over Exe: Executable runs...<br/>Prints output...
    
    Exe-->>Callback: stdout data
    activate Callback
    Callback->>Callback: Append to buffer
    deactivate Callback
    
    Exe-->>Callback: Process exits
    activate Callback
    Callback->>Callback: Resolve promise
    Callback-->>Handler: {code, output, error}
    deactivate Callback
    deactivate Exe
    
    Handler->>Handler: Process result
    Handler-->>Handler: Return to IPC caller
```

### Error Propagation Chain

```mermaid
sequenceDiagram
    participant Child as Child Process
    participant Spawn as spawnPython()
    participant Handler as IPC Handler
    participant IPCMain as ipcMain
    participant IPCRend as ipcRenderer
    participant UI as React Component
    participant User as User
    
    Child->>Child: Error occurs
    activate Child
    Child->>Child: Print to stderr
    Child->>Child: Exit with code 1
    Child-->>Spawn: close event (code=1)
    deactivate Child
    
    activate Spawn
    Spawn->>Spawn: Detect non-zero exit
    Spawn->>Spawn: Collect stderr buffer
    Spawn-->>Handler: Resolve promise with error
    deactivate Spawn
    
    activate Handler
    Handler->>Handler: Check exit code
    Handler->>Handler: Format error response
    Handler-->>IPCMain: Return error object
    Note over Handler: {success: false,<br/>error: "...",<br/>exitCode: 1}
    deactivate Handler
    
    activate IPCMain
    IPCMain->>IPCMain: Serialize response
    IPCMain-->>IPCRend: Send reply
    deactivate IPCMain
    
    activate IPCRend
    IPCRend->>IPCRend: Deserialize
    IPCRend-->>UI: Reject promise / Return error
    deactivate IPCRend
    
    activate UI
    UI->>UI: Catch error in try/catch
    UI->>UI: Update state
    UI->>UI: Show error message
    UI-->>User: Display alert/notification
    deactivate UI
    
    User->>User: Read error message
    User->>User: Take corrective action
```
