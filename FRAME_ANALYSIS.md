# 🔍 Frame Analysis: 030000000e1000100110021003103010311033fee4

## Frame Structure Breakdown

```
Frame: 030000000e1000100110021003103010311033fee4
Bytes: 03 00 00 00 0e 10 00 10 01 10 02 10 03 10 30 10 31 10 33 fe e4
```

### Header Analysis
- **Command**: `03` = Command 0x03 (Equipment confirmation/status request)
- **Address**: `00 00 00` = 0x000000 (broadcast address)
- **Length**: `0e` = 14 bytes of payload data
- **Checksum**: `fe e4` = 0xFEE4

### Payload Analysis (14 bytes)
The payload contains 7 object pairs in [class:1][number:1] format:

| Pair # | Class | Number | Object Description |
|--------|-------|--------|-------------------|
| 1 | 0x10 | 0x00 | Start/Stop status |
| 2 | 0x10 | 0x01 | Mode setting |
| 3 | 0x10 | 0x02 | Temperature setting |
| 4 | 0x10 | 0x03 | Fan speed (Air) |
| 5 | 0x10 | 0x30 | Vertical wind direction step |
| 6 | 0x10 | 0x31 | Vertical wind direction step |
| 7 | 0x10 | 0x33 | Temperature (alternative format) |

## What This Message Means

### 🎯 **Command 0x03 - Status Request**
This is a **status request command** from the master device (controller) asking the air conditioner to report the current values for these specific parameters:

1. **Power Status** (0x10, 0x00) - Is the AC on or off?
2. **Mode** (0x10, 0x01) - Current operating mode (Auto, Cool, Heat, etc.)
3. **Temperature** (0x10, 0x02) - Target temperature setting
4. **Fan Speed** (0x10, 0x03) - Current fan speed setting
5. **Vertical Direction** (0x10, 0x30) - Vertical air direction
6. **Vertical Direction** (0x10, 0x31) - Another vertical direction parameter
7. **Temperature Alt** (0x10, 0x33) - Temperature in alternative format

### 🔄 **Expected Response**
Your simulator should respond with a frame containing:
- Same command (0x03)
- Same address (0x000000) 
- Response data with actual status values for each requested object
- Proper checksum

## How Your Simulator Handles This

Looking at your `app.go` implementation, this frame triggers:

```go
case 0x03: // Equipment confirmation or wind direction command
    // Response will add 2 bytes data for each object
    payloadLength := length*2 + 1        // 2 bytes per object + 1 ACK byte
    frame = append(frame, payloadLength) // Length
    frame = append(frame, 0x01)          // ACK data

    for i := 0; i < len(data); i += 2 {
        if i+1 < len(data) {
            cls := data[i]   // First byte is class
            num := data[i+1] // Second byte is number

            returnStatus := a.GetReturnStatus(cls, num)

            // Add object (class and number)
            frame = append(frame, cls)
            frame = append(frame, num)

            // Add status (2 bytes, big-endian)
            frame = append(frame, byte((returnStatus>>8)&0xFF))
            frame = append(frame, byte(returnStatus&0xFF))
        }
    }
```

### 📊 **Response Example**
For each object, your simulator calls `GetReturnStatus(0x10, num)`:
- `GetReturnStatus(0x10, 0x00)` → Returns current power status
- `GetReturnStatus(0x10, 0x01)` → Returns current mode
- `GetReturnStatus(0x10, 0x02)` → Returns current temperature
- etc.

## 🎯 **Summary**
This is a **comprehensive status polling message** - the controller is asking your AC simulator to report its current operational state across all major parameters. Your simulator correctly processes this and responds with the current status of each requested parameter.

The frequent appearance of this message indicates the controller is regularly monitoring the AC's status, which is normal behavior for a Fujitsu AC system.
