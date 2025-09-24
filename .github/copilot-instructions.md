# Copilot Instructions for Nube AC Simulator

This workspace contains a Wails desktop application for simulating the UART 9600 baudrate frame.

## Project Context
- **Main Purpose**: Desktop application to simulate Fujitsu Air conditioner by sending/receiving UART frames.
- **Target Users**: Developers and testers working with Fujitsu Air conditioner systems.
- **Core Functionality**:
    - Design UI like Walls to show the power ON/OFF, Mode, Temp, Fan Speed, Swing, etc.
    - Send/receive UART 9600 baudrate frames to/from the air conditioner.
    - Power on/off the simulated air conditioner, showing the icon
    - Mode: Auto, Cool, Dry, Fan, Heat
    - Temperature setting from 16 to 30 degrees Celsius
    - Fan Speed: Auto, Low, Medium, High, Quite
    - Swing: On/Off
    - Display current status of the air conditioner
- **UI Requirements**: Modern interface with device selection,
    - Like  this: https://hvac-control-interfa-hv96.bolt.host/

## Technology Stack
- **Backend**: Go with Wails v2 framework
- **Frontend**: React with modern UI components

## Development Guidelines
- Use responsive design for various screen sizes

## Key Features to Implement
