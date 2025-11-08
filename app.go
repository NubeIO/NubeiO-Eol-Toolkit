package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// App struct
type App struct {
	ctx      context.Context
	ac       *AirConditioner
	model    int // 1: Office Model, 2: Horizontal, 3: VRF
	protocol *FujitsuProtocol
	mqtt     *MQTTService
}

// AirConditioner represents the state of the simulated air conditioner
type AirConditioner struct {
	Power       bool    `json:"power"`
	Mode        string  `json:"mode"`        // Auto, Cool, Dry, Fan, Heat
	Temperature float64 `json:"temperature"` // 16-30 degrees Celsius with 0.5°C precision
	FanSpeed    string  `json:"fanSpeed"`    // Auto, Low, Medium, High, Quiet
	Swing       bool    `json:"swing"`
	CurrentTemp float64 `json:"currentTemp"` // Room temperature with 0.01°C precision
	Model       int     `json:"model"`       // 1: Office, 2: Horizontal, 3: VRF
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

// MQTTConfig holds MQTT broker configuration
type MQTTConfig struct {
	Broker   string `json:"broker"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	ClientID string `json:"clientId"`
	DeviceID string `json:"deviceId"`
}

// DiscoveredDevice represents a discovered ESP32 device
type DiscoveredDevice struct {
	DeviceID    string          `json:"deviceId"`
	LastSeen    time.Time       `json:"lastSeen"`
	IPAddress   string          `json:"ipAddress,omitempty"`
	FirmwareVer string          `json:"firmwareVersion,omitempty"`
	State       *AirConditioner `json:"state,omitempty"` // Last known state of this device
}

// MQTTService handles MQTT communication for the AC simulator
type MQTTService struct {
	client            mqtt.Client
	config            MQTTConfig
	app               *App
	ctx               context.Context
	connected         bool
	discoveredDevices map[string]*DiscoveredDevice // Map of device ID to device info
}

// MQTTMessage represents a message structure for MQTT topics
type MQTTMessage struct {
	Timestamp int64       `json:"timestamp"` // Timestamp in milliseconds from ESP32
	DeviceID  string      `json:"deviceId"`
	Data      interface{} `json:"data"`
}

// ControlMessage represents control commands from MQTT
type ControlMessage struct {
	Command string      `json:"command"`
	Value   interface{} `json:"value"`
	Target  string      `json:"target,omitempty"` // For broadcast commands
}

// UARTMessage represents UART traffic data
type UARTMessage struct {
	Direction string `json:"direction"` // "rx" or "tx"
	Data      string `json:"data"`      // Hex encoded data
	Length    int    `json:"length"`
}

// DiscoveryMessage represents device discovery information
type DiscoveryMessage struct {
	DeviceID     string          `json:"deviceId"`
	Model        int             `json:"model"`
	ModelName    string          `json:"modelName"`
	Capabilities *CapabilityInfo `json:"capabilities"`
	Status       *AirConditioner `json:"status"`
	Timestamp    time.Time       `json:"timestamp"`
}

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
	initialRoomTemp := 0.0
	if protocol.RoomTemperature != 0xFFFF {
		roomFloat := ConvertHvacRoomTemperature(protocol.RoomTemperature)
		if roomFloat < 1000 { // guard against invalid sentinel
			initialRoomTemp = roomFloat
		}
	}

	app := &App{
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

	// Initialize MQTT service
	app.mqtt = NewMQTTService(app)

	return app
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

	// Connect to MQTT broker
	if err := a.mqtt.Connect(); err != nil {
		log.Printf("Failed to connect to MQTT broker: %v", err)
	} else {
		log.Println("MQTT service connected successfully")
	}
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

	// Publish control command to ESP32
	if a.mqtt != nil {
		a.mqtt.publishControlCommand("set_power", power)
		a.mqtt.publishStatus()
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

		// Publish control command to ESP32
		if a.mqtt != nil {
			// Convert mode to lowercase for ESP32
			a.mqtt.publishControlCommand("set_mode", strings.ToLower(mode))
			a.mqtt.publishStatus()
		}
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

		// Publish control command to ESP32
		if a.mqtt != nil {
			a.mqtt.publishControlCommand("set_target_temp", temp)
			a.mqtt.publishStatus()
		}
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

		// Publish control command to ESP32
		if a.mqtt != nil {
			// Map speed names to ESP32 expected values (0-4)
			fanSpeedMap := map[string]int{
				"Auto":   0,
				"Quiet":  1,
				"Low":    2,
				"Medium": 3,
				"High":   4,
			}
			if fanValue, ok := fanSpeedMap[speed]; ok {
				a.mqtt.publishControlCommand("set_fan_speed", fanValue)
			}
			a.mqtt.publishStatus()
		}
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

	// Publish status to MQTT
	if a.mqtt != nil {
		a.mqtt.publishStatus()
	}

	return a.ac
}

// SetRoomTemperature sets the room temperature for testing purposes
func (a *App) SetRoomTemperature(temp float64) *AirConditioner {
	// Convert temperature to protocol format (multiply by 100 for 0.01°C precision)
	// Protocol formula: (temp + 50) * 100 to handle range from -50.00°C to +605.34°C
	if temp < -50.0 || temp > 605.34 {
		log.Printf("Room temperature %.2f°C out of valid range (-50.00°C to +605.34°C)", temp)
		return a.ac
	}

	// Convert to protocol value using the same formula as TemperatureToHex
	protocolValue := uint16((temp + 50.0) * 100)
	a.protocol.RoomTemperature = protocolValue
	a.ac.CurrentTemp = temp

	log.Printf("Set room temperature to: %.2f°C (protocol: 0x%04X)", temp, protocolValue)

	// Publish status to MQTT
	if a.mqtt != nil {
		a.mqtt.publishStatus()
	}

	return a.ac
}

// SetModel sets the AC model type
func (a *App) SetModel(model int) *AirConditioner {
	if model >= 1 && model <= 3 {
		a.model = model
		a.ac.Model = model
		initModelCapabilities(a.protocol, model)
		log.Printf("Model set to %d: %s", model, a.getModelName(model))
		persistModel(model)

		// Publish discovery to MQTT
		if a.mqtt != nil {
			a.mqtt.publishDiscovery()
		}
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

// ---------------- MQTT Service Implementation ----------------

// NewMQTTService creates a new MQTT service instance
func NewMQTTService(app *App) *MQTTService {
	deviceID := getDeviceID()

	config := MQTTConfig{
		Broker:   getEnvOrDefault("MQTT_BROKER", "113.160.225.31"),
		Port:     getEnvIntOrDefault("MQTT_PORT", 1883),
		Username: getEnvOrDefault("MQTT_USERNAME", ""),
		Password: getEnvOrDefault("MQTT_PASSWORD", ""),
		ClientID: fmt.Sprintf("fga_simulator_%s", deviceID),
		DeviceID: deviceID,
	}

	return &MQTTService{
		config:            config,
		app:               app,
		connected:         false,
		discoveredDevices: make(map[string]*DiscoveredDevice),
	}
}

// getDeviceID generates or retrieves a unique device ID
func getDeviceID() string {
	// Try to read from environment first
	if deviceID := os.Getenv("DEVICE_ID"); deviceID != "" {
		return deviceID
	}

	// Try to read from config file
	configPath := "device_id.txt"
	if data, err := os.ReadFile(configPath); err == nil && len(data) > 0 {
		return strings.TrimSpace(string(data))
	}

	// Generate new device ID in format AC_SIM_XXXXXX (6 hex digits)
	// Use random hex to match the device format
	rand.Seed(time.Now().UnixNano())
	deviceID := fmt.Sprintf("AC_SIM_%06X", rand.Intn(0xFFFFFF))
	if err := os.WriteFile(configPath, []byte(deviceID), 0644); err != nil {
		log.Printf("Warning: Could not save device ID: %v", err)
	}

	return deviceID
}

// getEnvOrDefault gets environment variable or returns default value
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvIntOrDefault gets environment variable as int or returns default value
func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// Connect establishes connection to MQTT broker
func (m *MQTTService) Connect() error {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(fmt.Sprintf("tcp://%s:%d", m.config.Broker, m.config.Port))
	opts.SetClientID(m.config.ClientID)

	if m.config.Username != "" {
		opts.SetUsername(m.config.Username)
	}
	if m.config.Password != "" {
		opts.SetPassword(m.config.Password)
	}

	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(1 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)

	// Set connection handlers
	opts.SetOnConnectHandler(m.onConnect)
	opts.SetConnectionLostHandler(m.onConnectionLost)
	opts.SetReconnectingHandler(m.onReconnecting)

	m.client = mqtt.NewClient(opts)

	if token := m.client.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("failed to connect to MQTT broker: %v", token.Error())
	}

	return nil
}

// onConnect handles successful MQTT connection
func (m *MQTTService) onConnect(client mqtt.Client) {
	log.Printf("MQTT connected to broker %s:%d", m.config.Broker, m.config.Port)
	m.connected = true

	// Subscribe to control topics
	m.subscribeToTopics()

	// Publish discovery message
	m.publishDiscovery()

	// Publish initial status
	m.publishStatus()
}

// onConnectionLost handles MQTT connection loss
func (m *MQTTService) onConnectionLost(client mqtt.Client, err error) {
	log.Printf("MQTT connection lost: %v", err)
	m.connected = false
}

// onReconnecting handles MQTT reconnection
func (m *MQTTService) onReconnecting(client mqtt.Client, options *mqtt.ClientOptions) {
	log.Printf("MQTT reconnecting to broker %s:%d", m.config.Broker, m.config.Port)
}

// subscribeToTopics subscribes to all required MQTT topics
func (m *MQTTService) subscribeToTopics() {
	topics := map[string]byte{
		fmt.Sprintf("ac_sim/%s/control", m.config.DeviceID): 1, // QoS 1
		"ac_sim/all/control":     1, // Broadcast control
		"ac_sim/broadcast/state": 1, // Broadcast state from ESP32
		"ac_sim/+/state":         1, // All device states (wildcard)
		"ac_sim/discovery":       1, // ESP32 discovery messages
		fmt.Sprintf("ac_sim/%s/state", m.config.DeviceID): 1, // Own state
	}

	for topic, qos := range topics {
		if token := m.client.Subscribe(topic, qos, m.messageHandler); token.Wait() && token.Error() != nil {
			log.Printf("Failed to subscribe to %s: %v", topic, token.Error())
		} else {
			log.Printf("Subscribed to topic: %s", topic)
		}
	}
}

// messageHandler handles incoming MQTT messages
func (m *MQTTService) messageHandler(client mqtt.Client, msg mqtt.Message) {
	topic := msg.Topic()
	payload := msg.Payload()

	log.Printf("Received MQTT message on %s: %s", topic, string(payload))

	// Check if this is a state message (from ESP32 or other devices)
	// State topics end with "/state"
	if len(topic) >= 6 && topic[len(topic)-6:] == "/state" {
		log.Printf("Detected state message from topic: %s", topic)

		// Parse state message from ESP32
		var stateMsg MQTTMessage
		if err := json.Unmarshal(payload, &stateMsg); err != nil {
			log.Printf("Failed to parse state message: %v", err)
			return
		}

		log.Printf("Parsed state message from device %s", stateMsg.DeviceID)

		// Update the specific device's state if it's a discovered device
		if device, exists := m.discoveredDevices[stateMsg.DeviceID]; exists {
			if dataMap, ok := stateMsg.Data.(map[string]interface{}); ok {
				// Initialize state if nil
				if device.State == nil {
					device.State = &AirConditioner{
						Model: 1,
					}
				}

				// Update device state
				if power, ok := dataMap["power"].(bool); ok {
					device.State.Power = power
				}
				if mode, ok := dataMap["mode"].(string); ok {
					device.State.Mode = mode
				}
				if temp, ok := dataMap["temperature"].(float64); ok {
					device.State.Temperature = temp
				}
				if fanSpeed, ok := dataMap["fanSpeed"].(string); ok {
					device.State.FanSpeed = fanSpeed
				}
				if swing, ok := dataMap["swing"].(bool); ok {
					device.State.Swing = swing
				}
				if currentTemp, ok := dataMap["currentTemp"].(float64); ok {
					device.State.CurrentTemp = currentTemp
				}

				device.LastSeen = time.Now()
				log.Printf("Updated state for device %s: Power=%v, Mode=%s, Temp=%.1f",
					stateMsg.DeviceID, device.State.Power, device.State.Mode, device.State.Temperature)
			}
		}
		return
	}

	// Check if this is the broadcast state topic
	if topic == "ac_sim/broadcast/state" {
		log.Printf("Detected broadcast state message")

		// Parse state message from ESP32
		var stateMsg MQTTMessage
		if err := json.Unmarshal(payload, &stateMsg); err != nil {
			log.Printf("Failed to parse broadcast state message: %v", err)
			return
		}

		log.Printf("Parsed broadcast state message: %+v", stateMsg)

		// Update local state if data is present
		if dataMap, ok := stateMsg.Data.(map[string]interface{}); ok {
			log.Printf("Updating state from broadcast message data")
			m.updateStateFromMessage(dataMap)
		} else {
			log.Printf("No data map found in broadcast state message")
		}
		return
	}

	// Check if this is a discovery message
	if topic == "ac_sim/discovery" {
		log.Printf("Detected discovery message")

		// Parse discovery message
		var discoveryData map[string]interface{}
		if err := json.Unmarshal(payload, &discoveryData); err != nil {
			log.Printf("Failed to parse discovery message: %v", err)
			return
		}

		// Extract device ID - check both "device_id" and "deviceId" formats
		var deviceID string
		if id, ok := discoveryData["device_id"].(string); ok {
			deviceID = id
		} else if id, ok := discoveryData["deviceId"].(string); ok {
			deviceID = id
		}

		if deviceID != "" {
			// Ignore our own discovery messages
			if deviceID == m.config.DeviceID {
				log.Printf("Ignoring own discovery message from %s", deviceID)
				return
			}

			// Check if device already exists
			device, exists := m.discoveredDevices[deviceID]
			isNew := !exists

			if !exists {
				// Create new device with default state
				device = &DiscoveredDevice{
					DeviceID: deviceID,
					LastSeen: time.Now(),
					State: &AirConditioner{
						Power:       false,
						Mode:        "Auto",
						Temperature: 22.0,
						FanSpeed:    "Auto",
						Swing:       false,
						CurrentTemp: 24.0,
						Model:       1,
					},
				}
			} else {
				// Update last seen time
				device.LastSeen = time.Now()
			}

			// Extract optional fields
			if ip, ok := discoveryData["ip"].(string); ok {
				device.IPAddress = ip
			}
			if fw, ok := discoveryData["firmware_version"].(string); ok {
				device.FirmwareVer = fw
			}

			// Store device
			m.discoveredDevices[deviceID] = device

			if isNew {
				log.Printf("✓ Discovered new ESP32 device: %s (total: %d)", deviceID, len(m.discoveredDevices))
			} else {
				log.Printf("✓ Updated ESP32 device: %s", deviceID)
			}
		}
		return
	}

	// Parse control message
	var controlMsg ControlMessage
	if err := json.Unmarshal(payload, &controlMsg); err != nil {
		log.Printf("Failed to parse control message: %v", err)
		return
	}

	// Handle control commands
	m.handleControlCommand(controlMsg)
}

// updateStateFromMessage updates the app state from an incoming MQTT state message
func (m *MQTTService) updateStateFromMessage(data map[string]interface{}) {
	log.Printf("Updating state from MQTT message: %+v", data)

	if power, ok := data["power"].(bool); ok {
		m.app.ac.Power = power
		if power {
			m.app.protocol.SS = 1
		} else {
			m.app.protocol.SS = 0
		}
	}

	if mode, ok := data["mode"].(string); ok {
		m.app.ac.Mode = mode
		validModes := map[string]uint16{
			"Auto": 0, "Cool": 1, "Dry": 2, "Fan": 3, "Heat": 4,
		}
		if modeValue, exists := validModes[mode]; exists {
			m.app.protocol.Mode = modeValue
		}
	}

	if temp, ok := data["temperature"].(float64); ok {
		m.app.ac.Temperature = temp
		m.app.protocol.TempSetpoint = uint16(temp * 10)
	}

	if fanSpeed, ok := data["fanSpeed"].(string); ok {
		m.app.ac.FanSpeed = fanSpeed
		validSpeeds := map[string]uint16{
			"Auto": 0, "Quiet": 2, "Low": 5, "Medium": 8, "High": 11,
		}
		if speedValue, exists := validSpeeds[fanSpeed]; exists {
			m.app.protocol.Air = speedValue
		}
	}

	if swing, ok := data["swing"].(bool); ok {
		m.app.ac.Swing = swing
		if swing {
			m.app.protocol.VerticalWindSwing = 1
		} else {
			m.app.protocol.VerticalWindSwing = 0
		}
	}

	if currentTemp, ok := data["currentTemp"].(float64); ok {
		m.app.ac.CurrentTemp = currentTemp
	}

	if model, ok := data["model"].(float64); ok {
		m.app.ac.Model = int(model)
	}

	log.Printf("State updated: Power=%v, Mode=%s, Temp=%.1f, Fan=%s",
		m.app.ac.Power, m.app.ac.Mode, m.app.ac.Temperature, m.app.ac.FanSpeed)
}

// handleControlCommand processes control commands from MQTT
func (m *MQTTService) handleControlCommand(cmd ControlMessage) {
	log.Printf("Processing control command: %s = %v", cmd.Command, cmd.Value)

	switch cmd.Command {
	case "power":
		if value, ok := cmd.Value.(bool); ok {
			m.app.SetPower(value)
		}
	case "mode":
		if value, ok := cmd.Value.(string); ok {
			m.app.SetMode(value)
		}
	case "temperature":
		if value, ok := cmd.Value.(float64); ok {
			m.app.SetTemperature(value)
		}
	case "fanSpeed":
		if value, ok := cmd.Value.(string); ok {
			m.app.SetFanSpeed(value)
		}
	case "swing":
		if value, ok := cmd.Value.(bool); ok {
			m.app.SetSwing(value)
		}
	case "roomTemperature":
		if value, ok := cmd.Value.(float64); ok {
			m.app.SetRoomTemperature(value)
		}
	case "model":
		if value, ok := cmd.Value.(float64); ok {
			model := int(value)
			if model >= 1 && model <= 3 {
				m.app.SetModel(model)
			}
		}
	default:
		log.Printf("Unknown control command: %s", cmd.Command)
	}
}

// publishStatus publishes current AC status to MQTT
func (m *MQTTService) publishStatus() {
	if !m.connected {
		return
	}

	status := m.app.GetAirConditionerState()
	message := MQTTMessage{
		Timestamp: time.Now().UnixMilli(),
		DeviceID:  m.config.DeviceID,
		Data:      status,
	}

	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal status message: %v", err)
		return
	}

	topic := fmt.Sprintf("ac_sim/%s/state", m.config.DeviceID)
	if token := m.client.Publish(topic, 1, false, payload); token.Wait() && token.Error() != nil {
		log.Printf("Failed to publish status: %v", token.Error())
	} else {
		log.Printf("Published status to %s", topic)
	}
}

// publishUARTData publishes UART traffic to MQTT
func (m *MQTTService) publishUARTData(direction string, data []byte) {
	if !m.connected {
		return
	}

	uartMsg := UARTMessage{
		Direction: direction,
		Data:      fmt.Sprintf("%x", data),
		Length:    len(data),
	}

	message := MQTTMessage{
		Timestamp: time.Now().UnixMilli(),
		DeviceID:  m.config.DeviceID,
		Data:      uartMsg,
	}

	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal UART message: %v", err)
		return
	}

	topic := fmt.Sprintf("ac_sim/%s/uart/%s", m.config.DeviceID, direction)
	if token := m.client.Publish(topic, 0, false, payload); token.Wait() && token.Error() != nil {
		log.Printf("Failed to publish UART data: %v", token.Error())
	} else {
		log.Printf("Published UART %s data to %s", direction, topic)
	}
}

// publishControlCommand publishes a control command to ESP32 devices (all discovered devices)
func (m *MQTTService) publishControlCommand(action string, value interface{}) {
	if !m.connected {
		log.Printf("Cannot publish control command - MQTT not connected")
		return
	}

	controlMsg := map[string]interface{}{
		"action": action,
		"value":  value,
	}

	payload, err := json.Marshal(controlMsg)
	if err != nil {
		log.Printf("Failed to marshal control command: %v", err)
		return
	}

	// If we have discovered ESP32 devices, control them specifically
	if len(m.discoveredDevices) > 0 {
		for deviceID := range m.discoveredDevices {
			topic := fmt.Sprintf("ac_sim/%s/control", deviceID)
			if token := m.client.Publish(topic, 1, false, payload); token.Wait() && token.Error() != nil {
				log.Printf("Failed to publish control command to %s: %v", deviceID, token.Error())
			} else {
				log.Printf("Published control command to %s: %s = %v", topic, action, value)
			}
		}
	} else {
		// Fallback to broadcast if no devices discovered yet
		topic := "ac_sim/all/control"
		if token := m.client.Publish(topic, 1, false, payload); token.Wait() && token.Error() != nil {
			log.Printf("Failed to publish control command: %v", token.Error())
		} else {
			log.Printf("Published control command to %s (broadcast): %s = %v", topic, action, value)
		}
	}
}

// publishControlCommandToDevice publishes a control command to a specific ESP32 device
func (m *MQTTService) publishControlCommandToDevice(deviceID string, action string, value interface{}) {
	if !m.connected {
		log.Printf("Cannot publish control command - MQTT not connected")
		return
	}

	controlMsg := map[string]interface{}{
		"action": action,
		"value":  value,
	}

	payload, err := json.Marshal(controlMsg)
	if err != nil {
		log.Printf("Failed to marshal control command: %v", err)
		return
	}

	topic := fmt.Sprintf("ac_sim/%s/control", deviceID)
	if token := m.client.Publish(topic, 1, false, payload); token.Wait() && token.Error() != nil {
		log.Printf("Failed to publish control command to %s: %v", deviceID, token.Error())
	} else {
		log.Printf("Published control command to %s: %s = %v", topic, action, value)
	}
}

// publishDiscovery publishes device discovery information
func (m *MQTTService) publishDiscovery() {
	if !m.connected {
		return
	}

	discovery := DiscoveryMessage{
		DeviceID:     m.config.DeviceID,
		Model:        m.app.model,
		ModelName:    m.app.getModelName(m.app.model),
		Capabilities: m.app.GetCapabilities(),
		Status:       m.app.GetAirConditionerState(),
		Timestamp:    time.Now(),
	}

	payload, err := json.Marshal(discovery)
	if err != nil {
		log.Printf("Failed to marshal discovery message: %v", err)
		return
	}

	topic := "ac_sim/discovery"
	if token := m.client.Publish(topic, 1, false, payload); token.Wait() && token.Error() != nil {
		log.Printf("Failed to publish discovery: %v", token.Error())
	} else {
		log.Printf("Published discovery to %s", topic)
	}
}

// Disconnect disconnects from MQTT broker
func (m *MQTTService) Disconnect() {
	if m.client != nil && m.client.IsConnected() {
		m.client.Disconnect(250)
		log.Println("MQTT disconnected")
	}
	m.connected = false
}

// IsConnected returns the connection status
func (m *MQTTService) IsConnected() bool {
	return m.connected && m.client != nil && m.client.IsConnected()
}

// GetConfig returns the current MQTT configuration
func (m *MQTTService) GetConfig() MQTTConfig {
	return m.config
}

// UpdateConfig updates MQTT configuration and reconnects if needed
func (m *MQTTService) UpdateConfig(config MQTTConfig) error {
	wasConnected := m.IsConnected()

	if wasConnected {
		m.Disconnect()
	}

	m.config = config

	if wasConnected {
		return m.Connect()
	}

	return nil
}

// ---------------- MQTT Methods ----------------

// GetMQTTConfig returns the current MQTT configuration
func (a *App) GetMQTTConfig() MQTTConfig {
	if a.mqtt != nil {
		return a.mqtt.GetConfig()
	}
	return MQTTConfig{}
}

// UpdateMQTTConfig updates MQTT configuration
func (a *App) UpdateMQTTConfig(config MQTTConfig) error {
	if a.mqtt != nil {
		return a.mqtt.UpdateConfig(config)
	}
	return fmt.Errorf("MQTT service not initialized")
}

// GetMQTTStatus returns MQTT connection status
func (a *App) GetMQTTStatus() bool {
	if a.mqtt != nil {
		return a.mqtt.IsConnected()
	}
	return false
}

// ConnectMQTT manually connects to MQTT broker
func (a *App) ConnectMQTT() error {
	if a.mqtt != nil {
		return a.mqtt.Connect()
	}
	return fmt.Errorf("MQTT service not initialized")
}

// DisconnectMQTT manually disconnects from MQTT broker
func (a *App) DisconnectMQTT() {
	if a.mqtt != nil {
		a.mqtt.Disconnect()
	}
}

// PublishStatus manually publishes current status to MQTT
func (a *App) PublishStatus() {
	if a.mqtt != nil {
		a.mqtt.publishStatus()
	}
}

// PublishDiscovery manually publishes discovery information to MQTT
func (a *App) PublishDiscovery() {
	if a.mqtt != nil {
		a.mqtt.publishDiscovery()
	}
}

// GetDiscoveredDevices returns the list of discovered ESP32 devices
func (a *App) GetDiscoveredDevices() []DiscoveredDevice {
	if a.mqtt == nil {
		return []DiscoveredDevice{}
	}

	devices := make([]DiscoveredDevice, 0, len(a.mqtt.discoveredDevices))
	for _, device := range a.mqtt.discoveredDevices {
		devices = append(devices, *device)
	}
	return devices
}

// SetDevicePower sets power for a specific device
func (a *App) SetDevicePower(deviceID string, power bool) {
	if a.mqtt != nil {
		a.mqtt.publishControlCommandToDevice(deviceID, "power", power)
	}
}

// SetDeviceMode sets mode for a specific device
func (a *App) SetDeviceMode(deviceID string, mode string) {
	if a.mqtt != nil {
		a.mqtt.publishControlCommandToDevice(deviceID, "mode", mode)
	}
}

// SetDeviceTemperature sets temperature for a specific device
func (a *App) SetDeviceTemperature(deviceID string, temp float64) {
	if a.mqtt != nil {
		a.mqtt.publishControlCommandToDevice(deviceID, "temperature", temp)
	}
}

// SetDeviceFanSpeed sets fan speed for a specific device
func (a *App) SetDeviceFanSpeed(deviceID string, speed string) {
	if a.mqtt != nil {
		a.mqtt.publishControlCommandToDevice(deviceID, "fanSpeed", speed)
	}
}

// SetDeviceRoomTemperature sets room temperature for a specific device
func (a *App) SetDeviceRoomTemperature(deviceID string, temp float64) {
	if a.mqtt != nil {
		a.mqtt.publishControlCommandToDevice(deviceID, "roomTemperature", temp)
	}
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
