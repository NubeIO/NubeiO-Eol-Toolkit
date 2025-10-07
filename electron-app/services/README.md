# Services Directory

This directory contains modular service implementations for the FGA AC Simulator Electron app. Each service is self-contained and can be modified independently without affecting other services.

## Services

### 1. MQTT Service (`mqtt-service.js`)

Handles all MQTT-related functionality including:
- Connection management to MQTT broker
- Device discovery via MQTT topics
- Publishing and subscribing to AC control topics
- State management for discovered devices
- Configuration persistence

**Key Methods:**
- `connect(broker, port)` - Connect to MQTT broker
- `disconnect()` - Disconnect from broker
- `sendControlCommand(deviceId, action, value)` - Send control commands
- `getDiscoveredDevices()` - Get list of discovered devices
- `getStatus()` - Get connection status

**MQTT Topics:**
- `ac_sim/discovery` - Device discovery messages
- `ac_sim/{device_id}/state` - Device state updates
- `ac_sim/{device_id}/control` - Device control commands
- `ac_sim/broadcast/state` - Broadcast state updates

### 2. UDP Logger Service (`udp-logger.js`)

Handles UDP logging functionality for ESP32 devices:
- Listens for UDP packets on port 56789
- Strips ANSI color codes from log messages
- Provides log management (get, clear)
- Status reporting

**Key Methods:**
- `start(port, onLog)` - Start UDP logger on specified port
- `stop()` - Stop UDP logger
- `getStatus()` - Get logger status

**Configuration:**
- Default port: `56789`
- Listens on: `0.0.0.0` (all interfaces)

## Architecture

```
main.js
  ├── MQTTService (mqtt-service.js)
  │   ├── Device Discovery
  │   ├── State Management
  │   └── Control Commands
  │
  └── UDPLogger (udp-logger.js)
      ├── Log Reception
      └── Log Management
```

## Benefits of Separation

1. **Modularity**: Each service is self-contained and can be tested independently
2. **Maintainability**: Changes to one service don't affect others
3. **Reusability**: Services can be reused in other projects
4. **Clarity**: Clear separation of concerns makes code easier to understand
5. **Testing**: Each service can be unit tested separately

## Usage Example

```javascript
const MQTTService = require('./services/mqtt-service');
const UDPLogger = require('./services/udp-logger');

// Initialize services
const mqttService = new MQTTService(app);
const udpLogger = new UDPLogger();

// Start services
mqttService.connect('localhost', 1883);
udpLogger.start(56789, (log) => {
  console.log('UDP Log:', log);
});

// Use services
mqttService.sendControlCommand('AC_SIM_123456', 'power', true);
const devices = mqttService.getDiscoveredDevices();

// Stop services
mqttService.disconnect();
udpLogger.stop();
```

## Adding New Services

To add a new service:

1. Create a new file in this directory (e.g., `new-service.js`)
2. Export a class with clear methods and documentation
3. Import and initialize in `main.js`
4. Add IPC handlers in `main.js` if needed
5. Update this README

## Configuration

Services store their configuration in the user data directory:
- MQTT config: `mqtt_config.json`
- Device ID: `device_id.txt`

Location varies by platform:
- Linux: `~/.config/fga-ac-simulator/`
- Windows: `%APPDATA%/fga-ac-simulator/`
- macOS: `~/Library/Application Support/fga-ac-simulator/`
