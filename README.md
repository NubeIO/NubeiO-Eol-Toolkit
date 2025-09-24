# FGA Simulator - Fujitsu Air Conditioner Simulator

A desktop application built with Wails v2 that simulates a Fujitsu Air Conditioner with UART 9600 baudrate communication.

## Features

- **Power Control**: Turn the air conditioner on/off
- **Mode Selection**: Auto, Cool, Dry, Fan, Heat modes
- **Temperature Control**: Set target temperature from 16°C to 30°C
- **Fan Speed Control**: Auto, Quiet, Low, Medium, High speeds
- **Swing Control**: Enable/disable air swing
- **UART Communication**: Send/receive 9600 baudrate frames
- **Real-time Status**: Display current air conditioner state
- **Serial Port Management**: Connect to various serial ports

## Technology Stack

- **Backend**: Go with Wails v2 framework
- **Frontend**: React with Tailwind CSS
- **Serial Communication**: go.bug.st/serial library
- **UI Components**: Lucide React icons

## Prerequisites

- Go 1.21 or later
- Node.js and npm
- Wails v2 CLI

## Installation

1. Install Wails CLI:
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

2. Clone the repository:
```bash
git clone <repository-url>
cd FGA_Simulator
```

3. Install dependencies:
```bash
wails build
```

## Development

To run in development mode:

```bash
wails dev
```

## Building

To build the application:

```bash
wails build
```

## Usage

1. **Connect Serial Port**: 
   - Select an available serial port from the dropdown
   - Configure baud rate (default: 9600)
   - Click "Connect"

2. **Control Air Conditioner**:
   - Use the Power button to turn on/off
   - Select operating mode (Auto, Cool, Dry, Fan, Heat)
   - Adjust target temperature with +/- buttons
   - Choose fan speed
   - Toggle swing function

3. **Monitor Status**:
   - View current temperature and target temperature
   - Monitor connection status
   - See real-time operating parameters

## UART Protocol

The application simulates Fujitsu Air Conditioner UART frames:

- **Baud Rate**: 9600
- **Data Bits**: 8
- **Parity**: None
- **Stop Bits**: 1
- **Frame Length**: 8 bytes
- **Checksum**: XOR

### Frame Format

| Byte | Description |
|------|-------------|
| 0    | Start byte (0xFE) |
| 1    | Power and mode bits |
| 2    | Target temperature |
| 3    | Fan speed |
| 4    | Swing status |
| 5    | Current temperature |
| 6    | Reserved |
| 7    | XOR checksum |

## Serial Port Configuration

The application supports various serial port configurations:

- **Baud Rates**: 9600, 19200, 38400, 57600, 115200
- **Data Bits**: 7, 8
- **Parity**: None, Even, Odd
- **Stop Bits**: 1, 2

## Architecture

```
├── main.go              # Application entry point
├── app.go               # Backend logic and UART handling
├── wails.json           # Wails configuration
├── go.mod               # Go dependencies
└── frontend/
    ├── src/
    │   ├── App.js                           # Main React component
    │   ├── components/
    │   │   ├── AirConditionerControl.js     # AC control interface
    │   │   ├── StatusDisplay.js             # Status monitoring
    │   │   └── SerialConnection.js          # Serial port management
    │   └── wailsjs/                         # Generated Wails bindings
    ├── package.json       # Node.js dependencies
    └── tailwind.config.js # Tailwind CSS configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

Copyright © 2025 Nube IO. All rights reserved.

## Support

For support and questions, please contact info@nube-io.com.
