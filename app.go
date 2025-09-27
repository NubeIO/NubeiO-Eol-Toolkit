package main

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.bug.st/serial"
)

// helper to format bytes as space separated hex pairs
func bytesToSpacedHex(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	var sb strings.Builder
	for i, b := range data {
		if i > 0 {
			sb.WriteByte(' ')
		}
		sb.WriteString(fmt.Sprintf("%02x", b))
	}
	return sb.String()
}

// Protocol constants from Python simulation
const (
	OP_START_STOP              = 0x1000
	OP_MODE                    = 0x1001
	OP_TEMP_SETPOINT           = 0x1002 // Temperature Setpoint (Cooling: 18-30°C, Heating: 16-30°C)
	OP_AIR                     = 0x1003
	VERTICAL_DIRECTION         = 0x1010
	VERTICAL_DIRECTION_SWING   = 0x1011
	VERTICAL_DIRECTION1        = 0x1012
	VERTICAL_DIRECTION_SWING1  = 0x1013
	VERTICAL_DIRECTION2        = 0x1014
	VERTICAL_DIRECTION_SWING2  = 0x1015
	VERTICAL_DIRECTION3        = 0x1016
	VERTICAL_DIRECTION_SWING3  = 0x1017
	VERTICAL_DIRECTION4        = 0x1018
	VERTICAL_DIRECTION_SWING4  = 0x1019
	HORIZONTAL_DIRECTION       = 0x1022
	HORIZONTAL_DIRECTION_SWING = 0x1023
	OP_ERROR_CODE_1030         = 0x1030 // Error Code (Large/Small/Detail Classification)
	OP_ERROR_CODE_1031         = 0x1031 // Error Code related object
	OP_ROOM_TEMPERATURE        = 0x1033 // Room Temperature by 0.01°C
	ECONOMY                    = 0x1100
)

// App struct
type App struct {
	ctx      context.Context
	ac       *AirConditioner
	serial   serial.Port
	model    int // 1: Office Model, 2: Horizontal, 3: VRF
	protocol *FujitsuProtocol
}

// AirConditioner represents the state of the simulated air conditioner
type AirConditioner struct {
	Power       bool    `json:"power"`
	Mode        string  `json:"mode"`        // Auto, Cool, Dry, Fan, Heat
	Temperature float64 `json:"temperature"` // 16-30 degrees Celsius with 0.5°C precision
	FanSpeed    string  `json:"fanSpeed"`    // Auto, Low, Medium, High, Quiet
	Swing       bool    `json:"swing"`
	CurrentTemp int     `json:"currentTemp"`
	Model       int     `json:"model"` // 1: Office, 2: Horizontal, 3: VRF
}

// FujitsuProtocol holds all protocol state variables
type FujitsuProtocol struct {
	SS                  uint8
	Mode                uint16
	Air                 uint16
	VerDir              uint16
	HorDir              uint16
	TempSetpoint        uint16 // Temperature Setpoint (Cooling: 18-30°C, Heating: 16-30°C)
	VerticalWindSwing   uint16
	HorizontalWindSwing uint16
	VerDir1             uint16
	VerticalWindSwing1  uint16
	VerDir2             uint16
	VerticalWindSwing2  uint16
	VerDir3             uint16
	VerticalWindSwing3  uint16
	VerDir4             uint16
	VerticalWindSwing4  uint16
	Economy             uint16
	LastSSChangeTime    time.Time
	SSChangeInterval    time.Duration

	// Additional protocol objects
	ErrorCode1030   uint16 // Error Code (Large/Small/Detail Classification)
	ErrorCode1031   uint16 // Error Code related object
	RoomTemperature uint16 // Room Temperature by 0.01°C (0x1a90 = 6800 = 18.00°C)

	// Extended capability/state (per-model) mapped to class 0x01 objects
	SystemType          uint16    // object 0x0001 (0x0000 single/office/horizontal, 0x0004 VRF)
	VertStepsSupported  uint16    // 0x0130 (represented via class 0x01 num 0x30 in queries)
	VertSwingSupported  bool      // 0x0131 (class 0x01 num 0x31) overall vertical swing capability
	VertVanePos         [4]uint16 // 0x0132–0x0135 (class 0x01 num 0x32–0x35) individual positions
	VertVaneSwing       [4]bool   // 0x103A–0x103D originally, represented by 0x3A–0x3D in queries
	HorizStepsSupported uint16    // 0x0142 (class 0x01 num 0x42)
	HorizSwingSupported bool      // 0x0143 (class 0x01 num 0x43)
	HorizVanePos        [4]uint16 // 0x0144–0x0147 (class 0x01 num 0x44–0x47)
	HorizVaneSwing      [4]bool   // 0x0148–0x014B (class 0x01 num 0x48–0x4B)
}

