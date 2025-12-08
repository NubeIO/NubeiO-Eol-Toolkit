# System Architecture - Brother PT-P900W Printer Module

## Table of Contents

1. [Overview](#overview)
2. [System Components](#system-components)
3. [Architecture Diagrams](#architecture-diagrams)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Integration Points](#integration-points)

## Overview

The Brother PT-P900W printer module is a standalone component that integrates with the Nube iO Toolkit Electron application to provide automated label printing for factory testing workflows.

### Design Principles

- **Standalone Operation**: Executable works without Python installation
- **USB Communication**: Direct USB protocol for reliability
- **Minimal Dependencies**: Self-contained with bundled libraries
- **Cross-Process**: IPC integration with Electron main process
- **Error Resilient**: Comprehensive error handling and recovery

## System Components

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Factory Testing Page]
        B[Provisioning Page]
        C[Other UI Pages]
    end
    
    subgraph "IPC Layer"
        D[window.api.checkPrinterConnection]
        E[window.api.printLabel]
    end
    
    subgraph "Main Process Layer"
        F[main.js]
        G[IPC Handlers]
        H[spawnPython Helper]
        I[getPrinterScriptsDir Helper]
    end
    
    subgraph "Printer Module Layer"
        J{Executable Check}
        K[print_product_label.exe]
        L[Python Interpreter]
        M[print_product_label.py]
    end
    
    subgraph "Library Layer"
        N[brotherlabel Custom]
        O[brother_ql Library]
        P[Pillow Image]
        Q[python-barcode]
        R[pyusb]
    end
    
    subgraph "Driver Layer"
        S[libusb-1.0.dll]
    end
    
    subgraph "Hardware Layer"
        T[Brother PT-P900W]
    end
    
    A --> D
    A --> E
    B --> D
    B --> E
    D --> G
    E --> G
    G --> H
    H --> I
    I --> J
    J -->|Exists| K
    J -->|Missing| L
    K --> M
    L --> M
    M --> N
    M --> O
    M --> P
    M --> Q
    M --> R
    N --> S
    O --> S
    R --> S
    S --> T
    
    style K fill:#90EE90
    style T fill:#87CEEB
    style M fill:#FFD700
```

### Component Layers

```mermaid
graph LR
    subgraph "Layer 1: Presentation"
        A[React UI Components]
    end
    
    subgraph "Layer 2: Application"
        B[Electron Main Process]
    end
    
    subgraph "Layer 3: Business Logic"
        C[Printer Script]
    end
    
    subgraph "Layer 4: Communication"
        D[USB Protocol]
    end
    
    subgraph "Layer 5: Hardware"
        E[Printer Device]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    
    style A fill:#FFE4B5
    style B fill:#ADD8E6
    style C fill:#90EE90
    style D fill:#FFB6C1
    style E fill:#DDA0DD
```

## Architecture Diagrams

### Component Diagram

```mermaid
graph TB
    subgraph "Electron Application"
        subgraph "Renderer Process"
            UI[UI Components<br/>- FactoryTestingPage<br/>- ProvisioningPage]
            API[Preload API<br/>window.api]
        end
        
        subgraph "Main Process"
            IPC[IPC Handlers<br/>- checkConnection<br/>- printLabel]
            SPAWN[Process Spawner<br/>spawnPython]
            PATH[Path Resolver<br/>getPrinterScriptsDir]
        end
    end
    
    subgraph "Printer Executable"
        EXE[print_product_label.exe<br/>Standalone Binary]
        
        subgraph "Python Runtime"
            SCRIPT[print_product_label.py<br/>Main Script]
        end
        
        subgraph "Label Generation"
            BARCODE[Barcode Generator<br/>python-barcode]
            IMAGE[Image Processor<br/>PIL/Pillow]
        end
        
        subgraph "Printer Communication"
            BL[brotherlabel<br/>Custom Library]
            BQL[brother_ql<br/>Standard Library]
            USB[pyusb<br/>USB Interface]
        end
    end
    
    subgraph "System Libraries"
        LIBUSB[libusb-1.0.dll<br/>USB Driver]
    end
    
    subgraph "Hardware"
        PRINTER[Brother PT-P900W<br/>Label Printer]
    end
    
    UI --> API
    API --> IPC
    IPC --> SPAWN
    SPAWN --> PATH
    PATH --> EXE
    EXE --> SCRIPT
    SCRIPT --> BARCODE
    SCRIPT --> IMAGE
    SCRIPT --> BL
    SCRIPT --> BQL
    SCRIPT --> USB
    BL --> LIBUSB
    BQL --> LIBUSB
    USB --> LIBUSB
    LIBUSB --> PRINTER
    
    style EXE fill:#90EE90
    style PRINTER fill:#87CEEB
```

### Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_SRC[Source Code<br/>print_product_label.py]
        DEV_BUILD[Build Script<br/>build_exe.py]
        DEV_EXE[Development Executable]
    end
    
    subgraph "Build Pipeline"
        PYINSTALLER[PyInstaller<br/>Bundler]
        ELECTRON_BUILD[electron-builder<br/>Packager]
    end
    
    subgraph "Distribution Package"
        PORTABLE[Portable Executable<br/>205 MB]
        
        subgraph "Unpacked Resources"
            ASAR_UNPACK[app.asar.unpacked/<br/>printer-scripts/]
            EXTRA_RES[resources/<br/>printer-scripts/]
        end
        
        subgraph "Bundled Files"
            PRINT_EXE[print_product_label.exe<br/>15 MB]
            LIBUSB_DLL[libusb-1.0.dll<br/>154 KB]
            PY_FILES[Python Scripts<br/>.py, .spec]
        end
    end
    
    subgraph "End User Machine"
        USER_APP[Nube iO Toolkit]
        USER_PRINTER[PT-P900W<br/>USB Connected]
    end
    
    DEV_SRC --> DEV_BUILD
    DEV_BUILD --> PYINSTALLER
    PYINSTALLER --> DEV_EXE
    DEV_EXE --> ELECTRON_BUILD
    ELECTRON_BUILD --> PORTABLE
    PORTABLE --> ASAR_UNPACK
    PORTABLE --> EXTRA_RES
    ASAR_UNPACK --> PRINT_EXE
    ASAR_UNPACK --> LIBUSB_DLL
    ASAR_UNPACK --> PY_FILES
    EXTRA_RES --> PRINT_EXE
    EXTRA_RES --> LIBUSB_DLL
    PORTABLE --> USER_APP
    USER_APP --> USER_PRINTER
    
    style PORTABLE fill:#90EE90
    style USER_APP fill:#87CEEB
```

## Component Details

### 1. Electron Main Process (main.js)

**Purpose**: Bridge between UI and printer executable

**Key Functions**:

```javascript
// Path resolution for ASAR unpacking
function getPrinterScriptsDir() {
    const isDev = !app.isPackaged;
    if (isDev) {
        return path.join(__dirname, 'embedded', 'printer-scripts');
    }
    
    // Check ASAR unpacked first
    const asarPath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'embedded',
        'printer-scripts'
    );
    
    if (fs.existsSync(asarPath)) {
        return asarPath;
    }
    
    // Fallback to extraResources
    return path.join(
        process.resourcesPath,
        'embedded',
        'printer-scripts'
    );
}

// Process spawner with executable detection
function spawnPython(scriptPath, args) {
    const exePath = scriptPath.replace('.py', '.exe');
    
    if (fs.existsSync(exePath)) {
        // Use standalone executable
        return spawn(exePath, args);
    }
    
    // Fallback to Python
    return spawn('python', [scriptPath, ...args]);
}
```

**IPC Handlers**:

```javascript
ipcMain.handle('printer:checkConnection', async () => {
    const scriptPath = path.join(
        getPrinterScriptsDir(),
        'print_product_label.py'
    );
    
    return new Promise((resolve) => {
        const process = spawnPython(scriptPath, ['--check']);
        let output = '';
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.on('close', (code) => {
            resolve({
                connected: code === 0,
                output: output
            });
        });
    });
});

ipcMain.handle('printer:printLabel', async (event, data) => {
    const scriptPath = path.join(
        getPrinterScriptsDir(),
        'print_product_label.py'
    );
    
    const args = [
        data.barcode,
        data.mn,
        data.firmware,
        data.batchId,
        data.uid,
        data.date
    ];
    
    return new Promise((resolve) => {
        const process = spawnPython(scriptPath, args);
        let output = '';
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output
            });
        });
    });
});
```

### 2. Printer Script (print_product_label.py)

**Purpose**: Core printing logic and USB communication

**Architecture**:

```mermaid
classDiagram
    class PrinterScript {
        +main()
        +check_printer_connection()
        +print_label()
    }
    
    class LabelGenerator {
        -LABEL_WIDTH_MM: 12
        -LABEL_HEIGHT_MM: 60
        -DPI: 300
        +create_label_image()
        +create_barcode()
        +add_text_fields()
    }
    
    class PrinterCommunication {
        -PRINTER_VID: 0x04f9
        -PRINTER_PID: 0x2085
        +connect_printer()
        +get_status()
        +send_print_job()
    }
    
    class Utilities {
        +mm_to_pixels()
        +validate_input()
        +create_preview()
    }
    
    PrinterScript --> LabelGenerator
    PrinterScript --> PrinterCommunication
    LabelGenerator --> Utilities
    PrinterCommunication --> Utilities
```

### 3. brotherlabel Library

**Purpose**: USB protocol implementation for P-touch series

**Features**:
- Direct USB communication
- P-touch template mode support
- Raster image conversion
- Status monitoring

**Protocol Flow**:

```mermaid
sequenceDiagram
    participant Script
    participant brotherlabel
    participant libusb
    participant Printer
    
    Script->>brotherlabel: Create(model='PT-P900W')
    brotherlabel->>libusb: Find device (VID:PID)
    libusb->>Printer: Enumerate USB
    Printer-->>libusb: Device info
    libusb-->>brotherlabel: Device handle
    brotherlabel-->>Script: Printer object
    
    Script->>brotherlabel: GetStatus()
    brotherlabel->>Printer: Status query
    Printer-->>brotherlabel: Status byte
    brotherlabel-->>Script: Status dict
    
    Script->>brotherlabel: Send(image)
    brotherlabel->>brotherlabel: Convert to raster
    brotherlabel->>Printer: Raster data
    Printer-->>brotherlabel: ACK
    brotherlabel-->>Script: Success
```

### 4. PyInstaller Executable

**Purpose**: Bundle Python script into standalone executable

**Build Configuration**:

```python
# build_exe.py
PyInstaller.__main__.run([
    'print_product_label.py',
    '--onefile',
    '--console',
    '--name=print_product_label',
    f'--paths={os.path.join(script_dir, "py-brotherlabel")}',
    '--hidden-import=PIL',
    '--hidden-import=barcode',
    '--hidden-import=brotherlabel',
    '--hidden-import=brother_ql',
    '--hidden-import=usb',
    '--add-binary=libusb-1.0.dll;.',
    '--distpath=dist',
    '--workpath=build',
    '--specpath=.'
])
```

**Executable Structure**:

```
print_product_label.exe (15 MB)
├── Python Runtime (8 MB)
├── Standard Library (3 MB)
├── Dependencies (3 MB)
│   ├── PIL/Pillow
│   ├── python-barcode
│   ├── brother_ql
│   ├── pyusb
│   └── brotherlabel (custom)
├── libusb-1.0.dll (154 KB)
└── Script Code (1 MB)
```

## Data Flow

### Check Connection Flow

```mermaid
flowchart TD
    A[User Clicks Check] --> B[UI sends IPC]
    B --> C[main.js: checkConnection]
    C --> D[getPrinterScriptsDir]
    D --> E[spawnPython with --check]
    E --> F{Executable exists?}
    F -->|Yes| G[Run .exe --check]
    F -->|No| H[Run python script --check]
    G --> I[Script: check_printer_connection]
    H --> I
    I --> J[Find USB device]
    J --> K{Device found?}
    K -->|Yes| L[Connect via USB]
    K -->|No| M[Return CHECK_FAILED]
    L --> N[Query status]
    N --> O{Status OK?}
    O -->|Yes| P[Return CHECK_STATUS_OK]
    O -->|No| M
    P --> Q[Process exit 0]
    M --> R[Process exit 1]
    Q --> S[IPC return success]
    R --> T[IPC return failure]
    S --> U[UI shows success]
    T --> V[UI shows error]
    
    style G fill:#90EE90
    style P fill:#87CEEB
    style U fill:#98FB98
```

### Print Label Flow

```mermaid
flowchart TD
    A[User Clicks Print] --> B[Collect label data]
    B --> C[UI sends IPC with data]
    C --> D[main.js: printLabel]
    D --> E[Validate data structure]
    E --> F[getPrinterScriptsDir]
    F --> G[spawnPython with args]
    G --> H{Executable exists?}
    H -->|Yes| I[Run .exe with args]
    H -->|No| J[Run python with args]
    I --> K[Script: print_label]
    J --> K
    K --> L[Validate inputs]
    L --> M{Valid?}
    M -->|No| N[Return error]
    M -->|Yes| O[Create barcode image]
    O --> P[Create label image]
    P --> Q[Paste barcode + text]
    Q --> R[Save preview optional]
    R --> S[Connect to printer]
    S --> T{Connected?}
    T -->|No| N
    T -->|Yes| U[Get printer status]
    U --> V{Status OK?}
    V -->|No| N
    V -->|Yes| W[Convert to raster]
    W --> X[Send print job]
    X --> Y{Print OK?}
    Y -->|No| N
    Y -->|Yes| Z[Return success]
    Z --> AA[Process exit 0]
    N --> AB[Process exit 1]
    AA --> AC[IPC return success]
    AB --> AD[IPC return error]
    AC --> AE[UI shows success]
    AD --> AF[UI shows error]
    
    style I fill:#90EE90
    style Z fill:#87CEEB
    style AE fill:#98FB98
```

### Label Generation Flow

```mermaid
flowchart LR
    subgraph "Input Data"
        A[Barcode Text]
        B[Make/Model]
        C[Firmware]
        D[Batch ID]
        E[UID]
        F[Date]
    end
    
    subgraph "Barcode Generation"
        G[python-barcode]
        H[Code128]
        I[Barcode Image]
    end
    
    subgraph "Label Composition"
        J[Create Canvas<br/>708x141 px]
        K[Paste Barcode<br/>Left 40%]
        L[Add Text Fields<br/>Right 60%]
        M[Final Image]
    end
    
    subgraph "Output"
        N[Preview PNG]
        O[Raster Data]
        P[Print Job]
    end
    
    A --> G
    G --> H
    H --> I
    I --> K
    B --> L
    C --> L
    D --> L
    E --> L
    F --> L
    J --> K
    K --> L
    L --> M
    M --> N
    M --> O
    O --> P
    
    style M fill:#90EE90
    style P fill:#87CEEB
```

## Integration Points

### Electron Integration

```mermaid
graph LR
    subgraph "Renderer Process"
        A[React Component]
        B[Event Handler]
        C[window.api]
    end
    
    subgraph "IPC Channel"
        D[contextBridge]
        E[ipcRenderer]
    end
    
    subgraph "Main Process"
        F[ipcMain.handle]
        G[Business Logic]
        H[Child Process]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H -->|Result| G
    G -->|Response| F
    F -->|Reply| E
    E -->|Return| D
    D -->|Promise| C
    C -->|Await| B
    B -->|Update| A
    
    style C fill:#FFD700
    style H fill:#90EE90
```

### File System Integration

```mermaid
graph TB
    subgraph "Development"
        A[Source Directory<br/>embedded/printer-scripts]
        B[print_product_label.py]
        C[libusb-1.0.dll]
    end
    
    subgraph "Build Output"
        D[dist/print_product_label.exe]
    end
    
    subgraph "Electron Package"
        E[app.asar]
        F[app.asar.unpacked]
        G[resources/embedded]
    end
    
    subgraph "Runtime Resolution"
        H{app.isPackaged?}
        I[Development Path]
        J[ASAR Unpacked Path]
        K[Extra Resources Path]
    end
    
    A --> B
    A --> C
    B --> D
    D --> F
    D --> G
    E --> F
    H -->|No| I
    H -->|Yes| J
    J -->|Not Exist| K
    I --> A
    J --> F
    K --> G
    
    style D fill:#90EE90
    style J fill:#87CEEB
```

### USB Communication Stack

```mermaid
graph TB
    subgraph "Application Layer"
        A[print_product_label.py]
    end
    
    subgraph "Library Layer"
        B[brotherlabel<br/>Custom Protocol]
        C[brother_ql<br/>Standard Protocol]
        D[pyusb<br/>Python USB Interface]
    end
    
    subgraph "Driver Layer"
        E[libusb-1.0.dll<br/>Windows USB Driver]
    end
    
    subgraph "Kernel Layer"
        F[WinUSB<br/>Windows Kernel]
    end
    
    subgraph "Hardware Layer"
        G[USB Controller]
        H[Brother PT-P900W]
    end
    
    A --> B
    A --> C
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    
    style A fill:#FFD700
    style E fill:#90EE90
    style H fill:#87CEEB
```

## Performance Characteristics

### Latency Analysis

```mermaid
gantt
    title Print Job Timeline
    dateFormat X
    axisFormat %L ms
    
    section Connection
    Find USB Device: 0, 200
    Connect: 200, 300
    
    section Label Generation
    Create Barcode: 300, 500
    Build Image: 500, 800
    
    section Printing
    Get Status: 800, 1000
    Convert Raster: 1000, 1200
    Send Data: 1200, 2800
    
    section Completion
    Confirm Print: 2800, 3000
```

### Resource Usage

```mermaid
graph TB
    subgraph "Memory Usage"
        A[Executable Load<br/>30 MB]
        B[Python Runtime<br/>15 MB]
        C[Libraries<br/>10 MB]
        D[Image Processing<br/>20 MB]
        E[Peak Total<br/>70 MB]
    end
    
    subgraph "Disk Usage"
        F[Executable<br/>15 MB]
        G[libusb DLL<br/>154 KB]
        H[Source Code<br/>50 KB]
        I[Total<br/>15.2 MB]
    end
    
    subgraph "CPU Usage"
        J[Idle<br/>0%]
        K[Image Gen<br/>25%]
        L[USB Transfer<br/>5%]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    F --> I
    G --> I
    H --> I
```

## Security Considerations

### USB Security

```mermaid
flowchart TD
    A[Request USB Access] --> B{Permission Check}
    B -->|Denied| C[Error: Access Denied]
    B -->|Granted| D[Enumerate Devices]
    D --> E{Device Match?}
    E -->|No| F[Error: Device Not Found]
    E -->|Yes| G[Verify VID/PID]
    G --> H{Valid Brother Device?}
    H -->|No| I[Error: Invalid Device]
    H -->|Yes| J[Establish Connection]
    J --> K[Secure Communication]
    
    style K fill:#90EE90
```

### Input Validation

```mermaid
flowchart LR
    A[User Input] --> B{Barcode Valid?}
    B -->|No| C[Reject]
    B -->|Yes| D{Date Format OK?}
    D -->|No| C
    D -->|Yes| E{Fields Present?}
    E -->|No| C
    E -->|Yes| F{Length OK?}
    F -->|No| C
    F -->|Yes| G[Accept]
    
    style G fill:#90EE90
    style C fill:#FF6B6B
```

## Troubleshooting Architecture

### Error Detection Flow

```mermaid
stateDiagram-v2
    [*] --> Checking
    Checking --> Connected: Device Found
    Checking --> NotFound: No Device
    Connected --> Ready: Status OK
    Connected --> Error: Status Error
    Ready --> Printing: Send Job
    Printing --> Success: Print OK
    Printing --> Failed: Print Error
    NotFound --> [*]: Exit 1
    Error --> [*]: Exit 1
    Failed --> [*]: Exit 1
    Success --> [*]: Exit 0
    
    note right of NotFound
        CHECK_FAILED
        VID:PID not found
    end note
    
    note right of Error
        Status error
        Tape issue
        Cover open
    end note
    
    note right of Success
        CHECK_STATUS_OK
        Print succeeded
    end note
```

## Future Enhancements

### Planned Architecture Changes

1. **Network Printing**
   ```mermaid
   graph LR
       A[Printer Module] --> B{Connection Type}
       B -->|USB| C[USB Protocol]
       B -->|Network| D[TCP/IP Protocol]
       C --> E[Local Printer]
       D --> F[Network Printer]
   ```

2. **Batch Processing**
   ```mermaid
   graph TB
       A[Batch Queue] --> B[Job Scheduler]
       B --> C[Worker Pool]
       C --> D[Printer 1]
       C --> E[Printer 2]
       C --> F[Printer N]
   ```

3. **Cloud Integration**
   ```mermaid
   graph LR
       A[Local App] --> B[Cloud API]
       B --> C[Print Service]
       C --> D[Remote Printer]
       B --> E[Job Database]
       B --> F[Analytics]
   ```
