# Fleet Monitoring Feature

## Overview

The Fleet Monitoring feature allows you to monitor all FGA-Gen2-Fw devices connected to an MQTT broker in real-time. This feature provides a centralized dashboard to view device status, log messages, and health information across your entire fleet of ESP32-based HVAC controllers.

## Architecture

### Backend Service
- **File**: `services/fleet-monitoring.js`
- **Purpose**: Manages MQTT connection and device tracking
- **Dependencies**: `mqtt` library

### Frontend Module
- **File**: `renderer/pages/FleetMonitoringPage.js`
- **Purpose**: Renders the fleet monitoring UI and handles user interactions
- **Features**:
  - Real-time device list with online/offline status
  - Message feed with log level filtering
  - Device selection for focused monitoring
  - Configurable MQTT broker connection

### IPC Communication
- **Handlers in**: `main.js`
- **Exposed APIs in**: `preload.js` (via `fleetMonitoringAPI`)
- **Methods**:
  - `getConfig()` - Get current MQTT configuration
  - `getStatus()` - Get connection status and device list
  - `connect(broker, port, baseTopic)` - Connect to MQTT broker
  - `disconnect()` - Disconnect from MQTT broker
  - `clearMessages()` - Clear message history
  - `getDevices()` - Get list of discovered devices

## MQTT Topic Structure

The FGA-Gen2-Fw devices publish to the following MQTT topic pattern:

```
nube-io/hvac/logs/{client_id}/{environment}/{level}
```

### Topic Components:
- **Base**: `nube-io/hvac/logs`
- **Client ID**: Unique device identifier (e.g., `dev_hvac_001`)
- **Environment**: `dev`, `prod`, or `test`
- **Level**: `INFO`, `WARN`, `ERROR`, `DEBUG`

### Example Topics:
```
nube-io/hvac/logs/dev_hvac_001/prod/INFO
nube-io/hvac/logs/dev_hvac_002/prod/ERROR
nube-io/hvac/logs/test_device/dev/DEBUG
```

## Message Format

Messages are published as JSON:

```json
{
  "timestamp": "2025-10-13T09:15:30.123Z",
  "level": "INFO",
  "tag": "WiFi",
  "message": "Connected to WiFi, IP: 192.168.1.100"
}
```

## Features

### 1. Real-Time Device Discovery
- Automatically detects devices as they publish messages
- Tracks first seen and last seen timestamps
- Maintains message count per device

### 2. Device Status Indicators
- **Online** (Green): Device seen in last 30 seconds
- **Away** (Yellow): Device seen in last 5 minutes
- **Offline** (Red): Device not seen for >5 minutes

### 3. Message Filtering
- Filter by device: Click on a device to see only its messages
- Filter by log level: Dropdown to filter ERROR, WARN, INFO, DEBUG
- Combined filtering: Apply both filters simultaneously

### 4. Message History
- Stores up to 500 recent messages (configurable)
- Auto-scroll to latest messages
- Displays timestamp, device ID, log level, tag, and message content

### 5. Configuration
- Configurable MQTT broker address and port
- Custom topic filter (supports MQTT wildcards like `#`)
- Settings persist during session

## Usage

### Accessing Fleet Monitoring
1. **Via Navigation Bar**: Click the "🌐 Fleet" button
2. **Via Keyboard**: Press `Ctrl+5` (or `Cmd+5` on macOS)
3. **Via Menu**: View → Fleet Monitoring

### Connecting to MQTT Broker

1. Enter MQTT broker details:
   - **Broker**: IP address or hostname (default: `localhost`)
   - **Port**: MQTT port (default: `1883`)
   - **Topic Filter**: MQTT topic pattern (default: `nube-io/hvac/logs/#`)

2. Click "🔌 Connect to Fleet"

3. Wait for devices to appear as they publish messages

### Monitoring Devices

- **Device List** (Left Panel): Shows all discovered devices with status indicators
- **Message Feed** (Right Panel): Shows real-time log messages
- Click on a device to filter messages to that device only
- Use the log level dropdown to filter by message severity

### Disconnecting

Click the "🔌 Disconnect" button to close the MQTT connection.

## Configuration

### Feature Toggle
The feature can be enabled/disabled in `config/features.json`:

```json
{
  "fleetMonitoring": {
    "enabled": true,
    "description": "Fleet Monitoring - Monitor FGA-Gen2-Fw devices via MQTT"
  }
}
```

### Default Settings
Default MQTT settings in `fleet-monitoring.js`:

```javascript
{
  broker: 'localhost',
  port: 1883,
  baseTopic: 'nube-io/hvac/logs/#'
}
```

## Integration with FGA-Gen2-Fw

The FGA-Gen2-Fw firmware uses the `srvc_mqtt_log` component to publish logs to MQTT:

