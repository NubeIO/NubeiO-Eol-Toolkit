# Sequence Diagrams

## Overview

This document contains detailed sequence diagrams for the Brother printer integration workflows.

---

## 1. Print Label Sequence

Complete flow from UI button click to physical label printing.

```mermaid
sequenceDiagram
    actor User
    participant UI as Factory Testing UI
    participant IPC as IPC Main Handler
    participant Spawn as spawnPython()
    participant Exe as print_product_label.exe
    participant USB as USB Backend
    participant Printer as PT-P900W
    
    User->>UI: Click "Print Label"
    UI->>UI: Collect device data<br/>(UID, Model, FW, Batch)
    UI->>IPC: ipcRenderer.invoke('printer:printLabel', payload)
    
    IPC->>IPC: Validate payload
    IPC->>IPC: Build arguments array
    
    Note over IPC,Spawn: Check for standalone executable
    
    IPC->>Spawn: spawnPython([script, ...args])
    Spawn->>Spawn: Check if .exe exists
    
    alt .exe exists (Production)
        Spawn->>Exe: spawn(print_product_label.exe, args)
    else .exe not found (Development)
        Spawn->>Exe: spawn(python, [script, ...args])
    end
    
    Exe->>Exe: Parse arguments
    Exe->>Exe: create_product_label()
    Exe->>Exe: Generate barcode (Code128)
    Exe->>Exe: Create PIL Image
    Exe->>Exe: Draw text & barcode
    Exe->>Exe: Save preview_label.png
    
    Exe->>USB: connect_printer()
    USB->>Printer: USB handshake
    Printer-->>USB: Device ready
    USB-->>Exe: Device handle
    
    Exe->>Exe: Configure BrotherQLRaster('PT-P900W')
    Exe->>Exe: convert(image, label='12', hq=True)
    
    Exe->>USB: send(instructions, pyusb backend)
    USB->>Printer: Raster print data
    
    Printer->>Printer: Print label
    Printer->>Printer: Cut tape
    
    Printer-->>USB: Print complete
    USB-->>Exe: Success
    
    Exe->>USB: dispose_resources()
    USB->>Printer: Release device
    
    Exe-->>Spawn: exit(0)
    Spawn-->>IPC: Process completed
    IPC-->>UI: {success: true}
    UI->>User: Show "Label printed!"
```

---

## 2. Check Printer Connection Sequence

Printer connectivity verification with retry logic.

```mermaid
sequenceDiagram
    actor User
    participant UI as Factory Testing UI
    participant IPC as IPC Handler
    participant Exe as print_product_label.exe
    participant USB as USB Backend
    participant Printer as PT-P900W
    
    User->>UI: Click "Check Printer"
    UI->>IPC: ipcRenderer.invoke('printer:checkConnection')
    
    IPC->>IPC: Verify script exists
    IPC->>Exe: spawn(script, ['--check'])
    
    Exe->>Exe: check_printer_connection(max_attempts=3)
    
    loop Retry up to 3 times
        Exe->>USB: connect_printer()
        
        alt Printer found
            USB->>Printer: Find device (VID:0x04f9, PID:0x2085)
            Printer-->>USB: Device handle
            USB-->>Exe: Success
            Exe->>Exe: Print "CHECK_STATUS_OK"
            Exe->>Exe: Exit loop
        else Access denied (retry)
            USB-->>Exe: USBError (errno 13)
            Exe->>Exe: Print "CHECK_FAILED_ATTEMPT_N"
            Exe->>Exe: sleep(0.6s)
        else Printer not found
            USB-->>Exe: None
            Exe->>Exe: Print "CHECK_FAILED"
            Exe->>Exe: Exit loop
        end
        
        opt If not last attempt
            Exe->>USB: dispose_resources()
        end
    end
    
    alt Connection successful
        Exe-->>IPC: exit(0)
        IPC-->>UI: {connected: true, error: null}
        UI->>User: "Printer connected ✓"
    else Connection failed
        Exe-->>IPC: exit(1) + error message
        IPC-->>UI: {connected: false, error: "..."}
        UI->>User: "Printer not found ✗"
    end
```

---

## 3. Application Startup - Printer Module Initialization

```mermaid
sequenceDiagram
    participant App as Electron App
    participant Main as main.js
    participant FS as File System
    participant Env as Environment
    
    App->>Main: app.whenReady()
    Main->>Main: Initialize IPC handlers
    
    Main->>Main: Register 'printer:checkConnection'
    Main->>Main: Register 'printer:printLabel'
    
    Main->>FS: Check embedded/printer-scripts/
    FS-->>Main: Directory exists
    
    Main->>FS: Check print_product_label.exe
    
    alt .exe exists
        FS-->>Main: File found
        Main->>Main: Set mode: PRODUCTION
        Note over Main: Will use standalone .exe<br/>No Python required
    else .exe not found
        FS-->>Main: File not found
        Main->>Main: Set mode: DEVELOPMENT
        Main->>Env: resolvePythonExecutable()
        Env->>Env: Check NUBE_PYTHON_PATH
        Env->>Env: Check py, python3, python
        alt Python found
            Env-->>Main: {cmd: 'py', args: []}
            Note over Main: Will use Python interpreter
        else Python not found
            Env-->>Main: null
            Note over Main: Printer features disabled
        end
    end
    
    Main->>App: Ready for printer operations
```

