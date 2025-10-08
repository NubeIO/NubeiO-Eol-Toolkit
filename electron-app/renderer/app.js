// FGA AC Simulator - Electron Renderer
class App {
  constructor() {
    this.discoveredDevices = [];
    this.mqttConfig = { broker: 'localhost', port: 1883, deviceId: '' };
    this.isConnected = false;
    this.showConfig = false;
    this.currentTime = new Date();
    
    // Initialize modules
    this.helpModule = new HelpModule(this);
    this.configLoaded = false; // Track if config has been loaded
    this.features = {}; // Feature toggles
    this.currentPage = 'devices'; // 'devices', 'udp-logs', 'tcp-console', or 'esp32-flasher'
    this.flasherStatus = { isFlashing: false, hasProcess: false, portsAvailable: 0 };
    this.serialPorts = [];
    this.selectedPort = '';
    this.selectedFirmware = '';
    this.flashProgress = 0;
    this.flashStage = '';
    this.udpLogs = [];
    this.udpStatus = { isRunning: false, port: 56789, logCount: 0 };
    this.lastLogCount = 0; // Track last log count to detect new logs
    
    this.init();
  }

  async init() {
    // Load config from backend only once
    await this.loadFeatures();
    await this.loadMqttConfig();
    await this.loadMqttStatus();
    await this.loadDiscoveredDevices();
    await this.loadUDPStatus();
    
    // Initialize TCP Console module
    await tcpConsole.init();
    
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
    
    // Setup menu event listeners after a short delay to ensure electronAPI is ready
    setTimeout(() => {
      this.setupMenuListeners();
    }, 100);
  }

  setupMenuListeners() {
    // Listen for menu events from main process
    if (window.electronAPI) {
      console.log('Setting up menu listeners...');
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('onMenuEvent available:', typeof window.electronAPI.onMenuEvent);
      
      // Test if IPC is working at all
      try {
        window.electronAPI.onMenuEvent('test-event', () => {
          console.log('Test event received!');
        });
        console.log('Test event listener registered');
      } catch (error) {
        console.error('Error setting up test event listener:', error);
      }
      
      // Menu events
      window.electronAPI.onMenuEvent('menu:show-about', () => {
        console.log('Menu: Show About');
        this.helpModule.showAbout();
      });
      
      window.electronAPI.onMenuEvent('menu:show-shortcuts', () => {
        console.log('Menu: Show Shortcuts');
        this.helpModule.showKeyboardShortcuts();
      });
      
      window.electronAPI.onMenuEvent('menu:show-help', () => {
        console.log('Menu: Show Help');
        this.helpModule.toggleHelpMenu();
      });
      
      window.electronAPI.onMenuEvent('menu:switch-page', (page) => {
        console.log('Menu: Switch Page to', page);
        this.switchPage(page);
      });
      
      window.electronAPI.onMenuEvent('menu:toggle-config', () => {
        console.log('Menu: Toggle Config');
        this.toggleConfig();
      });
      
      window.electronAPI.onMenuEvent('menu:save-logs', () => {
        console.log('Menu: Save Logs');
        if (this.currentPage === 'udp-logs') {
          this.saveUDPLogs(false);
        }
      });
      
      window.electronAPI.onMenuEvent('menu:clear-logs', () => {
        console.log('Menu: Clear Logs');
        if (this.currentPage === 'udp-logs') {
          this.clearUDPLogs();
        }
      });
      
      console.log('All menu listeners registered');
    } else {
      console.log('electronAPI not available');
    }
  }

