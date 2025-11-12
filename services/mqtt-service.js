const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

/**
 * MQTT Service
 * Handles MQTT connection, device discovery, and control commands
 */
class MQTTService {
  constructor(app) {
    this.app = app;
    this.client = null;
    this.config = {
      broker: 'localhost',
      port: 1883,
      deviceId: this.getDeviceID()
    };
    this.discoveredDevices = new Map();
    this.isConnected = false;
    this.loadConfig();
  }

  /**
   * Get or generate a unique device ID
   * @returns {string} - Device ID
   */
  getDeviceID() {
    const configPath = path.join(this.app.getPath('userData'), 'device_id.txt');
    try {
      if (fs.existsSync(configPath)) {
        return fs.readFileSync(configPath, 'utf8').trim();
      }
    } catch (error) {
      console.error('Error reading device ID:', error);
    }
    
    // Generate new ID
    const deviceID = `AC_SIM_${Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')}`;
    try {
      fs.writeFileSync(configPath, deviceID);
    } catch (error) {
      console.error('Error saving device ID:', error);
    }
    return deviceID;
  }

  /**
   * Load MQTT configuration from file
   */
  loadConfig() {
    const configPath = path.join(this.app.getPath('userData'), 'mqtt_config.json');
    try {
      if (fs.existsSync(configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  /**
   * Save MQTT configuration to file
   */
  saveConfig() {
    const configPath = path.join(this.app.getPath('userData'), 'mqtt_config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  /**
   * Connect to MQTT broker
   * @param {string} broker - Broker address
   * @param {number} port - Broker port
   */
  connect(broker, port) {
    if (this.client) {
      this.client.end();
    }

    if (broker) this.config.broker = broker;
    if (port) this.config.port = port;
    
    // Save config
    this.saveConfig();

    const url = `mqtt://${this.config.broker}:${this.config.port}`;
    console.log('Connecting to MQTT broker:', url);

    this.client = mqtt.connect(url, {
      clientId: `fga_simulator_${this.config.deviceId}_${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000
    });

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.isConnected = true;
      
      // Subscribe to discovery and control topics
      this.client.subscribe('ac_sim/discovery');
      this.client.subscribe('ac_sim/+/state');
      this.client.subscribe('ac_sim/broadcast/state');
      this.client.subscribe(`ac_sim/${this.config.deviceId}/control`);
      this.client.subscribe('ac_sim/all/control');
      
      // Send status update
      this.sendStatus();
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      console.error('MQTT Error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('MQTT connection closed');
      this.isConnected = false;
    });
  }

  /**
   * Handle incoming MQTT messages
   * @param {string} topic - MQTT topic
   * @param {Buffer} message - Message payload
   */
  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log('MQTT Message received:', topic, payload);

      // Handle discovery messages
      if (topic === 'ac_sim/discovery') {
        if (payload.device_id && payload.device_id !== this.config.deviceId) {
          const device = {
            deviceId: payload.device_id,
            lastSeen: new Date(),
            ipAddress: payload.ip || '',
            firmwareVer: payload.firmware_version || '',
            state: {
              power: false,
              mode: 'Auto',
              temperature: 22.0,
              fanSpeed: 'Auto',
              swing: false,
              currentTemp: 24,
              model: 1
            }
          };
          this.discoveredDevices.set(payload.device_id, device);
          console.log('Discovered device:', payload.device_id);
        }
      }

      // Handle state updates
      if (topic.startsWith('ac_sim/') && topic.endsWith('/state')) {
        const deviceId = topic.split('/')[1];
        console.log('State update for device:', deviceId, 'Payload:', payload);
        
        if (deviceId !== this.config.deviceId) {
          const device = this.discoveredDevices.get(deviceId);
          if (device) {
            console.log('Updating device state. Old state:', device.state);
            // Extract the actual state data from the payload.data field
            if (payload.data) {
              device.state = { ...device.state, ...payload.data };
            } else {
              device.state = { ...device.state, ...payload };
            }
            device.lastSeen = new Date();
            this.discoveredDevices.set(deviceId, device);
            console.log('New state:', device.state);
          } else {
            console.log('Device not found in discoveredDevices:', deviceId);
            console.log('Available devices:', Array.from(this.discoveredDevices.keys()));
          }
        } else {
          console.log('Ignoring state update for own device:', deviceId);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error, error.stack);
    }
  }

  /**
   * Send device status update
   */
  sendStatus() {
    if (this.client && this.isConnected) {
      const status = {
        device_id: this.config.deviceId,
        power: false,
        mode: 'Auto',
        temperature: 22.0,
        fanSpeed: 'Auto',
        swing: false,
        currentTemp: 24
      };
      this.client.publish(`ac_sim/${this.config.deviceId}/state`, JSON.stringify(status));
    }
  }

  /**
   * Send control command to a device
   * @param {string} deviceId - Target device ID
   * @param {string} action - Action to perform
   * @param {any} value - Value for the action
   */
  sendControlCommand(deviceId, action, value) {
    if (this.client && this.isConnected) {
      const command = { action, value };
      this.client.publish(`ac_sim/${deviceId}/control`, JSON.stringify(command));
    }
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
    }
  }

  /**
   * Get list of discovered devices
   * @returns {Array} - Array of discovered devices
   */
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get current configuration
   * @returns {object} - Configuration object
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update MQTT configuration
   * @param {string} broker - Broker address
   * @param {number} port - Broker port
   */
  updateConfig(broker, port) {
    this.config.broker = broker;
    this.config.port = port;
    this.saveConfig();
  }

  /**
   * Get connection status
   * @returns {boolean} - Connection status
   */
  getStatus() {
    return this.isConnected;
  }
}

module.exports = MQTTService;
