// FGA AC Simulator - Electron Renderer
class App {
  constructor() {
    this.discoveredDevices = [];
    this.mqttConfig = { broker: 'localhost', port: 1883, deviceId: '' };
    this.isConnected = false;
    this.showConfig = false;
    this.currentTime = new Date();
    this.configLoaded = false; // Track if config has been loaded
    this.currentPage = 'devices'; // 'devices' or 'udp-logs'
    this.udpLogs = [];
    this.udpStatus = { isRunning: false, port: 56789, logCount: 0 };
    this.lastLogCount = 0; // Track last log count to detect new logs
    
    this.init();
  }

  async init() {
    // Load config from backend only once
    await this.loadMqttConfig();
    await this.loadMqttStatus();
    await this.loadDiscoveredDevices();
    await this.loadUDPStatus();
    
    // Start intervals
    setInterval(() => {
      if (this.isConnected) {
        this.loadDiscoveredDevices();
      }
    }, 2000);
    
    setInterval(() => {
      if (this.currentPage === 'udp-logs') {
        this.loadUDPLogs();
        this.loadUDPStatus();
      }
    }, 1000);
    
    setInterval(() => {
      this.currentTime = new Date();
      this.render();
    }, 1000);
    
    // Don't call render() here, let the time interval handle it
  }

  async loadMqttConfig() {
    try {
      const config = await window.electronAPI.getMQTTConfig();
      // Only load config on initial load, don't overwrite user changes
      if (!this.configLoaded) {
        this.mqttConfig = config;
        this.configLoaded = true;
      }
    } catch (error) {
      console.error('Failed to load MQTT config:', error);
    }
  }

  async loadMqttStatus() {
    try {
      const status = await window.electronAPI.getMQTTStatus();
      this.isConnected = status;
      this.render();
    } catch (error) {
      console.error('Failed to load MQTT status:', error);
    }
  }

  async loadDiscoveredDevices() {
    try {
      const devices = await window.electronAPI.getDiscoveredDevices();
      if (devices && devices.length > 0) {
        this.discoveredDevices = devices.sort((a, b) => 
          a.deviceId.localeCompare(b.deviceId)
        );
      } else {
        this.discoveredDevices = [];
      }
      this.render();
    } catch (error) {
      console.error('Failed to load discovered devices:', error);
    }
  }

  async loadUDPStatus() {
    try {
      const status = await window.electronAPI.getUDPStatus();
      this.udpStatus = status;
    } catch (error) {
      console.error('Failed to load UDP status:', error);
    }
  }

  async loadUDPLogs() {
    try {
      const logs = await window.electronAPI.getUDPLogs();
      this.udpLogs = logs;
      
      // If on UDP logs page, update only the logs container without full re-render
      if (this.currentPage === 'udp-logs') {
        this.updateUDPLogsOnly();
      } else {
        this.render();
      }
    } catch (error) {
      console.error('Failed to load UDP logs:', error);
    }
  }

  async clearUDPLogs() {
    try {
      await window.electronAPI.clearUDPLogs();
      this.udpLogs = [];
      this.lastLogCount = 0;
      this.render();
    } catch (error) {
      console.error('Failed to clear UDP logs:', error);
    }
  }

  switchPage(page) {
    this.currentPage = page;
    if (page === 'udp-logs') {
      // Initialize lastLogCount to current log count to prevent re-rendering all logs
      this.lastLogCount = this.udpLogs.length;
      this.loadUDPLogs();
      this.loadUDPStatus();
    }
    this.render();
  }

