/**
 * Factory Testing Page
 * Provides UI for factory testing NubeIO devices
 */

class FactoryTestingPage {
  constructor(app) {
    this.app = app;
    this.selectedVersion = null; // 'v1' or 'v2'
    this.selectedDevice = null; // Device name
    
    // Gen 1 devices
    this.v1Devices = ['Micro Edge', 'Droplet'];
    
    // Gen 2 devices
    this.v2Devices = ['ZC-LCD', 'ACB-M', 'Droplet', 'ZC-Controller'];
    
    // Pre-testing information (filled by tester)
    this.preTesting = {
      testerName: '',
      hardwareVersion: '',
      batchId: '',
      workOrderSerial: ''
    };
    
    // Device information
    this.deviceInfo = {
      firmwareVersion: '',
      hwVersion: '',
      uniqueId: '',
      deviceMake: '',
      deviceModel: ''
    };
    
    // Factory test results
    this.factoryTestResults = {
      batteryVoltage: '',
      pulsesCounter: '',
      dipSwitches: '',
      ain1Voltage: '',
      ain2Voltage: '',
      ain3Voltage: '',
      // ACB-M specific
      relay1Status: '',
      relay2Status: '',
      vccVoltage: '',
      digitalInputs: '',
      loraAddress: '',
      loraDetect: '',
      loraRawPush: ''
    };
    
    this.isConnected = false;
    this.isTesting = false;
    this.testProgress = '';
  }

  selectVersion(version) {
    this.selectedVersion = version;
    this.selectedDevice = null;
    this.resetData();
    this.app.render();
  }

  selectDevice(device) {
    this.selectedDevice = device;
    this.resetData();
    this.app.render();
    
    // Force focus on first input after a short delay
    setTimeout(() => {
      const firstInput = document.getElementById('tester-name');
      if (firstInput) {
        firstInput.focus();
        console.log('[Factory Testing] Focused on first input');
      }
    }, 200);
    
    // Attach pre-testing listeners immediately after render
    setTimeout(() => {
      this.attachPreTestingListeners();
    }, 50);
    
    // Load serial ports when device is selected
    if (window.factoryTestingModule) {
      setTimeout(() => {
        window.factoryTestingModule.loadSerialPorts().then(() => {
          window.factoryTestingModule.updatePortDropdown();
        });
      }, 100);
    }
  }

  resetData() {
    this.isConnected = false;
    this.preTesting = {
      testerName: '',
      hardwareVersion: '',
      batchId: '',
      workOrderSerial: ''
    };
    this.deviceInfo = {
      firmwareVersion: '',
      hwVersion: '',
      uniqueId: '',
      deviceMake: '',
      deviceModel: ''
    };
    this.factoryTestResults = {
      batteryVoltage: '',
      pulsesCounter: '',
      dipSwitches: '',
      ain1Voltage: '',
      ain2Voltage: '',
      ain3Voltage: '',
      // ACB-M specific
      relay1Status: '',
      relay2Status: '',
      vccVoltage: '',
      digitalInputs: '',
      loraAddress: '',
      loraDetect: '',
      loraRawPush: ''
    };
    this.testProgress = '';
  }

  async refreshSerialPorts() {
    if (!window.factoryTestingModule) {
      console.error('[Factory Testing Page] Module not found!');
      alert('Factory Testing Module not initialized');
      return;
    }

    try {
      console.log('[Factory Testing Page] Refreshing serial ports...');
      this.testProgress = 'Refreshing serial ports...';
      this.app.render();
      
      const result = await window.factoryTestingModule.loadSerialPorts();
      console.log('[Factory Testing Page] Load result:', result);
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update dropdown after render
      window.factoryTestingModule.updatePortDropdown();
      
      this.testProgress = `Found ${window.factoryTestingModule.serialPorts.length} ports`;
      this.app.render();
      
      console.log('[Factory Testing Page] Serial ports refreshed');
    } catch (error) {
      console.error('[Factory Testing Page] Failed to refresh ports:', error);
      this.testProgress = `Error refreshing ports: ${error.message}`;
      this.app.render();
    }
  }