---

## 4. Label Generation Process

Detailed image creation workflow.

```mermaid
sequenceDiagram
    participant Func as create_product_label()
    participant Barcode as python-barcode
    participant PIL as Pillow (PIL)
    participant Font as Font Manager
    
    Func->>Barcode: get_barcode_class('code128')
    Barcode-->>Func: Code128 class
    
    Func->>Barcode: Code128(data, writer=ImageWriter())
    Func->>Barcode: write(buffer, options)
    
    Barcode->>Barcode: Generate barcode bars
    Barcode->>Barcode: Add quiet zones
    Barcode-->>Func: BytesIO buffer with PNG
    
    Func->>PIL: Image.open(buffer)
    PIL-->>Func: Barcode image
    
    Func->>PIL: Convert to grayscale ('L')
    Func->>PIL: Resize (LANCZOS resampling)
    PIL-->>Func: Resized barcode
    
    Func->>PIL: Image.new('L', (width, height), 255)
    PIL-->>Func: Blank white canvas
    
    Func->>PIL: ImageDraw.Draw(canvas)
    PIL-->>Func: Drawing context
    
    Func->>Font: Load arial.ttf (44pt, 39pt, 34pt)
    alt Font found
        Font-->>Func: TrueType fonts
    else Font not found
        Font-->>Func: Default fonts
    end
    
    Func->>PIL: paste(barcode, position)
    
    loop For each info line (MN, SW, BA, Date)
        Func->>Func: draw_text_with_spacing()
        
        loop For each character
            Func->>PIL: draw.text((x, y), char, font, fill)
            Func->>PIL: Get char width
            Func->>Func: x += width + letter_spacing
        end
    end
    
    Func->>PIL: Draw barcode text (ME-05-XXXXXXXX)
    
    Func-->>Main: Return PIL Image (grayscale)
```

---

## 5. USB Communication Flow

Low-level USB communication sequence.

```mermaid
sequenceDiagram
    participant Script as Python Script
    participant PyUSB as PyUSB Library
    participant libusb as libusb-1.0.dll
    participant USB as USB Controller
    participant Printer as PT-P900W
    
    Script->>PyUSB: usb.core.find(idVendor, idProduct)
    PyUSB->>libusb: libusb_init()
    libusb->>USB: Initialize USB context
    
    PyUSB->>libusb: libusb_get_device_list()
    libusb->>USB: Enumerate USB devices
    USB-->>libusb: Device list
    
    libusb->>libusb: Filter by VID:PID (0x04f9:0x2085)
    
    alt Printer found
        libusb-->>PyUSB: Device handle
        PyUSB-->>Script: usb.core.Device
        
        Script->>PyUSB: Device configuration
        PyUSB->>libusb: libusb_set_configuration()
        libusb->>Printer: Set config
        
        Script->>PyUSB: Claim interface
        PyUSB->>libusb: libusb_claim_interface()
        libusb->>Printer: Claim exclusive access
        
        Script->>PyUSB: Send print data
        PyUSB->>libusb: libusb_bulk_transfer(OUT)
        libusb->>Printer: Raster data packets
        
        Printer->>Printer: Process & print
        
        Printer->>libusb: Status response
        libusb->>PyUSB: Transfer complete
        PyUSB-->>Script: Success
        
        Script->>PyUSB: usb.util.dispose_resources()
        PyUSB->>libusb: libusb_release_interface()
        libusb->>Printer: Release interface
        PyUSB->>libusb: libusb_close()
        PyUSB->>libusb: libusb_exit()
        
    else Printer not found
        libusb-->>PyUSB: None
        PyUSB-->>Script: None
        Script->>Script: raise ValueError("Printer not found")
    end
```

---

## 6. Error Handling Flow

Comprehensive error handling sequence.

