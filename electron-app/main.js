const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');

// Import services
const MQTTService = require('./services/mqtt-service');
const UDPLogger = require('./services/udp-logger');
const ESP32FlasherNative = require('./services/esp32-flasher-native');
const TCPConsoleClient = require('./services/tcp-console');
const ESP32Provisioning = require('./services/esp32-provisioning');
const SerialConsole = require('./services/serial-console');
const FleetMonitoringService = require('./services/fleet-monitoring');

// Disable hardware acceleration to avoid libva errors
app.disableHardwareAcceleration();

// Global service instances
let mqttService = null;
let udpLogger = null;
let esp32Flasher = null;
let tcpConsole = null;
let provisioningService = null;
let serialConsole = null;
let fleetMonitoring = null;

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Handle new file
          }
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            // Handle open file
          }
        },
        { type: 'separator' },
        {
          label: 'Save Logs',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // Send message to renderer to save logs
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:save-logs');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        {
          label: 'Clear UDP Logs',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:clear-logs');
            }
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Devices',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            console.log('Menu: Devices clicked');
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              console.log('Sending menu:switch-page devices');
              mainWindow.webContents.send('menu:switch-page', 'devices');
            }
          }
        },
        {
          label: 'UDP Logs',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            console.log('Menu: UDP Logs clicked');
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              console.log('Sending menu:switch-page udp-logs');
              mainWindow.webContents.send('menu:switch-page', 'udp-logs');
            }
          }
        },
        {
          label: 'Serial Console',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            console.log('Menu: Serial Console clicked');
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:switch-page', 'serial-console');
            }
          }
        },
        {
          label: 'ESP32 Provisioning',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            console.log('Menu: Provisioning clicked');
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:switch-page', 'provisioning');
            }
          }
        },
        {
          label: 'Fleet Monitoring',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            console.log('Menu: Fleet Monitoring clicked');
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:switch-page', 'fleet-monitoring');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Config',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:toggle-config');
            }
          }
        },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Console',
      submenu: [
        {
          label: 'TCP Console',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:switch-page', 'tcp-console');
            }
          }
        },
        {
          label: 'Clear Console',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:clear-tcp-console');
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About FGA Simulator',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:show-about');
            }
          }
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:show-shortcuts');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://nube-io.com/docs/fga-simulator');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            require('electron').shell.openExternal('https://github.com/nube-io/fga-simulator/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'Show Help',
          accelerator: 'F1',
          click: () => {
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:show-help');
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'build', 'icon.png'),
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
    
    // Test IPC after a delay
    setTimeout(() => {
      console.log('Sending test event to renderer...');
      mainWindow.webContents.send('test-event');
      mainWindow.webContents.send('menu:switch-page', 'devices');
    }, 2000);
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

  // Forward TCP Console events to renderer
  tcpConsole.on('message', (messageData) => {
    mainWindow.webContents.send('tcp:message', messageData);
  });

  tcpConsole.on('status-change', (status) => {
    mainWindow.webContents.send('tcp:status-change', status);
  });

  tcpConsole.on('messages-cleared', () => {
    mainWindow.webContents.send('tcp:messages-cleared');
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Create application menu
  createMenu();
  
  // Initialize services
  mqttService = new MQTTService(app);
  udpLogger = new UDPLogger();
  tcpConsole = new TCPConsoleClient();
  esp32Flasher = new ESP32FlasherNative();
  provisioningService = new ESP32Provisioning();
  serialConsole = new SerialConsole();
  fleetMonitoring = new FleetMonitoringService();

  // Initialize ESP32 flasher
  esp32Flasher.initialize().catch(err => {
    console.error('Failed to initialize ESP32 flasher:', err);
  });

  // Initialize provisioning service
  provisioningService.initialize().catch(err => {
    console.error('Failed to initialize provisioning service:', err);
  });
  
  createWindow();
  
  // UDP logger starts manually via UI with port configuration
  // TCP console client connects manually via UI

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  mqttService.disconnect();
  udpLogger.stop();
  tcpConsole.disconnect();
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
  mqttService.sendControlCommand(deviceId, 'roomTemperature', temperature);
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

ipcMain.handle('udp:start', (event, port = 56789) => {
  udpLogger.start(port);
  return true;
});

ipcMain.handle('udp:stop', () => {
  udpLogger.stop();
  return true;
});

ipcMain.handle('udp:saveLogs', async (event, filePath, format, append) => {
  return await udpLogger.saveLogs(filePath, format, append);
});

ipcMain.handle('udp:exportLogsAsString', (event, format) => {
  return udpLogger.exportLogsAsString(format);
});

ipcMain.handle('udp:showSaveDialog', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Save UDP Logs',
    defaultPath: `udp-logs-${new Date().toISOString().split('T')[0]}.txt`,
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('udp:enableAutoSave', (event, filePath, format) => {
  return udpLogger.enableAutoSave(filePath, format);
});

ipcMain.handle('udp:disableAutoSave', () => {
  return udpLogger.disableAutoSave();
});

// External link handler
ipcMain.handle('open-external', (event, url) => {
  require('electron').shell.openExternal(url);
  return true;
});

// ESP32 Flasher IPC Handlers (Native)
ipcMain.handle('flasher:getSerialPorts', async () => {
  // Use Node serialport to get ports
  const { SerialPort } = require('serialport');
  try {
    const ports = await SerialPort.list();
    // Filter and format ports
    return ports
      .filter(port => {
        const path = port.path.toLowerCase();
        return !path.includes('bluetooth') && !path.match(/ttys\d+/);
      })
      .map(port => port.path);
  } catch (error) {
    console.error('Failed to list serial ports:', error);
    return [];
  }
});

ipcMain.handle('flasher:getStatus', () => {
  return esp32Flasher.getStatus();
});

ipcMain.handle('flasher:detectChip', async (event, port) => {
  try {
    return await esp32Flasher.detectChip(port);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('flasher:flashFirmware', async (event, options) => {
  try {
    // Send progress updates to renderer
    const result = await esp32Flasher.flashFirmware({
      ...options,
      onProgress: (progress) => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('flasher:progress', progress);
        }
      }
    });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('flasher:cancelFlash', () => {
  return esp32Flasher.cancelFlash();
});

ipcMain.handle('flasher:showFirmwareDialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Firmware File',
    filters: [
      { name: 'Firmware Files', extensions: ['bin'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  return result;
});

ipcMain.handle('flasher:showFolderDialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Folder Containing ESP32 Firmware Files',
    properties: ['openDirectory']
  });
  return result;
});

ipcMain.handle('flasher:scanFolder', async (event, folderPath) => {
  try {
    const discovered = esp32Flasher.scanFolderForBinFiles(folderPath);
    return { success: true, files: discovered };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('flasher:flashComplete', async (event, options) => {
  try {
    const result = await esp32Flasher.flashComplete({
      ...options,
      onProgress: (progress) => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('flasher:progress', progress);
        }
      }
    });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// TCP Console Client IPC Handlers
ipcMain.handle('tcp:getStatus', () => {
  return tcpConsole.getStatus();
});

ipcMain.handle('tcp:getMessages', () => {
  return tcpConsole.getMessages();
});

ipcMain.handle('tcp:clearMessages', () => {
  tcpConsole.clearMessages();
  return true;
});

ipcMain.handle('tcp:send', (event, message) => {
  return tcpConsole.send(message);
});

ipcMain.handle('tcp:connect', (event, host, port) => {
  tcpConsole.connect(host, port);
  return true;
});

ipcMain.handle('tcp:disconnect', () => {
  tcpConsole.disconnect();
  return true;
});

ipcMain.handle('tcp:setAutoReconnect', (event, enabled) => {
  tcpConsole.setAutoReconnect(enabled);
  return true;
});

// Serial Console IPC Handlers
ipcMain.handle('serial:getSerialPorts', async () => {
  return await serialConsole.getSerialPorts();
});

ipcMain.handle('serial:getStatus', () => {
  return serialConsole.getStatus();
});

ipcMain.handle('serial:getMessages', () => {
  return serialConsole.getMessages();
});

ipcMain.handle('serial:clearMessages', () => {
  return serialConsole.clearMessages();
});

ipcMain.handle('serial:connect', async (event, port, baudRate) => {
  try {
    // Setup message callback to send messages to renderer
    serialConsole.setMessageCallback((message) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('serial:message', message);
      }
    });
    
    return await serialConsole.connect(port, baudRate);
  } catch (error) {
    console.error('Failed to connect serial console:', error);
    throw error;
  }
});

ipcMain.handle('serial:disconnect', async () => {
  return await serialConsole.disconnect();
});

ipcMain.handle('serial:send', async (event, message) => {
  return await serialConsole.send(message);
});

// ESP32 Provisioning IPC Handlers
ipcMain.handle('provisioning:getStatus', () => {
  return provisioningService.getStatus();
});

ipcMain.handle('provisioning:getSerialPorts', async () => {
  try {
    return await provisioningService.getSerialPorts();
  } catch (error) {
    console.error('Failed to get serial ports:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:readMacAddress', async (event, port, chip) => {
  try {
    return await provisioningService.readMacAddress(port, chip);
  } catch (error) {
    console.error('Failed to read MAC address:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:generateUUIDFromMAC', (event, macAddress) => {
  return provisioningService.generateUUIDFromMAC(macAddress);
});

ipcMain.handle('provisioning:generatePSK', () => {
  return provisioningService.generatePSK();
});

ipcMain.handle('provisioning:detectChipType', async (event, port) => {
  try {
    return await provisioningService.detectChipType(port);
  } catch (error) {
    console.error('Failed to detect chip type:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:createNVSCSV', (event, globalUUID, pskSecret, caUrl, wifiSSID, wifiPassword) => {
  return provisioningService.createNVSCSV(globalUUID, pskSecret, caUrl, wifiSSID, wifiPassword);
});

ipcMain.handle('provisioning:generateNVSBinary', async (event, csvPath, size) => {
  try {
    return await provisioningService.generateNVSBinary(csvPath, size);
  } catch (error) {
    console.error('Failed to generate NVS binary:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:flashNVSBinary', async (event, port, chip, offset, binPath, baudRate) => {
  try {
    // Send progress updates to renderer
    provisioningService.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('provisioning:progress', progress);
      }
    });
    
    return await provisioningService.flashNVSBinary(port, chip, offset, binPath, baudRate);
  } catch (error) {
    console.error('Failed to flash NVS binary:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:provisionESP32', async (event, config) => {
  try {
    // Send progress updates to renderer
    provisioningService.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('provisioning:progress', progress);
      }
    });
    
    return await provisioningService.provisionESP32(config);
  } catch (error) {
    console.error('Failed to provision ESP32:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:getChipTypes', () => {
  return provisioningService.getChipTypes();
});

ipcMain.handle('provisioning:eraseFlash', async (event, port, eraseType) => {
  try {
    return await provisioningService.eraseFlash(port, eraseType);
  } catch (error) {
    console.error('Failed to erase flash:', error);
    throw error;
  }
});

ipcMain.handle('provisioning:eraseCustomRegion', async (event, port, address, size) => {
  try {
    return await provisioningService.eraseCustomRegion(port, address, size);
  } catch (error) {
    console.error('Failed to erase custom region:', error);
    throw error;
  }
});

// Fleet Monitoring IPC Handlers
ipcMain.handle('fleet:getConfig', () => {
  return fleetMonitoring.getConfig();
});

ipcMain.handle('fleet:getStatus', () => {
  return fleetMonitoring.getStatus();
});

ipcMain.handle('fleet:connect', async (event, broker, port, baseTopic) => {
  try {
    return await fleetMonitoring.connect(broker, port, baseTopic);
  } catch (error) {
    console.error('Failed to connect fleet monitoring:', error);
    throw error;
  }
});

ipcMain.handle('fleet:disconnect', async () => {
  return await fleetMonitoring.disconnect();
});

ipcMain.handle('fleet:clearMessages', () => {
  return fleetMonitoring.clearMessages();
});

ipcMain.handle('fleet:getDevices', () => {
  return fleetMonitoring.getDevices();
});