  async debugPorts() {
    console.log('=== DEBUG PORTS START ===');
    console.log('1. window.electronAPI exists?', !!window.electronAPI);
    console.log('2. window.factoryTestingModule exists?', !!window.factoryTestingModule);
    
    if (window.factoryTestingModule) {
      console.log('3. Module serialPorts:', window.factoryTestingModule.serialPorts);
      console.log('4. Module selectedPort:', window.factoryTestingModule.selectedPort);
    }
    
    const dropdown = document.getElementById('factory-port-select');
    console.log('5. Dropdown element:', dropdown);
    if (dropdown) {
      console.log('6. Dropdown options count:', dropdown.options.length);
      console.log('7. Dropdown value:', dropdown.value);
      console.log('8. Dropdown HTML:', dropdown.outerHTML);
    }
    
    try {
      console.log('9. Calling electronAPI.getSerialPorts()...');
      const ports = await window.electronAPI.getSerialPorts();
      console.log('10. Direct API result:', ports);
      console.log('11. Ports count:', ports?.length || 0);
      
      if (ports && ports.length > 0) {
        console.log('12. First port:', ports[0]);
        alert(`Found ${ports.length} ports:\n${ports.map(p => p.path).join('\n')}`);
      } else {
        alert('No ports found! Check if devices are connected.');
      }
    } catch (error) {
      console.error('ERROR calling getSerialPorts:', error);
      alert(`Error: ${error.message}`);
    }
    
    console.log('=== DEBUG PORTS END ===');
  }

  renderTestResultsByDevice() {
    if (this.selectedDevice === 'Micro Edge') {
      return `
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          📊 Testing: Digital I/O, Analog inputs, Pulse counter, Battery, and LoRa communication
        </p>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🔋 Battery Voltage</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.batteryVoltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">⚡ Pulse Counter</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.pulsesCounter || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🎚️ DIP Switches</div>
            <div class="font-mono text-gray-800 dark:text-gray-100 text-xs">${this.factoryTestResults.dipSwitches || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📈 AIN 1 (Analog)</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.ain1Voltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📈 AIN 2 (Analog)</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.ain2Voltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📈 AIN 3 (Analog)</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.ain3Voltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Address</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraAddress || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Detect</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraDetect || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Push Test</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraRawPush || '—'}</div>
          </div>
        </div>
      `;
    } else if (this.selectedDevice === 'Droplet') {
      return `
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          🌡️ Testing: Environmental sensors (Temperature, Humidity, Pressure, CO2) and LoRa communication
        </p>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🌡️ Temperature</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.temperature || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">💧 Humidity</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.humidity || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🌪️ Pressure</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.pressure || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">💨 CO2 Level</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.co2 || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Address</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraAddress || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Detect</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraDetect || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600 col-span-3">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Push Test</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraRawPush || '—'}</div>
          </div>
        </div>
      `;
    } else if (this.selectedDevice === 'ACB-M') {
      return `
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          🔌 Testing: Power rails, Relays, Digital inputs, Analog inputs and LoRa communication
        </p>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🔋 VCC Voltage</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.vccVoltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🔁 Relay 1</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.relay1Status || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🔁 Relay 2</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.relay2Status || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">🎛️ Digital Inputs</div>
            <div class="font-mono text-gray-800 dark:text-gray-100 text-xs">${this.factoryTestResults.digitalInputs || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📈 AIN 1 (Analog)</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.ain1Voltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📈 AIN 2 (Analog)</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.ain2Voltage || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Address</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraAddress || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Detect</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraDetect || '—'}</div>
          </div>
          <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
            <div class="text-gray-500 dark:text-gray-400 mb-1">📡 LoRa Push Test</div>
            <div class="font-mono text-gray-800 dark:text-gray-100">${this.factoryTestResults.loraRawPush || '—'}</div>
          </div>
        </div>
      `;
    } else {
      return `<p class="text-sm text-gray-500 dark:text-gray-400">Select a device to see available tests</p>`;
    }
  }

