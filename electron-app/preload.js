const { contextBridge, ipcRenderer } = require('electron');

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
  stopUDP: () => ipcRenderer.invoke('udp:stop')
});