const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const util = require('util');

// Configure console.log to show more details
util.inspect.defaultOptions.maxArrayLength = null; // Show all array items
util.inspect.defaultOptions.depth = null; // Show all nested levels
util.inspect.defaultOptions.colors = true; // Enable colors

// Import services
const MQTTService = require('./services/mqtt-service');
const UDPLogger = require('./services/udp-logger');
const ESP32FlasherNative = require('./services/esp32-flasher-native');
const TCPConsoleClient = require('./services/tcp-console');
const ESP32Provisioning = require('./services/esp32-provisioning');
const SerialConsole = require('./services/serial-console');
const FleetMonitoringService = require('./services/fleet-monitoring');
const OpenOCDSTM32Service = require('./services/openocd-stm32');
const FactoryTestingService = require('./services/factory-testing');

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
let factoryTesting = null;

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
        {
          label: 'Factory Testing',
          accelerator: 'CmdOrCtrl+6',
          click: () => {
            console.log('Menu: Factory Testing clicked');
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('menu:switch-page', 'factory-testing');
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
          label: 'About Nube iO Toolkit',
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
  factoryTesting = new FactoryTestingService();

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

ipcMain.handle('flasher:eraseFlash', async (event, port) => {
  try {
    console.log('Erasing flash on port:', port);
    const result = await esp32Flasher.eraseFlash(port);
    return result;
  } catch (error) {
    console.error('Erase flash error:', error);
    return { success: false, error: error.message };
  }
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

// Check CA URL connectivity
ipcMain.handle('provisioning:checkCAConnection', async (event, caUrl) => {
  try {
    console.log('Checking CA connection for URL:', caUrl);
    const result = await provisioningService.checkCAConnection(caUrl);
    return { success: true, data: result };
  } catch (error) {
    console.error('CA connection check failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
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

// STM32 OpenOCD IPC Handlers
ipcMain.handle('stm32:flashDroplet', async (event, firmwarePath, version) => {
  try {
    if (version !== undefined) {
      OpenOCDSTM32Service.setVersion(version);
    }

    const mainWindow = BrowserWindow.getAllWindows()[0];

    const result = await OpenOCDSTM32Service.flashAndReadInfo(firmwarePath, (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('stm32:flash-progress', progress);
      }
    });

    if (mainWindow) {
      mainWindow.webContents.send('stm32:flash-complete', result);
    }

    return result;
  } catch (error) {
    console.error('Failed to flash STM32 droplet:', error);
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('stm32:flash-error', { error: error.message });
    }
    throw error;
  }
});

ipcMain.handle('stm32:readUID', async () => {
  try {
    const uidResult = await OpenOCDSTM32Service.readUID();
    const loraInfo = OpenOCDSTM32Service.generateLoRaID(uidResult.uid0, uidResult.uid1, uidResult.uid2);

    return {
      success: true,
      uid: {
        uid0: uidResult.uid0,
        uid1: uidResult.uid1,
        uid2: uidResult.uid2,
        uid0Hex: uidResult.uid0.toString(16).padStart(8, '0').toUpperCase(),
        uid1Hex: uidResult.uid1.toString(16).padStart(8, '0').toUpperCase(),
        uid2Hex: uidResult.uid2.toString(16).padStart(8, '0').toUpperCase()
      },
      loraID: loraInfo,
      rawOutput: uidResult.raw
    };
  } catch (error) {
    console.error('Failed to read STM32 UID:', error);
    throw error;
  }
});

ipcMain.handle('stm32:detectSTLink', async () => {
  try {
    return await OpenOCDSTM32Service.detectSTLink();
  } catch (error) {
    console.error('Failed to detect ST-Link:', error);
    return {
      success: false,
      detected: false,
      error: error.message
    };
  }
});

ipcMain.handle('stm32:detectSTLinkOnce', async (event, speed) => {
  try {
    const result = await OpenOCDSTM32Service.detectSTLinkOnce(speed);
    return result;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('stm32:getStatus', () => {
  return OpenOCDSTM32Service.getStatus();
});

ipcMain.handle('stm32:disconnectCubeCLI', async () => {
  try {
    return await OpenOCDSTM32Service.disconnectCubeCLI();
  } catch (error) {
    console.error('disconnectCubeCLI failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stm32:setVersion', (event, version) => {
  OpenOCDSTM32Service.setVersion(version);
  return { success: true, version };
});

ipcMain.handle('stm32:disconnect', async () => {
  try {
    // Try OpenOCD disconnect first
    const openocdRes = await OpenOCDSTM32Service.disconnectSTLink().catch(e => ({ success: false, error: e.message }));
    // Also attempt to disconnect CubeProgrammer CLI to fully release the ST-Link
    const cubeRes = await OpenOCDSTM32Service.disconnectCubeCLI().catch(() => ({ success: false }));

    return {
      openocd: openocdRes,
      cubecli: cubeRes
    };
  } catch (error) {
    console.error('Failed to disconnect ST-Link:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Force release: kill any lingering OpenOCD or STM32_Programmer_CLI processes
ipcMain.handle('stm32:forceRelease', async () => {
  try {
    const results = {};

    // First try graceful disconnects so ST-Link is released cleanly
    try {
      results.openocd_disconnect = await OpenOCDSTM32Service.disconnectSTLink().catch(e => ({ success: false, error: e.message }));
    } catch (e) {
      results.openocd_disconnect = { success: false, error: e.message };
    }

    try {
      results.cubecli_disconnect = await OpenOCDSTM32Service.disconnectCubeCLI().catch(e => ({ success: false, error: e.message }));
    } catch (e) {
      results.cubecli_disconnect = { success: false, error: e.message };
    }

    // If graceful disconnects indicate success, return early and let UI refresh
    const openOk = results.openocd_disconnect && results.openocd_disconnect.success;
    const cliOk = results.cubecli_disconnect && results.cubecli_disconnect.success;
    if (openOk || cliOk) {
      // Append to diagnostics and return tails
      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, 'cubecli-diagnostics.log');
        fs.appendFileSync(logPath, `\n=== FORCE RELEASE (graceful) (${new Date().toISOString()}) ===\n` + JSON.stringify(results, null, 2) + '\n');
      } catch (e) {}

      try {
        const fs = require('fs');
        const path = require('path');
        const readTail = (p, lines = 200) => {
          try {
            if (!fs.existsSync(p)) return '';
            const content = fs.readFileSync(p, 'utf8');
            const arr = content.split(/\r?\n/);
            return arr.slice(-lines).join('\n');
          } catch (e) { return ''; }
        };

        const pathCube = require('path').join(__dirname, 'cubecli-diagnostics.log');
        const pathOpen = require('path').join(__dirname, 'openocd-diagnostics.log');
        const tailCube = readTail(pathCube, 200);
        const tailOpen = readTail(pathOpen, 200);
        return { success: true, results, logTailCube: tailCube, logTailOpenOCD: tailOpen };
      } catch (e) {
        return { success: true, results };
      }
    }

    // If graceful disconnect did not succeed, perform force kills
    // Try to kill OpenOCD
    try {
      const { spawnSync } = require('child_process');
      if (process.platform === 'win32') {
        const kill = spawnSync('taskkill', ['/F', '/IM', 'openocd.exe']);
        results.openocd_kill = { status: kill.status, stdout: kill.stdout ? kill.stdout.toString() : '', stderr: kill.stderr ? kill.stderr.toString() : '' };
      } else {
        const kill = spawnSync('pkill', ['-f', 'openocd']);
        results.openocd_kill = { status: kill.status, stdout: kill.stdout ? kill.stdout.toString() : '', stderr: kill.stderr ? kill.stderr.toString() : '' };
      }
    } catch (e) {
      results.openocd_kill = { error: e.message };
    }

    // Try to kill STM32_Programmer_CLI
    try {
      const { spawnSync } = require('child_process');
      if (process.platform === 'win32') {
        const killCli = spawnSync('taskkill', ['/F', '/IM', 'STM32_Programmer_CLI.exe']);
        results.cubecli_kill = { status: killCli.status, stdout: killCli.stdout ? killCli.stdout.toString() : '', stderr: killCli.stderr ? killCli.stderr.toString() : '' };
      } else {
        const killCli = spawnSync('pkill', ['-f', 'STM32_Programmer_CLI']);
        results.cubecli_kill = { status: killCli.status, stdout: killCli.stdout ? killCli.stdout.toString() : '', stderr: killCli.stderr ? killCli.stderr.toString() : '' };
      }
    } catch (e) {
      results.cubecli_kill = { error: e.message };
    }

    // Append to diagnostics
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, 'cubecli-diagnostics.log');
      fs.appendFileSync(logPath, `\n=== FORCE RELEASE (${new Date().toISOString()}) ===\n` + JSON.stringify(results, null, 2) + '\n');
    } catch (e) {}

    // Read last lines from diagnostics to help UI show immediate feedback
    try {
      const fs = require('fs');
      const path = require('path');
      const readTail = (p, lines = 200) => {
        try {
          if (!fs.existsSync(p)) return '';
          const content = fs.readFileSync(p, 'utf8');
          const arr = content.split(/\r?\n/);
          return arr.slice(-lines).join('\n');
        } catch (e) {
          return '';
        }
      };

      const pathCube = path.join(__dirname, 'cubecli-diagnostics.log');
      const pathOpen = path.join(__dirname, 'openocd-diagnostics.log');

      const tailCube = readTail(pathCube, 200);
      const tailOpen = readTail(pathOpen, 200);

      return { success: true, results, logTailCube: tailCube, logTailOpenOCD: tailOpen };
    } catch (e) {
      return { success: true, results };
    }
  } catch (error) {
    console.error('Force release failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('dialog:openFile', async (event, options) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    throw new Error('No main window found');
  }

  return await dialog.showOpenDialog(mainWindow, options);
});

// STM32 Device Type Management
ipcMain.handle('stm32:setDeviceType', async (event, deviceType) => {
  try {
    return OpenOCDSTM32Service.setDeviceType(deviceType);
  } catch (error) {
    console.error('Failed to set device type:', error);
    throw error;
  }
});

ipcMain.handle('stm32:getDeviceTypes', () => {
  return OpenOCDSTM32Service.getDeviceTypes();
});

ipcMain.handle('stm32:getCurrentDeviceType', () => {
  return {
    success: true,
    deviceType: OpenOCDSTM32Service.currentDeviceType
  };
});

// Factory Testing IPC Handlers
ipcMain.handle('factoryTesting:connect', async (event, port, baudRate) => {
  try {
    return await factoryTesting.connect(port, baudRate);
  } catch (error) {
    console.error('Failed to connect factory testing:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:disconnect', async () => {
  try {
    return await factoryTesting.disconnect();
  } catch (error) {
    console.error('Failed to disconnect factory testing:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:readDeviceInfo', async () => {
  try {
    return await factoryTesting.readDeviceInfo();
  } catch (error) {
    console.error('Failed to read device info:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:runFactoryTests', async (event, device) => {
  try {
    // Setup progress callback
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('factoryTesting:progress', progress);
      }
    });

    return await factoryTesting.runFactoryTests(device);
  } catch (error) {
    console.error('Failed to run factory tests:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:saveResults', async (event, version, device, deviceInfo, testResults, preTesting) => {
  try {
    return await factoryTesting.saveResults(version, device, deviceInfo, testResults, preTesting);
  } catch (error) {
    console.error('Failed to save factory test results:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:getStatus', () => {
  return factoryTesting.getStatus();
});

// ACB-M specific test handlers
ipcMain.handle('factoryTesting:acb:wifi', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbWifiTest();
  } catch (error) {
    console.error('ACB WiFi test failed:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:acb:rs485', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbRs485Test();
  } catch (error) {
    console.error('ACB RS485 test failed:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:acb:rs485_2', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbRs485_2Test();
  } catch (error) {
    console.error('ACB RS485-2 test failed:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:acb:eth', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbEthTest();
  } catch (error) {
    console.error('ACB ETH test failed:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:acb:lora', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbLoraTest();
  } catch (error) {
    console.error('ACB LoRa test failed:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:acb:rtc', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbRtcTest();
  } catch (error) {
    console.error('ACB RTC test failed:', error);
    throw error;
  }
});

ipcMain.handle('factoryTesting:acb:full', async (event) => {
  try {
    factoryTesting.setProgressCallback((progress) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.webContents.send('factoryTesting:progress', progress);
    });
    return await factoryTesting.acbFullTest();
  } catch (error) {
    console.error('ACB Full test failed:', error);
    throw error;
  }
});

// Two-step connect: probe connect-only and return working token
ipcMain.handle('stm32:probeConnect', async () => {
  try {
    return await OpenOCDSTM32Service.probeConnect_via_CubeCLI();
  } catch (error) {
    console.error('probeConnect failed:', error);
    return { success: false, error: error.message };
  }
});

// Flash using connect token (used after a successful probeConnect and user released RESET)
ipcMain.handle('stm32:flashWithToken', async (event, connectToken, firmwarePath, version) => {
  try {
    if (version !== undefined) {
      OpenOCDSTM32Service.setVersion(version);
    }

    const mainWindow = BrowserWindow.getAllWindows()[0];

    const result = await OpenOCDSTM32Service.flashWithToken_via_CubeCLI(connectToken, firmwarePath, (progress) => {
      if (mainWindow) mainWindow.webContents.send('stm32:flash-progress', progress);
    });

    if (mainWindow) mainWindow.webContents.send('stm32:flash-complete', result);
    return result;
  } catch (error) {
    console.error('flashWithToken failed:', error);
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) mainWindow.webContents.send('stm32:flash-error', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Abort backend processes immediately (force kill)
ipcMain.handle('stm32:abort', async () => {
  try {
    const res = await OpenOCDSTM32Service.abort();
    return res;
  } catch (e) {
    console.error('stm32:abort failed:', e);
    return { success: false, error: e.message };
  }
});