  renderInstructionsByDevice() {
    if (this.selectedDevice === 'Micro Edge') {
      return `
        <ol class="text-xs text-gray-700 dark:text-gray-300 space-y-1 ml-4 list-decimal">
          <li>Connect Micro Edge device via UART (115200 baud)</li>
          <li>Verify battery voltage is within acceptable range</li>
          <li>Test analog inputs (AIN1, AIN2, AIN3) with known voltages</li>
          <li>Verify pulse counter is counting correctly</li>
          <li>Check DIP switch states for configuration</li>
          <li>Test LoRa module detection and communication</li>
          <li>Results saved to: <code>factory-tests/{uniqueID}/</code> as CSV + LOG</li>
        </ol>
      `;
    } else if (this.selectedDevice === 'Droplet') {
      return `
        <ol class="text-xs text-gray-700 dark:text-gray-300 space-y-1 ml-4 list-decimal">
          <li>Connect Droplet device via UART (115200 baud)</li>
          <li>Read temperature sensor (verify room temperature ~20-25°C)</li>
          <li>Read humidity sensor (verify normal range 30-70%)</li>
          <li>Read pressure sensor (verify atmospheric ~1000 hPa)</li>
          <li>Read CO2 sensor (verify indoor air quality 400-1000 ppm)</li>
          <li>Test LoRa module detection and communication</li>
          <li>Results saved to: <code>factory-tests/{uniqueID}/</code> as CSV + LOG</li>
        </ol>
      `;
    } else {
      return `
        <ol class="text-xs text-gray-700 dark:text-gray-300 space-y-1 ml-4 list-decimal">
          <li>Select device generation (Gen 1 or Gen 2) and device type</li>
          <li>Connect device via UART/serial port</li>
          <li>Read device information using AT commands</li>
          <li>Run factory tests to verify all hardware components</li>
          <li>Results will be saved to folder named by device Unique ID</li>
        </ol>
      `;
    }
  }

  updatePreTestingInfo(field, value) {
    this.preTesting[field] = value;
    console.log('[Factory Testing Page] Pre-testing info updated:', field, value);
    // Don't re-render the entire page on input, just update internal state
  }

  // Static helper function for inline handlers
  static updateField(field, value) {
    if (window.factoryTestingPage) {
      window.factoryTestingPage.preTesting[field] = value;
      console.log('[Factory Testing] Field updated:', field, value);
    }
  }

  attachPreTestingListeners() {
    // No longer needed - using inline handlers (onkeyup/onchange)
    // But keeping this method for compatibility
    console.log('[Factory Testing] Pre-testing inputs use inline handlers');
  }

  validatePreTestingInfo() {
    const missing = [];
    if (!this.preTesting.testerName) missing.push('Tester Name');
    if (!this.preTesting.hardwareVersion) missing.push('Hardware Version');
    if (!this.preTesting.batchId) missing.push('Batch ID');
    if (!this.preTesting.workOrderSerial) missing.push('Work Order Serial');
    
    if (missing.length > 0) {
      alert(`Please fill in the following required fields:\n- ${missing.join('\n- ')}`);
      return false;
    }
    return true;
  }

  async connectDevice() {
    if (!window.factoryTestingModule) {
      alert('Factory Testing Module not initialized');
      return;
    }

    try {
      console.log('[Factory Testing Page] === START CONNECT WORKFLOW ===');
      
      // Get selected port and baud rate
      const portSelect = document.getElementById('factory-port-select');
      const baudrateSelect = document.getElementById('factory-baudrate-select');
      
      const selectedPort = portSelect ? portSelect.value : '';
      const selectedBaud = baudrateSelect ? baudrateSelect.value : '115200';
      
      console.log('[Factory Testing Page] Selected port:', selectedPort);
      console.log('[Factory Testing Page] Selected baud:', selectedBaud);
      
      if (!selectedPort) {
        alert('Please select a serial port');
        return;
      }
      
      this.testProgress = `Connecting to ${selectedPort} @ ${selectedBaud} baud...`;
      this.app.render();
      
      console.log('[Factory Testing Page] Calling module.connect()...');
      const result = await window.factoryTestingModule.connect();
      console.log('[Factory Testing Page] Connect result:', result);
      
      if (result.success) {
        this.isConnected = true;
        this.testProgress = `✅ Connected to ${selectedPort}`;
        console.log('[Factory Testing Page] Connection successful');
        alert(`Connected successfully to ${selectedPort}`);
      } else {
        this.testProgress = `❌ Connection failed: ${result.error}`;
        console.error('[Factory Testing Page] Connection failed:', result.error);
        alert(`Connection failed: ${result.error}`);
      }
      
      this.app.render();
      console.log('[Factory Testing Page] === END CONNECT WORKFLOW ===');
    } catch (error) {
      console.error('[Factory Testing Page] Connection error:', error);
      console.error('[Factory Testing Page] Error stack:', error.stack);
      this.testProgress = `❌ Error: ${error.message}`;
      alert(`Connection error: ${error.message}`);
      this.app.render();
    }
  }