### Firmware Side Configuration
- **MQTT Broker**: Configured via `PARAM_MQTT_LOG_BROKER` (0x0300)
- **MQTT Port**: Configured via `PARAM_MQTT_LOG_PORT` (0x0301)
- **Username**: Configured via `PARAM_MQTT_LOG_USERNAME` (0x0302)
- **Password**: Configured via `PARAM_MQTT_LOG_PASSWORD` (0x0303)
- **Client ID**: Configured via `PARAM_MQTT_LOG_CLIENT_ID` (0x0304)
- **Base Topic**: Configured via `PARAM_MQTT_LOG_BASE_TOPIC` (0x0305)
- **Environment**: Configured via `PARAM_MQTT_LOG_ENVIRONMENT` (0x0307)

### Example Firmware Commands
```bash
# Configure MQTT broker
mqtt_config -b "mqtt://broker.example.com:1883" -u "username" -p "password"

# Set client ID
mqtt_config -c "hvac_device_001"

# Enable MQTT logging
mqtt_enable
```

## Technical Details

### Service Architecture

```
┌─────────────────────────────────────────────┐
│          Electron Main Process              │
│  ┌──────────────────────────────────────┐   │
│  │   FleetMonitoringService             │   │
│  │   - MQTT Client                      │   │
│  │   - Device Tracking                  │   │
│  │   - Message Buffer                   │   │
│  └──────────────────────────────────────┘   │
│              ▲              ▼                │
│         IPC Handlers    IPC Events           │
└─────────────┼──────────────┼────────────────┘
              │              │
         ┌────┼──────────────┼────┐
         │    │              │    │
         │    ▼              ▼    │
         │  ┌──────────────────┐  │
         │  │  preload.js      │  │
         │  │  (fleetAPI)      │  │
         │  └──────────────────┘  │
         │    ▲              ▼    │
         │    │              │    │
         │  Renderer Process      │
         │  ┌──────────────────┐  │
         │  │ FleetMonitoring  │  │
         │  │ Page             │  │
         │  └──────────────────┘  │
         └────────────────────────┘
```

### Device State Management

The service maintains a `Map` of devices:

```javascript
devices = Map {
  'dev_hvac_001' => {
    clientId: 'dev_hvac_001',
    environment: 'prod',
    lastSeen: '2025-10-13T09:15:30.123Z',
    messageCount: 42,
    firstSeen: '2025-10-13T08:00:00.000Z'
  }
}
```

### Message Buffer

Messages are stored in a circular buffer (FIFO):
- Max capacity: 500 messages (configurable)
- Oldest messages are removed when capacity is reached
- Messages include: timestamp, clientId, environment, level, tag, message, topic

## Troubleshooting

### Devices Not Appearing

1. **Check MQTT Broker**: Ensure broker is running and accessible
2. **Check Topic Filter**: Verify topic pattern matches device topics
3. **Check Firmware**: Ensure devices have MQTT logging enabled
4. **Check Network**: Verify network connectivity between devices and broker

### Connection Failed

- **Broker Unreachable**: Check if broker is running on specified host:port
- **Authentication**: If broker requires auth, ensure credentials are correct
- **Firewall**: Check if firewall is blocking MQTT port (default: 1883)

### Messages Not Updating

- **Check Device Status**: Device may be offline
- **Check Filters**: Log level or device filter may be hiding messages
- **Clear Messages**: Try clearing message history and reconnecting

## Best Practices

1. **Use Unique Client IDs**: Ensure each device has a unique client ID to avoid confusion
2. **Set Appropriate Log Levels**: Use INFO for normal operations, ERROR for critical issues
3. **Monitor Regularly**: Check device status indicators regularly for offline devices
4. **Clear Messages Periodically**: Clear message history when it gets too large
5. **Use Environment Tags**: Use `dev`, `test`, `prod` environments appropriately

## Future Enhancements

Potential improvements for the Fleet Monitoring feature:

- [ ] Device grouping by environment or location
- [ ] Message search and export functionality
- [ ] Device statistics and metrics dashboard
- [ ] Alert notifications for critical errors
- [ ] Historical data persistence (database integration)
- [ ] Device remote control commands
- [ ] Custom dashboard widgets
- [ ] Message filtering by regex patterns

## Related Files

- `services/fleet-monitoring.js` - Backend MQTT service
- `renderer/pages/FleetMonitoringPage.js` - Frontend UI page
- `main.js` - IPC handlers and service initialization
- `preload.js` - IPC API exposure
- `renderer/app.js` - Page integration and routing
- `renderer/index.html` - Page script inclusion
- `config/features.json` - Feature toggle configuration

## References

- FGA-Gen2-Fw MQTT Integration: `/home/tanlm/work/FGA-Gen2-Fw/components/srvc_mqtt_log/`
- MQTT.js Documentation: https://github.com/mqttjs/MQTT.js
- ESP-IDF MQTT Component: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/protocols/mqtt.html

