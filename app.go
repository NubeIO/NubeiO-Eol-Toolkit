package main

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"

	"go.bug.st/serial"
)

// Protocol constants from Python simulation
const (
	OP_START_STOP              = 0x1000
	OP_MODE                    = 0x1001
	OP_SET_TEMP                = 0x1002
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
	ECONOMY                    = 0x1100
)

// App struct
type App struct {
	ctx      context.Context
	ac       *AirConditioner
	serial   serial.Port
	model    int // 1: Office Model, 2: Vertical, 3: VRF
	protocol *FujitsuProtocol
}

// AirConditioner represents the state of the simulated air conditioner
type AirConditioner struct {
	Power       bool   `json:"power"`
	Mode        string `json:"mode"`        // Auto, Cool, Dry, Fan, Heat
	Temperature int    `json:"temperature"` // 16-30 degrees Celsius
	FanSpeed    string `json:"fanSpeed"`    // Auto, Low, Medium, High, Quiet
	Swing       bool   `json:"swing"`
	CurrentTemp int    `json:"currentTemp"`
	Model       int    `json:"model"` // 1: Office, 2: Vertical, 3: VRF
}

// FujitsuProtocol holds all protocol state variables
type FujitsuProtocol struct {
	SS                  uint8
	Mode                uint16
	Air                 uint16
	VerDir              uint16
	HorDir              uint16
	Temp                uint16
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
		Temp:                0xB4, // Default temperature
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
	}

	return &App{
		model:    1, // Default to Office Model
		protocol: protocol,
		ac: &AirConditioner{
			Power:       false,
			Mode:        "Auto",
			Temperature: 22,
			FanSpeed:    "Auto",
			Swing:       false,
			CurrentTemp: 24,
			Model:       1,
		},
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
		case 0x01: // System Type
			if a.model == 3 {
				return 0x04
			}
			return 0x00
		case 0x10, 0x11, 0x12, 0x14, 0x15, 0x17, 0x1a, 0x1d, 0x20: // Various operation modes
			return 0x01
		case 0x13: // Operation HEAT
			if a.model == 2 {
				return 0x00
			}
			return 0x01
		case 0x30, 0x31: // Vertical wind direction step
			return 0x04
		case 0x32, 0x33, 0x34, 0x35: // Vertical wind direction step (model 3 only)
			if a.model == 3 {
				return 0x04
			}
			return 0xFFFF
		case 0x3A, 0x3B, 0x3C, 0x3D: // Vertical wind direction step (model 3 only)
			if a.model == 3 {
				return 0x01
			}
			return 0xFFFF
		case 0x42: // Horizontal Wind Direction Step
			if a.model == 2 {
				return 0x15
			}
			return 0x00
		case 0x43: // Horizontal Wind Direction Swing ON/OFF
			if a.model == 2 {
				return 0x01
			}
			return 0x00
		case 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B: // Horizontal wind direction (model 3 only)
			if a.model == 3 {
				return 0x00
			}
			return 0xFFFF
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
		case 0x02: // Temperature
			if a.protocol.Temp == 0xB4 {
				return 0xDC
			}
			return 0xB4
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
		case 0x33: // Temperature
			return TemperatureToHex(float64(a.protocol.Temp) / 10)
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
	}
	return a.ac
}

// SetTemperature sets the target temperature
func (a *App) SetTemperature(temp int) *AirConditioner {
	if temp >= 16 && temp <= 30 {
		a.ac.Temperature = temp
		a.protocol.Temp = uint16(temp * 10) // Protocol uses temperature * 10
	}
	return a.ac
}

