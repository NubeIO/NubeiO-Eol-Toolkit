const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // MQTT methods
  getMQTTConfig: () => ipcRenderer.invoke('mqtt:getConfig'),
  updateMQTTConfig: (broker, port) => ipcRenderer.invoke('mqtt:updateConfig', broker, port),
  getMQTTStatus: () => ipcRenderer.invoke('mqtt:getStatus'),
  connectMQTT: () => ipcRenderer.invoke('mqtt:connect'),
  disconnectMQTT: () => ipcRenderer.invoke('mqtt:disconnect'),
  getDiscoveredDevices: () => ipcRenderer.invoke('mqtt:getDiscoveredDevices'),

  // Device control methods
  setDevicePower: (deviceId, power) => ipcRenderer.invoke('device:setPower', deviceId, power),
  setDeviceMode: (deviceId, mode) => ipcRenderer.invoke('device:setMode', deviceId, mode),
  setDeviceTemperature: (deviceId, temperature) => ipcRenderer.invoke('device:setTemperature', deviceId, temperature),
  setDeviceFanSpeed: (deviceId, fanSpeed) => ipcRenderer.invoke('device:setFanSpeed', deviceId, fanSpeed),
  setDeviceRoomTemperature: (deviceId, temperature) => ipcRenderer.invoke('device:setRoomTemperature', deviceId, temperature),

  // UDP Logger methods
  getUDPStatus: () => ipcRenderer.invoke('udp:getStatus'),
  getUDPLogs: () => ipcRenderer.invoke('udp:getLogs'),
  clearUDPLogs: () => ipcRenderer.invoke('udp:clearLogs'),
  startUDPLogger: (port) => ipcRenderer.invoke('udp:start', port),
  stopUDPLogger: () => ipcRenderer.invoke('udp:stop'),
  startUDP: () => ipcRenderer.invoke('udp:start'), // Legacy support
  stopUDP: () => ipcRenderer.invoke('udp:stop'), // Legacy support
  saveUDPLogs: (filePath, format, append) => ipcRenderer.invoke('udp:saveLogs', filePath, format, append),
  exportUDPLogsAsString: (format) => ipcRenderer.invoke('udp:exportLogsAsString', format),
  showSaveDialog: () => ipcRenderer.invoke('udp:showSaveDialog'),
  enableAutoSave: (filePath, format) => ipcRenderer.invoke('udp:enableAutoSave', filePath, format),
  disableAutoSave: () => ipcRenderer.invoke('udp:disableAutoSave'),

  // Menu event handling
  onMenuEvent: (event, callback) => {
    ipcRenderer.on(event, (event, ...args) => callback(...args));
  },

  // Remove menu event listeners
  removeMenuEvent: (event) => {
    ipcRenderer.removeAllListeners(event);
  },

  // External link opening
  openExternal: (url) => {
    ipcRenderer.invoke('open-external', url);
  },

  // System information
  getSystemInfo: () => ({
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    platform: process.platform,
    arch: process.arch
  }),

  // TCP Console Client methods
  getTCPStatus: () => ipcRenderer.invoke('tcp:getStatus'),
  getTCPMessages: () => ipcRenderer.invoke('tcp:getMessages'),
  clearTCPMessages: () => ipcRenderer.invoke('tcp:clearMessages'),
  sendTCP: (message) => ipcRenderer.invoke('tcp:send', message),
  connectTCP: (host, port) => ipcRenderer.invoke('tcp:connect', host, port),
  disconnectTCP: () => ipcRenderer.invoke('tcp:disconnect'),
  setTCPAutoReconnect: (enabled) => ipcRenderer.invoke('tcp:setAutoReconnect', enabled),

  // Serial Console methods
  getSerialConsoleStatus: () => ipcRenderer.invoke('serial:getStatus'),
  getSerialConsoleMessages: () => ipcRenderer.invoke('serial:getMessages'),
  clearSerialConsoleMessages: () => ipcRenderer.invoke('serial:clearMessages'),
  connectSerialConsole: (port, baudRate) => ipcRenderer.invoke('serial:connect', port, baudRate),
  disconnectSerialConsole: () => ipcRenderer.invoke('serial:disconnect'),
  sendSerialConsoleMessage: (message) => ipcRenderer.invoke('serial:send', message),
  onSerialMessage: (callback) => {
    ipcRenderer.on('serial:message', (event, message) => callback(message));
  },

  // ESP32 Flasher methods
  getSerialPorts: () => ipcRenderer.invoke('flasher:getSerialPorts'),
  getFlasherStatus: () => ipcRenderer.invoke('flasher:getStatus'),
  detectChip: (port) => ipcRenderer.invoke('flasher:detectChip', port),
  flashFirmware: (options) => ipcRenderer.invoke('flasher:flashFirmware', options),
  flashComplete: (options) => ipcRenderer.invoke('flasher:flashComplete', options),
  cancelFlash: () => ipcRenderer.invoke('flasher:cancelFlash'),
  eraseFlash: (port) => ipcRenderer.invoke('flasher:eraseFlash', port),
  showFirmwareDialog: () => ipcRenderer.invoke('flasher:showFirmwareDialog'),
  showFolderDialog: () => ipcRenderer.invoke('flasher:showFolderDialog'),
  scanFolder: (folderPath) => ipcRenderer.invoke('flasher:scanFolder', folderPath),
  onFlasherProgress: (callback) => {
    ipcRenderer.on('flasher:progress', (event, progress) => callback(progress));
  },

  // STM32 OpenOCD methods
  detectSTM32: () => ipcRenderer.invoke('stm32:detectSTLink'),
  flashSTM32Droplet: (firmwarePath, version) => ipcRenderer.invoke('stm32:flashDroplet', firmwarePath, version),
  readSTM32UID: () => ipcRenderer.invoke('stm32:readUID'),
  disconnectSTM32: () => ipcRenderer.invoke('stm32:disconnect'),
  getSTM32Status: () => ipcRenderer.invoke('stm32:getStatus'),
  setSTM32Version: (version) => ipcRenderer.invoke('stm32:setVersion', version),

  // Device type management
  setSTM32DeviceType: (deviceType) => ipcRenderer.invoke('stm32:setDeviceType', deviceType),
  getSTM32DeviceTypes: () => ipcRenderer.invoke('stm32:getDeviceTypes'),
  getCurrentSTM32DeviceType: () => ipcRenderer.invoke('stm32:getCurrentDeviceType'),

  selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options)
});

