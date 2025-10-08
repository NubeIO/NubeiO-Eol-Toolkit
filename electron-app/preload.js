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
  startUDP: () => ipcRenderer.invoke('udp:start'),
  stopUDP: () => ipcRenderer.invoke('udp:stop'),
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
  
  // ESP32 Flasher methods
  getSerialPorts: () => ipcRenderer.invoke('flasher:getSerialPorts'),
  getFlasherStatus: () => ipcRenderer.invoke('flasher:getStatus'),
  verifyFirmware: (filePath) => ipcRenderer.invoke('flasher:verifyFirmware', filePath),
  flashFirmware: (options) => ipcRenderer.invoke('flasher:flashFirmware', options),
  cancelFlash: () => ipcRenderer.invoke('flasher:cancelFlash'),
  showFirmwareDialog: () => ipcRenderer.invoke('flasher:showFirmwareDialog')
});

console.log('electronAPI exposed to window');

// Test IPC listener setup
ipcRenderer.on('test-event', () => {
  console.log('Preload: Test event received in preload.js');
});