  async handleConnectMQTT() {
    try {
      await window.electronAPI.connectMQTT(this.mqttConfig.broker, this.mqttConfig.port);
      setTimeout(() => {
        this.loadMqttStatus();
        this.loadDiscoveredDevices();
      }, 500);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }

  async handleDisconnectMQTT() {
    try {
      await window.electronAPI.disconnectMQTT();
      setTimeout(() => this.loadMqttStatus(), 500);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }

  formatTime() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[this.currentTime.getDay()];
    const hours = this.currentTime.getHours();
    const minutes = this.currentTime.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${day} ${displayHours}:${minutes}${ampm}`;
  }

  getModeIcon(mode) {
    const icons = {
      'Auto': '≈',
      'Cool': '❄',
      'Dry': '💧',
      'Fan': '🌀',
      'Heat': '🔥'
    };
    return icons[mode] || '≈';
  }

  renderDevicePanel(device) {
    const acState = device.state || {
      power: false,
      mode: 'Auto',
      temperature: 22.0,
      fanSpeed: 'Auto',
      swing: false,
      currentTemp: 24,
      model: 1
    };

    const handlePowerToggle = async () => {
      if (!this.isConnected) return;
      try {
        await window.electronAPI.setDevicePower(device.deviceId, !acState.power);
        setTimeout(() => this.loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to toggle power:', error);
      }
    };

    const handleModeClick = async () => {
      if (!this.isConnected || !acState.power) return;
      const modes = ['Auto', 'Cool', 'Dry', 'Fan', 'Heat'];
      const currentIndex = modes.indexOf(acState.mode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      try {
        await window.electronAPI.setDeviceMode(device.deviceId, nextMode);
        setTimeout(() => this.loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change mode:', error);
      }
    };

    const handleFanClick = async () => {
      if (!this.isConnected || !acState.power) return;
      const fans = ['Auto', 'Low', 'Medium', 'High'];
      const currentIndex = fans.indexOf(acState.fanSpeed);
      const nextFan = fans[(currentIndex + 1) % fans.length];
      try {
        await window.electronAPI.setDeviceFanSpeed(device.deviceId, nextFan);
        setTimeout(() => this.loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change fan speed:', error);
      }
    };

    const handleTemperatureChange = async (delta) => {
      if (!this.isConnected || !acState.power) return;
      const newTemp = acState.temperature + delta;
      if (newTemp < 16 || newTemp > 30) return;
      try {
        await window.electronAPI.setDeviceTemperature(device.deviceId, newTemp);
        setTimeout(() => this.loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change temperature:', error);
      }
    };

    const handleRoomTempChange = async (delta) => {
      if (!this.isConnected) return;
      const newTemp = acState.currentTemp + delta;
      if (newTemp < -50 || newTemp > 100) return;
      try {
        await window.electronAPI.setDeviceRoomTemperature(device.deviceId, newTemp);
        setTimeout(() => this.loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change room temperature:', error);
      }
    };

    return `
      <div class="bg-white rounded-3xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="relative bg-white px-6 py-4 flex items-center justify-between border-b">
          <h1 class="text-xl font-bold text-gray-700 tracking-wide">FUJITSU</h1>
          <div class="w-3 h-3 rounded-full ${acState.power ? 'bg-green-500' : 'bg-red-500'}"></div>
        </div>

        <!-- Main Content -->
        <div class="${acState.power ? 'bg-gradient-to-br from-green-100 to-green-200' : 'bg-gradient-to-br from-gray-100 to-gray-200'} rounded-2xl p-6 mb-6 shadow-md mx-6 mt-6">
          <!-- Title and Time -->
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-gray-700 font-semibold text-sm">
              ${device.deviceId.replace('AC_SIM_', '')}
            </h2>
            <span class="text-gray-500 text-sm">${this.formatTime()}</span>
          </div>

          <!-- Mode, Temp, Fan Display -->
          <div class="grid grid-cols-3 gap-3 mb-6">
            <!-- Mode -->
            <div class="text-center">
              <div class="text-xs text-gray-500 mb-2">Mode</div>
              <div class="bg-white rounded-xl p-3 shadow-sm">
                <div class="text-2xl mb-1">${this.getModeIcon(acState.mode)}</div>
                <div class="text-sm font-medium text-gray-700">${acState.mode}</div>
              </div>
            </div>

            <!-- Set Temperature -->
            <div class="text-center">
              <div class="text-xs text-gray-500 mb-2">Set Temp.</div>
              <div class="bg-white rounded-xl p-3 shadow-sm">
                <div class="text-4xl font-bold text-gray-800">
                  ${acState.temperature.toFixed(1)}
                </div>
                <div class="text-xs text-gray-500">°C</div>
              </div>
            </div>

            <!-- Fan -->
            <div class="text-center">
              <div class="text-xs text-gray-500 mb-2">Fan</div>
              <div class="bg-white rounded-xl p-3 shadow-sm">
                <div class="text-2xl mb-1">≈</div>
                <div class="text-sm font-medium text-gray-700">${acState.fanSpeed}</div>
              </div>
            </div>
          </div>

          <!-- Room Temperature with Controls -->
          <div class="mb-4">
            <div class="text-center mb-2">
              <span class="text-gray-600 text-xs">Room Temp. </span>
              <span class="text-gray-800 text-lg font-bold">
                ${typeof acState.currentTemp === 'number' ? acState.currentTemp.toFixed(1) : '0.0'}°C
              </span>
            </div>
            <div class="flex gap-2 justify-center">
              <button
                onclick="app.handleRoomTempChange('${device.deviceId}', -0.5)"
                ${!this.isConnected ? 'disabled' : ''}
                class="w-12 h-8 bg-blue-100 hover:bg-blue-200 rounded text-gray-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <button
                onclick="app.handleRoomTempChange('${device.deviceId}', 0.5)"
                ${!this.isConnected ? 'disabled' : ''}
                class="w-12 h-8 bg-blue-100 hover:bg-blue-200 rounded text-gray-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <!-- Bottom Icons and Buttons -->
          <div class="flex justify-between items-center">
            <div class="flex gap-3">
              <button 
                onclick="app.handleDevicePower('${device.deviceId}')"
                ${!this.isConnected ? 'disabled' : ''}
                class="w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  acState.power 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                } ${!this.isConnected ? 'opacity-50' : ''}"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div class="flex gap-2">
              <button class="px-4 py-2 bg-white rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                Status
              </button>
              <button class="px-4 py-2 bg-white rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                ☰ Menu
              </button>
            </div>
          </div>
        </div>

        <!-- Main ON/OFF Button -->
        <div class="px-6">
          <button
            onclick="app.handleDevicePower('${device.deviceId}')"
            ${!this.isConnected ? 'disabled' : ''}
            class="w-full h-16 rounded-2xl font-bold text-lg shadow-md transition-all mb-4 ${
              acState.power
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-600'
            } ${!this.isConnected ? 'opacity-50 cursor-not-allowed' : ''}"
          >
            <div class="flex items-center justify-center gap-2">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
              </svg>
              ON/OFF
            </div>
          </button>

          <!-- Temperature Controls -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <button
              onclick="app.handleDeviceTemp('${device.deviceId}', 0.5)"
              ${!this.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
              TEMP+
            </button>
            <button
              onclick="app.handleDeviceTemp('${device.deviceId}', -0.5)"
              ${!this.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              TEMP-
            </button>
          </div>

          <!-- Mode and Fan Controls -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <button
              onclick="app.handleDeviceMode('${device.deviceId}')"
              ${!this.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              MODE
            </button>
            <button
              onclick="app.handleDeviceFan('${device.deviceId}')"
              ${!this.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              FAN
            </button>
          </div>

          <!-- Swing Control -->
          <button
            onclick="app.handleDeviceSwing('${device.deviceId}')"
            ${!this.isConnected || !acState.power ? 'disabled' : ''}
            class="w-full h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            SWING
          </button>
        </div>
      </div>
    `;
  }

  // Helper methods for onclick handlers
  async handleDevicePower(deviceId) {
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected) return;
    
    const newPowerState = !device.state.power;
    try {
      await window.electronAPI.setDevicePower(deviceId, newPowerState);
      setTimeout(() => this.loadDiscoveredDevices(), 300);
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  }

  async handleDeviceMode(deviceId) {
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected || !device.state.power) return;
    
    const modes = ['Auto', 'Cool', 'Dry', 'Fan', 'Heat'];
    const currentIndex = modes.indexOf(device.state.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    try {
      await window.electronAPI.setDeviceMode(deviceId, nextMode);
      setTimeout(() => this.loadDiscoveredDevices(), 300);
    } catch (error) {
      console.error('Failed to change mode:', error);
    }
  }

  async handleDeviceFan(deviceId) {
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected || !device.state.power) return;
    
    const fans = ['Auto', 'Low', 'Medium', 'High'];
    const currentIndex = fans.indexOf(device.state.fanSpeed);
    const nextFan = fans[(currentIndex + 1) % fans.length];
    
    try {
      await window.electronAPI.setDeviceFanSpeed(deviceId, nextFan);
      setTimeout(() => this.loadDiscoveredDevices(), 300);
    } catch (error) {
      console.error('Failed to change fan speed:', error);
    }
  }

  async handleDeviceTemp(deviceId, delta) {
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected || !device.state.power) return;
    
    const newTemp = device.state.temperature + delta;
    if (newTemp < 16 || newTemp > 30) return;
    
    try {
      await window.electronAPI.setDeviceTemperature(deviceId, newTemp);
      setTimeout(() => this.loadDiscoveredDevices(), 300);
    } catch (error) {
      console.error('Failed to change temperature:', error);
    }
  }

  async handleRoomTempChange(deviceId, delta) {
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected) return;
    
    const newTemp = device.state.currentTemp + delta;
    if (newTemp < -50 || newTemp > 100) return;
    
    try {
      await window.electronAPI.setDeviceRoomTemperature(deviceId, newTemp);
      setTimeout(() => this.loadDiscoveredDevices(), 300);
    } catch (error) {
      console.error('Failed to change room temperature:', error);
    }
  }

  async handleDeviceSwing(deviceId) {
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected || !device.state.power) return;
    
    try {
      await window.electronAPI.setDeviceSwing(deviceId, !device.state.swing);
      setTimeout(() => this.loadDiscoveredDevices(), 300);
    } catch (error) {
      console.error('Failed to toggle swing:', error);
    }
  }

  render() {
    const appDiv = document.getElementById('app');
    
    // If config panel is open, don't re-render (preserve input focus)
    if (this.showConfig && document.getElementById('config-panel')) {
      // Only update non-input elements
      this.updateDynamicContent();
      return;
    }
    
    // Save scroll position for UDP logs if on that page
    const logContainer = document.getElementById('udp-log-container');
    const savedScrollTop = logContainer ? logContainer.scrollTop : 0;
    
    appDiv.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-4">
        <!-- Header Bar -->
        <div class="max-w-7xl mx-auto mb-6">
          <div class="bg-white rounded-2xl shadow-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-gray-800">FGA Simulator</h1>
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full ${this.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
                  <span class="text-sm text-gray-600">${this.isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <button onclick="app.toggleConfig()" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                  ⚙️ Config
                </button>
                <button onclick="app.${this.isConnected ? 'handleDisconnectMQTT' : 'handleConnectMQTT'}()" 
                  class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                    this.isConnected 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  }">
                  ${this.isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
            
            <!-- Page Navigation -->
            <div class="mt-4 flex gap-2 border-t pt-4">
              <button onclick="app.switchPage('devices')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  this.currentPage === 'devices' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }">
                🏠 Devices
              </button>
              <button onclick="app.switchPage('udp-logs')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  this.currentPage === 'udp-logs' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }">
                📡 UDP Logs
              </button>
            </div>

            ${this.showConfig ? `
              <div class="mt-4 p-4 bg-gray-50 rounded-lg" id="config-panel">
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Broker</label>
                    <input type="text" id="broker" 
                      class="w-full px-3 py-2 border rounded-lg text-sm" 
                      oninput="app.mqttConfig.broker = this.value" />
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Port</label>
                    <input type="number" id="port" 
                      class="w-full px-3 py-2 border rounded-lg text-sm"
                      oninput="app.mqttConfig.port = parseInt(this.value)" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <button onclick="app.saveConfig()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                    💾 Save & Connect
                  </button>
                  <button onclick="app.toggleConfig()" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Content Area -->
        <div class="max-w-7xl mx-auto">
          ${this.currentPage === 'devices' ? this.renderDevicesPage() : this.renderUDPLogsPage()}
        </div>
      </div>
    `;
    
    // Restore scroll position for UDP logs
    if (this.currentPage === 'udp-logs') {
      setTimeout(() => {
        const newLogContainer = document.getElementById('udp-log-container');
        if (newLogContainer) {
          newLogContainer.scrollTop = savedScrollTop;
        }
      }, 0);
    }
  }

  renderDevicesPage() {
    if (this.discoveredDevices.length === 0) {
      return `
        <div class="text-center py-12 text-gray-500">
          <p class="text-lg font-medium">${this.isConnected ? 'Waiting for devices to connect...' : 'Please connect to MQTT broker first'}</p>
        </div>
      `;
    }
    
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        ${this.discoveredDevices.map(device => this.renderDevicePanel(device)).join('')}
      </div>
    `;
  }

  renderUDPLogsPage() {
    return `
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold text-gray-800">UDP Logger</h2>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${this.udpStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}"></div>
              <span class="text-sm text-gray-600">Port ${this.udpStatus.port}</span>
              <span class="text-sm text-gray-500">| <span id="udp-log-count">${this.udpStatus.logCount}</span> logs</span>
            </div>
          </div>
          <button onclick="app.clearUDPLogs()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
            🗑️ Clear Logs
          </button>
        </div>
        
        <div id="udp-log-container" class="bg-gray-900 rounded-lg p-4 overflow-y-auto font-mono text-sm" style="height: calc(100vh - 280px);">
          ${this.udpLogs.length === 0 ? `
            <div class="text-center py-12 text-gray-500">
              <p>No UDP messages received yet</p>
              <p class="text-xs mt-2">Listening on UDP port ${this.udpStatus.port}</p>
            </div>
          ` : `
            ${this.udpLogs.map((log, index) => `
              <div class="mb-2 pb-2 border-b border-gray-700 last:border-b-0">
                <div class="flex items-start gap-3">
                  <span class="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">${new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span class="text-blue-400 text-xs whitespace-nowrap flex-shrink-0">${log.from}</span>
                  <span class="text-green-400 text-xs break-words flex-1">${this.escapeHtml(this.stripAnsiCodes(log.message))}</span>
                </div>
              </div>
            `).join('')}
          `}
        </div>
      </div>
    `;
  }

  stripAnsiCodes(text) {
    // Remove ANSI escape codes (color codes, etc.)
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\[\d+;\d+m/g, '').replace(/\[0m/g, '');
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  createLogElement(log) {
    // Create DOM elements directly without innerHTML to prevent flickering
    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    logDiv.style.cssText = 'margin-bottom: 0.25rem; font-family: monospace; font-size: 0.75rem; line-height: 1.5;';
    
    // Create timestamp span
    const timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'color: #6b7280; white-space: nowrap;';
    timeSpan.textContent = new Date(log.timestamp).toLocaleTimeString();
    
    // Create source span
    const sourceSpan = document.createElement('span');
    sourceSpan.style.cssText = 'color: #60a5fa; white-space: nowrap; margin-left: 0.75rem;';
    sourceSpan.textContent = log.from;
    
    // Create message span
    const messageSpan = document.createElement('span');
    messageSpan.style.cssText = 'color: #4ade80; margin-left: 0.75rem; word-break: break-word;';
    messageSpan.textContent = this.stripAnsiCodes(log.message);
    
    // Assemble
    logDiv.appendChild(timeSpan);
    logDiv.appendChild(sourceSpan);
    logDiv.appendChild(messageSpan);
    
    return logDiv;
  }

  updateUDPLogsOnly() {
    // Terminal-style update: only append new logs without touching existing DOM
    const logContainer = document.getElementById('udp-log-container');
    if (!logContainer) return;
    
    // Check if there are new logs
    const newLogCount = this.udpLogs.length;
    const hasNewLogs = newLogCount > this.lastLogCount;
    
    if (this.udpLogs.length === 0) {
      // Only update if not already showing placeholder
      if (!logContainer.querySelector('.text-center')) {
        logContainer.innerHTML = `
          <div class="text-center py-12 text-gray-500">
            <p>No UDP messages received yet</p>
            <p class="text-xs mt-2">Listening on UDP port ${this.udpStatus.port}</p>
          </div>
        `;
      }
      this.lastLogCount = 0;
    } else if (hasNewLogs) {
      // Only add new logs incrementally (logs are newest first in array)
      const newLogsCount = newLogCount - this.lastLogCount;
      const newLogs = this.udpLogs.slice(0, newLogsCount);
      
      // If container has placeholder, clear it
      if (logContainer.querySelector('.text-center')) {
        logContainer.textContent = ''; // Clear faster than innerHTML
      }
      
      // Prepend new logs to the top using DocumentFragment
      const fragment = document.createDocumentFragment();
      newLogs.reverse().forEach(log => {
        fragment.prepend(this.createLogElement(log));
      });
      
      // Insert at the beginning
      logContainer.insertBefore(fragment, logContainer.firstChild);
      
      // Limit to max 1000 logs in DOM to prevent memory issues
      while (logContainer.children.length > 1000) {
        logContainer.removeChild(logContainer.lastChild);
      }
      
      this.lastLogCount = newLogCount;
    }
    
    // Update log count in header
    const logCountElement = document.getElementById('udp-log-count');
    if (logCountElement) {
      logCountElement.textContent = this.udpStatus.logCount;
    }
  }

  updateDynamicContent() {
    // Update only the connection status and device list without re-rendering inputs
    // This is called when config panel is open to avoid losing focus
  }

  toggleConfig() {
    this.showConfig = !this.showConfig;
    this.render();
    
    // Set input values after render
    if (this.showConfig) {
      setTimeout(() => {
        const brokerInput = document.getElementById('broker');
        const portInput = document.getElementById('port');
        if (brokerInput) brokerInput.value = this.mqttConfig.broker;
        if (portInput) portInput.value = this.mqttConfig.port;
      }, 0);
    }
  }

  async saveConfig() {
    // Config is already updated via oninput, just save to backend
    try {
      await window.electronAPI.updateMQTTConfig(this.mqttConfig.broker, this.mqttConfig.port);
      console.log('Config saved:', this.mqttConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
    
    this.showConfig = false;
    this.handleConnectMQTT();
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