// SerialConfig holds serial port configuration
type SerialConfig struct {
	Port     string `json:"port"`
	BaudRate int    `json:"baudRate"`
	DataBits int    `json:"dataBits"`
	Parity   string `json:"parity"`
	StopBits int    `json:"stopBits"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	protocol := &FujitsuProtocol{
		SS:                  0,
		Mode:                0,
		Air:                 0,
		VerDir:              0,
		HorDir:              0,
		TempSetpoint:        0xB4, // Default temperature setpoint (18.0°C)
		VerticalWindSwing:   0x00,
		HorizontalWindSwing: 0x00,
		VerDir1:             0x00,
		VerticalWindSwing1:  0x00,
		VerDir2:             0x00,
		VerticalWindSwing2:  0x00,
		VerDir3:             0x00,
		VerticalWindSwing3:  0x00,
		VerDir4:             0x00,
		VerticalWindSwing4:  0x00,
		Economy:             0,
		LastSSChangeTime:    time.Now(),
		SSChangeInterval:    time.Duration(rand.Intn(5)+5) * time.Second,

		// Additional protocol objects
		ErrorCode1030:   0,      // No error initially
		ErrorCode1031:   0,      // No error initially
		RoomTemperature: 0x1a90, // Room temperature (6800 = 18.00°C)
	}

	// Load persisted model selection (fallback to 1)
	storedModel := loadStoredModel()
	if storedModel < 1 || storedModel > 3 {
		storedModel = 1
	}
	initModelCapabilities(protocol, storedModel)

	// Derive initial current room temperature from protocol.RoomTemperature value
	initialRoomTemp := 0
	if protocol.RoomTemperature != 0xFFFF {
		roomFloat := ConvertHvacRoomTemperature(protocol.RoomTemperature)
		if roomFloat < 1000 { // guard against invalid sentinel
			initialRoomTemp = int(math.Round(roomFloat))
		}
	}

	return &App{
		model:    storedModel,
		protocol: protocol,
		ac: &AirConditioner{
			Power:       false,
			Mode:        "Auto",
			Temperature: 22.0,
			FanSpeed:    "Auto",
			Swing:       false,
			CurrentTemp: initialRoomTemp,
			Model:       storedModel,
		},
	}
}

// initModelCapabilities sets protocol capability / static values per model id
func initModelCapabilities(p *FujitsuProtocol, model int) {
	// Reset arrays
	for i := 0; i < 4; i++ {
		p.VertVanePos[i] = 0
		p.VertVaneSwing[i] = false
		p.HorizVanePos[i] = 0
		p.HorizVaneSwing[i] = false
	}

	switch model {
	case 1: // Office (treated same as Horizontal single for system type)
		p.SystemType = 0x0000
		p.VertStepsSupported = 0x0004
		p.VertSwingSupported = true
		p.VertVanePos[0] = 0x0001 // only first vane meaningful
		// Individual vanes 2-4 unsupported -> leave at 0 & swing false (reported as FFFF)
		p.HorizStepsSupported = 0x0000
		p.HorizSwingSupported = false
	case 2: // Horizontal (Single)
		p.SystemType = 0x0000
		p.VertStepsSupported = 0x0004
		p.VertSwingSupported = true
		p.VertVanePos[0] = 0x0001
		p.HorizStepsSupported = 0x0015 // extended horizontal positions
		p.HorizSwingSupported = true
		p.HorizVanePos[0] = 0x0001
	case 3: // VRF
		p.SystemType = 0x0004
		p.VertStepsSupported = 0x0004
		p.VertSwingSupported = true
		for i := 0; i < 4; i++ { // all four vertical vanes supported
			p.VertVanePos[i] = 0x0001
		}
		// Horizontal generally not present (treat as 0 steps)
		p.HorizStepsSupported = 0x0000
		p.HorizSwingSupported = false
	}
}

// startup is called when the app starts. The context passed
// is saved to use for any blocking operations
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	log.Println("FGA Simulator started")
	// Initialize random seed (deprecated warning fixed by using time-based seed)
	rand.New(rand.NewSource(time.Now().UnixNano()))
}

// TemperatureToHex converts temperature in Celsius to hex format
func TemperatureToHex(tempC float64) uint16 {
	if tempC < -50.00 {
		return 0x0000
	} else if tempC > 605.34 {
		return 0xFFFE
	}

	// Calculate the hex value for valid temperatures between -50.00℃ and 605.34℃
	index := int((tempC + 50) * 100) // Calculate the index
	return uint16(index)             // Return the index directly as a number
}

// HexToTemperature converts hex value back to temperature in Celsius
func HexToTemperature(hexVal uint16) float64 {
	if hexVal == 0x0000 {
		return -50.00
	} else if hexVal >= 0xFFFE {
		return 605.34
	}

	// Convert hex index back to temperature
	return (float64(hexVal) / 100.0) - 50.0
}

// HVAC Temperature protocol constants
const (
	HVAC_TEMP_INVALID   = 0xFFFF
	HVAC_TEMP_MIN_VALID = 0x0001
	HVAC_TEMP_MAX_VALID = 0xFFFE
	HVAC_TEMP_BASE      = -50.00
	HVAC_TEMP_SCALE     = 0.01
)

// ConvertHvacRoomTemperature converts HVAC room temperature following DeviceController::getRoomTemperature() formula
func ConvertHvacRoomTemperature(hvacTempValue uint16) float64 {
	if hvacTempValue == 0x0000 {
		return HVAC_TEMP_BASE // -50.00°C
	} else if hvacTempValue >= HVAC_TEMP_MIN_VALID && hvacTempValue <= HVAC_TEMP_MAX_VALID {
		return HVAC_TEMP_BASE + (float64(hvacTempValue) * HVAC_TEMP_SCALE)
	} else {
		return 0xFFFF // Invalid value
	}
}

// GetReturnStatus implements the status logic from Python simulation
func (a *App) GetReturnStatus(cls, num uint8) uint16 {
	switch cls {
	case 0x00:
		if num == 0x01 {
			return 0x00 // Communication Version 0
		}
		return 0x02

	case 0x01:
		switch num {
		case 0x01: // System Type (object 0x0001) explicit per model mapping
			if a.model == 3 { // VRF
				return 0x0004
			}
			// Office (1) and Horizontal (2) both report 0x0000
			return 0x0000
		case 0x13: // Special handling requested: for Horizontal (model 2) must be 0x0000
			if a.model == 1 { // Office
				return 0x0001
			} else if a.model == 2 { // Horizontal override to 0x0000 per requirement
				return 0x0000
			}
			return 0x0001 // VRF or others default (retain previous non-zero behavior)
		case 0x12: // Requirement: VRF (model 3) should report 0x0000 for 0x0112
			if a.model == 3 {
				return 0x0000
			}
			// Office & Horizontal keep previous enabled (0x0001)
			return 0x0001
		case 0x10, 0x11, 0x14, 0x15, 0x17, 0x1a, 0x1d, 0x20: // Operation modes - Office Model specific (excluding 0x13 & 0x12 handled separately)
			if a.model == 1 { // Office Model - expected: 01 [num] 00 01
				return 0x0001
			}
			return 0x01
		// case 0x13 is now handled in the combined case above
		case 0x30: // Vertical steps supported
			return a.protocol.VertStepsSupported
		case 0x31: // Overall vertical swing capability (report 1 if supported)
			if a.protocol.VertSwingSupported {
				return 0x0001
			} else {
				return 0x0000
			}
		case 0x32, 0x33, 0x34, 0x35: // Individual vertical vane positions
			// Updated requirement: Office (1) AND Horizontal (2) report 0xFFFF for 0x0132-0x0135
			if a.model == 1 || a.model == 2 {
				return 0xFFFF
			}
			// VRF requirement: always report 0x0004 for 0x0132-0x0135
			if a.model == 3 {
				return 0x0004
			}
			return 0xFFFF
		case 0x3A, 0x3B, 0x3C, 0x3D: // Individual vertical vane swing states
			// Office (1) & Horizontal (2) report unsupported (0xFFFF) for 0x013A-0x013D
			if a.model == 1 || a.model == 2 {
				return 0xFFFF
			}
			// VRF requirement: always report swing state supported/on = 0x0001 for 0x013A-0x013D
			if a.model == 3 {
				return 0x0001
			}
			return 0xFFFF
		case 0x42: // Horizontal steps supported
			return a.protocol.HorizStepsSupported
		case 0x43: // Horizontal swing overall
			if a.protocol.HorizSwingSupported {
				return 0x0001
			} else {
				return 0x0000
			}
		case 0x44, 0x45, 0x46, 0x47: // Individual horizontal vane position
			// Updated requirement: Office (1) AND Horizontal (2) report unsupported (0xFFFF)
			if a.model == 1 || a.model == 2 {
				return 0xFFFF
			}
			// VRF: treat as present but neutral (0) / stored value
			return a.protocol.HorizVanePos[int(num-0x44)]
		case 0x48, 0x49, 0x4A, 0x4B: // Individual horizontal vane swing
			// Updated requirement: Office (1) AND Horizontal (2) per-vane horizontal swing unsupported
			if a.model == 1 || a.model == 2 {
				return 0xFFFF
			}
			if a.protocol.HorizVaneSwing[int(num-0x48)] {
				return 0x0001
			}
			return 0x0000
		case 0x50: // ECONOMY ON
			return 0x01
		case 0x51, 0x52: // Min Heat, Human Detection (model 1 only)
			if a.model == 1 {
				return 0x01
			}
			return 0x00
		case 0x53: // Energy Saving Fan Control
			if a.model == 3 {
				return 0x00
			}
			return 0x01
		case 0x54: // Auto Save Setting Time
			if a.model == 1 {
				return 0x02
			}
			return 0x00
		case 0x55: // Auto OFF Setting Time
			return 0x00
		case 0x70, 0x71: // Powerful ON, Indoor Unit Low Noise (model 1 only)
			if a.model == 1 {
				return 0x01
			}
			return 0x00
		case 0x93: // Coil dry function
			return 0x00
		}

	case 0x10:
		switch num {
		case 0x00: // Start/Stop status
			return uint16(a.protocol.SS)
		case 0x01: // Mode
			return a.protocol.Mode
		case 0x02: // Temperature Setpoint (value stored as Celsius * 10)
			// Return the actual protocol TempSetpoint so UI & status match object 0x1002 queries
			return a.protocol.TempSetpoint
		case 0x03: // Air
			return a.protocol.Air
		case 0x10: // Vertical direction
			return a.protocol.VerDir
		case 0x11: // Vertical wind swing
			return a.protocol.VerticalWindSwing
		case 0x12: // Vertical direction 1
			return a.protocol.VerDir1
		case 0x13: // Vertical wind swing 1
			return a.protocol.VerticalWindSwing1
		case 0x14: // Vertical direction 2
			return a.protocol.VerDir2
		case 0x15: // Vertical wind swing 2
			return a.protocol.VerticalWindSwing2
		case 0x16: // Vertical direction 3
			return a.protocol.VerDir3
		case 0x17: // Vertical wind swing 3
			return a.protocol.VerticalWindSwing3
		case 0x18: // Vertical direction 4
			return a.protocol.VerDir4
		case 0x19: // Vertical wind swing 4
			return a.protocol.VerticalWindSwing4
		case 0x22: // Horizontal direction
			return a.protocol.HorDir
		case 0x23: // Horizontal wind swing
			return a.protocol.HorizontalWindSwing
		case 0x30, 0x31: // Reserved
			return 0x00
		case 0x33: // Room Temperature (sensor reading)
			return a.protocol.RoomTemperature
		}

	case 0x11:
		if num == 0x00 {
			return a.protocol.Economy
		}
	}

	return 0xFFFF // Default status for unknown classes
}

// GetAirConditionerState returns the current state of the air conditioner
func (a *App) GetAirConditionerState() *AirConditioner {
	return a.ac
}

// SetPower sets the power state of the air conditioner
func (a *App) SetPower(power bool) *AirConditioner {
	a.ac.Power = power
	if power {
		a.protocol.SS = 1
	} else {
		a.protocol.SS = 0
	}
	return a.ac
}

// SetMode sets the operating mode of the air conditioner
func (a *App) SetMode(mode string) *AirConditioner {
	validModes := map[string]uint16{
		"Auto": 0,
		"Cool": 1,
		"Dry":  2,
		"Fan":  3,
		"Heat": 4,
	}

	if modeValue, exists := validModes[mode]; exists {
		a.ac.Mode = mode
		a.protocol.Mode = modeValue
		log.Printf("Mode changed to: %s (protocol value: %d)", mode, modeValue)
	} else {
		log.Printf("Invalid mode: %s", mode)
	}
	return a.ac
}

// SetTemperature sets the target temperature setpoint with mode-aware validation
func (a *App) SetTemperature(temp float64) *AirConditioner {
	var minTemp, maxTemp float64

	// Set temperature range based on current mode
	switch a.ac.Mode {
	case "Heat":
		minTemp, maxTemp = 16.0, 30.0 // Heating: 16-30°C
	case "Cool":
		minTemp, maxTemp = 18.0, 30.0 // Cooling: 18-30°C
	default:
		minTemp, maxTemp = 16.0, 30.0 // Auto/Dry/Fan: full range
	}

	if temp >= minTemp && temp <= maxTemp {
		a.ac.Temperature = temp
		a.protocol.TempSetpoint = uint16(temp * 10) // Protocol uses temperature * 10 (0.1°C precision)
		log.Printf("Set temperature setpoint to: %.1f°C (mode: %s, range: %.1f-%.1f°C)", temp, a.ac.Mode, minTemp, maxTemp)
	} else {
		log.Printf("Temperature %.1f°C out of range for %s mode (valid: %.1f-%.1f°C)", temp, a.ac.Mode, minTemp, maxTemp)
	}
	return a.ac
}

// SetFanSpeed sets the fan speed
func (a *App) SetFanSpeed(speed string) *AirConditioner {
	validSpeeds := map[string]uint16{
		"Auto":   0,
		"Quiet":  2,
		"Low":    5,
		"Medium": 8,
		"High":   11,
	}

	if speedValue, exists := validSpeeds[speed]; exists {
		a.ac.FanSpeed = speed
		a.protocol.Air = speedValue
		log.Printf("Fan speed changed to: %s (protocol value: %d)", speed, speedValue)
	} else {
		log.Printf("Invalid fan speed: %s", speed)
	}
	return a.ac
}

// SetSwing sets the swing state
func (a *App) SetSwing(swing bool) *AirConditioner {
	a.ac.Swing = swing
	if swing {
		a.protocol.VerticalWindSwing = 1
	} else {
		a.protocol.VerticalWindSwing = 0
	}
	return a.ac
}

// GetAvailablePorts returns available serial ports
func (a *App) GetAvailablePorts() []string {
	ports, err := serial.GetPortsList()
	if err != nil {
		log.Printf("Error getting serial ports: %v", err)
		return []string{}
	}
	return ports
}

// ConnectSerial connects to a serial port
func (a *App) ConnectSerial(config SerialConfig) error {
	// Validate input
	if config.Port == "" {
		return fmt.Errorf("port name cannot be empty")
	}

	// Log connection attempt
	log.Printf("Attempting to connect to serial port: %s at %d baud", config.Port, config.BaudRate)

	mode := &serial.Mode{
		BaudRate: config.BaudRate,
		DataBits: config.DataBits,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}

	switch config.Parity {
	case "Even":
		mode.Parity = serial.EvenParity
	case "Odd":
		mode.Parity = serial.OddParity
	}

	switch config.StopBits {
	case 2:
		mode.StopBits = serial.TwoStopBits
	}

	// Check if port exists before trying to open
	if _, err := os.Stat(config.Port); os.IsNotExist(err) {
		return fmt.Errorf("serial port %s does not exist", config.Port)
	}

	port, err := serial.Open(config.Port, mode)
	if err != nil {
		// Provide more detailed error information
		if strings.Contains(err.Error(), "permission denied") {
			return fmt.Errorf("permission denied accessing %s. Make sure you're in the dialout group: sudo usermod -a -G dialout $USER", config.Port)
		} else if strings.Contains(err.Error(), "busy") || strings.Contains(err.Error(), "device or resource busy") {
			return fmt.Errorf("serial port %s is already in use by another process. Use 'lsof %s' to find which process is using it", config.Port, config.Port)
		} else if strings.Contains(err.Error(), "no such file") {
			return fmt.Errorf("serial port %s does not exist. Available ports can be found with GetAvailablePorts()", config.Port)
		}
		return fmt.Errorf("failed to open serial port %s: %v", config.Port, err)
	}

	a.serial = port
	log.Printf("Successfully connected to serial port %s at %d baud", config.Port, config.BaudRate)

	// Start listening for incoming Fujitsu protocol frames
	a.StartProtocolListener()

	return nil
}

// DisconnectSerial disconnects from the serial port
func (a *App) DisconnectSerial() error {
	if a.serial != nil {
		err := a.serial.Close()
		a.serial = nil
		return err
	}
	return nil
}

// CalculateFrameCheck calculates the frame check (one's complement of the sum)
func (a *App) CalculateFrameCheck(data []byte) uint16 {
	sum := uint16(0)
	for _, b := range data {
		sum += uint16(b)
	}
	return ^sum // One's complement (same as C++ ~sum)
}

// VerifyFrameChecksum verifies the checksum of a received frame
func (a *App) VerifyFrameChecksum(frame []byte) bool {
	if len(frame) < 7 { // Minimum frame size: cmd(1) + addr(3) + len(1) + checksum(2) = 7
		return false
	}

	// Frame structure: cmd(1) + addr(3) + len(1) + payload(len) + checksum(2)
	dataLength := int(frame[4])
	checksumStartPos := 5 + dataLength

	if len(frame) < checksumStartPos+2 {
		return false
	}

	// Extract the checksum from the frame
	receivedChecksum := (uint16(frame[checksumStartPos]) << 8) | uint16(frame[checksumStartPos+1])

	// Calculate checksum for all bytes before the checksum
	dataForChecksum := frame[:checksumStartPos]
	calculatedChecksum := a.CalculateFrameCheck(dataForChecksum)

	isValid := receivedChecksum == calculatedChecksum
	if !isValid {
		log.Printf("Checksum mismatch! Received: 0x%04X, Calculated: 0x%04X", receivedChecksum, calculatedChecksum)
		log.Printf("Frame: %s", hex.EncodeToString(frame))
		log.Printf("Data for checksum: %s", hex.EncodeToString(dataForChecksum))
	}

	return isValid
}

// ConstructResponse constructs a response frame based on the correct frame structure
func (a *App) ConstructResponse(command uint8, address uint32, length uint8, data []byte) []byte {
	frame := make([]byte, 0)

	// Add command
	frame = append(frame, command)

	// Add address (3 bytes, big-endian)
	frame = append(frame, byte((address>>16)&0xFF))
	frame = append(frame, byte((address>>8)&0xFF))
	frame = append(frame, byte(address&0xFF))

	// Handle different command types
	switch command {
	case 0x00: // Start command - send response based on data
		if len(data) > 0 && data[0] == 0x01 {
			// Response format: 2 byte request echo + 2 byte status
			frame = append(frame, 4)    // Length (4 bytes of response data)
			frame = append(frame, 0x00) // Request echo byte 1 (command)
			frame = append(frame, 0x01) // Request echo byte 2 (data)
			frame = append(frame, 0x01) // Status byte 1
			frame = append(frame, 0x00) // Status byte 2
		} else {
			// Default ACK
			frame = append(frame, 1)    // Length (1 byte of response data)
			frame = append(frame, 0x01) // Response data
		}

	case 0x01: // Equipment info command - send response based on data
		if len(data) > 0 && data[0] == 0x01 {
			// Response format: 2 byte request echo + 2 byte status
			frame = append(frame, 4)    // Length (4 bytes of response data)
			frame = append(frame, 0x01) // Request echo byte 1 (command)
			frame = append(frame, 0x01) // Request echo byte 2 (data)
			frame = append(frame, 0x00) // Status byte 1
			frame = append(frame, 0x00) // Status byte 2
		} else {
			// Default ACK
			frame = append(frame, 1)    // Length (1 byte of response data)
			frame = append(frame, 0x01) // Response data
		}

	case 0x02: // Object data command - process and ACK
		// Handle command 2 - process object data
		// Data format: [object_id(2 bytes)][value(2 bytes)] repeating
		index := 0
		for index < int(length) {
			if index+4 <= len(data) {
				object := binary.BigEndian.Uint16(data[index : index+2])
				value := binary.BigEndian.Uint16(data[index+2 : index+4])

				log.Printf("Processing object: 0x%04X, value: 0x%04X", object, value)

				switch object {
				case OP_TEMP_SETPOINT:
					a.protocol.TempSetpoint = value
					a.updateACFromProtocol()
					// Convert from protocol value (temp * 10) to actual temperature
					actualTemp := float64(value) / 10.0
					log.Printf("Set temperature setpoint to: 0x%04X (%.1f°C)", value, actualTemp)
				case OP_START_STOP:
					a.protocol.SS = uint8(value)
					a.updateACFromProtocol()
					log.Printf("Set power to: %d (0=stop, 1=start)", value)
				case OP_MODE:
					a.protocol.Mode = value
					a.updateACFromProtocol()
					modeNames := map[uint16]string{0: "Auto", 1: "Cool", 2: "Dry", 3: "Fan", 4: "Heat"}
					modeName := modeNames[value]
					if modeName == "" {
						modeName = "Unknown"
					}
					log.Printf("Set mode to: %d (%s)", value, modeName)
				case OP_AIR:
					a.protocol.Air = value
					a.updateACFromProtocol()
					fanNames := map[uint16]string{0: "Auto", 2: "Quiet", 5: "Low", 8: "Medium", 11: "High"}
					fanName := fanNames[value]
					if fanName == "" {
						fanName = "Unknown"
					}
					log.Printf("Set fan speed to: %d (%s)", value, fanName)
				case VERTICAL_DIRECTION:
					a.protocol.VerDir = value
					log.Printf("Set vertical direction to: %d", value)
				case VERTICAL_DIRECTION_SWING:
					a.protocol.VerticalWindSwing = value
					a.updateACFromProtocol()
					log.Printf("Set vertical swing to: %d", value)
				case VERTICAL_DIRECTION1:
					a.protocol.VerDir1 = value
				case VERTICAL_DIRECTION_SWING1:
					a.protocol.VerticalWindSwing1 = value
				case VERTICAL_DIRECTION2:
					a.protocol.VerDir2 = value
				case VERTICAL_DIRECTION_SWING2:
					a.protocol.VerticalWindSwing2 = value
				case VERTICAL_DIRECTION3:
					a.protocol.VerDir3 = value
				case VERTICAL_DIRECTION_SWING3:
					a.protocol.VerticalWindSwing3 = value
				case VERTICAL_DIRECTION4:
					a.protocol.VerDir4 = value
				case VERTICAL_DIRECTION_SWING4:
					a.protocol.VerticalWindSwing4 = value
				case HORIZONTAL_DIRECTION:
					a.protocol.HorDir = value
				case HORIZONTAL_DIRECTION_SWING:
					a.protocol.HorizontalWindSwing = value
					a.updateACFromProtocol()
					log.Printf("Set horizontal swing to: %d", value)
				case ECONOMY:
					a.protocol.Economy = value
					log.Printf("Set economy mode to: %d", value)
				// Extended capability/state writes
				case 0x0132, 0x0133, 0x0134, 0x0135: // Vertical vane positions (per-vane)
					idx := int(object - 0x0132)
					if a.model == 3 { // VRF supports all 4
						if idx >= 0 && idx < 4 {
							a.protocol.VertVanePos[idx] = value
							log.Printf("Set vertical vane %d position to: 0x%04X", idx, value)
						}
					} else if (a.model == 1 || a.model == 2) && idx == 0 { // only vane 0 meaningful
						a.protocol.VertVanePos[0] = value
						log.Printf("Set vertical vane 0 position to: 0x%04X", value)
					}
				case 0x103A, 0x103B, 0x103C, 0x103D: // Vertical vane swing (VRF per-vane)
					idx := int(object - 0x103A)
					if a.model == 3 && idx >= 0 && idx < 4 {
						a.protocol.VertVaneSwing[idx] = value != 0
						log.Printf("Set vertical vane %d swing to: %v", idx, value != 0)
					}
				case 0x0144, 0x0145, 0x0146, 0x0147: // Horizontal vane positions
					idx := int(object - 0x0144)
					if a.model == 2 { // Horizontal model only first vane
						if idx == 0 {
							a.protocol.HorizVanePos[0] = value
							log.Printf("Set horizontal vane 0 position to: 0x%04X", value)
						}
					} else if a.model == 3 { // VRF treat as neutral/no-op but record
						if idx >= 0 && idx < 4 {
							a.protocol.HorizVanePos[idx] = value
							log.Printf("(VRF) Stored horizontal vane %d position (not used) to: 0x%04X", idx, value)
						}
					}
				case 0x0148, 0x0149, 0x014A, 0x014B: // Horizontal vane swing
					idx := int(object - 0x0148)
					if a.model == 2 { // only first vane
						if idx == 0 {
							a.protocol.HorizVaneSwing[0] = value != 0
							log.Printf("Set horizontal vane 0 swing to: %v", value != 0)
						}
					} else if a.model == 3 { // record but not really used
						if idx >= 0 && idx < 4 {
							a.protocol.HorizVaneSwing[idx] = value != 0
							log.Printf("(VRF) Stored horizontal vane %d swing (not used) to: %v", idx, value != 0)
						}
					}
				case OP_ERROR_CODE_1030:
					a.protocol.ErrorCode1030 = value
					log.Printf("Set error code 1030 to: 0x%04X", value)
				case OP_ERROR_CODE_1031:
					a.protocol.ErrorCode1031 = value
					log.Printf("Set error code 1031 to: 0x%04X", value)
				case OP_ROOM_TEMPERATURE:
					a.protocol.RoomTemperature = value
					temp := ConvertHvacRoomTemperature(value)
					log.Printf("Set room temperature to: 0x%04X (%.2f°C)", value, temp)
				default:
					log.Printf("Unknown object: 0x%04X with value: 0x%04X", object, value)
				}
			}
			index += 4 // Move to next object-value pair
		}
		frame = append(frame, 1)    // Length (1 byte of response data)
		frame = append(frame, 0x01) // Response data (ACK)

	case 0x03: // Equipment confirmation or status request command
		// Check if this is object-value pairs (4-byte groups) or class-number pairs (2-byte groups)
		if length%4 == 0 && length >= 4 {
			// Handle as status request with object-value pairs
			// Response format: 03000000 [data length][01-ACK] 1000 xxxx 1001 xxx,....[2byte-checksum]
			responseData := []byte{0x01} // Start with ACK byte

			// Process input data as object pairs and provide status for each
			for i := 0; i < len(data); i += 4 {
				if i+3 < len(data) {
					// Extract object ID (2 bytes, big-endian)
					objectID := binary.BigEndian.Uint16(data[i : i+2])
					// Skip the value bytes for status request (we'll return current status)

					log.Printf("Status requested for object: 0x%04X", objectID)

					// Add object ID to response (2 bytes, big-endian)
					responseData = append(responseData, byte((objectID>>8)&0xFF))
					responseData = append(responseData, byte(objectID&0xFF))

					// Add current status value for this object (2 bytes, big-endian)
					var statusValue uint16
					switch objectID {
					case OP_START_STOP: // 1000 - Power status
						statusValue = uint16(a.protocol.SS)
					case OP_MODE: // 1001 - Mode status
						statusValue = a.protocol.Mode
						log.Printf("Mode status requested: returning %d (%s)", statusValue, a.ac.Mode)
					case OP_TEMP_SETPOINT: // 1002 - Temperature Setpoint (Cooling: 18-30°C, Heating: 16-30°C)
						statusValue = a.protocol.TempSetpoint
						// Convert and log the actual temperature
						actualTemp := float64(statusValue) / 10.0
						log.Printf("Temperature setpoint: 0x%04X (%.1f°C)", statusValue, actualTemp)
					case OP_AIR: // 1003 - Fan speed status
						statusValue = a.protocol.Air
						log.Printf("Fan speed status requested: returning %d (%s)", statusValue, a.ac.FanSpeed)
					case VERTICAL_DIRECTION: // 1010 - Vertical direction status
						statusValue = a.protocol.VerDir
					case VERTICAL_DIRECTION_SWING: // 1011 - Vertical swing status
						statusValue = a.protocol.VerticalWindSwing
					case OP_ERROR_CODE_1030: // 1030 - Error Code (Large/Small/Detail Classification)
						statusValue = a.protocol.ErrorCode1030
					case OP_ERROR_CODE_1031: // 1031 - Error Code related object
						statusValue = a.protocol.ErrorCode1031
					case OP_ROOM_TEMPERATURE: // 1033 - Room Temperature by 0.01°C
						statusValue = a.protocol.RoomTemperature
						// Convert to actual temperature for logging
						roomTemp := ConvertHvacRoomTemperature(statusValue)
						log.Printf("Room temperature: 0x%04X = %.2f°C", statusValue, roomTemp)
					case HORIZONTAL_DIRECTION_SWING: // 1023 - Horizontal swing status
						statusValue = a.protocol.HorizontalWindSwing
					case ECONOMY: // 1100 - Economy mode status
						statusValue = a.protocol.Economy
					default:
						statusValue = 0 // Default status for unknown objects
					}

					// Add status value (2 bytes, big-endian)
					responseData = append(responseData, byte((statusValue>>8)&0xFF))
					responseData = append(responseData, byte(statusValue&0xFF))

					log.Printf("Response for object 0x%04X: status=0x%04X", objectID, statusValue)
				}
			}

			// Set the data length for the response
			frame = append(frame, byte(len(responseData))) // Length of response data
			frame = append(frame, responseData...)         // Append all response data
		} else {
			// Handle as equipment confirmation with class-number pairs (original behavior)
			// Equipment confirmation - response format: ACK + 4 bytes per query
			// Expected response format: [00] [cls] [num] [00] for each query
			payloadLength := length*2 + 1        // 4 bytes per object + 1 ACK byte
			frame = append(frame, payloadLength) // Length
			frame = append(frame, 0x01)          // ACK data

			for i := 0; i < len(data); i += 2 {
				if i+1 < len(data) {
					cls := data[i]   // First byte is class
					num := data[i+1] // Second byte is number

					returnStatus := a.GetReturnStatus(cls, num)

					// Add response in format: [cls] [num] [status_high] [status_low]
					// This matches the expected format: 2 byte request echo + 2 byte status
					frame = append(frame, cls)                          // Request echo: Class
					frame = append(frame, num)                          // Request echo: Number
					frame = append(frame, byte((returnStatus>>8)&0xFF)) // Status high byte
					frame = append(frame, byte(returnStatus&0xFF))      // Status low byte
				}
			}
		}
	}

	// Calculate and add frame check (2 bytes, big-endian)
	frameCheck := a.CalculateFrameCheck(frame)
	frame = append(frame, byte((frameCheck>>8)&0xFF))
	frame = append(frame, byte(frameCheck&0xFF))

	return frame
}

// updateACFromProtocol updates the AC state from protocol values
func (a *App) updateACFromProtocol() {
	oldMode := a.ac.Mode
	oldFanSpeed := a.ac.FanSpeed
	oldPower := a.ac.Power

	// Update power state
	a.ac.Power = a.protocol.SS != 0

	// Update mode
	switch a.protocol.Mode {
	case 0:
		a.ac.Mode = "Auto"
	case 1:
		a.ac.Mode = "Cool"
	case 2:
		a.ac.Mode = "Dry"
	case 3:
		a.ac.Mode = "Fan"
	case 4:
		a.ac.Mode = "Heat"
	}

	// Update fan speed
	switch a.protocol.Air {
	case 0:
		a.ac.FanSpeed = "Auto"
	case 2:
		a.ac.FanSpeed = "Quiet"
	case 5:
		a.ac.FanSpeed = "Low"
	case 8:
		a.ac.FanSpeed = "Medium"
	case 11:
		a.ac.FanSpeed = "High"
	default:
		// For unknown values, keep current speed or default to Auto
		if a.ac.FanSpeed == "" {
			a.ac.FanSpeed = "Auto"
		}
	}

	// Log changes
	if oldPower != a.ac.Power {
		log.Printf("AC Power updated: %v -> %v", oldPower, a.ac.Power)
	}
	if oldMode != a.ac.Mode {
		log.Printf("AC Mode updated: %s -> %s", oldMode, a.ac.Mode)
	}
	if oldFanSpeed != a.ac.FanSpeed {
		log.Printf("AC Fan Speed updated: %s -> %s", oldFanSpeed, a.ac.FanSpeed)
	}

	// Update swing (combine global + per-vane arrays)
	swing := a.protocol.VerticalWindSwing != 0 || a.protocol.HorizontalWindSwing != 0
	for i := 0; i < 4 && !swing; i++ {
		if a.protocol.VertVaneSwing[i] || a.protocol.HorizVaneSwing[i] {
			swing = true
			break
		}
	}
	a.ac.Swing = swing

	// Update temperature setpoint
	if a.protocol.TempSetpoint >= 16*10 && a.protocol.TempSetpoint <= 30*10 {
		a.ac.Temperature = float64(a.protocol.TempSetpoint) / 10.0
	}

	// Update current (sensor) room temperature from object 0x1033
	if a.protocol.RoomTemperature != 0xFFFF { // treat 0xFFFF as invalid/unset
		room := ConvertHvacRoomTemperature(a.protocol.RoomTemperature)
		if room > -50 && room < 80 { // plausible indoor range safeguard
			a.ac.CurrentTemp = int(math.Round(room))
		}
	}
}

// ReadFrame reads a complete frame from serial with timeout
func (a *App) ReadFrame(buffer []byte, timeout time.Duration) ([]byte, []byte, error) {
	startTime := time.Now()

	for time.Since(startTime) < timeout {
		if a.serial == nil {
			return nil, buffer, fmt.Errorf("serial port not connected")
		}

		// Read available data
		available := make([]byte, 128)
		n, err := a.serial.Read(available)
		if err != nil {
			return nil, buffer, err
		}

		if n > 0 {
			buffer = append(buffer, available[:n]...)
			// log.Printf("Buffer now contains: %s (length: %d)", hex.EncodeToString(buffer), len(buffer))
		}

		// Try to find and extract valid frames from buffer
		for {
			frame, newBuffer, found := a.extractValidFrame(buffer)
			if !found {
				break
			}

			buffer = newBuffer
			if frame != nil {
				return frame, buffer, nil
			}
		}

		time.Sleep(10 * time.Millisecond)
	}

	// if len(buffer) > 0 {
	// 	log.Printf("Timeout with remaining buffer: %s", hex.EncodeToString(buffer))
	// }
	return nil, buffer, fmt.Errorf("timeout reading frame")
}

// extractValidFrame tries to extract a valid frame from the buffer
func (a *App) extractValidFrame(buffer []byte) ([]byte, []byte, bool) {
	// Need at least 7 bytes for minimum frame: cmd(1) + addr(3) + len(1) + checksum(2) = 7
	if len(buffer) < 7 {
		return nil, buffer, false
	}

	// Try each position in the buffer as a potential frame start
	for i := 0; i <= len(buffer)-7; i++ {
		// Check if this could be a valid frame start
		command := buffer[i]

		// Fujitsu commands are typically 0x00-0x03, reject obvious noise
		if command > 0x03 {
			continue
		}

		// Check if we have enough bytes for the header
		if i+4 >= len(buffer) {
			continue
		}

		dataLength := int(buffer[i+4])

		// Sanity check on data length (Fujitsu frames are typically small)
		if dataLength > 50 {
			continue
		}

		// Calculate expected frame length: cmd(1) + addr(3) + len(1) + payload(dataLength) + checksum(2)
		expectedFrameLength := 5 + dataLength + 2

		// Check if we have enough data for this potential frame
		if i+expectedFrameLength > len(buffer) {
			// Not enough data for this frame yet
			if i == 0 {
				// This might be the start of a valid frame, wait for more data
				return nil, buffer, false
			}
			continue
		}

		// Extract potential frame
		candidateFrame := buffer[i : i+expectedFrameLength]

		// Additional validation - check if address bytes are reasonable
		address := (uint32(candidateFrame[1]) << 16) | (uint32(candidateFrame[2]) << 8) | uint32(candidateFrame[3])
		if address == 0x000000 && command == 0x00 && dataLength == 0 {
			// This looks like the noise pattern we're seeing
			log.Printf("Skipping noise pattern at offset %d: %s", i, hex.EncodeToString(candidateFrame[:min(8, len(candidateFrame))]))
			continue
		}

		// Verify checksum
		if a.VerifyFrameChecksum(candidateFrame) {
			// log.Printf("Found valid frame at offset %d: %s (cmd=0x%02X, addr=0x%06X, len=%d)",
			// 	i, hex.EncodeToString(candidateFrame), command, address, dataLength)

			// Remove processed data including any garbage before the frame
			remainingBuffer := buffer[i+expectedFrameLength:]
			return candidateFrame, remainingBuffer, true
		} else {
			log.Printf("Checksum failed for candidate at offset %d: %s", i, hex.EncodeToString(candidateFrame[:min(16, len(candidateFrame))]))
		}
	}

	// No valid frame found, remove some garbage data if buffer is getting large
	if len(buffer) > 256 {
		log.Printf("Buffer overflow protection: removing oldest 128 bytes of potentially invalid data")
		buffer = buffer[128:]
	}

	return nil, buffer, false
}

// Helper function to get minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SetModel sets the AC model type
func (a *App) SetModel(model int) *AirConditioner {
	if model >= 1 && model <= 3 {
		a.model = model
		a.ac.Model = model
		initModelCapabilities(a.protocol, model)
		log.Printf("Model set to %d: %s", model, a.getModelName(model))
		persistModel(model)
	}
	return a.ac
}

// getModelName returns the model name
func (a *App) getModelName(model int) string {
	switch model {
	case 1:
		return "Office Model"
	case 2:
		return "Horizontal"
	case 3:
		return "VRF"
	default:
		return "Unknown"
	}
}

// StartProtocolListener starts listening for protocol frames
func (a *App) StartProtocolListener() {
	if a.serial == nil {
		return
	}

	log.Println("Starting Fujitsu protocol listener...")

	go func() {
		remainingBuffer := make([]byte, 0)

		for {
			if a.serial == nil {
				break
			}

			frame, newBuffer, err := a.ReadFrame(remainingBuffer, 500*time.Millisecond)
			remainingBuffer = newBuffer

			if err != nil {
				continue
			}

			if len(frame) >= 7 { // Minimum frame: cmd(1) + addr(3) + len(1) + checksum(2) = 7
				command := frame[0]
				address := (uint32(frame[1]) << 16) | (uint32(frame[2]) << 8) | uint32(frame[3])
				dataLength := frame[4]

				// Extract payload data (starts at byte 5, length is dataLength)
				var data []byte
				if dataLength > 0 && len(frame) >= int(5+dataLength+2) {
					data = frame[5 : 5+dataLength] // Payload starts at byte 5
				}

				// log.Printf("Processing command: 0x%02X, address: 0x%06X, length: %d, data: %s",
				// 	command, address, dataLength, hex.EncodeToString(data))

				// Send immediate ACK for critical commands (but not 0x03 which needs full response)
				if command == 0x00 || command == 0x01 {
					// Send simple ACK immediately
					ackFrame := []byte{command, byte((address >> 16) & 0xFF), byte((address >> 8) & 0xFF), byte(address & 0xFF), 0x01, 0x01}
					// Add checksum
					frameCheck := a.CalculateFrameCheck(ackFrame)
					ackFrame = append(ackFrame, byte((frameCheck>>8)&0xFF))
					ackFrame = append(ackFrame, byte(frameCheck&0xFF))

					if a.serial != nil {
						_, err := a.serial.Write(ackFrame)
						if err != nil {
							log.Printf("Error sending immediate ACK: %v", err)
						} else {
							log.Printf("Sent immediate ACK: %s", hex.EncodeToString(ackFrame))
						}
					}
				} else {
					// For other commands (including 0x03), send full response
					responseFrame := a.ConstructResponse(command, address, dataLength, data)

					if a.serial != nil {
						_, err := a.serial.Write(responseFrame)
						if err != nil {
							log.Printf("Error sending response: %v", err)
						} else {
							// log.Printf("Sent response: %s", bytesToSpacedHex(responseFrame))
						}
					}
				}
			}
		}
	}()
}

// ---------------- Persistence Helpers ----------------

const configFileName = "fga_simulator_config.json"

type persistentConfig struct {
	Model int `json:"model"`
}

// loadStoredModel reads last selected model from config file
func loadStoredModel() int {
	path := filepath.Join(".", configFileName)
	f, err := os.Open(path)
	if err != nil {
		return 1
	}
	defer f.Close()
	var cfg persistentConfig
	if err := json.NewDecoder(f).Decode(&cfg); err != nil {
		return 1
	}
	if cfg.Model < 1 || cfg.Model > 3 {
		return 1
	}
	return cfg.Model
}

// persistModel writes the selected model to config file
func persistModel(model int) {
	if model < 1 || model > 3 {
		return
	}
	path := filepath.Join(".", configFileName)
	tmp := path + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	_ = enc.Encode(&persistentConfig{Model: model})
	f.Close()
	_ = os.Rename(tmp, path)
}

// ---------------- Capability Accessor ----------------

// CapabilityInfo describes feature support for current model
type CapabilityInfo struct {
	Model                   int    `json:"model"`
	ModelName               string `json:"modelName"`
	SystemType              uint16 `json:"systemType"`
	VerticalSteps           uint16 `json:"verticalSteps"`
	VerticalSwing           bool   `json:"verticalSwing"`
	VerticalVaneCount       int    `json:"verticalVaneCount"`
	VerticalVaneSupported   []bool `json:"verticalVaneSupported"`
	HorizontalSteps         uint16 `json:"horizontalSteps"`
	HorizontalSwing         bool   `json:"horizontalSwing"`
	HorizontalVaneCount     int    `json:"horizontalVaneCount"`
	HorizontalVaneSupported []bool `json:"horizontalVaneSupported"`
}

// GetCapabilities returns current model capability information
func (a *App) GetCapabilities() *CapabilityInfo {
	vertSupported := make([]bool, 4)
	horizSupported := make([]bool, 4)

	// Determine per-vane support based on model rules already used in GetReturnStatus
	switch a.model {
	case 1: // only first vertical vane meaningful; no horizontal
		vertSupported[0] = true
	case 2: // single vertical & single horizontal
		vertSupported[0] = true
		horizSupported[0] = true
	case 3: // VRF supports four vertical
		for i := 0; i < 4; i++ {
			vertSupported[i] = true
		}
	}

	vCount := 0
	hCount := 0
	for _, v := range vertSupported {
		if v {
			vCount++
		}
	}
	for _, v := range horizSupported {
		if v {
			hCount++
		}
	}

	return &CapabilityInfo{
		Model:                   a.model,
		ModelName:               a.getModelName(a.model),
		SystemType:              a.protocol.SystemType,
		VerticalSteps:           a.protocol.VertStepsSupported,
		VerticalSwing:           a.protocol.VertSwingSupported,
		VerticalVaneCount:       vCount,
		VerticalVaneSupported:   vertSupported,
		HorizontalSteps:         a.protocol.HorizStepsSupported,
		HorizontalSwing:         a.protocol.HorizSwingSupported,
		HorizontalVaneCount:     hCount,
		HorizontalVaneSupported: horizSupported,
	}
}

// ---------------- Per-Vane Control Exported Methods ----------------

// SetVerticalVanePosition sets an individual vertical vane position if supported and returns updated capabilities
func (a *App) SetVerticalVanePosition(index int, position uint16) *CapabilityInfo {
	if index < 0 || index > 3 {
		return a.GetCapabilities()
	}
	// Model support: model 3 supports all four, models 1 & 2 only index 0
	if a.model == 3 || (index == 0 && (a.model == 1 || a.model == 2)) {
		// Clamp position to supported steps if steps declared (>0 means count)
		steps := int(a.protocol.VertStepsSupported)
		if steps > 0 && int(position) > steps {
			position = uint16(steps)
		}
		if position == 0 {
			position = 1
		} // enforce minimum 1 for now
		a.protocol.VertVanePos[index] = position
		log.Printf("Vertical vane %d position set to %d", index, position)
	}
	return a.GetCapabilities()
}

// SetVerticalVaneSwing sets swing state for a single vertical vane (VRF only) else ignored
func (a *App) SetVerticalVaneSwing(index int, swing bool) *CapabilityInfo {
	if index < 0 || index > 3 {
		return a.GetCapabilities()
	}
	if a.model == 3 { // only VRF exposes per-vane swing
		a.protocol.VertVaneSwing[index] = swing
		log.Printf("Vertical vane %d swing set to %v", index, swing)
		a.updateACFromProtocol()
	} else if index == 0 { // for single vane models treat as global vertical swing
		if swing {
			a.protocol.VerticalWindSwing = 1
		} else {
			a.protocol.VerticalWindSwing = 0
		}
		a.updateACFromProtocol()
	}
	return a.GetCapabilities()
}

// SetHorizontalVanePosition sets an individual horizontal vane position if supported
func (a *App) SetHorizontalVanePosition(index int, position uint16) *CapabilityInfo {
	if index < 0 || index > 3 {
		return a.GetCapabilities()
	}
	// Model 2 supports only index 0; model 3 conceptually none but we store for completeness
	if a.model == 2 && index == 0 {
		steps := int(a.protocol.HorizStepsSupported)
		if steps > 0 && int(position) > steps {
			position = uint16(steps)
		}
		if position == 0 {
			position = 1
		}
		a.protocol.HorizVanePos[0] = position
		log.Printf("Horizontal vane 0 position set to %d", position)
	} else if a.model == 3 { // store but not operational
		a.protocol.HorizVanePos[index] = position
		log.Printf("(VRF) Stored horizontal vane %d position %d (non-operational)", index, position)
	}
	return a.GetCapabilities()
}

// SetHorizontalVaneSwing sets swing for horizontal vane (model 2 index 0 only, VRF store only)
func (a *App) SetHorizontalVaneSwing(index int, swing bool) *CapabilityInfo {
	if index < 0 || index > 3 {
		return a.GetCapabilities()
	}
	if a.model == 2 && index == 0 {
		a.protocol.HorizVaneSwing[0] = swing
		if swing {
			a.protocol.HorizontalWindSwing = 1
		} else {
			a.protocol.HorizontalWindSwing = 0
		}
		a.updateACFromProtocol()
		log.Printf("Horizontal vane 0 swing set to %v", swing)
	} else if a.model == 3 { // store only
		a.protocol.HorizVaneSwing[index] = swing
		log.Printf("(VRF) Stored horizontal vane %d swing %v (non-operational)", index, swing)
	}
	return a.GetCapabilities()
}
