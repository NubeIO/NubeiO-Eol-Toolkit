const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mqtt = require('mqtt');
const fs = require('fs');
const dgram = require('dgram');

// Disable hardware acceleration to avoid libva errors
app.disableHardwareAcceleration();

// MQTT Service
class MQTTService {
  constructor() {
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

  getDeviceID() {
    const configPath = path.join(app.getPath('userData'), 'device_id.txt');
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

  loadConfig() {
    const configPath = path.join(app.getPath('userData'), 'mqtt_config.json');
    try {
      if (fs.existsSync(configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  saveConfig() {
    const configPath = path.join(app.getPath('userData'), 'mqtt_config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

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

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());

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
        if (deviceId !== this.config.deviceId) {
          const device = this.discoveredDevices.get(deviceId);
          if (device) {
            device.state = { ...device.state, ...payload };
            device.lastSeen = new Date();
            this.discoveredDevices.set(deviceId, device);
          }
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

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

  sendControlCommand(deviceId, action, value) {
    if (this.client && this.isConnected) {
      const command = { action, value };
      this.client.publish(`ac_sim/${deviceId}/control`, JSON.stringify(command));
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
    }
  }

  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  getConfig() {
    return this.config;
  }

  updateConfig(broker, port) {
    this.config.broker = broker;
    this.config.port = port;
    this.saveConfig();
  }

  getStatus() {
    return this.isConnected;
  }
}

// UDP Logger Service
class UDPLogger {
  constructor() {
    this.server = null;
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs
    this.isRunning = false;
    this.port = 56789;
  }

  start() {
    if (this.isRunning) return;

    this.server = dgram.createSocket('udp4');

    this.server.on('error', (err) => {
      console.error('UDP Server error:', err);
      this.isRunning = false;
    });

    this.server.on('message', (msg, rinfo) => {
      const log = {
        timestamp: new Date().toISOString(),
        message: msg.toString(),
        from: `${rinfo.address}:${rinfo.port}`,
        size: rinfo.size
      };
      
      this.logs.unshift(log); // Add to beginning
      if (this.logs.length > this.maxLogs) {
        this.logs.pop(); // Remove oldest
      }
      
      console.log(`UDP [${log.from}]: ${log.message}`);
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`UDP Logger listening on ${address.address}:${address.port}`);
      this.isRunning = true;
    });

    this.server.bind(this.port);
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.isRunning = false;
      console.log('UDP Logger stopped');
    }
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      logCount: this.logs.length
    };
  }
}

// Global service instances
const mqttService = new MQTTService();
const udpLogger = new UDPLogger();

// Create main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window is ready and visible');
  });

  // Load the HTML file
  const indexPath = path.join(__dirname, 'renderer', 'index.html');
  console.log('Loading file:', indexPath);
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('Failed to load file:', err);
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  
  // Start UDP logger automatically
  udpLogger.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  mqttService.disconnect();
  udpLogger.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('mqtt:getConfig', () => {
  return mqttService.getConfig();
});

ipcMain.handle('mqtt:updateConfig', (event, broker, port) => {
  mqttService.updateConfig(broker, port);
  return true;
});

ipcMain.handle('mqtt:getStatus', () => {
  return mqttService.getStatus();
});

ipcMain.handle('mqtt:connect', () => {
  mqttService.connect();
  return true;
});

ipcMain.handle('mqtt:disconnect', () => {
  mqttService.disconnect();
  return true;
});

ipcMain.handle('mqtt:getDiscoveredDevices', () => {
  return mqttService.getDiscoveredDevices();
});

ipcMain.handle('device:setPower', (event, deviceId, power) => {
  mqttService.sendControlCommand(deviceId, 'power', power);
  return true;
});

ipcMain.handle('device:setMode', (event, deviceId, mode) => {
  mqttService.sendControlCommand(deviceId, 'mode', mode);
  return true;
});

ipcMain.handle('device:setTemperature', (event, deviceId, temperature) => {
  mqttService.sendControlCommand(deviceId, 'temperature', temperature);
  return true;
});

ipcMain.handle('device:setFanSpeed', (event, deviceId, fanSpeed) => {
  mqttService.sendControlCommand(deviceId, 'fan_speed', fanSpeed);
  return true;
});

ipcMain.handle('device:setRoomTemperature', (event, deviceId, temperature) => {
  mqttService.sendControlCommand(deviceId, 'room_temperature', temperature);
  return true;
});

// UDP Logger IPC Handlers
ipcMain.handle('udp:getStatus', () => {
  return udpLogger.getStatus();
});

ipcMain.handle('udp:getLogs', () => {
  return udpLogger.getLogs();
});

ipcMain.handle('udp:clearLogs', () => {
  udpLogger.clearLogs();
  return true;
});

ipcMain.handle('udp:start', () => {
  udpLogger.start();
  return true;
});

ipcMain.handle('udp:stop', () => {
  udpLogger.stop();
  return true;
});