  async loadFeatures() {
    try {
      const response = await fetch('./config/features.json');
      this.features = await response.json();
      console.log('Features loaded:', this.features);
    } catch (error) {
      console.error('Failed to load features:', error);
      // Default to all features enabled if config not found
      this.features = {
        esp32Flasher: { enabled: true },
        udpLogger: { enabled: true },
        tcpConsole: { enabled: true }
      };
    }
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

  async saveUDPLogs(append = false) {
    try {
      // Check if there are logs to save
      if (this.udpStatus.logCount === 0) {
        alert('No logs to save');
        return;
      }

      // Show save dialog
      const dialogResult = await window.electronAPI.showSaveDialog();
      
      if (dialogResult.canceled) {
        console.log('Save canceled by user');
        return;
      }
      
      // Get file extension to determine format
      const filePath = dialogResult.filePath;
      const ext = filePath.split('.').pop().toLowerCase();
      let format = 'txt';
      
      if (ext === 'json') format = 'json';
      else if (ext === 'csv') format = 'csv';
      
      // Save logs with append option
      const saveResult = await window.electronAPI.saveUDPLogs(filePath, format, append);
      
      if (saveResult.success) {
        const action = append ? 'appended' : 'saved';
        alert(`✅ Successfully ${action} ${saveResult.logCount} logs to:\n${saveResult.filePath}`);
      } else {
        alert(`❌ Failed to save logs:\n${saveResult.message}`);
      }
    } catch (error) {
      console.error('Error saving logs:', error);
      alert(`❌ Error: ${error.message}`);
    }
  }

  async toggleAutoSave() {
    try {
      if (this.udpStatus.autoSaveEnabled) {
        // Disable auto-save
        const result = await window.electronAPI.disableAutoSave();
        if (result.success) {
          alert(`✅ Auto-save stopped.\nLogs saved to: ${result.filePath}`);
          await this.loadUDPStatus();
          this.render();
        } else {
          alert(`❌ Failed to stop auto-save:\n${result.message}`);
        }
      } else {
        // Enable auto-save - show dialog to choose file
        const dialogResult = await window.electronAPI.showSaveDialog();
        
        if (dialogResult.canceled) {
          console.log('Auto-save canceled by user');
          return;
        }
        
        // Get file extension to determine format
        const filePath = dialogResult.filePath;
        const ext = filePath.split('.').pop().toLowerCase();
        let format = 'txt';
        
        if (ext === 'json') format = 'json';
        else if (ext === 'csv') format = 'csv';
        
        // Enable auto-save
        const result = await window.electronAPI.enableAutoSave(filePath, format);
        
        if (result.success) {
          alert(`✅ Real-time auto-save enabled!\n\nAll new logs will be automatically saved to:\n${result.filePath}\n\nFormat: ${format.toUpperCase()}`);
          await this.loadUDPStatus();
          this.render();
        } else {
          alert(`❌ Failed to enable auto-save:\n${result.message}`);
        }
      }
    } catch (error) {
      console.error('Error toggling auto-save:', error);
      alert(`❌ Error: ${error.message}`);
    }
  }

  switchPage(page) {
    console.log('Switching to page:', page);
    this.currentPage = page;
    if (page === 'udp-logs') {
      // Initialize lastLogCount to current log count to prevent re-rendering all logs
      this.lastLogCount = this.udpLogs.length;
      this.loadUDPLogs();
      this.loadUDPStatus();
    } else if (page === 'tcp-console') {
      tcpConsole.showConsole = true;
    } else if (page === 'esp32-flasher') {
      // Load serial ports when switching to flasher page
      this.loadSerialPorts();
      this.loadFlasherStatus();
      tcpConsole.showConsole = false;
    } else {
      tcpConsole.showConsole = false;
    }
    this.render();
    console.log('Current page after switch:', this.currentPage);
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
    console.log('handleRoomTempChange called with:', deviceId, delta);
    const device = this.discoveredDevices.find(d => d.deviceId === deviceId);
    if (!device || !this.isConnected) {
      console.log('Device not found or not connected:', device, this.isConnected);
      return;
    }
    
    const newTemp = device.state.currentTemp + delta;
    console.log('Current temp:', device.state.currentTemp, 'New temp:', newTemp);
    if (newTemp < -50 || newTemp > 100) {
      console.log('Temperature out of range:', newTemp);
      return;
    }
    
    try {
      console.log('Sending room temperature change:', deviceId, newTemp);
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
    
    // If TCP Console inputs have focus, don't re-render (preserve input focus)
    const activeElement = document.activeElement;
    if (activeElement && 
        (activeElement.id === 'tcp-host-input' || 
         activeElement.id === 'tcp-port-input' || 
         activeElement.id === 'tcp-message-input')) {
      return;
    }
    
    appDiv.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-4">
        <!-- Header Bar -->
        <div class="max-w-7xl mx-auto mb-6">
          <div class="bg-white rounded-2xl shadow-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <img src="assets/Logo.svg" alt="FGA Simulator Logo" class="h-10" />
                <div>
                  <h1 class="text-2xl font-bold text-gray-800">FGA Simulator</h1>
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full ${this.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
                    <span class="text-sm text-gray-600">${this.isConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
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
              ${this.features.udpLogger?.enabled !== false ? `
              <button onclick="app.switchPage('udp-logs')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  this.currentPage === 'udp-logs' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }">
                📡 UDP Logs
              </button>
              ` : ''}
              ${this.features.tcpConsole?.enabled !== false ? `
              <button onclick="app.switchPage('tcp-console')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  this.currentPage === 'tcp-console' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }">
                💻 TCP Console
              </button>
              ` : ''}
              ${this.features.esp32Flasher?.enabled !== false ? `
              <button onclick="app.switchPage('esp32-flasher')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  this.currentPage === 'esp32-flasher' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }">
                ⚡ ESP32 Flasher
              </button>
              ` : ''}
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
          ${
            this.currentPage === 'devices' ? this.renderDevicesPage() : 
            this.currentPage === 'udp-logs' ? this.renderUDPLogsPage() :
            this.currentPage === 'tcp-console' ? tcpConsole.render() :
            this.currentPage === 'esp32-flasher' ? this.renderFlasherPage() :
            this.renderDevicesPage()
          }
        </div>
      </div>
      
      <!-- Help Dialogs -->
      ${this.helpModule.renderAboutDialog()}
      ${this.helpModule.renderKeyboardShortcuts()}
    `;
    
    // Auto-scroll to bottom for UDP logs on initial render
    if (this.currentPage === 'udp-logs') {
      setTimeout(() => {
        const logContainer = document.getElementById('udp-log-container');
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }, 0);
    }
    
    // Don't auto-scroll TCP Console on render - let user control it
    // if (this.currentPage === 'tcp-console') {
    //   setTimeout(() => {
    //     const tcpContainer = document.getElementById('tcp-messages-container');
    //     if (tcpContainer) {
    //       tcpContainer.scrollTop = tcpContainer.scrollHeight;
    //     }
    //   }, 0);
    // }
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
        <div class="mb-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-4">
              <h2 class="text-xl font-bold text-gray-800">UDP Logger</h2>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full ${this.udpStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}"></div>
                <span class="text-sm text-gray-600">Port ${this.udpStatus.port}</span>
                <span class="text-sm text-gray-500">| <span id="udp-log-count">${this.udpStatus.logCount}</span> logs</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="app.saveUDPLogs(false)" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2" ${this.udpStatus.logCount === 0 ? 'disabled' : ''}>
                💾 Save Logs
              </button>
              <button onclick="app.saveUDPLogs(true)" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2" ${this.udpStatus.logCount === 0 ? 'disabled' : ''}>
                ➕ Append Logs
              </button>
              <button onclick="app.clearUDPLogs()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                🗑️ Clear Logs
              </button>
            </div>
          </div>
          
          <!-- Auto-Save Section -->
          <div class="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full ${this.udpStatus.autoSaveEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></div>
                  <span class="text-sm font-medium text-gray-700">Real-Time Auto-Save</span>
                </div>
                ${this.udpStatus.autoSaveEnabled ? `
                  <span class="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                    📁 ${this.udpStatus.autoSaveFilePath ? this.udpStatus.autoSaveFilePath.split('/').pop() : 'Unknown'} (${this.udpStatus.autoSaveFormat.toUpperCase()})
                  </span>
                ` : ''}
              </div>
              <div class="flex gap-2">
                ${!this.udpStatus.autoSaveEnabled ? `
                  <button onclick="app.toggleAutoSave()" class="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors">
                    🚀 Start Auto-Save
                  </button>
                ` : `
                  <button onclick="app.toggleAutoSave()" class="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-medium transition-colors">
                    ⏸️ Stop Auto-Save
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
        
        <div id="udp-log-container" style="
          height: calc(100vh - 280px);
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          overflow-y: auto;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: #1f2937;
        ">
          ${this.udpLogs.length === 0 ? `
            <div style="text-align: center; padding: 48px 0; color: #6b7280;">
              <p>No UDP messages received yet</p>
              <p style="font-size: 11px; margin-top: 8px;">Listening on UDP port ${this.udpStatus.port}</p>
            </div>
          ` : `
            ${[...this.udpLogs].reverse().map((log, index) => `
              <div style="margin-bottom: 2px; padding: 2px 0; color: #1f2937;">
                <span style="color: #6b7280; margin-right: 8px;">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span style="color: #2563eb; margin-right: 8px;">${log.from}</span>
                <span style="color: #059669;">${this.escapeHtml(this.stripAnsiCodes(log.message))}</span>
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
    logDiv.style.cssText = 'margin-bottom: 2px; padding: 2px 0; color: #1f2937; font-family: "Consolas", "Courier New", monospace; font-size: 13px; line-height: 1.5;';
    
    // Create timestamp span
    const timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'color: #6b7280; margin-right: 8px;';
    timeSpan.textContent = new Date(log.timestamp).toLocaleTimeString();
    
    // Create source span
    const sourceSpan = document.createElement('span');
    sourceSpan.style.cssText = 'color: #2563eb; margin-right: 8px;';
    sourceSpan.textContent = log.from;
    
    // Create message span
    const messageSpan = document.createElement('span');
    messageSpan.style.cssText = 'color: #059669;';
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
    
    // Check if user is scrolled to bottom before adding new logs
    const isScrolledToBottom = logContainer.scrollHeight - logContainer.scrollTop <= logContainer.clientHeight + 50;
    
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
      
      // Append new logs to the bottom using DocumentFragment
      const fragment = document.createDocumentFragment();
      newLogs.reverse().forEach(log => {
        fragment.appendChild(this.createLogElement(log));
      });
      
      // Append at the end (newest logs at bottom)
      logContainer.appendChild(fragment);
      
      // Remove old logs from the top to prevent memory issues (keep max 1000)
      while (logContainer.children.length > 1000) {
        logContainer.removeChild(logContainer.firstChild);
      }
      
      this.lastLogCount = newLogCount;
      
      // Auto-scroll to bottom if user was already at the bottom
      if (isScrolledToBottom) {
        requestAnimationFrame(() => {
          logContainer.scrollTop = logContainer.scrollHeight;
        });
      }
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

  // ============================================
  // ESP32 Flasher Methods
  // ============================================
  
  handlePortChange(portPath) {
    this.selectedPort = portPath;
    console.log('Port selected:', portPath);
    // Don't re-render, just update the state
  }

  async loadSerialPorts() {
    try {
      const allPorts = await window.electronAPI.getSerialPorts();
      
      // Filter and sort ports - prioritize ESP32-related ports
      this.serialPorts = allPorts
        .filter(port => {
          // Filter out system ports that are unlikely to be ESP32
          const path = port.path.toLowerCase();
          return !path.includes('bluetooth') && 
                 !path.includes('ttyS0') && 
                 !path.includes('ttyS1') &&
                 !path.includes('ttyS2') &&
                 !path.includes('ttyS3');
        })
        .sort((a, b) => {
          // Prioritize known ESP32 manufacturers
          const aIsESP = (a.manufacturer || '').toLowerCase().includes('espressif') ||
                        (a.manufacturer || '').toLowerCase().includes('silicon labs') ||
                        (a.manufacturer || '').toLowerCase().includes('qinheng') ||
                        (a.manufacturer || '').toLowerCase().includes('cp210') ||
                        (a.manufacturer || '').toLowerCase().includes('ch340');
          const bIsESP = (b.manufacturer || '').toLowerCase().includes('espressif') ||
                        (b.manufacturer || '').toLowerCase().includes('silicon labs') ||
                        (b.manufacturer || '').toLowerCase().includes('qinheng') ||
                        (b.manufacturer || '').toLowerCase().includes('cp210') ||
                        (b.manufacturer || '').toLowerCase().includes('ch340');
          
          if (aIsESP && !bIsESP) return -1;
          if (!aIsESP && bIsESP) return 1;
          
          // Otherwise sort by path
          return a.path.localeCompare(b.path);
        });
      
      // Auto-select first ESP32-likely port
      if (this.serialPorts.length > 0 && !this.selectedPort) {
        const esp32Port = this.serialPorts.find(port => 
          (port.manufacturer || '').toLowerCase().includes('espressif') ||
          (port.manufacturer || '').toLowerCase().includes('silicon labs')
        );
        this.selectedPort = esp32Port ? esp32Port.path : this.serialPorts[0].path;
      }
    } catch (error) {
      console.error('Failed to load serial ports:', error);
    }
  }

  async loadFlasherStatus() {
    try {
      this.flasherStatus = await window.electronAPI.getFlasherStatus();
    } catch (error) {
      console.error('Failed to load flasher status:', error);
    }
  }

  async selectFirmwareFile() {
    try {
      const result = await window.electronAPI.showFirmwareDialog();
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        this.selectedFirmware = result.filePaths[0];
        
        // Verify firmware
        const verification = await window.electronAPI.verifyFirmware(this.selectedFirmware);
        if (verification.success) {
          alert(`✅ Firmware verified!\n\nFile: ${this.selectedFirmware.split('/').pop()}\nSize: ${verification.sizeHuman}\nType: ${verification.extension}`);
        } else {
          alert(`❌ Firmware verification failed:\n${verification.message}`);
          this.selectedFirmware = '';
        }
        
        this.render();
      }
    } catch (error) {
      console.error('Error selecting firmware:', error);
      alert(`❌ Error: ${error.message}`);
    }
  }

  async flashESP32() {
    if (!this.selectedPort) {
      alert('❌ Please select a serial port');
      return;
    }
    
    if (!this.selectedFirmware) {
      alert('❌ Please select a firmware file');
      return;
    }
    
    const baudRate = document.getElementById('baud-rate')?.value || '460800';
    const eraseFlash = document.getElementById('erase-flash')?.checked || false;
    
    const confirmed = confirm(
      `Flash ESP32?\n\n` +
      `Port: ${this.selectedPort}\n` +
      `Firmware: ${this.selectedFirmware.split('/').pop()}\n` +
      `Baud Rate: ${baudRate}\n` +
      `Erase Flash: ${eraseFlash ? 'Yes' : 'No'}\n\n` +
      `This will take 1-2 minutes. Continue?`
    );
    
    if (!confirmed) return;
    
    try {
      this.flashProgress = 0;
      this.flashStage = 'starting';
      this.render();
      
      const result = await window.electronAPI.flashFirmware({
        port: this.selectedPort,
        baudRate: parseInt(baudRate),
        firmwarePath: this.selectedFirmware,
        eraseFlash: eraseFlash
      });
      
      if (result.success) {
        alert(`✅ Firmware flashed successfully!\n\n${result.message}`);
        this.flashProgress = 100;
        this.flashStage = 'complete';
      } else {
        alert(`❌ Flash failed:\n${result.message}`);
        this.flashStage = 'failed';
      }
    } catch (error) {
      console.error('Flash error:', error);
      alert(`❌ Flash error:\n${error.message || JSON.stringify(error)}`);
      this.flashStage = 'failed';
    }
    
    await this.loadFlasherStatus();
    this.render();
  }

  renderFlasherPage() {
    return `
      <div class="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-2xl p-8">
        <div class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                <span class="text-4xl">⚡</span>
                ESP32 Firmware Flasher
              </h2>
              <p class="text-gray-600 text-sm mt-2 ml-1">Flash firmware to ESP32 devices via serial port</p>
            </div>
            <button 
              onclick="app.loadSerialPorts(); app.render();" 
              class="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 transform hover:scale-105"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Ports
            </button>
          </div>
        </div>

        <!-- Serial Port Selection -->
        <div class="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 shadow-lg">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
            Select Serial Port
          </h3>
          
          ${this.serialPorts.length === 0 ? `
            <div class="text-center py-8">
              <p class="text-gray-500 mb-3">No serial ports detected</p>
              <p class="text-xs text-gray-400">Connect your ESP32 device and click Refresh Ports</p>
            </div>
          ` : `
            <div class="max-w-2xl">
              <div class="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2">
                ${this.serialPorts.map(port => `
                  <label class="flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    this.selectedPort === port.path
                      ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100 shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                  }">
                    <input 
                      type="radio" 
                      name="serial-port" 
                      value="${port.path}"
                      ${this.selectedPort === port.path ? 'checked' : ''}
                      onchange="app.handlePortChange(this.value)"
                      class="w-5 h-5 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    >
                    <div class="ml-3 flex-1">
                      <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span class="font-bold text-gray-800 text-sm">${port.path}</span>
                      </div>
                      <div class="text-xs text-gray-600 mt-1">
                        ${port.manufacturer || 'Unknown'} ${port.serialNumber ? `• SN: ${port.serialNumber}` : ''}
                      </div>
                    </div>
                    ${this.selectedPort === port.path ? `
                      <div class="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                      </div>
                    ` : ''}
                  </label>
                `).join('')}
              </div>
            </div>
          `}
        </div>

        <!-- Firmware Selection -->
        <div class="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 shadow-lg">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
            Select Firmware File
          </h3>
          
          <div class="flex items-center gap-3 mb-3">
            <button
              onclick="app.selectFirmwareFile()"
              class="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 transform hover:scale-105"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Browse Firmware (.bin / .elf)
            </button>
            
            ${this.selectedFirmware ? `
              <div class="flex-1 px-5 py-3 bg-gradient-to-r from-white to-green-50 rounded-xl border-2 border-green-300 shadow-md">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div class="text-sm font-bold text-gray-800">${this.selectedFirmware.split('/').pop()}</div>
                      <div class="text-xs text-gray-500 truncate max-w-md">${this.selectedFirmware}</div>
                    </div>
                  </div>
                  <button
                    onclick="app.selectedFirmware = ''; app.render();"
                    class="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-lg text-red-600 hover:text-red-700 transition-all flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ` : `
              <div class="flex-1 px-5 py-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <p class="text-sm text-gray-500 text-center">📁 No firmware file selected</p>
              </div>
            `}
          </div>
        </div>

        <!-- Flash Options -->
        <div class="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 shadow-lg">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span class="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
            Flash Options
          </h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Baud Rate
              </label>
              <select id="baud-rate" class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white font-medium shadow-sm transition-all">
                <option value="115200">115200 (Safe)</option>
                <option value="460800" selected>460800 (Recommended) ⭐</option>
                <option value="921600">921600 (Fast) 🚀</option>
              </select>
            </div>
            
            <div class="flex items-center">
              <label class="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-xl border-2 border-gray-300 hover:border-purple-400 transition-all w-full">
                <input type="checkbox" id="erase-flash" class="w-6 h-6 text-purple-500 rounded-lg focus:ring-2 focus:ring-purple-500">
                <div>
                  <div class="text-sm font-bold text-gray-800">Erase Flash</div>
                  <div class="text-xs text-gray-500">Clear before writing</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Flash Button -->
        <div class="mb-8">
          <button
            onclick="app.flashESP32()"
            ${!this.selectedPort || !this.selectedFirmware || this.flasherStatus.isFlashing ? 'disabled' : ''}
            class="w-full h-20 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white rounded-2xl font-bold text-xl shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105 hover:shadow-red-500/50 relative overflow-hidden"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-shimmer"></div>
            ${this.flasherStatus.isFlashing ? `
              <svg class="animate-spin h-7 w-7" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Flashing... ${this.flashProgress}%</span>
            ` : `
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>FLASH ESP32 FIRMWARE</span>
            `}
          </button>
        </div>

        <!-- Progress Info -->
        ${this.flasherStatus.isFlashing || this.flashStage ? `
          <div class="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl shadow-lg">
            <div class="flex items-center gap-4 mb-4">
              <div class="text-5xl animate-pulse">
                ${this.flashStage === 'connecting' ? '🔌' : 
                  this.flashStage === 'erasing' ? '🗑️' :
                  this.flashStage === 'writing' ? '📝' :
                  this.flashStage === 'verifying' ? '✅' :
                  this.flashStage === 'complete' ? '🎉' :
                  this.flashStage === 'failed' ? '❌' : '⏳'}
              </div>
              <div class="flex-1">
                <div class="font-bold text-xl text-gray-800">
                  ${this.flashStage === 'connecting' ? 'Connecting to ESP32...' :
                    this.flashStage === 'erasing' ? 'Erasing flash memory...' :
                    this.flashStage === 'writing' ? 'Writing firmware...' :
                    this.flashStage === 'verifying' ? 'Verifying...' :
                    this.flashStage === 'complete' ? 'Flash Complete!' :
                    this.flashStage === 'failed' ? 'Flash Failed' : 'Starting...'}
                </div>
                <div class="text-sm text-gray-600 mt-1">
                  ${this.flashProgress > 0 ? `Progress: ${this.flashProgress}%` : 'Please wait...'}
                </div>
              </div>
            </div>
            
            ${this.flashProgress > 0 && this.flashProgress < 100 ? `
              <div class="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-2" style="width: ${this.flashProgress}%">
                  <span class="text-xs text-white font-bold">${this.flashProgress}%</span>
                </div>
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="p-6 bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200 rounded-2xl shadow-md">
            <h4 class="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Quick Start Guide
            </h4>
            <ol class="text-sm text-gray-700 space-y-2 list-none">
              <li class="flex items-start gap-3">
                <span class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                <span>Connect your ESP32 device via USB</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                <span>Select the correct serial port (usually /dev/ttyACM0 or /dev/ttyUSB0)</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                <span>Browse and select your firmware .bin or .elf file</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                <span>Adjust baud rate if needed (460800 is recommended)</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
                <span>Click the big "FLASH ESP32 FIRMWARE" button</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">6</span>
                <span>Wait 1-2 minutes for flashing to complete 🎉</span>
              </li>
            </ol>
          </div>
        `}
      </div>
    `;
  }
}

// Initialize app when DOM is ready
let app = null;
window.app = null;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
  window.app = app;
});
