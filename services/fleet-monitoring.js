/**
 * Fleet Monitoring Service
 * Monitors FGA-Gen2-Fw devices via MQTT
 */

const mqtt = require('mqtt');

class FleetMonitoringService {
  constructor() {
    this.client = null;
    this.config = {
      broker: '113.160.225.31',
      port: 1884,
      baseTopic: 'nube-io/hvac/logs/#'
    };
    this.isConnected = false;
    this.devices = new Map(); // Map of device_id -> device info
    this.messages = []; // Recent messages
    this.maxMessages = 500;
  }

  /**
   * Connect to MQTT broker
   */
  connect(broker, port, baseTopic) {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        return resolve({ success: true, message: 'Already connected' });
      }

      this.config = { broker, port, baseTopic };
      const brokerUrl = `mqtt://${broker}:${port}`;

      console.log(`Fleet Monitoring: Connecting to ${brokerUrl}`);

      this.client = mqtt.connect(brokerUrl, {
        clientId: `fleet_monitor_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: 5000,
        port: parseInt(port), // Explicitly set port to prevent port shifting
        host: broker,
        keepalive: 60,
        connectTimeout: 10000
      });

      this.client.on('connect', () => {
        console.log('Fleet Monitoring: Connected to MQTT broker');
        this.isConnected = true;

        // Subscribe to topic
        this.client.subscribe(baseTopic, (err) => {
          if (err) {
            console.error('Fleet Monitoring: Subscription error:', err);
            reject(new Error(`Subscription failed: ${err.message}`));
          } else {
            console.log(`Fleet Monitoring: Subscribed to ${baseTopic}`);
            resolve({ success: true, message: 'Connected and subscribed' });
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload);
      });

      this.client.on('error', (error) => {
        console.error('Fleet Monitoring: MQTT error:', error);
        console.error('  → Attempted connection to:', error.address, ':', error.port);
        if (!this.isConnected) {
          reject(new Error(`Connection failed: ${error.message}`));
        }
      });

      this.client.on('reconnect', () => {
        console.log(`Fleet Monitoring: Reconnecting to ${broker}:${port}...`);
      });

      this.client.on('close', () => {
        console.log('Fleet Monitoring: Connection closed');
        this.isConnected = false;
      });

      this.client.on('offline', () => {
        console.log('Fleet Monitoring: Client offline');
        this.isConnected = false;
      });
    });
  }

  /**
   * Handle incoming MQTT message
   */
  handleMessage(topic, payload) {
    try {
      // Parse topic: nube-io/hvac/logs/{client_id}/{environment}/{level}
      const parts = topic.split('/');
      
      // Check if topic matches expected format (nube-io/hvac/logs/...)
      if (parts.length < 5 || parts[0] !== 'nube-io' || parts[1] !== 'hvac' || parts[2] !== 'logs') {
        // Silently ignore topics that don't match our format (other MQTT traffic)
        return;
      }

      const clientId = parts[3];
      const environment = parts[4];
      const level = parts[5] || 'INFO';

      // Parse JSON payload
      let data = {};
      try {
        data = JSON.parse(payload.toString());
      } catch (e) {
        // If not JSON, treat as plain text
        data = { message: payload.toString() };
      }

      const message = {
        timestamp: data.timestamp || new Date().toISOString(),
        clientId: clientId,
        environment: environment,
        level: level,
        tag: data.tag || '',
        message: data.message || payload.toString(),
        topic: topic
      };

      // Update device info
      if (!this.devices.has(clientId)) {
        this.devices.set(clientId, {
          clientId: clientId,
          environment: environment,
          lastSeen: message.timestamp,
          messageCount: 0,
          firstSeen: message.timestamp
        });
      }

      const device = this.devices.get(clientId);
      device.lastSeen = message.timestamp;
      device.messageCount++;
      device.environment = environment; // Update if changed

      // Add message to list
      this.messages.push(message);

      // Limit message count
      if (this.messages.length > this.maxMessages) {
        this.messages.shift();
      }

      console.log(`Fleet Monitoring: [${clientId}] ${level}: ${message.message.substring(0, 100)}`);
    } catch (error) {
      console.error('Fleet Monitoring: Error handling message:', error);
    }
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      return new Promise((resolve) => {
        this.client.end(() => {
          this.isConnected = false;
          this.client = null;
          console.log('Fleet Monitoring: Disconnected');
          resolve({ success: true });
        });
      });
    }
    return { success: true, message: 'Not connected' };
  }

  /**
   * Get current status
   */
  getStatus() {
    const devicesObj = {};
    this.devices.forEach((device, id) => {
      devicesObj[id] = device;
    });

    return {
      isConnected: this.isConnected,
      broker: this.config.broker,
      port: this.config.port,
      baseTopic: this.config.baseTopic,
      devices: devicesObj,
      deviceCount: this.devices.size,
      messageCount: this.messages.length,
      messages: this.messages
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Clear messages
   */
  clearMessages() {
    this.messages = [];
    return { success: true };
  }

  /**
   * Get devices list
   */
  getDevices() {
    const devicesArray = [];
    this.devices.forEach((device) => {
      devicesArray.push(device);
    });
    return devicesArray;
  }
}

module.exports = FleetMonitoringService;