```mermaid
sequenceDiagram
    participant UI as User Interface
    participant IPC as IPC Handler
    participant Script as Python Script
    participant Printer as Printer
    
    UI->>IPC: Print request
    IPC->>Script: Execute
    
    alt Success path
        Script->>Printer: Connect & print
        Printer-->>Script: Success
        Script-->>IPC: exit(0)
        IPC-->>UI: {success: true}
    
    else Import error
        Script->>Script: Import brother_ql
        Script-->>Script: ImportError
        Script->>Script: Print error message
        Script-->>IPC: exit(1)
        IPC-->>UI: {success: false, error: "Missing dependency"}
    
    else Printer not found
        Script->>Printer: connect_printer()
        Printer-->>Script: None
        Script->>Script: raise ValueError
        Script->>Script: Print "CHECK_FAILED"
        Script-->>IPC: exit(1)
        IPC-->>UI: {success: false, error: "Printer not found"}
    
    else Access denied
        Script->>Printer: USB connect
        Printer-->>Script: USBError (errno 13)
        Script->>Script: _is_access_denied(exc)
        
        alt Retries available
            Script->>Script: sleep(0.6s)
            Script->>Printer: Retry connection
        else Max retries reached
            Script-->>IPC: exit(1)
            IPC-->>UI: {success: false, error: "Access denied"}
        end
    
    else Print error
        Script->>Printer: send(data)
        Printer-->>Script: USBError
        Script->>Script: Print traceback
        Script-->>IPC: exit(1)
        IPC-->>UI: {success: false, error: "Print failed"}
    
    else Invalid arguments
        Script->>Script: Parse sys.argv
        Script-->>Script: Missing args
        Script->>Script: Print usage
        Script-->>IPC: exit(1)
        IPC-->>UI: {success: false, error: "Invalid arguments"}
    end
```

---

## 7. PyInstaller Build Process

Build sequence for creating standalone executable.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Build as build_exe.py
    participant PyInstaller as PyInstaller
    participant Analyzer as Analysis
    participant Bundler as EXE Builder
    
    Dev->>Build: python build_exe.py
    Build->>Build: Clean dist/ and build/
    
    Build->>PyInstaller: PyInstaller.__main__.run()
    
    PyInstaller->>Analyzer: Analyze print_product_label.py
    Analyzer->>Analyzer: Find imports
    Analyzer->>Analyzer: Process hidden imports
    Analyzer->>Analyzer: Find system DLLs
    Analyzer->>Analyzer: Collect binaries
    
    Note over Analyzer: Includes:<br/>- Python313.dll<br/>- _imaging.pyd<br/>- USB DLLs
    
    Analyzer-->>PyInstaller: Dependency graph
    
    PyInstaller->>Bundler: Create PYZ archive
    Bundler->>Bundler: Compress Python modules
    
    PyInstaller->>Bundler: Create PKG
    Bundler->>Bundler: Bundle dependencies
    
    PyInstaller->>Bundler: Create EXE
    Bundler->>Bundler: Add bootloader
    Bundler->>Bundler: Embed manifest
    Bundler->>Bundler: Sign (optional)
    
    Bundler-->>PyInstaller: print_product_label.exe
    PyInstaller-->>Build: Build complete
    
    Build->>Build: Copy to embedded/printer-scripts/
    Build-->>Dev: ✓ Ready for deployment
```

---

## 8. Factory Testing Integration

How printer integrates with factory testing workflow.

```mermaid
sequenceDiagram
    actor Technician
    participant UI as Factory Test Page
    participant Tests as Test Runner
    participant Device as Test Device
    participant Printer as Printer Module
    participant Label as Physical Label
    
    Technician->>UI: Start factory testing
    
    UI->>Tests: Run all tests
    
    Tests->>Device: Power test
    Device-->>Tests: ✓ Pass
    
    Tests->>Device: UART communication test
    Device-->>Tests: ✓ Pass (UID captured)
    
    Tests->>Device: LoRa test
    Device-->>Tests: ✓ Pass (LoRa ID captured)
    
    Tests->>Device: Firmware version
    Device-->>Tests: ✓ 1.3.6
    
    Tests-->>UI: All tests passed
    UI->>UI: Display results:<br/>- Model: ME-05-N1<br/>- UID: F8AC119F<br/>- FW: 1.3.6<br/>- Batch: 01202434
    
    UI->>Technician: Enable "Print Label" button
    
    Technician->>UI: Click "Print Label"
    
    UI->>Printer: Print request with data
    Printer->>Printer: Generate label
    Printer->>Label: Print physical label
    
    Label-->>Technician: Label printed
    
    Technician->>Technician: Apply label to device
    Technician->>Technician: Scan barcode for verification
    
    Technician->>UI: Mark device complete
    UI->>UI: Log to database
    UI->>UI: Increment counter
    
    Technician->>UI: Test next device
```

---

## Notes

### Timing Considerations

- **Printer connection**: ~500ms
- **Label generation**: ~200ms
- **Print operation**: ~3-5 seconds
- **Total time**: ~4-6 seconds per label

### Retry Logic

- Connection retries: 3 attempts
- Retry delay: 0.6 seconds
- Total max wait: ~2 seconds

### Thread Safety

- All USB operations are synchronous
- No concurrent printer access
- IPC ensures sequential operations

### Error Recovery

- Automatic retry on access denied
- Clean resource disposal on errors
- Detailed error logging for debugging
