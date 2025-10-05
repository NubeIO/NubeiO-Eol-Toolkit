# FGA Simulator - Fujitsu Air Conditioner Simulator

A modern desktop application for simulating Fujitsu Air Conditioner systems via MQTT communication. Built with Wails v2 (Go backend + React frontend).

## Features

- **MQTT Communication**: Full MQTT integration for remote control and monitoring
- **Modern UI**: Clean, responsive interface similar to professional HVAC control systems
- **Multiple Models**: Support for Office, Horizontal, and VRF air conditioner models
- **Real-time Status**: Live updates of air conditioner state via MQTT
- **Device Discovery**: Automatic device discovery and capability reporting

## MQTT Topics

The simulator implements the following MQTT topics:

- `ac_sim/{device_id}/state` - Status updates
- `ac_sim/{device_id}/control` - Control commands  
- `ac_sim/{device_id}/uart/rx` - UART RX traffic
- `ac_sim/{device_id}/uart/tx` - UART TX traffic
- `ac_sim/all/control` - Broadcast control
- `ac_sim/discovery` - Device discovery

## Prerequisites

- Go 1.24.0 or later
- Node.js 16+ and npm
- MQTT broker (e.g., Mosquitto, EMQX, or cloud MQTT service)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd FGA-AC-Simulator
```

### 2. Install Dependencies

```bash
# Install Go dependencies
go mod tidy

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Install Wails (if not already installed)

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Configuration

### Environment Variables

You can configure the MQTT connection using environment variables:

```bash
export MQTT_BROKER="localhost"        # MQTT broker hostname
export MQTT_PORT="1883"               # MQTT broker port
export MQTT_USERNAME=""               # MQTT username (optional)
export MQTT_PASSWORD=""               # MQTT password (optional)
export DEVICE_ID="ac_sim_001"         # Unique device ID (optional)
```

### MQTT Broker Setup

For local development, you can use Mosquitto:

```bash
# Install Mosquitto (Ubuntu/Debian)
sudo apt-get install mosquitto mosquitto-clients

# Start Mosquitto
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

## Development

### Frontend Development

```bash
cd frontend
npm start
```

This will start the React development server.

### Backend Development

```bash
# Run the Wails development server
wails dev
```

This will start both the Go backend and React frontend in development mode.

### Building the Application

```bash
# Build the frontend
cd frontend
npm run build
cd ..

# Build the Wails application
wails build
```

## Usage

### 1. Start the Application

```bash
wails dev
```

### 2. Configure MQTT Connection

1. Click "Show Config" in the MQTT Connection panel
2. Enter your MQTT broker details
3. Click "Connect"

### 3. Control the Air Conditioner

- **Power**: Toggle the air conditioner on/off
- **Mode**: Select operating mode (Auto, Cool, Dry, Fan, Heat)
- **Temperature**: Adjust target temperature (16-30°C)
- **Fan Speed**: Set fan speed (Auto, Quiet, Low, Medium, High)
- **Swing**: Enable/disable swing function
- **Room Temperature**: Simulate room temperature for testing

### 4. Monitor Status

The Status Display panel shows:
- Current power state
- Operating mode
- Temperature settings
- Fan speed
- Swing status
- Device capabilities
- MQTT connection status

## MQTT Message Format

### Status Messages

```json
{
  "timestamp": "2025-01-27T10:30:00Z",
  "deviceId": "ac_sim_001",
  "data": {
    "power": true,
    "mode": "Cool",
    "temperature": 22.0,
    "fanSpeed": "Auto",
    "swing": false,
    "currentTemp": 24,
    "model": 1
  }
}
```

### Control Messages

```json
{
  "command": "power",
  "value": true
}
```

```json
{
  "command": "temperature",
  "value": 22.5
}
```

```json
{
  "command": "mode",
  "value": "Cool"
}
```

## Device Models

### Office Model (Model 1)
- Single vertical vane support
- No horizontal vane support
- Basic swing functionality

### Horizontal Model (Model 2)
- Single vertical vane support
- Single horizontal vane support
- Full swing functionality

### VRF Model (Model 3)
- Four vertical vanes support
- Advanced per-vane control
- Comprehensive swing options

## Testing

### Manual Testing

1. Start the application
2. Connect to MQTT broker
3. Use the UI controls to change settings
4. Monitor MQTT topics for status updates

### MQTT Testing

You can test MQTT communication using mosquitto_pub:

```bash
# Send a control command
mosquitto_pub -h localhost -t "ac_sim/device_id/control" -m '{"command":"power","value":true}'

# Subscribe to status updates
mosquitto_sub -h localhost -t "ac_sim/device_id/state"
```

## Troubleshooting

### Common Issues

1. **MQTT Connection Failed**
   - Check broker hostname and port
   - Verify broker is running
   - Check firewall settings

2. **Frontend Build Errors**
   - Ensure Node.js 16+ is installed
   - Run `npm install` in frontend directory
   - Check for missing dependencies

3. **Wails Build Errors**
   - Ensure Go 1.24+ is installed
   - Run `go mod tidy`
   - Check Wails installation

### Logs

The application logs important events to the console:
- MQTT connection status
- Control command processing
- Status updates
- Error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Copyright © 2025 Nube IO. All rights reserved.

## Support

For support and questions, please contact the development team or create an issue in the repository.
