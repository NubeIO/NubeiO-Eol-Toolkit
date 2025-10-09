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
    this.flashMessage = '';
    this.fullUpdate = false;
    this.folderPath = '';
    this.chipType = null;
    this.discoveredFiles = {
      bootloader: '',
      partition: '',
      otaData: '',
      firmware: ''
    };
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

    // Setup ESP32 flasher progress listener
    window.electronAPI.onFlasherProgress((progress) => {
      this.flashProgress = progress.progress || 0;
      this.flashStage = progress.stage || '';
      this.flashMessage = progress.message || '';
      this.flasherStatus.isFlashing = progress.stage !== 'complete' && progress.stage !== 'failed' && progress.stage !== 'error';
      this.render();
    });

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

    // If flasher page dropdown or any select/input has focus, don't re-render
    if (activeElement &&
        (activeElement.id === 'serial-port-select' ||
         activeElement.id === 'baud-rate' ||
         activeElement.id === 'erase-flash' ||
         activeElement.tagName === 'SELECT')) {
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
  
  async handlePortChange(portPath) {
    this.selectedPort = portPath;
    console.log('=== Port selected:', portPath);

    // Auto-detect chip type when port is selected
    if (portPath) {
      console.log('=== Starting auto chip detection...');
      await this.detectChipType();
      console.log('=== After detection, chipType =', this.chipType);
    } else {
      this.chipType = null;
      this.render();
    }
  }

  async loadSerialPorts() {
    try {
      const allPorts = await window.electronAPI.getSerialPorts();

      // Backend returns simple array of port paths (strings)
      // Filter out system ports
      this.serialPorts = allPorts.filter(port => {
        const path = port.toLowerCase();
        // Filter out bluetooth and ttyS ports
        return !path.includes('bluetooth') && !path.match(/ttys\d+/);
      });

      // Auto-select first port if none selected and trigger chip detection
      if (this.serialPorts.length > 0 && !this.selectedPort) {
        this.selectedPort = this.serialPorts[0];
        console.log('Auto-selected port:', this.selectedPort);
        // Trigger chip detection for auto-selected port
        await this.detectChipType();
      }
    } catch (error) {
      console.error('Failed to load serial ports:', error);
      this.serialPorts = [];
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
        this.render();
      }
    } catch (error) {
      console.error('Error selecting firmware:', error);
      alert(`❌ Error: ${error.message}`);
    }
  }

  async selectFirmwareFolder() {
    try {
      const result = await window.electronAPI.showFolderDialog();
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        this.folderPath = result.filePaths[0];

        // Scan folder for firmware files
        const scanResult = await window.electronAPI.scanFolder(this.folderPath);
        if (scanResult.success) {
          this.discoveredFiles = scanResult.files;

          // Try to detect chip type if port is selected
          if (this.selectedPort) {
            await this.detectChipType();
          }

          this.render();
        } else {
          alert(`❌ Failed to scan folder: ${scanResult.error}`);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      alert(`❌ Error: ${error.message}`);
    }
  }

  async detectChipType() {
    if (!this.selectedPort) {
      console.log('Cannot detect chip: no port selected');
      return;
    }

    try {
      console.log('Detecting chip type on port:', this.selectedPort);
      const detectResult = await window.electronAPI.detectChip(this.selectedPort);
      if (detectResult.success && detectResult.chipType) {
        this.chipType = detectResult.chipType;
        console.log('✅ Detected chip type:', this.chipType);
        this.render();
      } else {
        console.warn('Failed to detect chip:', detectResult.error || 'Unknown error');
        this.chipType = null;
      }
    } catch (error) {
      console.error('Error detecting chip:', error);
      this.chipType = null;
    }
  }

  async flashESP32() {
    if (!this.selectedPort) {
      alert('❌ Please select a serial port');
      return;
    }

    const baudRate = document.getElementById('baud-rate')?.value || '460800';
    const eraseFlash = document.getElementById('erase-flash')?.checked || false;

    // Check if full update mode
    if (this.fullUpdate) {
      if (!this.discoveredFiles.firmware) {
        alert('❌ Please select a firmware folder with at least a firmware file');
        return;
      }

      const confirmed = confirm(
        `Complete Flash ESP32?\n\n` +
        `Port: ${this.selectedPort}\n` +
        `Bootloader: ${this.discoveredFiles.bootloader ? '✓' : '✗'}\n` +
        `Partition: ${this.discoveredFiles.partition ? '✓' : '✗'}\n` +
        `OTA Data: ${this.discoveredFiles.otaData ? '✓' : '✗'}\n` +
        `Firmware: ${this.discoveredFiles.firmware ? '✓' : '✗'}\n` +
        `Baud Rate: ${baudRate}\n` +
        `Erase Flash: ${eraseFlash ? 'Yes' : 'No'}\n\n` +
        `This will take 2-3 minutes. Continue?`
      );

      if (!confirmed) return;

      try {
        this.flashProgress = 0;
        this.flashStage = 'starting';
        this.render();

        console.log('Flashing with chipType:', this.chipType);
        const flashOptions = {
          port: this.selectedPort,
          baudRate: parseInt(baudRate),
          bootloaderPath: this.discoveredFiles.bootloader,
          partitionPath: this.discoveredFiles.partition,
          otaDataPath: this.discoveredFiles.otaData,
          firmwarePath: this.discoveredFiles.firmware,
          eraseFlash: eraseFlash,
          chipType: this.chipType
        };
        console.log('Flash options:', flashOptions);

        const result = await window.electronAPI.flashComplete(flashOptions);

        if (result.success) {
          this.flashProgress = 100;
          this.flashStage = 'complete';
        } else {
          this.flashStage = 'failed';
          this.flashMessage = result.error;
        }
      } catch (error) {
        console.error('Flash error:', error);
        this.flashStage = 'failed';
        this.flashMessage = error.message;
      }
    } else {
      // Single file flash
      if (!this.selectedFirmware) {
        alert('❌ Please select a firmware file');
        return;
      }

      const flashAddress = document.getElementById('flash-address')?.value || '0x10000';
      const confirmed = confirm(
        `Flash ESP32?\n\n` +
        `Port: ${this.selectedPort}\n` +
        `Firmware: ${this.selectedFirmware.split('/').pop()}\n` +
        `Address: ${flashAddress}\n` +
        `Baud Rate: ${baudRate}\n` +
        `Erase Flash: ${eraseFlash ? 'Yes' : 'No'}\n\n` +
        `This will take 1-2 minutes. Continue?`
      );

      if (!confirmed) return;

      try {
        this.flashProgress = 0;
        this.flashStage = 'starting';
        this.render();

        console.log('Single file flash with chipType:', this.chipType);
        const result = await window.electronAPI.flashFirmware({
          port: this.selectedPort,
          baudRate: parseInt(baudRate),
          firmwarePath: this.selectedFirmware,
          flashAddress: flashAddress,
          eraseFlash: eraseFlash,
          chipType: this.chipType
        });

        if (result.success) {
          this.flashProgress = 100;
          this.flashStage = 'complete';
        } else {
          this.flashStage = 'failed';
          this.flashMessage = result.error;
        }
      } catch (error) {
        console.error('Flash error:', error);
        this.flashStage = 'failed';
        this.flashMessage = error.message;
      }
    }

    await this.loadFlasherStatus();
    this.render();
  }

  renderFlasherPage() {
    return `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h3 class="text-2xl font-bold text-gray-800 mb-6">ESP32 Firmware Flashing</h3>

        <!-- Flash Configuration -->
        <div class="flash-config space-y-4 mb-6">
          <!-- Serial Port Row -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col">
              <label class="text-sm font-semibold text-gray-700 mb-2">Serial Port:</label>
              <div class="flex gap-2">
                <select
                  id="serial-port-select"
                  onchange="app.handlePortChange(this.value)"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  ${this.flasherStatus.isFlashing ? 'disabled' : ''}
                >
                  <option value="">Select Port</option>
                  ${this.serialPorts.map(port => `
                    <option value="${port}" ${this.selectedPort === port ? 'selected' : ''}>${port}</option>
                  `).join('')}
                </select>
                <button
                  onclick="app.loadSerialPorts(); app.render();"
                  class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh serial ports"
                  ${this.flasherStatus.isFlashing ? 'disabled' : ''}
                >
                  🔄
                </button>
              </div>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-semibold text-gray-700 mb-2">Baud Rate:</label>
              <select
                id="baud-rate"
                class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.flasherStatus.isFlashing ? 'disabled' : ''}
              >
                <option value="115200">115200 (Most Stable)</option>
                <option value="460800" selected>460800</option>
                <option value="921600">921600 (Fastest)</option>
              </select>
            </div>
          </div>

          <!-- Full Update Checkbox -->
          <div class="flex items-center">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="full-update"
                onchange="app.fullUpdate = this.checked; app.render();"
                ${this.fullUpdate ? 'checked' : ''}
                class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.flasherStatus.isFlashing ? 'disabled' : ''}
              />
              <span class="text-sm font-semibold text-gray-700">Full Update (Complete Flash with Bootloader)</span>
            </label>
          </div>

          ${!this.fullUpdate ? `
            <!-- Single File Mode -->
            <div class="flex flex-col">
              <label class="text-sm font-semibold text-gray-700 mb-2">Firmware File:</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  value="${this.selectedFirmware ? this.selectedFirmware.split('/').pop() : ''}"
                  readonly
                  placeholder="Select firmware file (.bin)"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                />
                <button
                  onclick="app.selectFirmwareFile()"
                  class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  ${this.flasherStatus.isFlashing ? 'disabled' : ''}
                >
                  Browse
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col">
                <label class="text-sm font-semibold text-gray-700 mb-2">Flash Address:</label>
                <input
                  type="text"
                  id="flash-address"
                  value="0x10000"
                  class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="0x10000"
                  ${this.flasherStatus.isFlashing ? 'disabled' : ''}
                />
              </div>
            </div>
          ` : `
            <!-- Full Update Mode -->
            <div class="flex flex-col">
              <label class="text-sm font-semibold text-gray-700 mb-2">Firmware Folder:</label>
              <button
                onclick="app.selectFirmwareFolder()"
                class="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.flasherStatus.isFlashing ? 'disabled' : ''}
              >
                Select Folder with .bin Files
              </button>
            </div>

            ${this.folderPath ? `
              <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <div class="font-semibold text-gray-700 text-sm mb-3 flex items-center justify-between">
                  <div>
                    <strong>Selected Folder:</strong> ${this.folderPath.split('/').pop()}
                    ${this.chipType ? `<span class="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">${this.chipType}</span>` : `<span class="ml-2 text-gray-400 text-xs">(Chip not detected)</span>`}
                  </div>
                  ${this.selectedPort && !this.chipType ? `
                    <button
                      onclick="app.detectChipType()"
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Detect Chip
                    </button>
                  ` : ''}
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Bootloader (optional):</span>
                  <span class="${this.discoveredFiles.bootloader ? 'text-green-600 font-semibold' : 'text-gray-400'}">
                    ${this.discoveredFiles.bootloader ? this.discoveredFiles.bootloader.split('/').pop() : 'Not found (will skip)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ ${this.chipType && (this.chipType.includes('ESP32-S') || this.chipType.includes('ESP32-C')) ? '0x0' : '0x1000'}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Partition Table (optional):</span>
                  <span class="${this.discoveredFiles.partition ? 'text-green-600 font-semibold' : 'text-gray-400'}">
                    ${this.discoveredFiles.partition ? this.discoveredFiles.partition.split('/').pop() : 'Not found (will skip)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ 0x8000</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">OTA Data (optional):</span>
                  <span class="${this.discoveredFiles.otaData ? 'text-green-600 font-semibold' : 'text-gray-400'}">
                    ${this.discoveredFiles.otaData ? this.discoveredFiles.otaData.split('/').pop() : 'Not found (will skip)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ 0xd000</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Firmware (required):</span>
                  <span class="${this.discoveredFiles.firmware ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}">
                    ${this.discoveredFiles.firmware ? this.discoveredFiles.firmware.split('/').pop() : 'Not found (required!)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ ${this.chipType && this.chipType.includes('ESP32-S3') ? '0x20000' : '0x10000'}</span>
                </div>
              </div>
            ` : ''}
          `}

          <!-- Erase Flash Checkbox -->
          <div class="flex items-center">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="erase-flash"
                class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.flasherStatus.isFlashing ? 'disabled' : ''}
              />
              <span class="text-sm text-gray-700">Erase flash before writing</span>
            </label>
          </div>
        </div>

        <!-- Flash Progress -->
        ${this.flasherStatus.isFlashing ? `
          <div class="flash-progress mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-semibold text-gray-700">${this.flashStage || 'Starting...'}</span>
              <span class="text-sm font-semibold text-gray-700">${Math.round(this.flashProgress || 0)}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                class="h-full bg-blue-600 rounded-full transition-all duration-300"
                style="width: ${this.flashProgress || 0}%"
              ></div>
            </div>
            <div class="text-xs text-gray-600 mt-2">${this.flashMessage || 'Please wait...'}</div>
          </div>
        ` : ''}

        <!-- Flash Status Messages -->
        ${this.flashStage === 'complete' ? `
          <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <span class="text-green-700 font-semibold">✅ Flashing completed successfully!</span>
          </div>
        ` : ''}

        ${this.flashStage === 'failed' || this.flashStage === 'error' ? `
          <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <span class="text-red-700 font-semibold">❌ ${this.flashMessage || 'Flash failed'}</span>
          </div>
        ` : ''}

        <!-- Flash Button -->
        <div class="flash-controls">
          <button
            onclick="app.flashESP32()"
            ${this.flasherStatus.isFlashing || !this.selectedPort || (!this.fullUpdate && !this.selectedFirmware) || (this.fullUpdate && !this.discoveredFiles.firmware) ? 'disabled' : ''}
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            ${this.flasherStatus.isFlashing ? `
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              ${this.fullUpdate ? 'Complete Flashing...' : 'Flashing...'}
            ` : `
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              ${this.fullUpdate ? 'Complete Flash ESP32' : 'Flash Firmware'}
            `}
          </button>
        </div>

        <!-- Flash Instructions -->
        <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p class="text-sm font-semibold text-gray-800 mb-2">ESP32 Flashing Instructions:</p>
          <ol class="text-xs text-gray-700 space-y-1 ml-4 list-decimal">
            <li>Connect ESP32 to computer via USB</li>
            <li>Select correct serial port (usually /dev/ttyUSB0 on Linux, COM* on Windows)</li>
            <li>Choose firmware .bin file and configure options</li>
            <li>Click "Flash Firmware" button</li>
            <li>ESP32 will automatically enter download mode if supported</li>
            <li>Wait for flashing to complete</li>
          </ol>
        </div>
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
