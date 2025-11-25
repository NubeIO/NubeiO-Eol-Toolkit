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
    this.showRawJson = false;
    this.showProfile = false; // toggles the small profile panel
  }

  toggleRawJson() {
    this.showRawJson = !this.showRawJson;
    this.app.render();
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
    // Load saved defaults for this device type (if any)
    try {
      const key = `factoryDefaults:${device.replace(/\s+/g, '-').toLowerCase()}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.preTesting = Object.assign({}, this.preTesting, parsed);
        }
      }
    } catch (e) {
      console.warn('[Factory Testing] Failed to load defaults for device:', device, e && e.message);
    }
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

  // Save current preTesting as defaults for selected device type
  saveDefaultsForDevice() {
    if (!this.selectedDevice) return;
    try {
      const key = `factoryDefaults:${this.selectedDevice.replace(/\s+/g, '-').toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(this.preTesting));
      this.testProgress = 'Saved defaults for ' + this.selectedDevice;
      this.app.render();
    } catch (e) {
      console.error('[Factory Testing] Failed to save defaults:', e && e.message);
    }
  }

  // Reset defaults for selected device type
  resetDefaultsForDevice() {
    if (!this.selectedDevice) return;
    try {
      const key = `factoryDefaults:${this.selectedDevice.replace(/\s+/g, '-').toLowerCase()}`;
      localStorage.removeItem(key);
      // Clear current preTesting fields
      this.preTesting = { testerName: '', hardwareVersion: '', batchId: '', workOrderSerial: '' };
      this.testProgress = 'Reset defaults for ' + this.selectedDevice;
      this.app.render();
    } catch (e) {
      console.error('[Factory Testing] Failed to reset defaults:', e && e.message);
    }
  }

  toggleProfilePanel() {
    this.showProfile = !this.showProfile;
    this.app.render();
  }

  // Format AIN display: if value is normalized (0..1) convert to 0..3.3V, otherwise assume already volts
  _formatAIN(value) {
    if (value === null || typeof value === 'undefined' || value === '') return '—';
    // If the value is already a string with 'V', try to parse the numeric part
    let raw = value;
    if (typeof raw === 'string') raw = raw.trim();
    // Extract first number appearance
    const m = String(raw).match(/-?[0-9]*\.?[0-9]+/);
    if (!m) return String(value);
    const n = parseFloat(m[0]);
    if (Number.isNaN(n)) return String(value);
    // If the reading looks normalized (0..1) convert to volts
    let volts = n;
    if (Math.abs(n) <= 1.05) {
      volts = n * 3.3;
    }
    return `${volts.toFixed(2)} V`;
  }

  // Evaluate Micro Edge results using thresholds and update UI icons/colors
  _evaluateMicroEdgeResults(results) {
    if (!results) return;
    // Helper to set icon and color
    const makeCheck = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>`;
    const makeCross = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>`;
    const makeDot = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6 h-6"><circle cx="12" cy="12" r="4" fill="${color}"/></svg>`;

    const setStatus = (iconId, labelId, boxId, passed) => {
      const iconEl = document.getElementById(iconId);
      const labelEl = document.getElementById(labelId);
      const boxEl = document.getElementById(boxId);
      if (!iconEl || !boxEl) return;
      // Clean previous color classes
      iconEl.classList.remove('text-red-600', 'text-green-600', 'text-gray-400');
      boxEl.classList.remove('border-red-600', 'border-green-600');
      if (labelEl) labelEl.classList.remove('text-red-600', 'text-green-600', 'text-gray-400');

      if (passed === true) {
        iconEl.innerHTML = makeCheck('#16A34A');
        if (labelEl) { labelEl.textContent = 'Done'; labelEl.style.color = '#16A34A'; }
        boxEl.classList.add('border-green-600');
      } else if (passed === false) {
        iconEl.innerHTML = makeCross('#DC2626');
        if (labelEl) { labelEl.textContent = 'Fail'; labelEl.style.color = '#DC2626'; }
        boxEl.classList.add('border-red-600');
      } else {
        iconEl.innerHTML = makeDot('#9CA3AF');
        if (labelEl) { labelEl.textContent = ''; labelEl.style.color = '#9CA3AF'; }
      }
    };

    // Parse volts as number
    const parseVolts = (v) => {
      if (v === null || typeof v === 'undefined' || v === '') return NaN;
      const m = String(v).match(/-?[0-9]*\.?[0-9]+/);
      if (!m) return NaN;
      let n = parseFloat(m[0]);
      if (Math.abs(n) <= 1.05) n = n * 3.3; // normalized
      return n;
    };

    // 1. Battery Voltage: pass if 2.5..4.5
    const batt = parseVolts(results.batteryVoltage);
    setStatus('me-battery-icon', 'me-battery-label', 'me-battery-box', (batt >= 2.5 && batt <= 4.5));
    // 2. AIN1: 1.4-1.7
    const a1 = parseVolts(results.ain1Voltage);
    setStatus('me-ain1-icon', 'me-ain1-label', 'me-ain1-box', (a1 >= 1.4 && a1 <= 1.7));
    // 3. AIN2: 0.75-1.2
    const a2 = parseVolts(results.ain2Voltage);
    setStatus('me-ain2-icon', 'me-ain2-label', 'me-ain2-box', (a2 >= 0.75 && a2 <= 1.2));
    // 4. AIN3: 0.5-0.9
    const a3 = parseVolts(results.ain3Voltage);
    setStatus('me-ain3-icon', 'me-ain3-label', 'me-ain3-box', (a3 >= 0.5 && a3 <= 0.9));
    // 5. Pulse > 3
    const pulses = Number(results.pulsesCounter || 0);
    setStatus('me-pulses-icon', 'me-pulses-label', 'me-pulse-box', (pulses > 3));
    // 6. LoRa: detect + raw push OK
    const detectOk = String(results.loraDetect || '').toLowerCase().includes('detect');
    const pushOk = String(results.loraRawPush || '').toLowerCase().includes('ok');
    const loraPass = detectOk && pushOk;
    setStatus('me-lora-icon', 'me-lora-label', 'me-lora-box', loraPass);
    // Update LoRa subtext to include push DONE/FAIL explicitly
    try {
      const loraSubEl = document.getElementById('me-lora-sub');
      if (loraSubEl) {
        const push = results.loraRawPush || '';
        const detect = results.loraDetect || '';
        const pushText = push.toUpperCase() === 'OK' ? 'Done' : (push ? 'Fail' : '');
        loraSubEl.textContent = `${detect}${push ? ' · ' + push : ''}${pushText ? ' · ' + pushText : ''}`;
      }
    } catch (e) { /* ignore */ }
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
      // Determine whether to use AT+UNLOCK - only Micro Edge requires it
      const useUnlock = this.selectedDevice === 'Micro Edge';
      const result = await window.factoryTestingModule.connect(this.selectedPort, undefined, useUnlock);
      console.log('[Factory Testing Page] Connect result:', result);
      
      if (result.success) {
        this.isConnected = true;
        this.testProgress = `✅ Connected to ${selectedPort}`;
        console.log('[Factory Testing Page] Connection successful');
        // If backend returned device info (unique ID / MAC), set it in page state
        if (result.deviceInfo) {
          this.deviceInfo = result.deviceInfo;
        }
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

  // ZC-LCD individual test runners update UI fields
  async runZcWifiTest() {
    if (!window.factoryTestingModule || !this.isConnected) { alert('Connect first'); return; }
    this.testProgress = 'Running ZC WiFi test...'; this.app.render();
    try {
      const res = await window.factoryTestingModule.zcWifiTest();
      this.factoryTestResults.wifi = res;
      // Populate labeled value spans and apply status color
      const status = res.status || (res.success ? 'done' : 'fail');
      const statusEl = document.getElementById('zc-wifi-status-val');
      const rssiEl = document.getElementById('zc-wifi-rssi-val');
      const netsEl = document.getElementById('zc-wifi-networks-val');
      if (statusEl) { statusEl.textContent = status; statusEl.classList.remove('text-red-600','text-green-600','text-gray-500'); statusEl.classList.add(status === 'done' ? 'text-green-600' : status === 'fail' ? 'text-red-600' : 'text-gray-500'); }
      if (rssiEl) rssiEl.textContent = (typeof res.rssi !== 'undefined' ? res.rssi : '—');
      if (netsEl) netsEl.textContent = ((res.networks && res.networks.length) ? res.networks.join(', ') : '—');
      this.testProgress = 'ZC WiFi test complete';
      this.app.render();
      return res;
    } catch (e) { this.testProgress = `Error: ${e.message}`; this.app.render(); }
  }

  async runZcI2cTest() {
    if (!window.factoryTestingModule || !this.isConnected) { alert('Connect first'); return; }
    this.testProgress = 'Running ZC I2C test...'; this.app.render();
    try {
      const res = await window.factoryTestingModule.zcI2cTest();
      this.factoryTestResults.i2c = res;
      // Populate labeled value spans and apply status color
      const statusI = res.status || (res.success ? 'done' : 'fail');
      const statusElI = document.getElementById('zc-i2c-status-val');
      if (statusElI) { statusElI.textContent = statusI; statusElI.classList.remove('text-red-600','text-green-600','text-gray-500'); statusElI.classList.add(statusI === 'done' ? 'text-green-600' : statusI === 'fail' ? 'text-red-600' : 'text-gray-500'); }
      const addrEl = document.getElementById('zc-i2c-addr-val'); if (addrEl) addrEl.textContent = res.sensor_addr || '—';
      const sensorEl = document.getElementById('zc-i2c-sensor-val'); if (sensorEl) sensorEl.textContent = res.sensor || '—';
      const tempEl = document.getElementById('zc-i2c-temp-val'); if (tempEl) tempEl.textContent = (typeof res.temperature_c !== 'undefined' ? res.temperature_c + '°C' : '—');
      const humEl = document.getElementById('zc-i2c-hum-val'); if (humEl) humEl.textContent = (typeof res.humidity_rh !== 'undefined' ? res.humidity_rh + '%' : '—');
      this.testProgress = 'ZC I2C test complete';
      this.app.render();
      return res;
    } catch (e) { this.testProgress = `Error: ${e.message}`; this.app.render(); }
  }

  async runZcLcdTest() {
    // LCD test removed - unsupported by firmware
    alert('LCD test is not supported by this device firmware');
    return { success: false, error: 'LCD test unsupported' };
  }

  async runZcRs485Test() {
    if (!window.factoryTestingModule || !this.isConnected) { alert('Connect first'); return; }
    this.testProgress = 'Running ZC RS485 test...'; this.app.render();
    try {
      const res = await window.factoryTestingModule.zcRs485Test();
      this.factoryTestResults.rs485 = res;
      // Populate labeled value spans and apply status color
      const statusR = res.status || (res.success ? 'done' : 'fail');
      const statusElR = document.getElementById('zc-rs485-status-val');
      if (statusElR) { statusElR.textContent = statusR; statusElR.classList.remove('text-red-600','text-green-600','text-gray-500'); statusElR.classList.add(statusR === 'done' ? 'text-green-600' : statusR === 'fail' ? 'text-red-600' : 'text-gray-500'); }
      const tempElR = document.getElementById('zc-rs485-temp-val'); if (tempElR) tempElR.textContent = (typeof res.temperature !== 'undefined' ? res.temperature + '°C' : '—');
      const humElR = document.getElementById('zc-rs485-hum-val'); if (humElR) humElR.textContent = (typeof res.humidity !== 'undefined' ? res.humidity : '—');
      const slaveEl = document.getElementById('zc-rs485-slave-val'); if (slaveEl) slaveEl.textContent = (typeof res.slave_ok !== 'undefined' ? (res.slave_ok ? 'Yes' : 'No') : '—');
      const masterEl = document.getElementById('zc-rs485-master-val'); if (masterEl) masterEl.textContent = (typeof res.master_ok !== 'undefined' ? (res.master_ok ? 'Yes' : 'No') : '—');
      this.testProgress = 'ZC RS485 test complete';
      this.app.render();
      return res;
    } catch (e) { this.testProgress = `Error: ${e.message}`; this.app.render(); }
  }

  async runZcFullTest() {
    if (!window.factoryTestingModule || !this.isConnected) { alert('Connect first'); return; }
    if (!this.validatePreTestingInfo()) return;
    this.isTesting = true; this.testProgress = 'Running ZC full test...'; this.app.render();
    try {
      const res = await window.factoryTestingModule.zcFullTest();
      if (res.success) {
        // populate UI fields
        this.factoryTestResults.wifi = res.data.wifi || {};
        this.factoryTestResults.i2c = res.data.i2c || {};
        this.factoryTestResults.rs485 = res.data.rs485 || {};

        // Populate wifi fields
        const w = this.factoryTestResults.wifi || {};
        const wifiStatusEl = document.getElementById('zc-wifi-status-val'); if (wifiStatusEl) { const s = w.status || (w.success ? 'done' : 'fail'); wifiStatusEl.textContent = s; wifiStatusEl.classList.remove('text-red-600','text-green-600','text-gray-500'); wifiStatusEl.classList.add(s === 'done' ? 'text-green-600' : s === 'fail' ? 'text-red-600' : 'text-gray-500'); }
        const wifiRssiEl = document.getElementById('zc-wifi-rssi-val'); if (wifiRssiEl) wifiRssiEl.textContent = (typeof w.rssi !== 'undefined' ? w.rssi : '—');
        const wifiNEl = document.getElementById('zc-wifi-networks-val'); if (wifiNEl) wifiNEl.textContent = ((w.networks && w.networks.length) ? w.networks.join(', ') : '—');

        // Populate i2c fields
        const ii = this.factoryTestResults.i2c || {};
        const iStatusEl = document.getElementById('zc-i2c-status-val'); if (iStatusEl) { const s = ii.status || (ii.success ? 'done' : 'fail'); iStatusEl.textContent = s; iStatusEl.classList.remove('text-red-600','text-green-600','text-gray-500'); iStatusEl.classList.add(s === 'done' ? 'text-green-600' : s === 'fail' ? 'text-red-600' : 'text-gray-500'); }
        const iAddrEl = document.getElementById('zc-i2c-addr-val'); if (iAddrEl) iAddrEl.textContent = ii.sensor_addr || '—';
        const iSensorEl = document.getElementById('zc-i2c-sensor-val'); if (iSensorEl) iSensorEl.textContent = ii.sensor || '—';
        const iTempEl = document.getElementById('zc-i2c-temp-val'); if (iTempEl) iTempEl.textContent = (typeof ii.temperature_c !== 'undefined' ? ii.temperature_c + '°C' : '—');
        const iHumEl = document.getElementById('zc-i2c-hum-val'); if (iHumEl) iHumEl.textContent = (typeof ii.humidity_rh !== 'undefined' ? ii.humidity_rh + '%' : '—');

        // Populate rs485 fields
        const rr = this.factoryTestResults.rs485 || {};
        const rStatusEl = document.getElementById('zc-rs485-status-val'); if (rStatusEl) { const s = rr.status || (rr.success ? 'done' : 'fail'); rStatusEl.textContent = s; rStatusEl.classList.remove('text-red-600','text-green-600','text-gray-500'); rStatusEl.classList.add(s === 'done' ? 'text-green-600' : s === 'fail' ? 'text-red-600' : 'text-gray-500'); }
        const rTempEl = document.getElementById('zc-rs485-temp-val'); if (rTempEl) rTempEl.textContent = (typeof rr.temperature !== 'undefined' ? rr.temperature + '°C' : '—');
        const rHumEl = document.getElementById('zc-rs485-hum-val'); if (rHumEl) rHumEl.textContent = (typeof rr.humidity !== 'undefined' ? rr.humidity : '—');
        const rSlaveEl = document.getElementById('zc-rs485-slave-val'); if (rSlaveEl) rSlaveEl.textContent = (typeof rr.slave_ok !== 'undefined' ? (rr.slave_ok ? 'Yes' : 'No') : '—');
        const rMasterEl = document.getElementById('zc-rs485-master-val'); if (rMasterEl) rMasterEl.textContent = (typeof rr.master_ok !== 'undefined' ? (rr.master_ok ? 'Yes' : 'No') : '—');

        this.testProgress = 'ZC-LCD full test completed';
        // Auto-save
        await this.saveResultsToFile();
      } else {
        this.testProgress = `ZC-LCD full test failed: ${res.error}`;
      }
    } catch (e) {
      this.testProgress = `Error: ${e.message}`;
    }
    this.isTesting = false; this.app.render();
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
        // Populate Micro Edge result spans if present (use IDs that match the rendered DOM)
        try {
          const setIf = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
          setIf('me-battery-val', this.factoryTestResults.batteryVoltage ? this._formatAIN(this.factoryTestResults.batteryVoltage) : '—');
          setIf('me-pulses-val', this.factoryTestResults.pulsesCounter || '—');
          setIf('me-dips-val', this.factoryTestResults.dipSwitches || '—');
          setIf('me-ain1-val', this._formatAIN(this.factoryTestResults.ain1Voltage));
          setIf('me-ain2-val', this._formatAIN(this.factoryTestResults.ain2Voltage));
          setIf('me-ain3-val', this._formatAIN(this.factoryTestResults.ain3Voltage));
          setIf('me-lora-val', this.factoryTestResults.loraAddress || '—');
          // me-lora-sub contains detect and push info
          const loraSub = `${this.factoryTestResults.loraDetect || ''}${this.factoryTestResults.loraRawPush ? ' · ' + this.factoryTestResults.loraRawPush : ''}`.trim();
          setIf('me-lora-sub', loraSub || '—');
        } catch (e) { console.warn('Failed to populate Micro Edge spans:', e && e.message); }

        // Evaluate thresholds and set pass/fail icons; prefer service-side evaluation flags when available
        try {
          // If service attached _eval flags, use them to drive UI
          if (this.factoryTestResults._eval) {
            const f = this.factoryTestResults._eval;
            // Map flags to UI
            const map = [
              ['me-battery-icon', 'me-battery-box', f.pass_battery],
              ['me-ain1-icon', 'me-ain1-box', f.pass_ain1],
              ['me-ain2-icon', 'me-ain2-box', f.pass_ain2],
              ['me-ain3-icon', 'me-ain3-box', f.pass_ain3],
              ['me-pulses-icon', 'me-pulse-box', f.pass_pulses],
              ['me-lora-icon', 'me-lora-box', f.pass_lora]
            ];
            map.forEach(([iconId, boxId, pass]) => {
              const iconEl = document.getElementById(iconId);
              const boxEl = document.getElementById(boxId);
              if (!iconEl || !boxEl) return;
              // Clean previous classes
              iconEl.classList.remove('text-red-600', 'text-green-600', 'text-gray-400');
              boxEl.classList.remove('border-red-600', 'border-green-600');
              if (pass === true) {
                iconEl.textContent = '✔️'; iconEl.classList.add('text-green-600'); boxEl.classList.add('border-green-600');
              } else if (pass === false) {
                iconEl.textContent = '✖️'; iconEl.classList.add('text-red-600'); boxEl.classList.add('border-red-600');
              } else {
                iconEl.textContent = '⏺'; iconEl.classList.add('text-gray-400');
              }
            });

            // Update LoRa subtext to include DONE/FAIL
            const loraSubEl = document.getElementById('me-lora-sub');
            if (loraSubEl) {
              const push = String(this.factoryTestResults.loraRawPush || '').toUpperCase();
              const detect = String(this.factoryTestResults.loraDetect || '');
              const pass = f.pass_lora ? 'DONE' : 'FAIL';
              loraSubEl.textContent = `${detect}${push ? ' · ' + push : ''} · ${pass}`;
            }
          } 
          // Always run client-side evaluation to ensure UI is consistent (will be a no-op for icons already set)
          this._evaluateMicroEdgeResults(this.factoryTestResults);
        } catch (e) { console.warn('Eval error:', e && e.message); }
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
    // Compute Micro Edge evaluation UI state so icons persist across render
    const _meEval = this.factoryTestResults._eval || {};
    const makeSVG = (type, color) => {
      if (type === 'check') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>`;
      if (type === 'cross') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6 h-6"><circle cx="12" cy="12" r="4" fill="${color}"/></svg>`;
    };
    const _meState = (key) => {
      const p = typeof _meEval[key] === 'boolean' ? _meEval[key] : undefined;
      if (p === true) return { icon: makeSVG('check', '#16A34A'), iconClass: '', boxClass: 'border-green-600', label: 'Done', labelColor: '#16A34A' };
      if (p === false) return { icon: makeSVG('cross', '#DC2626'), iconClass: '', boxClass: 'border-red-600', label: 'Fail', labelColor: '#DC2626' };
      return { icon: makeSVG('dot', '#9CA3AF'), iconClass: '', boxClass: '', label: '', labelColor: '#9CA3AF' };
    };
    const meBattery = _meState('pass_battery');
    const meAin1 = _meState('pass_ain1');
    const meAin2 = _meState('pass_ain2');
    const meAin3 = _meState('pass_ain3');
    const mePulses = _meState('pass_pulses');
    const meLora = _meState('pass_lora');

    // Build LoRa subtext with DONE/FAIL if evaluation exists
    const _loraDetect = this.factoryTestResults.loraDetect || '';
    const _loraPush = this.factoryTestResults.loraRawPush || '';
    const _loraPassText = (typeof _meEval.pass_lora === 'boolean') ? (_meEval.pass_lora ? 'DONE' : 'FAIL') : '';

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
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
                📝 Step 1.5: Pre-Testing Information
              </h3>
              <div class="flex items-center gap-2">
                <button
                  onclick="window.factoryTestingPage.saveDefaultsForDevice()"
                  class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
                  title="Save these tester defaults for this device type"
                >Save Defaults</button>
                <button
                  onclick="window.factoryTestingPage.resetDefaultsForDevice()"
                  class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                  title="Reset saved defaults for this device type"
                >Reset Defaults</button>
                <button
                  onclick="window.factoryTestingPage.toggleProfilePanel()"
                  class="px-3 py-1 bg-gray-300 hover:bg-gray-350 rounded text-sm"
                  title="Toggle profile panel"
                >Profile</button>
              </div>
            </div>
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
            ${this.showProfile ? `
              <div class="mt-3 p-3 bg-white rounded border text-sm">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-xs text-gray-600">Saved Profile for ${this.selectedDevice || 'Device'}</div>
                    <div class="font-mono text-sm">${this.preTesting.testerName || '—'} · ${this.preTesting.hardwareVersion || '—'} · ${this.preTesting.batchId || '—'} · ${this.preTesting.workOrderSerial || '—'}</div>
                  </div>
                  <div class="text-xs text-gray-500">Defaults persist per device type</div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Device Information Section -->
          <div class="mb-6 p-4 ${this.selectedDevice === 'Micro Edge' ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700' : this.selectedDevice === 'Droplet' ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700'} rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
                ${this.selectedDevice === 'Micro Edge' ? '⚡' : this.selectedDevice === 'Droplet' ? '🌡️' : '📋'} Step 2: Read Device Information
              </h3>
              
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

            ${this.selectedDevice === 'Micro Edge' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold mb-3">🧩 Micro Edge - Test Results</h4>
                <div class="grid grid-cols-4 gap-3 text-sm">
                  <div id="me-battery-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between ${meBattery.boxClass}">
                    <div>
                      <div class="text-xs text-gray-500">Battery Voltage</div>
                        <div id="me-battery-val" class="font-mono">${this._formatAIN(this.factoryTestResults.batteryVoltage)}</div>
                      </div>
                      <div class="text-right">
                        <div id="me-battery-icon" class="text-2xl ${meBattery.iconClass}">${meBattery.icon}</div>
                        <div id="me-battery-label" class="text-xs mt-1" style="color: ${meBattery.labelColor}">${meBattery.label}</div>
                      </div>
                  </div>

                  <div id="me-pulse-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between ${mePulses.boxClass}">
                    <div>
                      <div class="text-xs text-gray-500">Pulses</div>
                      <div id="me-pulses-val" class="font-mono">${this.factoryTestResults.pulsesCounter || '—'}</div>
                    </div>
                    <div class="text-right">
                      <div id="me-pulses-icon" class="text-2xl ${mePulses.iconClass}">${mePulses.icon}</div>
                      <div id="me-pulses-label" class="text-xs mt-1" style="color: ${mePulses.labelColor}">${mePulses.label}</div>
                    </div>
                  </div>

                  <div id="me-dips-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <div class="text-xs text-gray-500">DIP Switches</div>
                      <div id="me-dips-val" class="font-mono">${this.factoryTestResults.dipSwitches || '—'}</div>
                    </div>
                    <div class="text-right">
                      <div id="me-dips-icon" class="text-2xl text-gray-400">⏺</div>
                      <div id="me-dips-label" class="text-xs text-gray-400 mt-1"></div>
                    </div>
                  </div>

                  <div id="me-lora-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between ${meLora.boxClass}">
                    <div>
                      <div class="text-xs text-gray-500">LoRa</div>
                      <div id="me-lora-val" class="font-mono">${this.factoryTestResults.loraAddress || '—'}</div>
                      <div id="me-lora-sub" class="text-xs text-gray-500">${_loraDetect || ''}${_loraPush ? ' · ' + _loraPush : ''}${_loraPassText ? ' · ' + _loraPassText : ''}</div>
                    </div>
                    <div class="text-right">
                      <div id="me-lora-icon" class="text-2xl ${meLora.iconClass}">${meLora.icon}</div>
                      <div id="me-lora-label" class="text-xs mt-1" style="color: ${meLora.labelColor}">${meLora.label}</div>
                    </div>
                  </div>

                  <div id="me-ain1-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between ${meAin1.boxClass}">
                    <div>
                      <div class="text-xs text-gray-500">AIN 1</div>
                      <div id="me-ain1-val" class="font-mono">${this._formatAIN(this.factoryTestResults.ain1Voltage)}</div>
                    </div>
                    <div class="text-right">
                      <div id="me-ain1-icon" class="text-2xl ${meAin1.iconClass}">${meAin1.icon}</div>
                      <div id="me-ain1-label" class="text-xs mt-1" style="color: ${meAin1.labelColor}">${meAin1.label}</div>
                    </div>
                  </div>

                  <div id="me-ain2-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between ${meAin2.boxClass}">
                    <div>
                      <div class="text-xs text-gray-500">AIN 2</div>
                      <div id="me-ain2-val" class="font-mono">${this._formatAIN(this.factoryTestResults.ain2Voltage)}</div>
                    </div>
                    <div class="text-right">
                      <div id="me-ain2-icon" class="text-2xl ${meAin2.iconClass}">${meAin2.icon}</div>
                      <div id="me-ain2-label" class="text-xs mt-1" style="color: ${meAin2.labelColor}">${meAin2.label}</div>
                    </div>
                  </div>

                  <div id="me-ain3-box" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 flex items-center justify-between ${meAin3.boxClass}">
                    <div>
                      <div class="text-xs text-gray-500">AIN 3</div>
                      <div id="me-ain3-val" class="font-mono">${this._formatAIN(this.factoryTestResults.ain3Voltage)}</div>
                    </div>
                    <div class="text-right">
                      <div id="me-ain3-icon" class="text-2xl ${meAin3.iconClass}">${meAin3.icon}</div>
                      <div id="me-ain3-label" class="text-xs mt-1" style="color: ${meAin3.labelColor}">${meAin3.label}</div>
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            ${this.selectedDevice === 'ZC-LCD' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold mb-3">🎮 Test Controls - ZC-LCD</h4>
                <div class="grid grid-cols-1 gap-2">
                    <button id="zc-wifi-btn" onclick="window.factoryTestingPage.runZcWifiTest()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">📶 WiFi Test</button>
                    <button id="zc-i2c-btn" onclick="window.factoryTestingPage.runZcI2cTest()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">🔬 I2C Temp/Humidity</button>
                    <button id="zc-rs485-btn" onclick="window.factoryTestingPage.runZcRs485Test()" class="px-4 py-3 bg-gray-300 hover:bg-gray-350 rounded-lg text-sm">🧭 RS485 Test</button>
                    <button id="zc-full-btn" onclick="window.factoryTestingPage.runZcFullTest()" class="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">✳️ Run FULL TEST (ZC-LCD)</button>
                    <button onclick="window.factoryTestingModule.acbClearOutput()" class="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">🧹 Clear Output</button>
                </div>

                  <div class="mt-4 grid grid-cols-2 gap-3">
                    <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                      <div class="text-sm text-gray-500 mb-1">WiFi Test</div>
                      <div class="text-sm text-gray-800 dark:text-gray-100 space-y-1">
                        <div><span class="text-gray-600">Status:</span> <span id="zc-wifi-status-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.factoryTestResults.wifi?.status || (this.factoryTestResults.wifi?.success ? 'done' : '—')}</span></div>
                        <div><span class="text-gray-600">RSSI:</span> <span id="zc-wifi-rssi-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.factoryTestResults.wifi?.rssi ?? '—'}</span></div>
                        <div><span class="text-gray-600">Networks:</span> <span id="zc-wifi-networks-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${(this.factoryTestResults.wifi?.networks && this.factoryTestResults.wifi.networks.length) ? this.factoryTestResults.wifi.networks.join(', ') : '—'}</span></div>
                      </div>
                    </div>
                    <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                      <div class="text-sm text-gray-500 mb-1">I2C Test</div>
                      <div class="text-sm text-gray-800 dark:text-gray-100 space-y-1">
                        <div><span class="text-gray-600">Status:</span> <span id="zc-i2c-status-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.factoryTestResults.i2c?.status || (this.factoryTestResults.i2c?.success ? 'done' : '—')}</span></div>
                        <div><span class="text-gray-600">Addr:</span> <span id="zc-i2c-addr-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.factoryTestResults.i2c?.sensor_addr || '—'}</span></div>
                        <div><span class="text-gray-600">Sensor:</span> <span id="zc-i2c-sensor-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.factoryTestResults.i2c?.sensor || '—'}</span></div>
                        <div><span class="text-gray-600">Temp:</span> <span id="zc-i2c-temp-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${typeof this.factoryTestResults.i2c?.temperature_c !== 'undefined' ? this.factoryTestResults.i2c.temperature_c + '°C' : '—'}</span></div>
                        <div><span class="text-gray-600">Humidity:</span> <span id="zc-i2c-hum-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${typeof this.factoryTestResults.i2c?.humidity_rh !== 'undefined' ? this.factoryTestResults.i2c.humidity_rh + '%' : '—'}</span></div>
                      </div>
                    </div>

                    <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                      <div class="text-sm text-gray-500 mb-1">RS485 Test</div>
                      <div class="text-sm text-gray-800 dark:text-gray-100 space-y-1">
                        <div><span class="text-gray-600">Status:</span> <span id="zc-rs485-status-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.factoryTestResults.rs485?.status || (this.factoryTestResults.rs485?.success ? 'done' : '—')}</span></div>
                        <div><span class="text-gray-600">Temp:</span> <span id="zc-rs485-temp-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${typeof this.factoryTestResults.rs485?.temperature !== 'undefined' ? this.factoryTestResults.rs485.temperature + '°C' : '—'}</span></div>
                        <div><span class="text-gray-600">Humidity:</span> <span id="zc-rs485-hum-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${typeof this.factoryTestResults.rs485?.humidity !== 'undefined' ? this.factoryTestResults.rs485.humidity : '—'}</span></div>
                        <div><span class="text-gray-600">Slave OK:</span> <span id="zc-rs485-slave-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${typeof this.factoryTestResults.rs485?.slave_ok !== 'undefined' ? (this.factoryTestResults.rs485.slave_ok ? 'Yes' : 'No') : '—'}</span></div>
                        <div><span class="text-gray-600">Master OK:</span> <span id="zc-rs485-master-val" class="font-mono text-sm text-gray-800 dark:text-gray-100">${typeof this.factoryTestResults.rs485?.master_ok !== 'undefined' ? (this.factoryTestResults.rs485.master_ok ? 'Yes' : 'No') : '—'}</span></div>
                      </div>
                    </div>
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
          
          <!-- Raw JSON Debug Toggle -->
          ${this.selectedDevice === 'ZC-LCD' ? `
            <div class="mt-4 flex items-center gap-2">
              <button onclick="window.factoryTestingPage.toggleRawJson()" class="px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded">${this.showRawJson ? 'Hide' : 'Show'} Raw JSON</button>
              <div class="text-xs text-gray-500">Toggle parsed JSON for WiFi / I2C / RS485</div>
            </div>
            ${this.showRawJson ? `
              <div class="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <div class="text-sm text-gray-500 mb-2">Raw JSON (parsed)</div>
                <pre class="text-xs font-mono text-gray-800 dark:text-gray-100 max-h-64 overflow-auto">
WiFi: ${JSON.stringify(this.factoryTestResults.wifi?.parsed || this.factoryTestResults.wifi || {}, null, 2)}

I2C: ${JSON.stringify(this.factoryTestResults.i2c?.parsed || this.factoryTestResults.i2c || {}, null, 2)}

RS485: ${JSON.stringify(this.factoryTestResults.rs485?.parsed || this.factoryTestResults.rs485 || {}, null, 2)}
                </pre>
              </div>
            ` : ''}
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
