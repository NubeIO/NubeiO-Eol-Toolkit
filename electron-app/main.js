const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');

// Import services
const MQTTService = require('./services/mqtt-service');
const UDPLogger = require('./services/udp-logger');

// Disable hardware acceleration to avoid libva errors
app.disableHardwareAcceleration();

// Global service instances
let mqttService = null;
let udpLogger = null;

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
}

// App lifecycle
app.whenReady().then(() => {
  // Create application menu
  createMenu();
  
  // Initialize services
  mqttService = new MQTTService(app);
  udpLogger = new UDPLogger();
  
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

ipcMain.handle('udp:start', () => {
  udpLogger.start();
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