// Expose provisioning service
contextBridge.exposeInMainWorld('provisioningService', {
  getStatus: () => ipcRenderer.invoke('provisioning:getStatus'),
  getSerialPorts: () => ipcRenderer.invoke('provisioning:getSerialPorts'),
  readMacAddress: (port, chip) => ipcRenderer.invoke('provisioning:readMacAddress', port, chip),
  generateUUIDFromMAC: (macAddress) => ipcRenderer.invoke('provisioning:generateUUIDFromMAC', macAddress),
  generatePSK: () => ipcRenderer.invoke('provisioning:generatePSK'),
  detectChipType: (port) => ipcRenderer.invoke('provisioning:detectChipType', port),
  createNVSCSV: (globalUUID, pskSecret, caUrl, wifiSSID, wifiPassword) =>
    ipcRenderer.invoke('provisioning:createNVSCSV', globalUUID, pskSecret, caUrl, wifiSSID, wifiPassword),
  generateNVSBinary: (csvPath, size) => ipcRenderer.invoke('provisioning:generateNVSBinary', csvPath, size),
  flashNVSBinary: (port, chip, offset, binPath, baudRate) =>
    ipcRenderer.invoke('provisioning:flashNVSBinary', port, chip, offset, binPath, baudRate),
  provisionESP32: (config) => ipcRenderer.invoke('provisioning:provisionESP32', config),
  checkCAConnection: (caUrl) => ipcRenderer.invoke('provisioning:checkCAConnection', caUrl),
  getChipTypes: () => ipcRenderer.invoke('provisioning:getChipTypes'),
  eraseFlash: (port, eraseType) => ipcRenderer.invoke('provisioning:eraseFlash', port, eraseType),
  eraseCustomRegion: (port, address, size) => ipcRenderer.invoke('provisioning:eraseCustomRegion', port, address, size),
  onProvisioningProgress: (callback) => {
    ipcRenderer.on('provisioning:progress', (event, progress) => callback(progress));
  }
});

// Expose Fleet Monitoring service
contextBridge.exposeInMainWorld('fleetMonitoringAPI', {
  getConfig: () => ipcRenderer.invoke('fleet:getConfig'),
  getStatus: () => ipcRenderer.invoke('fleet:getStatus'),
  connect: (broker, port, baseTopic) => ipcRenderer.invoke('fleet:connect', broker, port, baseTopic),
  disconnect: () => ipcRenderer.invoke('fleet:disconnect'),
  clearMessages: () => ipcRenderer.invoke('fleet:clearMessages'),
  getDevices: () => ipcRenderer.invoke('fleet:getDevices')
});

console.log('electronAPI exposed to window');

// Test IPC listener setup
ipcRenderer.on('test-event', () => {
  console.log('Preload: Test event received in preload.js');
});