  async disconnectDevice() {
    if (!window.factoryTestingModule) {
      return;
    }

    try {
      await window.factoryTestingModule.disconnect();
      this.isConnected = false;
      this.testProgress = 'Disconnected';
      this.app.render();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  async readDeviceInfo() {
    if (!window.factoryTestingModule || !this.isConnected) {
      alert('Please connect to device first');
      return;
    }

    try {
      this.testProgress = 'Reading device information...';
      this.app.render();
      
      const result = await window.factoryTestingModule.readDeviceInfo();
      
      if (result.success) {
        this.deviceInfo = result.data;
        this.testProgress = 'Device information retrieved successfully';
      } else {
        this.testProgress = `Failed to read device info: ${result.error}`;
      }
      
      this.app.render();
    } catch (error) {
      console.error('Read device info error:', error);
      this.testProgress = `Error: ${error.message}`;
      this.app.render();
    }
  }

  async runFactoryTests() {
    if (!window.factoryTestingModule || !this.isConnected) {
      alert('Please connect to device first');
      return;
    }

    // Validate pre-testing information
    if (!this.validatePreTestingInfo()) {
      return;
    }

    try {
      this.isTesting = true;
      this.testProgress = 'Running factory tests...';
      this.app.render();
      
      const result = await window.factoryTestingModule.runFactoryTests(this.selectedDevice, (progress) => {
        this.testProgress = progress;
        this.app.render();
      });
      
      if (result.success) {
        this.factoryTestResults = result.data;
        this.testProgress = 'Factory tests completed successfully';
        
        // Auto-save results to file
        await this.saveResultsToFile();
      } else {
        this.testProgress = `Factory tests failed: ${result.error}`;
      }
      
      this.isTesting = false;
      this.app.render();
    } catch (error) {
      console.error('Factory test error:', error);
      this.testProgress = `Error: ${error.message}`;
      this.isTesting = false;
      this.app.render();
    }
  }

  async saveResultsToFile() {
    if (!window.factoryTestingModule) {
      return;
    }

    try {
      const result = await window.factoryTestingModule.saveResults(
        this.selectedVersion,
        this.selectedDevice,
        this.deviceInfo,
        this.factoryTestResults,
        this.preTesting
      );

      if (result.success) {
        this.testProgress += `\n✅ Results saved to folder: ${result.folder}`;
        this.testProgress += `\n📄 CSV: ${result.csvPath}`;
        this.testProgress += `\n📄 LOG: ${result.logPath}`;
        this.testProgress += `\n📊 Master CSV: ${result.masterCsvPath}`;
      }
    } catch (error) {
      console.error('Save results error:', error);
    }
  }

  render() {
    // Version selection screen
    if (!this.selectedVersion) {
      return `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Factory Testing - Select Version</h2>
          
          <div class="grid grid-cols-2 gap-6">
            <button
              onclick="window.factoryTestingPage.selectVersion('v1')"
              class="p-8 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              <div class="text-4xl mb-4">📟</div>
              <div class="text-2xl font-bold mb-2">Gen 1</div>
              <div class="text-sm opacity-90">Micro Edge & Droplet</div>
            </button>
            
            <button
              onclick="window.factoryTestingPage.selectVersion('v2')"
              class="p-8 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              <div class="text-4xl mb-4">📱</div>
              <div class="text-2xl font-bold mb-2">Gen 2</div>
              <div class="text-sm opacity-90">ZC-LCD, ACB-M, Droplet, ZC-Controller</div>
            </button>
          </div>
        </div>
      `;
    }

    // Device selection screen
    if (!this.selectedDevice) {
      const devices = this.selectedVersion === 'v1' ? this.v1Devices : this.v2Devices;
      
      return `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Factory Testing - ${this.selectedVersion === 'v1' ? 'Gen 1' : 'Gen 2'}
            </h2>
            <button
              onclick="window.factoryTestingPage.selectVersion(null)"
              class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              ← Back to Version Selection
            </button>
          </div>
          
          <p class="text-gray-600 dark:text-gray-400 mb-6">Select a device to test:</p>
          
          <div class="grid grid-cols-2 gap-6">
            ${devices.map(device => {
              // Device-specific styling
              const isMicroEdge = device === 'Micro Edge';
              const isDroplet = device === 'Droplet';
              
              let gradient, icon, description;
              
              if (isMicroEdge) {
                gradient = 'from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700';
                icon = '⚡';
                description = 'Digital, Analog, Pulse & LoRa';
              } else if (isDroplet) {
                gradient = 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700';
                icon = '🌡️';
                description = 'Environmental Sensors & LoRa';
              } else {
                gradient = 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700';
                icon = '🔧';
                description = 'Factory Testing';
              }
              
              return `
                <button
                  onclick="window.factoryTestingPage.selectDevice('${device}')"
                  class="p-8 bg-gradient-to-br ${gradient} text-white rounded-xl shadow-lg transition-all transform hover:scale-105 hover:shadow-2xl"
                >
                  <div class="text-6xl mb-4">${icon}</div>
                  <div class="text-2xl font-bold mb-2">${device}</div>
                  <div class="text-sm opacity-90">${description}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Testing interface: enable Gen1 Micro Edge and Gen2 ZC-LCD/ACB-M
    const isTestingEnabled = (this.selectedVersion === 'v1' && this.selectedDevice === 'Micro Edge') ||
                 (this.selectedVersion === 'v2' && (this.selectedDevice === 'ZC-LCD' || this.selectedDevice === 'ACB-M'));
    
    // Schedule port dropdown update after render
    if (isTestingEnabled && window.factoryTestingModule) {
      setTimeout(() => {
        console.log('[Factory Testing Page] Post-render: updating dropdown');
        window.factoryTestingModule.updatePortDropdown();
      }, 50);
    }
    
    return `
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            ${this.selectedDevice === 'Micro Edge' ? `
              <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-3xl shadow-lg">
                ⚡
              </div>
            ` : this.selectedDevice === 'Droplet' ? `
              <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-3xl shadow-lg">
                🌡️
              </div>
            ` : `
              <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg">
                🔧
              </div>
            `}
            <div>
              <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
                ${this.selectedDevice}
              </h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                ${this.selectedDevice === 'Micro Edge' ? 'Digital, Analog, Pulse & LoRa Testing' : 
                  this.selectedDevice === 'Droplet' ? 'Environmental Sensors & LoRa Testing' : 
                  'Factory Testing'} • Gen ${this.selectedVersion === 'v1' ? '1' : '2'}
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg ${this.isConnected ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}">
              <div class="w-3 h-3 rounded-full ${this.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}"></div>
              <span class="text-sm font-medium ${this.isConnected ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}">
                ${this.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onclick="window.factoryTestingPage.selectDevice(null)"
              class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              ← Back to Device Selection
            </button>
          </div>
        </div>

        ${!isTestingEnabled ? `
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <p class="text-yellow-800 dark:text-yellow-200 font-semibold">
              ⚠️ Testing is currently available for Gen 1 - Micro Edge and Gen 2 - ZC-LCD
            </p>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Support for additional Gen 2 devices will be added soon.
            </p>
          </div>
        ` : ''}

        ${isTestingEnabled ? `
          <!-- Connection Section -->
          <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Step 1: Connect to Device</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect to the device via UART to communicate using AT commands.
            </p>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">Serial Port</label>
                <div class="flex gap-2">
                  <select
                    id="factory-port-select"
                    class="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    ${this.isConnected ? 'disabled' : ''}
                    onchange="window.factoryTestingModule.selectedPort = this.value; console.log('Port changed to:', this.value);"
                  >
                    <option value="">Select Port</option>
                  </select>
                  <button
                    onclick="window.factoryTestingPage.refreshSerialPorts()"
                    class="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    ${this.isConnected ? 'disabled' : ''}
                    title="Refresh ports"
                  >
                    🔄
                  </button>
                  <button
                    onclick="window.factoryTestingPage.debugPorts()"
                    class="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm transition-colors"
                    title="Debug ports"
                  >
                    🐛
                  </button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ${window.factoryTestingModule ? `${window.factoryTestingModule.serialPorts.length} ports available` : 'Loading...'}
                </p>
              </div>
              <div>
                <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">Baud Rate</label>
                <select
                  id="factory-baudrate-select"
                  class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  ${this.isConnected ? 'disabled' : ''}
                >
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200" selected>115200</option>
                </select>
              </div>
            </div>
            
            <div class="flex gap-2">
              ${!this.isConnected ? `
                <button
                  onclick="window.factoryTestingPage.connectDevice()"
                  class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  🔌 Connect
                </button>
              ` : `
                <button
                  onclick="window.factoryTestingPage.disconnectDevice()"
                  class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  🔌 Disconnect
                </button>
              `}
            </div>
          </div>

          <!-- Pre-Testing Information Section -->
          <div class="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
              📝 Step 1.5: Pre-Testing Information
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Fill in the following information before proceeding with device testing.
            </p>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tester Name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="tester-name"
                  tabindex="1"
                  value="${this.preTesting.testerName}"
                  placeholder="Enter tester name"
                  onkeyup="updateFactoryTestingField('testerName', this.value)"
                  onchange="updateFactoryTestingField('testerName', this.value)"
                  onfocus="console.log('Tester name focused')"
                  class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hardware Version <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="hardware-version"
                  tabindex="2"
                  value="${this.preTesting.hardwareVersion}"
                  placeholder="e.g., v1.2, v2.0"
                  onkeyup="updateFactoryTestingField('hardwareVersion', this.value)"
                  onchange="updateFactoryTestingField('hardwareVersion', this.value)"
                  class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Batch ID <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="batch-id"
                  tabindex="3"
                  value="${this.preTesting.batchId}"
                  placeholder="Enter batch ID"
                  onkeyup="updateFactoryTestingField('batchId', this.value)"
                  onchange="updateFactoryTestingField('batchId', this.value)"
                  class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Work Order Serial <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="work-order-serial"
                  tabindex="4"
                  value="${this.preTesting.workOrderSerial}"
                  placeholder="Enter work order serial"
                  onkeyup="updateFactoryTestingField('workOrderSerial', this.value)"
                  onchange="updateFactoryTestingField('workOrderSerial', this.value)"
                  class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div class="mt-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded border border-purple-300 dark:border-purple-600">
              <p class="text-xs text-purple-800 dark:text-purple-200">
                ℹ️ <strong>Note:</strong> All fields marked with <span class="text-red-500">*</span> are required before running factory tests. This information will be included in the test reports.
              </p>
            </div>
          </div>

          <!-- Device Information Section -->
          <div class="mb-6 p-4 ${this.selectedDevice === 'Micro Edge' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700' : this.selectedDevice === 'Droplet' ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700'} rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
                ${this.selectedDevice === 'Micro Edge' ? '⚡' : this.selectedDevice === 'Droplet' ? '🌡️' : '📋'} Step 2: Read Device Information
              </h3>
              <button
                onclick="window.factoryTestingPage.readDeviceInfo()"
                class="px-4 py-2 ${this.selectedDevice === 'Micro Edge' ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700' : this.selectedDevice === 'Droplet' ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg text-sm font-medium transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                ${!this.isConnected ? 'disabled' : ''}
              >
                📖 Read Device Info
              </button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                <div class="text-gray-500 dark:text-gray-400 mb-1">Firmware Version</div>
                <div class="font-mono text-gray-800 dark:text-gray-100">${this.deviceInfo.firmwareVersion || '—'}</div>
              </div>
              <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                <div class="text-gray-500 dark:text-gray-400 mb-1">HW Version</div>
                <div class="font-mono text-gray-800 dark:text-gray-100">${this.deviceInfo.hwVersion || '—'}</div>
              </div>
              <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                <div class="text-gray-500 dark:text-gray-400 mb-1">Unique ID</div>
                <div class="font-mono text-gray-800 dark:text-gray-100 text-xs">${this.deviceInfo.uniqueId || '—'}</div>
              </div>
              <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                <div class="text-gray-500 dark:text-gray-400 mb-1">Device Make</div>
                <div class="font-mono text-gray-800 dark:text-gray-100">${this.deviceInfo.deviceMake || '—'}</div>
              </div>
              <div class="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                <div class="text-gray-500 dark:text-gray-400 mb-1">Device Model</div>
                <div class="font-mono text-gray-800 dark:text-gray-100">${this.deviceInfo.deviceModel || '—'}</div>
              </div>
            </div>
          </div>

          <!-- Factory Testing Section -->
          <div class="mb-6 p-4 ${this.selectedDevice === 'Micro Edge' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700' : this.selectedDevice === 'Droplet' ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700'} rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
                ${this.selectedDevice === 'Micro Edge' ? '⚡' : this.selectedDevice === 'Droplet' ? '🌡️' : '🧪'} Step 3: Run Factory Tests
              </h3>
              <button
                onclick="window.factoryTestingPage.runFactoryTests()"
                class="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                ${!this.isConnected || this.isTesting ? 'disabled' : ''}
              >
                ${this.isTesting ? `
                  <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing...
                ` : '▶️ Run All Tests'}
              </button>
            </div>
            
            ${this.renderTestResultsByDevice()}

            <!-- ACB-M Test Controls -->
            ${this.selectedDevice === 'ACB-M' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold mb-3">🎮 Test Controls - ACB-M</h4>
                <div class="grid grid-cols-1 gap-2">
                  <button onclick="window.factoryTestingModule.acbWifiTest()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">📶 WiFi Test</button>
                  <button onclick="window.factoryTestingModule.acbRs485Test()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">🧭 RS485 Test</button>
                  <button onclick="window.factoryTestingModule.acbRs485_2Test()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">🔁 RS485-2 Test</button>
                  <button onclick="window.factoryTestingModule.acbEthTest()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">🌐 ETH Test</button>
                  <button onclick="window.factoryTestingModule.acbLoraTest()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">📡 LoRa Test</button>
                  <button onclick="window.factoryTestingModule.acbRtcTest()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">⏱️ RTC Test</button>
                  <button onclick="window.factoryTestingModule.acbFullTest()" class="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">✳️ Run FULL TEST (ACB-M)</button>
                  <button onclick="window.factoryTestingModule.acbClearOutput()" class="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">🧹 Clear Output</button>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Progress/Status Section -->
          ${this.testProgress ? `
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p class="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">${this.testProgress}</p>
            </div>
          ` : ''}
        ` : ''}

        <!-- Instructions -->
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
            ${this.selectedDevice === 'Micro Edge' ? 'Micro Edge Testing:' : 
              this.selectedDevice === 'Droplet' ? 'Droplet Testing:' : 'Factory Testing Instructions:'}
          </p>
          ${this.renderInstructionsByDevice()}
        </div>
      </div>
    `;
  }
}

// Make it globally accessible
if (typeof window !== 'undefined') {
  window.FactoryTestingPage = FactoryTestingPage;
  
  // Global helper function for input updates
  window.updateFactoryTestingField = function(field, value) {
    if (window.factoryTestingPage) {
      window.factoryTestingPage.preTesting[field] = value;
      console.log('[Factory Testing] Field updated:', field, value);
    } else {
      console.warn('[Factory Testing] factoryTestingPage not initialized yet');
    }
  };
}
