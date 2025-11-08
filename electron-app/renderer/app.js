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
    this.serialConsole = new SerialConsoleModule(this);
    this.devicesPage = new DevicesPage(this); // Devices page
    this.udpLogsPage = new UDPLogsPage(this); // UDP logs page
    this.provisioningPage = null; // Will be initialized conditionally
    this.fleetMonitoringPage = null; // Will be initialized conditionally
    this.configLoaded = false; // Track if config has been loaded
    this.features = {}; // Feature toggles
    this.currentPage = 'devices'; // 'devices', 'udp-logs', 'tcp-console', 'serial-console', 'esp32-flasher', 'provisioning', or 'fleet-monitoring'
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
    this.flashSize = '4MB'; // Default flash size
    this.eraseFlashChecked = true; // Default to checked
    this.discoveredFiles = {
      bootloader: '',
      partition: '',
      otaData: '',
      firmware: ''
    };
    this.udpLogs = [];
    this.udpStatus = { isRunning: false, port: 56789, logCount: 0 };
    this.lastLogCount = 0; // Track last log count to detect new logs

    // Theme management
    this.isDarkMode = false;
    this.loadTheme();

    this.init();
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme === 'dark';
    this.applyTheme();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
    this.render();
  }

  applyTheme() {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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

    // Initialize Serial Console module
    await this.serialConsole.init();

    // Initialize STM32 Flasher module
    if (window.stm32Flasher) {
      await window.stm32Flasher.init();
    }

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
      // Update clock without full re-render (prevents flicker on UDP logs)
      this.updateClockOnly();
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
      console.log('✓ Features loaded:', this.features);
      console.log('  - Fleet Monitoring enabled?', this.features.fleetMonitoring?.enabled);
    } catch (error) {
      console.error('✗ Failed to load features:', error);
      // Default to all features enabled if config not found
      this.features = {
        esp32Flasher: { enabled: true },
        udpLogger: { enabled: true },
        provisioning: { enabled: true },
        tcpConsole: { enabled: true },
        fleetMonitoring: { enabled: true }
      };
      console.log('  - Using default features with Fleet Monitoring enabled');
    }

    // Initialize provisioning page if feature is enabled and class exists
    if (this.features.provisioning && this.features.provisioning.enabled) {
      if (typeof ProvisioningPage !== 'undefined') {
        this.provisioningPage = new ProvisioningPage(this);
        window.provisioningPage = this.provisioningPage; // Make globally accessible
        console.log('Provisioning page initialized');
      } else {
        console.warn('ProvisioningPage class not found');
      }
    }

    // Initialize fleet monitoring page if feature is enabled and class exists
    if (this.features.fleetMonitoring && this.features.fleetMonitoring.enabled) {
      if (typeof FleetMonitoringPage !== 'undefined') {
        this.fleetMonitoringPage = new FleetMonitoringPage(this);
        window.fleetMonitoringPage = this.fleetMonitoringPage; // Make globally accessible
        // Init will be called asynchronously, don't await here to avoid blocking
        this.fleetMonitoringPage.init().catch(err => {
          console.error('Failed to initialize Fleet Monitoring:', err);
        });
        console.log('Fleet Monitoring page initialized');
      } else {
        console.warn('FleetMonitoringPage class not found');
      }
    } else {
      console.log('Fleet Monitoring feature not enabled or not in config');
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

    // Stop fleet monitoring auto-refresh when switching away
    if (this.currentPage === 'fleet-monitoring' && page !== 'fleet-monitoring') {
      if (this.fleetMonitoringPage) {
        this.fleetMonitoringPage.stopAutoRefresh();
      }
    }

    this.currentPage = page;
    if (page === 'udp-logs') {
      // Initialize lastLogCount to current log count to prevent re-rendering all logs
      this.lastLogCount = this.udpLogs.length;
      this.loadUDPLogs();
      this.loadUDPStatus();
    } else if (page === 'tcp-console') {
      tcpConsole.showConsole = true;
    } else if (page === 'serial-console') {
      this.serialConsole.loadStatus();
      this.serialConsole.loadSerialPorts();
      this.serialConsole.loadMessages();
    } else if (page === 'esp32-flasher') {
      // Load serial ports when switching to flasher page
      this.loadSerialPorts();
      this.loadFlasherStatus();
      tcpConsole.showConsole = false;
    } else if (page === 'stm32-flasher') {
      // Initialize STM32 flasher page
      tcpConsole.showConsole = false;
    } else if (page === 'provisioning') {
      // Load serial ports for provisioning page (same as flasher)
      this.loadSerialPorts();
      tcpConsole.showConsole = false;
    } else if (page === 'fleet-monitoring') {
      // Load fleet monitoring status and start auto-refresh if connected
      if (this.fleetMonitoringPage) {
        this.fleetMonitoringPage.loadStatus().then(() => {
          if (this.fleetMonitoringPage.isConnected && !this.fleetMonitoringPage.refreshInterval) {
            this.fleetMonitoringPage.startAutoRefresh();
          }
        });
      }
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
      const fans = ['Auto', 'Quiet', 'Low', 'Medium', 'High'];
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
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transition-colors">
        <!-- Header -->
        <div class="relative bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between border-b dark:border-gray-700">
          <h1 class="text-xl font-bold text-gray-700 dark:text-gray-200 tracking-wide">FUJITSU</h1>
          <div class="w-3 h-3 rounded-full ${acState.power ? 'bg-green-500' : 'bg-red-500'}"></div>
        </div>

        <!-- Main Content -->
        <div class="${acState.power ? 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600'} rounded-2xl p-6 mb-6 shadow-md mx-6 mt-6">
          <!-- Title and Time -->
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-gray-700 dark:text-gray-200 font-semibold text-sm">
              ${device.deviceId.replace('AC_SIM_', '')}
            </h2>
            <span class="text-gray-500 dark:text-gray-400 text-sm">${this.formatTime()}</span>
          </div>

          <!-- Mode, Temp, Fan Display -->
          <div class="grid grid-cols-3 gap-3 mb-6">
            <!-- Mode -->
            <div class="text-center">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Mode</div>
              <div class="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                <div class="text-2xl mb-1">${this.getModeIcon(acState.mode)}</div>
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">${acState.mode}</div>
              </div>
            </div>

            <!-- Set Temperature -->
            <div class="text-center">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Set Temp.</div>
              <div class="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                <div class="text-4xl font-bold text-gray-800 dark:text-gray-100">
                  ${acState.temperature.toFixed(1)}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">°C</div>
              </div>
            </div>

            <!-- Fan -->
            <div class="text-center">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Fan</div>
              <div class="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                <div class="text-2xl mb-1">≈</div>
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">${acState.fanSpeed}</div>
              </div>
            </div>
          </div>

          <!-- Room Temperature with Controls -->
          <div class="mb-4">
            <div class="text-center mb-2">
              <span class="text-gray-600 dark:text-gray-400 text-xs">Room Temp. </span>
              <span class="text-gray-800 dark:text-gray-100 text-lg font-bold">
                ${typeof acState.currentTemp === 'number' ? acState.currentTemp.toFixed(1) : '0.0'}°C
              </span>
            </div>
            <div class="flex gap-2 justify-center">
              <button
                onclick="app.handleRoomTempChange('${device.deviceId}', -0.5)"
                ${!this.isConnected ? 'disabled' : ''}
                class="w-12 h-8 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 rounded text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <button
                onclick="app.handleRoomTempChange('${device.deviceId}', 0.5)"
                ${!this.isConnected ? 'disabled' : ''}
                class="w-12 h-8 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 rounded text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                class="w-10 h-10 rounded-full flex items-center justify-center transition-colors ${acState.power
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
            class="w-full h-16 rounded-2xl font-bold text-lg shadow-md transition-all mb-4 ${acState.power
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

    const fans = ['Auto', 'Quiet', 'Low', 'Medium', 'High'];
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

    // If console or provisioning inputs have focus, don't re-render (preserve input focus)
    const activeElement = document.activeElement;
    if (activeElement &&
      (activeElement.id === 'tcp-host-input' ||
        activeElement.id === 'tcp-port-input' ||
        activeElement.id === 'tcp-message-input' ||
        activeElement.id === 'serial-message-input' ||
        activeElement.id === 'udp-port-input' ||
        activeElement.id === 'prov-offset' ||
        activeElement.id === 'prov-size' ||
        activeElement.id === 'prov-caurl' ||
        activeElement.id === 'prov-uuid' ||
        activeElement.id === 'prov-psk' ||
        activeElement.id === 'prov-wifi-ssid' ||
        activeElement.id === 'prov-wifi-password' ||
        activeElement.id === 'prov-erase-address' ||
        activeElement.id === 'prov-erase-size' ||
        activeElement.id === 'fleet-broker' ||
        activeElement.id === 'fleet-port' ||
        activeElement.id === 'fleet-topic')) {
      return;
    }

    // If flasher page dropdown or any select/input has focus, don't re-render
    if (activeElement &&
      (activeElement.id === 'serial-port-select' ||
        activeElement.id === 'baud-rate' ||
        activeElement.id === 'erase-flash' ||
        activeElement.id === 'prov-port' ||
        activeElement.id === 'prov-chip' ||
        activeElement.id === 'prov-baudrate' ||
        activeElement.id === 'prov-erase-type' ||
        activeElement.tagName === 'SELECT')) {
      return;
    }

    // Save scroll positions before render
    let fleetScrollPosition = 0;
    let udpScrollPosition = 0;

    if (this.currentPage === 'fleet-monitoring') {
      const fleetContainer = document.getElementById('fleet-messages-container');
      if (fleetContainer) {
        fleetScrollPosition = fleetContainer.scrollTop;
      }
    } else if (this.currentPage === 'udp-logs') {
      const udpContainer = document.getElementById('udp-log-container');
      if (udpContainer) {
        udpScrollPosition = udpContainer.scrollTop;
      }
    }

    appDiv.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 transition-colors duration-300">
        <!-- Header Bar -->
        <div class="max-w-7xl mx-auto mb-6">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-2xl p-4 transition-colors duration-300">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <img src="assets/Logo.svg" alt="Nube iO Toolkit Logo" class="h-10 ${this.isDarkMode ? 'brightness-110' : ''}" />
                <div>
                  <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Nube iO Toolkit</h1>
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full ${this.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
                    <span class="text-sm text-gray-600 dark:text-gray-300">${this.isConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <button onclick="app.toggleTheme()" class="px-4 py-2 bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white rounded-lg text-sm font-medium transition-all transform hover:scale-105 shadow-md" title="${this.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
                  ${this.isDarkMode ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
            </div>
            
            <!-- Page Navigation -->
            <div class="mt-4 flex gap-2 border-t dark:border-gray-700 pt-4">
              <button onclick="app.switchPage('devices')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'devices'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }">
                🏠 Devices
              </button>
              ${this.features.udpLogger?.enabled !== false ? `
              <button onclick="app.switchPage('udp-logs')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'udp-logs'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }">
                📡 UDP Logs
              </button>
              ` : ''}
              ${this.features.tcpConsole?.enabled !== false ? `
              <button onclick="app.switchPage('tcp-console')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'tcp-console'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }">
                💻 TCP Console
              </button>
              ` : ''}
              <button onclick="app.switchPage('serial-console')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'serial-console'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }">
                🔌 Serial Console
              </button>
              ${this.features.esp32Flasher?.enabled !== false ? `
              <button onclick="app.switchPage('esp32-flasher')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'esp32-flasher'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }">
                ⚡ ESP32 Flasher
              </button>
              ` : ''}
              <button onclick="app.switchPage('stm32-flasher')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'stm32-flasher'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }">
                🔧 STM32 Flasher
              </button>
              ${this.features.provisioning?.enabled !== false ? `
              <button onclick="app.switchPage('provisioning')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'provisioning'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }">
                🔐 Provisioning
              </button>
              ` : ''}
              ${this.features.fleetMonitoring?.enabled === true ? `
              <button onclick="app.switchPage('fleet-monitoring')" 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${this.currentPage === 'fleet-monitoring'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }">
                🌐 Fleet
              </button>
              ` : ''}
            </div>

            ${this.showConfig ? `
              <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" id="config-panel">
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">Broker</label>
                    <input type="text" id="broker" 
                      class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" 
                      oninput="app.mqttConfig.broker = this.value" />
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">Port</label>
                    <input type="number" id="port" 
                      class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      oninput="app.mqttConfig.port = parseInt(this.value)" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <button onclick="app.saveConfig()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                    💾 Save & Connect
                  </button>
                  <button onclick="app.toggleConfig()" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Content Area -->
        <div class="max-w-7xl mx-auto">
          ${this.currentPage === 'devices' ? this.renderDevicesPage() :
        this.currentPage === 'udp-logs' ? this.renderUDPLogsPage() :
          this.currentPage === 'tcp-console' ? tcpConsole.render() :
            this.currentPage === 'serial-console' ? this.serialConsole.render() :
              this.currentPage === 'esp32-flasher' ? this.renderFlasherPage() :
                this.currentPage === 'stm32-flasher' ? '<div id="stm32-flasher-container" class="p-6"></div>' :
                  this.currentPage === 'provisioning' ? (this.provisioningPage ? this.provisioningPage.render() : '<div class="p-6 text-center">Provisioning feature not enabled</div>') :
                    this.currentPage === 'fleet-monitoring' ? (this.fleetMonitoringPage ? this.fleetMonitoringPage.render() : '<div class="p-6 text-center">Fleet Monitoring feature not enabled</div>') :
                      this.renderDevicesPage()
      }
        </div>
      </div>
      
      <!-- Help Dialogs -->
      ${this.helpModule.renderAboutDialog()}
      ${this.helpModule.renderKeyboardShortcuts()}
    `;

    // VSCode-style scroll: Only auto-scroll UDP logs if user is at the bottom
    if (this.currentPage === 'udp-logs') {
      setTimeout(() => {
        const logContainer = document.getElementById('udp-log-container');
        if (logContainer) {
          if (udpScrollPosition > 0) {
            // Restore previous scroll position if saved
            logContainer.scrollTop = udpScrollPosition;
          } else {
            // Check if user is at the bottom (with 50px tolerance)
            const isAtBottom = logContainer.scrollHeight - logContainer.scrollTop <= logContainer.clientHeight + 50;
            // Only auto-scroll if user is already at bottom or no logs yet
            if (isAtBottom || this.udpLogs.length === 0) {
              logContainer.scrollTop = logContainer.scrollHeight;
            }
          }
        }
      }, 0);
    }

    // Restore fleet monitoring scroll position after render
    if (this.currentPage === 'fleet-monitoring' && fleetScrollPosition > 0) {
      setTimeout(() => {
        const fleetContainer = document.getElementById('fleet-messages-container');
        if (fleetContainer) {
          fleetContainer.scrollTop = fleetScrollPosition;
        }
      }, 0);
    }

    // Render STM32 flasher module if on that page
    if (this.currentPage === 'stm32-flasher' && window.stm32Flasher) {
      setTimeout(() => {
        window.stm32Flasher.render();
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
    return this.devicesPage.render();
  }

  renderUDPLogsPage() {
    return this.udpLogsPage.render();
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

  updateClockOnly() {
    // Skip render on UDP logs, Fleet Monitoring, and STM32 Flasher pages to prevent flicker
    if (this.currentPage === 'udp-logs' ||
      this.currentPage === 'fleet-monitoring' ||
      this.currentPage === 'stm32-flasher') {
      return; // Don't re-render, these pages update incrementally
    }

    // For other pages (like devices page with clock displays), do full render
    this.render();
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

      // Auto-select first port if none selected and trigger chip detection (only for flasher page)
      if (this.serialPorts.length > 0 && !this.selectedPort && this.currentPage === 'esp32-flasher') {
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

  async manualEraseFlash() {
    if (!this.selectedPort) {
      alert('⚠️ Please select a serial port first');
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: Erase Entire Flash Memory\n\n` +
      `This will COMPLETELY ERASE all flash memory on the ESP32:\n` +
      `- Firmware\n` +
      `- Bootloader\n` +
      `- Partition table\n` +
      `- NVS (credentials, settings)\n` +
      `- All data\n\n` +
      `Port: ${this.selectedPort}\n\n` +
      `Make sure ESP32 is in DOWNLOAD MODE:\n` +
      `1. Hold BOOT button\n` +
      `2. Press & release RESET button\n` +
      `3. Release BOOT button\n\n` +
      `Continue with FULL ERASE?`
    );

    if (!confirmed) return;

    try {
      this.flasherStatus.isFlashing = true;
      this.flashStage = 'erasing';
      this.flashProgress = 0;
      this.flashMessage = 'Erasing flash memory...';
      this.render();

      console.log('Manually erasing flash on port:', this.selectedPort);
      const result = await window.electronAPI.eraseFlash(this.selectedPort);

      if (result.success) {
        this.flashStage = 'complete';
        this.flashProgress = 100;
        this.flashMessage = 'Flash erased successfully!';
        alert('✅ Flash Erased Successfully\n\nThe ESP32 flash memory has been completely erased.');
      } else {
        this.flashStage = 'failed';
        this.flashMessage = result.error || 'Erase failed';
        alert(`❌ Erase Failed\n\n${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Erase error:', error);
      this.flashStage = 'failed';
      this.flashMessage = error.message;
      alert(`❌ Erase Error\n\n${error.message}`);
    } finally {
      this.flasherStatus.isFlashing = false;
      this.render();
    }
  }

  async detectChipType() {
    if (!this.selectedPort) {
      console.log('Cannot detect chip: no port selected');
      alert('⚠️ Please select a serial port first');
      return;
    }

    try {
      console.log('Detecting chip type on port:', this.selectedPort);
      this.chipType = 'detecting'; // Show detecting state
      this.render();

      const detectResult = await window.electronAPI.detectChip(this.selectedPort);

      if (detectResult.success && detectResult.chipType) {
        this.chipType = detectResult.chipType;
        // Auto-detect flash size if available
        if (detectResult.flashSize) {
          this.flashSize = detectResult.flashSize;
          console.log('✅ Auto-detected chip type:', this.chipType, 'Flash size:', this.flashSize);
        } else {
          console.log('✅ Auto-detected chip type:', this.chipType);
        }
        this.render();
      } else {
        console.warn('Failed to detect chip:', detectResult.error || 'Unknown error');
        this.chipType = null;

        // Check for common error conditions
        const errorMsg = detectResult.error || '';
        if (errorMsg.includes('busy') || errorMsg.includes('in use') || errorMsg.includes('permission denied') || errorMsg.includes('EBUSY') || errorMsg.includes('EACCES')) {
          alert(`❌ Port Busy or In Use\n\n` +
            `The port ${this.selectedPort} is currently being used by another application.\n\n` +
            `Please:\n` +
            `1. Close other applications using this port (Serial Monitor, PlatformIO, Arduino IDE, etc.)\n` +
            `2. Unplug and replug the ESP32\n` +
            `3. Try again`);
        } else if (errorMsg.includes('not found') || errorMsg.includes('cannot open')) {
          alert(`❌ Port Not Found\n\n` +
            `Cannot open ${this.selectedPort}.\n\n` +
            `The device may have been disconnected. Please:\n` +
            `1. Check the USB connection\n` +
            `2. Refresh the port list\n` +
            `3. Select the port again`);
        } else {
          alert(`❌ Chip Detection Failed\n\n${errorMsg || 'Unknown error'}\n\nPlease ensure:\n` +
            `- ESP32 is in DOWNLOAD MODE (hold BOOT, press RESET, release BOOT)\n` +
            `- USB cable supports data transfer\n` +
            `- Device drivers are installed`);
        }
        this.render();
      }
    } catch (error) {
      console.error('Error detecting chip:', error);
      this.chipType = null;
      alert(`❌ Detection Error\n\n${error.message}`);
      this.render();
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
        `Firmware: ${this.discoveredFiles.firmware ? '✓' : '✗'}\n` +
        `OTA Data Initial: ${this.discoveredFiles.otaDataInitial ? '✓' : '✗'}\n` +
        `Storage: ${this.discoveredFiles.storage ? '✓' : '✗'}\n` +
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
          otaDataInitialPath: this.discoveredFiles.otaDataInitial,
          storagePath: this.discoveredFiles.storage,
          firmwarePath: this.discoveredFiles.firmware,
          eraseFlash: eraseFlash,
          chipType: this.chipType,
          flashSize: this.flashSize
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
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Flash Size</label>
              <select
                id="flash-size"
                onchange="app.flashSize = this.value"
                class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.flasherStatus.isFlashing ? 'disabled' : ''}
              >
                <option value="2MB" ${this.flashSize === '2MB' ? 'selected' : ''}>2MB</option>
                <option value="4MB" ${this.flashSize === '4MB' ? 'selected' : ''}>4MB</option>
                <option value="8MB" ${this.flashSize === '8MB' ? 'selected' : ''}>8MB</option>
                <option value="16MB" ${this.flashSize === '16MB' ? 'selected' : ''}>16MB</option>
                <option value="32MB" ${this.flashSize === '32MB' ? 'selected' : ''}>32MB</option>
              </select>
            </div>
          </div>

          <!-- Manual Erase Flash Button -->
          <div class="border-t pt-4 flex items-center justify-between bg-red-50 -mx-6 px-6 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800 mb-1">🗑️ Manual Flash Erase (Standalone Operation)</p>
              <p class="text-xs text-gray-600 mb-1">Erase entire flash without flashing new firmware</p>
              <p class="text-xs text-orange-600">⚠️ Use this for troubleshooting corrupted flash or when you need to erase without flashing</p>
            </div>
            <button
              onclick="app.manualEraseFlash()"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold whitespace-nowrap"
              ${this.flasherStatus.isFlashing || !this.selectedPort ? 'disabled' : ''}
              title="${!this.selectedPort ? 'Select a port first' : 'Erase entire flash memory without flashing'}"
            >
              🗑️ Erase Flash Only
            </button>
          </div>

          <!-- Full Update Checkbox -->
          <div class="flex items-center border-t pt-4">
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
                    ${this.chipType === 'detecting' ?
          `<span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">🔍 Detecting...</span>` :
          this.chipType ?
            `<span class="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">✓ ${this.chipType.toUpperCase()}</span>` :
            `<span class="ml-2 text-gray-400 text-xs">(Chip not detected)</span>`}
                  </div>
                  ${this.selectedPort ? `
                    <button
                      onclick="app.detectChipType()"
                      class="px-3 py-1 ${this.chipType ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded text-xs font-semibold transition-colors"
                      title="${this.chipType ? 'Re-detect chip type' : 'Detect chip type'}"
                    >
                      ${this.chipType ? '🔄 Re-detect' : '🔍 Detect Chip'}
                    </button>
                  ` : `
                    <span class="text-xs text-orange-600">⚠ Select a port first</span>
                  `}
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
                  <span class="text-gray-600">Firmware (required):</span>
                  <span class="${this.discoveredFiles.firmware ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}">
                    ${this.discoveredFiles.firmware ? this.discoveredFiles.firmware.split('/').pop() : 'Not found (required!)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ ${this.chipType && this.chipType.includes('ESP32-S3') ? '0x20000' : '0x10000'}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">OTA Data Initial (optional):</span>
                  <span class="${this.discoveredFiles.otaDataInitial ? 'text-green-600 font-semibold' : 'text-gray-400'}">
                    ${this.discoveredFiles.otaDataInitial ? this.discoveredFiles.otaDataInitial.split('/').pop() : 'Not found (will skip)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ 0x19000</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Storage (optional):</span>
                  <span class="${this.discoveredFiles.storage ? 'text-green-600 font-semibold' : 'text-gray-400'}">
                    ${this.discoveredFiles.storage ? this.discoveredFiles.storage.split('/').pop() : 'Not found (will skip)'}
                  </span>
                  <span class="text-gray-500 text-xs">@ 0xa70000</span>
                </div>
              </div>
            ` : ''}
          `}

          <!-- Erase Flash Checkbox -->
          <div class="flex items-center bg-blue-50 p-3 rounded-md -mx-6 px-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="erase-flash"
                ${this.eraseFlashChecked ? 'checked' : ''}
                onchange="app.eraseFlashChecked = this.checked"
                class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.flasherStatus.isFlashing ? 'disabled' : ''}
              />
              <div>
                <span class="text-sm font-semibold text-gray-800">Erase entire flash before writing</span>
                <p class="text-xs text-gray-600 mt-1">Automatically erases ALL flash memory before writing firmware (recommended - ensures clean state)</p>
              </div>
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
let serialConsole = null;
window.serialConsole = null;
window.udpLogsPage = null;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
  window.app = app;
  // Make serial console globally accessible
  serialConsole = app.serialConsole;
  window.serialConsole = app.serialConsole;
  // Make UDP logs page globally accessible
  window.udpLogsPage = app.udpLogsPage;
});
