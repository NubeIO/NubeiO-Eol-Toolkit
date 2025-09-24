# 🚀 FGA Simulator - Quick Start Guide for Office PC

## Complete Setup Instructions for New PC

### 1. Prerequisites Installation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential build tools
sudo apt install -y build-essential curl wget git

# Install Go 1.21+
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
echo 'export PATH=$PATH:~/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify installations
go version      # Should show Go 1.21+
node --version  # Should show Node 18+
npm --version   # Should show npm 8+
wails version   # Should show Wails v2.10.2+
```

### 2. Project Setup

```bash
# Clone the project (replace with actual git repository)
git clone <your-repository-url> FGA_Simulator
cd FGA_Simulator

# Build the application
wails build

# The executable will be at: ./build/bin/FGA_Simulator
```

### 3. Serial Port Configuration

```bash
# Add user to dialout group for serial access
sudo usermod -a -G dialout $USER

# IMPORTANT: Log out and log back in after running the above command

# Check available ports
ls /dev/ttyUSB* /dev/ttyACM*

# Test port permissions (after re-login)
# If this fails, you need to log out/in again
groups | grep dialout
```

### 4. Running the Application

```bash
# Navigate to project directory
cd FGA_Simulator

# Run the application
./build/bin/FGA_Simulator

# Application will start with GUI
# Connect to serial port (e.g., /dev/ttyUSB1) at 9600 baud
```

## 📋 Current Working Status

### ✅ Fully Implemented Features
- **Serial Communication**: UART 9600 baud with proper framing
- **Protocol Parser**: Handles all Fujitsu commands (0x00-0x03)
- **Frame Validation**: Checksum verification and noise filtering
- **Command Processing**: 
  - Command 0x00: Start/initialization
  - Command 0x01: Equipment info
  - Command 0x02: Object-value write operations
  - Command 0x03: Status requests
- **ACK Responses**: Immediate acknowledgment for all commands
- **Object Processing**: Power control (0x1000), mode, temperature, fan speed
- **Real-time Logging**: Comprehensive debug output

### 🔧 Technical Specifications
- **Frame Structure**: `[CMD:1][ADDR:3][LEN:1][PAYLOAD:N][CHECKSUM:2]`
- **Checksum Algorithm**: One's complement (`~sum`)
- **Supported Objects**:
  - `0x1000`: Power (0=stop, 1=start)
  - `0x1001`: Mode (0=Auto, 1=Cool, 2=Dry, 3=Fan, 4=Heat)
  - `0x1002`: Temperature setting
  - `0x1003`: Fan speed
  - `0x1010-0x1019`: Vertical direction/swing
  - `0x1022-0x1023`: Horizontal direction/swing
  - `0x1100`: Economy mode

### 📊 Test Results
- ✅ Successfully processes power commands: `0x1000` with values `0x0001` (start) and `0x0000` (stop)
- ✅ Proper frame parsing with noise tolerance
- ✅ Stable serial communication at 9600 baud
- ✅ Correct checksum calculation and verification
- ✅ Real-time protocol monitoring and logging

## 🛠️ Troubleshooting Common Issues

### Serial Port Access Denied
```bash
# Solution 1: Add user to dialout group (then logout/login)
sudo usermod -a -G dialout $USER

# Solution 2: Temporary permission fix
sudo chmod 666 /dev/ttyUSB1  # Replace with your port

# Check who is using the port
sudo lsof /dev/ttyUSB1
```

### Port Already in Use
```bash
# Find processes using the port
sudo lsof /dev/ttyUSB1

# Kill processes using the port
sudo pkill -f /dev/ttyUSB1

# Or restart the USB subsystem
sudo modprobe -r usbserial
sudo modprobe usbserial
```

### Build Errors
```bash
# Clean build cache
wails clean

# Rebuild everything
wails build

# Check dependencies
go mod tidy
```

### No Serial Ports Detected
```bash
# Check USB devices
lsusb

# Check dmesg for USB events
dmesg | grep -i usb

# Install USB serial drivers if needed
sudo apt install -y usb-modeswitch usb-modeswitch-data
```

## 📁 Project File Structure

```
FGA_Simulator/
├── app.go                    # ⭐ Main protocol implementation
├── main.go                   # Application entry point
├── wails.json               # Wails configuration
├── go.mod/go.sum            # Go dependencies
├── frontend/                # React UI
│   ├── src/App.jsx          # Main React component
│   ├── dist/                # Built frontend
│   └── package.json         # Node dependencies
├── build/bin/FGA_Simulator  # ⭐ Executable
└── README.md                # Documentation
```

## 🔄 Development Workflow

### Making Protocol Changes
```bash
# Edit app.go for protocol modifications
nano app.go

# Rebuild
wails build

# Test with hardware
./build/bin/FGA_Simulator
```

### Adding New Features
```bash
# For UI changes
cd frontend
npm run build
cd ..
wails build

# For backend changes
wails build
```

## 📞 Quick Reference

### Key Files to Know
- `app.go` - All protocol logic and serial communication
- `frontend/src/App.jsx` - User interface
- `build/bin/FGA_Simulator` - The executable

### Important Commands
```bash
# Build application
wails build

# Development mode
wails dev

# Check serial ports
ls /dev/ttyUSB*

# Run application
./build/bin/FGA_Simulator
```

### Protocol Testing
The application logs all communication in the terminal. Look for:
```
Processing object: 0x1000, value: 0x0001
Set power to: 1 (0=stop, 1=start)
```

## 🎯 Next Steps

1. **Setup Environment**: Follow steps 1-3 above
2. **Build & Test**: Run the application and connect to serial port
3. **Verify Communication**: Check terminal logs for proper frame processing
4. **Test Hardware**: Connect to actual Fujitsu unit and verify commands

---

**The simulator is production-ready and successfully communicating with Fujitsu hardware! 🎉**