// SetFanSpeed sets the fan speed
func (a *App) SetFanSpeed(speed string) *AirConditioner {
	validSpeeds := map[string]uint16{
		"Auto":   0,
		"Quiet":  1,
		"Low":    2,
		"Medium": 3,
		"High":   4,
	}

	if speedValue, exists := validSpeeds[speed]; exists {
		a.ac.FanSpeed = speed
		a.protocol.Air = speedValue
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
	case 0x00: // Start command - send simple ACK
		frame = append(frame, 1)    // Length (1 byte of response data)
		frame = append(frame, 0x01) // Response data

	case 0x01: // Equipment info command - send ACK
		frame = append(frame, 1)    // Length (1 byte of response data)
		frame = append(frame, 0x01) // Response data

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
				case OP_SET_TEMP:
					a.protocol.Temp = value
					a.updateACFromProtocol()
					log.Printf("Set temperature to: %d", value)
				case OP_START_STOP:
					a.protocol.SS = uint8(value)
					a.updateACFromProtocol()
					log.Printf("Set power to: %d (0=stop, 1=start)", value)
				case OP_MODE:
					a.protocol.Mode = value
					a.updateACFromProtocol()
					log.Printf("Set mode to: %d", value)
				case OP_AIR:
					a.protocol.Air = value
					a.updateACFromProtocol()
					log.Printf("Set fan speed to: %d", value)
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
				default:
					log.Printf("Unknown object: 0x%04X with value: 0x%04X", object, value)
				}
			}
			index += 4 // Move to next object-value pair
		}
		frame = append(frame, 1)    // Length (1 byte of response data)
		frame = append(frame, 0x01) // Response data (ACK)

	case 0x03: // Equipment confirmation or wind direction command
		// Equipment confirmation - response will be adding 2 bytes data each object
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
	}

	// Calculate and add frame check (2 bytes, big-endian)
	frameCheck := a.CalculateFrameCheck(frame)
	frame = append(frame, byte((frameCheck>>8)&0xFF))
	frame = append(frame, byte(frameCheck&0xFF))

	return frame
}

// updateACFromProtocol updates the AC state from protocol values
func (a *App) updateACFromProtocol() {
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
	case 1:
		a.ac.FanSpeed = "Quiet"
	case 2:
		a.ac.FanSpeed = "Low"
	case 3:
		a.ac.FanSpeed = "Medium"
	case 4:
		a.ac.FanSpeed = "High"
	}

	// Update swing (combine all swing states for simplicity)
	a.ac.Swing = a.protocol.VerticalWindSwing != 0 || a.protocol.HorizontalWindSwing != 0

	// Update temperature
	if a.protocol.Temp >= 16*10 && a.protocol.Temp <= 30*10 {
		a.ac.Temperature = int(a.protocol.Temp / 10)
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
			log.Printf("Buffer now contains: %s (length: %d)", hex.EncodeToString(buffer), len(buffer))
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

	if len(buffer) > 0 {
		log.Printf("Timeout with remaining buffer: %s", hex.EncodeToString(buffer))
	}
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
			log.Printf("Found valid frame at offset %d: %s (cmd=0x%02X, addr=0x%06X, len=%d)",
				i, hex.EncodeToString(candidateFrame), command, address, dataLength)

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
		log.Printf("Model set to %d: %s", model, a.getModelName(model))
	}
	return a.ac
}

// getModelName returns the model name
func (a *App) getModelName(model int) string {
	switch model {
	case 1:
		return "Office Model"
	case 2:
		return "Vertical"
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

				log.Printf("Processing command: 0x%02X, address: 0x%06X, length: %d, data: %s",
					command, address, dataLength, hex.EncodeToString(data))

				// Send immediate ACK for critical commands
				if command == 0x00 || command == 0x01 || command == 0x03 {
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
					// For other commands, send full response
					responseFrame := a.ConstructResponse(command, address, dataLength, data)

					if a.serial != nil {
						_, err := a.serial.Write(responseFrame)
						if err != nil {
							log.Printf("Error sending response: %v", err)
						} else {
							log.Printf("Sent response: %s", hex.EncodeToString(responseFrame))
						}
					}
				}
			}
		}
	}()
}
