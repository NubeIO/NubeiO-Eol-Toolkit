# Factory Testing - Source Code Documentation

## Table of Contents
1. [Code Architecture](#code-architecture)
2. [File Structure](#file-structure)
3. [Core Classes](#core-classes)
4. [Key Methods](#key-methods)
5. [AT Command Protocol](#at-command-protocol)
6. [Test Implementations](#test-implementations)
7. [IPC Communication](#ipc-communication)
8. [Code Examples](#code-examples)
9. [Extension Guide](#extension-guide)
10. [Testing & Debugging](#testing--debugging)

---

## Code Architecture

### Component Relationship Diagram

```mermaid
classDiagram
    class FactoryTestingPage {
        +DOMElement container
        +Object state
        +render()
        +handleDeviceSelect()
        +handleStartTest()
        +displayResults()
    }
    
    class FactoryTestingModule {
        +startTest(deviceType, params)
        +stopTest()
        +getAvailablePorts()
        +printLabel(data)
    }
    
    class FactoryTestingService {
        -SerialPort port
        -ReadlineParser parser
        -boolean isConnected
        +connect(portPath)
        +disconnect()
        +sendCommand(cmd)
        +runTestSequence(device)
        +testWifi()
        +testRS485()
        +testPower()
    }
    
    class SerialPort {
        +open()
        +write(data)
        +close()
    }
    
    class ReadlineParser {
        +on('data', callback)
    }
    
    FactoryTestingPage --> FactoryTestingModule : uses
    FactoryTestingModule --> IPC : electron.ipcRenderer
    IPC --> FactoryTestingService : invoke handler
    FactoryTestingService --> SerialPort : controls
    SerialPort --> ReadlineParser : pipes to
    ReadlineParser --> FactoryTestingService : emits data
```

---

## File Structure

### Project Layout

```
services/
├── factory-testing.js          ⭐ Core testing service (2300+ lines)
├── mqtt-service.js
├── openocd-stm32.js
└── README.md

renderer/
├── pages/
│   └── FactoryTestingPage.js   ⭐ UI component (800+ lines)
├── modules/
│   └── FactoryTestingModule.js ⭐ IPC client (300+ lines)
└── app.js

embedded/
└── printer-scripts/
    └── print_product_label.py  ⭐ Label printing (200+ lines)

main.js                          ⭐ IPC handlers (50+ lines factory testing)
```

### File Responsibilities

| File | Lines | Purpose |
|------|-------|---------|
| **factory-testing.js** | 2,310 | Core service: serial communication, AT commands, test logic |
| **FactoryTestingPage.js** | 800+ | UI: device selection, progress display, results |
| **FactoryTestingModule.js** | 300+ | IPC bridge: renderer ↔ main communication |
| **main.js** | ~50 | IPC handlers: register factory testing endpoints |
| **print_product_label.py** | 200+ | Label generation: QR codes, Brother printer |

---

## Core Classes

### FactoryTestingService Class

**Location:** `services/factory-testing.js`

```javascript
class FactoryTestingService {
    constructor() {
        this.port = null;              // SerialPort instance
        this.parser = null;            // ReadlineParser instance
        this.isConnected = false;      // Connection state
        this.isConnecting = false;     // Prevent concurrent connections
        this.portPath = '';            // e.g., 'COM3', '/dev/ttyUSB0'
        this.baudRate = 115200;        // Serial baud rate
        this.commandTimeout = 5000;    // AT command timeout (5 sec)
        this.progressCallback = null;  // Progress reporting callback
    }
}
```

### Class Diagram

```mermaid
classDiagram
    class FactoryTestingService {
        -SerialPort port
        -ReadlineParser parser
        -boolean isConnected
        -boolean isConnecting
        -string portPath
        -number baudRate
        -number commandTimeout
        -Function progressCallback
        
        +connect(portPath) Promise
        +disconnect() Promise
        +sendCommand(cmd, timeout) Promise
        +awaitTestJSONResult(cmd, timeout) Promise
        +runTestSequence(deviceType, params) Promise
        +testWifi() Promise
        +testRS485_1() Promise
        +testRS485_2() Promise
        +testI2C() Promise
        +testPower() Promise
        +printLabel(deviceInfo) Promise
    }
    
    class SerialPort {
        +path: string
        +baudRate: number
        +open()
        +write(data)
        +close()
    }
    
    class ReadlineParser {
        +delimiter: string
        +on(event, callback)
        +removeListener(event, callback)
    }
    
    FactoryTestingService --> SerialPort : manages
    FactoryTestingService --> ReadlineParser : uses
```

---

## Key Methods

### Connection Management

#### connect(portPath)

Establishes serial connection to device.

**Signature:**
```javascript
async connect(portPath: string): Promise<Object>
```

**Implementation:**
```javascript
async connect(portPath) {
    if (this.isConnecting) {
        throw new Error('Connection already in progress');
    }
    
    if (this.isConnected) {
        await this.disconnect();
    }
    
    this.isConnecting = true;
    this.portPath = portPath;
    
    return new Promise((resolve, reject) => {
        // Create SerialPort instance
        this.port = new SerialPort({
            path: portPath,
            baudRate: this.baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        // Create line parser
        this.parser = this.port.pipe(
            new ReadlineParser({ delimiter: '\n' })
        );
        
        // Handle port open
        this.port.on('open', () => {
            console.log(`Connected to ${portPath}`);
            this.isConnected = true;
            this.isConnecting = false;
            resolve({ success: true, port: portPath });
        });
        
        // Handle errors
        this.port.on('error', (err) => {
            console.error('Serial port error:', err);
            this.isConnecting = false;
            reject(err);
        });
    });
}
```

**Usage:**
```javascript
const service = new FactoryTestingService();
await service.connect('COM3');
```

---

#### disconnect()

Closes serial port connection.

**Implementation:**
```javascript
async disconnect() {
    if (this.port && this.isConnected) {
        return new Promise((resolve) => {
            this.port.close(() => {
                console.log('Serial port closed');
                this.isConnected = false;
                this.port = null;
                this.parser = null;
                resolve();
            });
        });
    }
    return Promise.resolve();
}
```

---

### Command Execution

#### sendCommand(command, timeout)

Sends AT command and waits for response.

**Signature:**
```javascript
async sendCommand(command: string, timeout: number = 5000): Promise<string>
```

**Implementation:**
```javascript
async sendCommand(command, timeout = this.commandTimeout) {
    if (!this.isConnected || !this.port) {
        throw new Error('Not connected to device');
    }
    
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            this.parser.removeListener('data', onData);
            reject(new Error(`Timeout waiting for response to: ${command}`));
        }, timeout);
        
        const responses = [];
        
        const onData = (data) => {
            const line = data.toString().trim();
            if (!line) return;
            
            console.log(`RX: ${line}`);
            responses.push(line);
            
            // Check for completion markers
            if (line === 'OK' || line.startsWith('ERROR')) {
                clearTimeout(timer);
                this.parser.removeListener('data', onData);
                resolve(responses.join('\n'));
            }
        };
        
        this.parser.on('data', onData);
        
        // Send command
        const cmd = command + '\r\n';
        console.log(`TX: ${command}`);
        this.port.write(cmd, (err) => {
            if (err) {
                clearTimeout(timer);
                this.parser.removeListener('data', onData);
                reject(new Error(`Failed to send: ${err.message}`));
            }
        });
    });
}
```

---

#### awaitTestJSONResult(command, timeout)

Sends test command and parses JSON response.

**Signature:**
```javascript
async awaitTestJSONResult(
    command: string,
    timeoutMs: number = 10000
): Promise<{raw: string, parsed: Object, success: boolean}>
```

**Implementation:**
```javascript
async awaitTestJSONResult(command, timeoutMs = 10000) {
    if (!this.isConnected || !this.port) {
        throw new Error('Not connected');
    }
    
    return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
            this.parser.removeListener('data', onData);
            reject(new Error('Timeout waiting for JSON response'));
        }, timeoutMs);
        
        const onData = (data) => {
            const line = data.toString().trim();
            if (!line) return;
            
            console.log(`RX: ${line}`);
            
            // Try parse as JSON
            try {
                const parsed = JSON.parse(line);
                clearTimeout(timeout);
                this.parser.removeListener('data', onData);
                
                // Determine success
                const ok = parsed && (
                    parsed.result === 'done' ||
                    parsed.status === 'done' ||
                    parsed.result === 'OK' ||
                    parsed.ok === true
                );
                
                resolve({ 
                    raw: line, 
                    parsed, 
                    success: !!ok 
                });
                return;
            } catch (e) {
                // Not JSON - check for text markers
                const lower = line.toLowerCase();
                
                if (line === 'OK' || lower === 'done') {
                    clearTimeout(timeout);
                    this.parser.removeListener('data', onData);
                    resolve({ raw: line, parsed: null, success: true });
                    return;
                }
                
                if (line.startsWith('ERROR') || lower.includes('fail')) {
                    clearTimeout(timeout);
                    this.parser.removeListener('data', onData);
                    resolve({ raw: line, parsed: null, success: false });
                    return;
                }
            }
        };
        
        this.parser.on('data', onData);
        
        // Send command
        const cmd = command + '\r\n';
        console.log(`TX: ${command}`);
        this.port.write(cmd, (err) => {
            if (err) {
                clearTimeout(timeout);
                this.parser.removeListener('data', onData);
                reject(new Error(`Failed to send: ${err.message}`));
            }
        });
    });
}
```

---

### Test Implementations

#### testWifi()

Tests WiFi scanning capability.

**Sequence Diagram:**
```mermaid
sequenceDiagram
    participant Service
    participant Port as Serial Port
    participant Device
    
    Service->>Port: AT+WIFISCAN\r\n
    Port->>Device: Send command
    Note over Device: Scan WiFi networks<br/>(2-3 seconds)
    Device-->>Port: +WIFISCAN:SSID1,-45\r\n
    Device-->>Port: +WIFISCAN:SSID2,-52\r\n
    Device-->>Port: +WIFISCAN:SSID3,-60\r\n
    Device-->>Port: OK\r\n
    Port-->>Service: Parse responses
    Service->>Service: Extract networks & RSSI
    Service-->>Service: Return result
```

**Implementation:**
```javascript
async testWifi() {
    this.reportProgress('Testing WiFi...');
    
    try {
        const response = await this.awaitTestJSONResult('AT+WIFISCAN', 15000);
        
        // Normalize result
        const result = this._normalizeWifiResult(response);
        
        this.reportProgress(
            result.success 
                ? `WiFi test PASS (${result.networks.length} networks)` 
                : 'WiFi test FAIL'
        );
        
        return result;
    } catch (error) {
        this.reportProgress(`WiFi test ERROR: ${error.message}`);
        throw error;
    }
}
```

**Result Normalization:**
```javascript
_normalizeWifiResult(respObj) {
    return {
        success: !!(respObj && respObj.success),
        status: respObj && respObj.success ? 'done' : 'fail',
        rssi: respObj?.parsed?.rssi || null,
        networks: Array.isArray(respObj?.parsed?.networks) 
            ? respObj.parsed.networks 
            : [],
        raw: respObj?.raw,
        parsed: respObj?.parsed
    };
}
```

---

#### testRS485()

Tests RS485 communication bus.

**Implementation:**
```javascript
async testRS485_1() {
    this.reportProgress('Testing RS485-1...');
    
    try {
        const response = await this.awaitTestJSONResult('AT+RS485_1_TEST', 10000);
        
        const result = this._normalizeRs485Result(response);
        
        this.reportProgress(
            result.success 
                ? 'RS485-1 test PASS' 
                : 'RS485-1 test FAIL'
        );
        
        return result;
    } catch (error) {
        this.reportProgress(`RS485-1 test ERROR: ${error.message}`);
        throw error;
    }
}

async testRS485_2() {
    this.reportProgress('Testing RS485-2...');
    
    try {
        const response = await this.awaitTestJSONResult('AT+RS485_2_TEST', 10000);
        
        const result = this._normalizeRs485Result(response);
        
        this.reportProgress(
            result.success 
                ? 'RS485-2 test PASS' 
                : 'RS485-2 test FAIL'
        );
        
        return result;
    } catch (error) {
        this.reportProgress(`RS485-2 test ERROR: ${error.message}`);
        throw error;
    }
}
```

---

#### testPower()

Tests power supply voltages.

**Implementation:**
```javascript
async testPower() {
    this.reportProgress('Testing power...');
    
    try {
        const response = await this.awaitTestJSONResult('AT+POWER_TEST', 5000);
        
        const result = {
            success: !!(response && response.success),
            status: response && response.success ? 'done' : 'fail',
            vcc: response?.parsed?.vcc || null,
            battery: response?.parsed?.battery || null,
            raw: response?.raw,
            parsed: response?.parsed
        };
        
        this.reportProgress(
            result.success 
                ? `Power test PASS (VCC: ${result.vcc}V)` 
                : 'Power test FAIL'
        );
        
        return result;
    } catch (error) {
        this.reportProgress(`Power test ERROR: ${error.message}`);
        throw error;
    }
}
```

---

### Test Sequence Orchestration

#### runTestSequence(deviceType, params)

Executes complete test sequence for device.

**Flow Diagram:**
```mermaid
flowchart TD
    A[Start Test Sequence] --> B[Unlock Device]
    B --> C{Unlock OK?}
    C -->|No| Z[Abort: Auth Failed]
    C -->|Yes| D[Read Device Info]
    D --> E[Parse MAC, FW, HW]
    E --> F[Run WiFi Test]
    F --> G{WiFi Pass?}
    G -->|No| H[Mark WiFi Failed]
    G -->|Yes| I[Run RS485-1 Test]
    I --> J{RS485-1 Pass?}
    J -->|No| K[Mark RS485-1 Failed]
    J -->|Yes| L[Run RS485-2 Test]
    L --> M{RS485-2 Pass?}
    M -->|No| N[Mark RS485-2 Failed]
    M -->|Yes| O[Run Power Test]
    O --> P{Power Pass?}
    P -->|No| Q[Mark Power Failed]
    P -->|Yes| R[All Tests Pass]
    H --> S[Calculate Overall Result]
    K --> S
    N --> S
    Q --> S
    R --> S
    S --> T[Return Results]
    
    style R fill:#4CAF50
    style Z fill:#F44336
```

**Implementation:**
```javascript
async runTestSequence(deviceType, params) {
    const results = {
        deviceInfo: {},
        tests: {},
        overallStatus: 'FAIL',
        timestamp: new Date().toISOString()
    };
    
    try {
        // Step 1: Unlock device
        this.reportProgress('Unlocking device...');
        await this.sendCommand('AT+UNLOCK=N00BIO');
        
        // Step 2: Read device info
        this.reportProgress('Reading device info...');
        const infoResponse = await this.sendCommand('AT+INFO?');
        results.deviceInfo = this.parseDeviceInfo(infoResponse);
        
        // Step 3: Run tests based on device type
        if (deviceType === 'ACB-M' || deviceType === 'ZC-LCD') {
            // WiFi test
            results.tests.wifi = await this.testWifi();
            
            // RS485 tests
            results.tests.rs485_1 = await this.testRS485_1();
            results.tests.rs485_2 = await this.testRS485_2();
            
            // Power test
            results.tests.power = await this.testPower();
        }
        else if (deviceType === 'Micro Edge') {
            // LoRa test
            results.tests.lora = await this.testLoRa();
            
            // WiFi test
            results.tests.wifi = await this.testWifi();
            
            // Power test
            results.tests.power = await this.testPower();
        }
        
        // Step 4: Determine overall status
        const allPassed = Object.values(results.tests)
            .every(test => test.success);
        
        results.overallStatus = allPassed ? 'PASS' : 'FAIL';
        
        this.reportProgress(
            allPassed 
                ? '✓✓✓ All tests PASSED ✓✓✓' 
                : '✗ Some tests FAILED'
        );
        
        return results;
        
    } catch (error) {
        this.reportProgress(`Test sequence ERROR: ${error.message}`);
        results.overallStatus = 'ERROR';
        results.error = error.message;
        return results;
    }
}
```

---

## AT Command Protocol

### Command Reference

| Command | Purpose | Response | Timeout |
|---------|---------|----------|---------|
| `AT+UNLOCK=N00BIO` | Unlock device | `+UNLOCK:OK\nOK` | 3s |
| `AT+INFO?` | Get device info | `+INFO:MAC=...,FW=...\nOK` | 3s |
| `AT+WIFISCAN` | Scan WiFi networks | JSON with networks | 15s |
| `AT+RS485_1_TEST` | Test RS485 bus 1 | JSON with result | 10s |
| `AT+RS485_2_TEST` | Test RS485 bus 2 | JSON with result | 10s |
| `AT+POWER_TEST` | Test power supply | JSON with voltages | 5s |
| `AT+I2C_TEST` | Test I2C sensor | JSON with readings | 5s |

### Response Parsing

**Example WiFi Response:**
```json
{
    "result": "done",
    "networks": ["WiFi-1", "WiFi-2", "WiFi-3"],
    "rssi": -45,
    "count": 3
}
```

**Example Power Response:**
```json
{
    "status": "done",
    "vcc": 3.31,
    "battery": 4.18,
    "ok": true
}
```

---

## IPC Communication

### IPC Architecture

```mermaid
sequenceDiagram
    participant UI as FactoryTestingPage<br/>(Renderer)
    participant Module as FactoryTestingModule<br/>(Renderer)
    participant IPC as Electron IPC
    participant Handler as main.js<br/>(Main Process)
    participant Service as FactoryTestingService<br/>(Main Process)
    
    UI->>Module: startTest(deviceType, params)
    Module->>IPC: invoke('factory-testing:start-test', ...)
    IPC->>Handler: Route to handler
    Handler->>Service: runTestSequence(...)
    Service-->>Handler: Return results
    Handler-->>IPC: Return response
    IPC-->>Module: Resolve promise
    Module-->>UI: Update UI with results
```

### IPC Handler Registration

**File:** `main.js`

```javascript
const { ipcMain } = require('electron');
const FactoryTestingService = require('./services/factory-testing');

const factoryTestingService = new FactoryTestingService();

// Register handlers
ipcMain.handle('factory-testing:get-ports', async () => {
    try {
        const { SerialPort } = require('serialport');
        const ports = await SerialPort.list();
        return { success: true, ports };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('factory-testing:start-test', async (event, data) => {
    try {
        const { deviceType, params } = data;
        
        // Connect to device
        await factoryTestingService.connect(params.portPath);
        
        // Run test sequence
        const results = await factoryTestingService.runTestSequence(
            deviceType, 
            params
        );
        
        // Disconnect
        await factoryTestingService.disconnect();
        
        return { success: true, results };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('factory-testing:print-label', async (event, data) => {
    try {
        await factoryTestingService.printLabel(data);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

---

## Code Examples

### Example 1: Basic Test Flow

```javascript
// Initialize service
const service = new FactoryTestingService();

// Set progress callback
service.progressCallback = (message) => {
    console.log(`[Progress] ${message}`);
};

try {
    // Connect
    await service.connect('COM3');
    
    // Unlock
    await service.sendCommand('AT+UNLOCK=N00BIO');
    
    // Get info
    const info = await service.sendCommand('AT+INFO?');
    console.log('Device Info:', info);
    
    // Run tests
    const wifiResult = await service.testWifi();
    const rs485Result = await service.testRS485_1();
    const powerResult = await service.testPower();
    
    // Check results
    if (wifiResult.success && rs485Result.success && powerResult.success) {
        console.log('✓ All tests passed!');
    }
    
    // Disconnect
    await service.disconnect();
    
} catch (error) {
    console.error('Test failed:', error);
}
```

### Example 2: Custom Test Sequence

```javascript
async function runCustomTest(portPath, deviceType) {
    const service = new FactoryTestingService();
    const results = {};
    
    try {
        await service.connect(portPath);
        
        // Device-specific test order
        if (deviceType === 'ACB-M') {
            results.wifi = await service.testWifi();
            results.rs485_1 = await service.testRS485_1();
            results.rs485_2 = await service.testRS485_2();
            results.power = await service.testPower();
        }
        
        await service.disconnect();
        
        return {
            success: true,
            results,
            passed: Object.values(results).every(r => r.success)
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
```

---

## Extension Guide

### Adding New Device Type

**Step 1: Define Test Sequence**

```javascript
// In factory-testing.js

async runTestSequence(deviceType, params) {
    // ... existing code ...
    
    // Add new device type
    else if (deviceType === 'NEW-DEVICE') {
        results.tests.wifi = await this.testWifi();
        results.tests.custom = await this.testCustomFeature();
        results.tests.power = await this.testPower();
    }
}
```

**Step 2: Implement Custom Test**

```javascript
async testCustomFeature() {
    this.reportProgress('Testing custom feature...');
    
    try {
        const response = await this.awaitTestJSONResult(
            'AT+CUSTOM_TEST', 
            10000
        );
        
        return {
            success: !!(response && response.success),
            status: response?.success ? 'done' : 'fail',
            data: response?.parsed,
            raw: response?.raw
        };
    } catch (error) {
        throw error;
    }
}
```

**Step 3: Update UI**

```javascript
// In FactoryTestingPage.js

const DEVICE_TYPES = {
    'Gen-2': [
        'ACB-M',
        'ZC-LCD',
        'ZC-Controller',
        'Droplet',
        'NEW-DEVICE'  // Add here
    ]
};
```

---

## Testing & Debugging

### Debug Logging

```javascript
// Enable verbose logging
class FactoryTestingService {
    constructor(debug = false) {
        this.debug = debug;
        // ...
    }
    
    log(message) {
        if (this.debug) {
            console.log(`[Factory Testing] ${message}`);
        }
    }
    
    async sendCommand(command, timeout) {
        this.log(`TX: ${command}`);
        // ... send command ...
        this.log(`RX: ${response}`);
        return response;
    }
}
```

### Unit Testing

```javascript
// test/factory-testing.test.js

const FactoryTestingService = require('../services/factory-testing');

describe('FactoryTestingService', () => {
    let service;
    
    beforeEach(() => {
        service = new FactoryTestingService();
    });
    
    test('normalizes WiFi result correctly', () => {
        const input = {
            success: true,
            raw: '{"result":"done","networks":["WiFi1"],"rssi":-45}',
            parsed: {
                result: 'done',
                networks: ['WiFi1'],
                rssi: -45
            }
        };
        
        const result = service._normalizeWifiResult(input);
        
        expect(result.success).toBe(true);
        expect(result.networks).toEqual(['WiFi1']);
        expect(result.rssi).toBe(-45);
    });
});
```

---

## Summary

### Key Takeaways

✅ **Multi-process architecture** - Electron main/renderer separation  
✅ **Async/await pattern** - Promise-based serial communication  
✅ **Event-driven parsing** - ReadlineParser for AT responses  
✅ **Modular test design** - Each test is independent method  
✅ **Extensible structure** - Easy to add new device types  
✅ **Error handling** - Timeouts and try-catch throughout  

### Code Statistics

| Component | Lines of Code | Complexity |
|-----------|---------------|------------|
| factory-testing.js | 2,310 | High |
| FactoryTestingPage.js | 800+ | Medium |
| FactoryTestingModule.js | 300+ | Low |
| IPC Handlers | 50+ | Low |
| **Total** | **~3,500** | **Medium-High** |

---

## Document Information

- **Target Audience:** Developers, maintainers
- **Technical Level:** Advanced
- **Prerequisites:** JavaScript, Node.js, Electron, Serial communication
- **Last Updated:** December 9, 2025
- **Version:** 1.0.0
