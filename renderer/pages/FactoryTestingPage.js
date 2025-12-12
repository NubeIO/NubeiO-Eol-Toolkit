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
    this.v1Devices = ['Micro Edge'];
    
    // Gen 2 devices
    this.v2Devices = ['ZC-LCD', 'ZC-Controller', 'ACB-M', 'Droplet'];
    
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
    this.factoryTestResults = this._createEmptyFactoryResults();
    
    this.isConnected = false;
    this.isTesting = false;
    this.testProgress = '';
    this.showRawJson = false;
    this.showProfile = false; // toggles the small profile panel
    this.mode = 'auto'; // 'auto' or 'manual' for Micro Edge workflow
    this.preTestingCollapsed = true; // pre-testing section collapsed by default
    this._autoPollTimer = null;
    this.showConnectConfirm = false; // show modal to confirm before running tests in Auto
    this._lastAutoConnectedPort = '';
    this._autoConnectInProgress = false;
    this._autoConnectLastPort = '';
    this._autoConnectLastAttempt = 0;
    this._autoConnectManualSuppressUntil = 0;
    // Step flow: 'pre' (pre-test form) -> 'main' (tests) for ACB-M, ZC-LCD, Micro Edge and Droplet
    this.acbStep = 'main';
    this.zcStep = 'main';
    this.microEdgeStep = 'main';
    this.dropletStep = 'main';
    this.zcControllerStep = 'main';
    
    // Printer state
    this.printerConnected = false;
    this.allowPrint = false;
    this._printerCheckPromise = null;
    this._lastPrinterCheck = 0;
    this._postRenderTicket = false;
    this._printerPollTimer = null;
  }

  _createEmptyFactoryResults() {
    return {
      batteryVoltage: '',
      pulsesCounter: '',
      dipSwitches: '',
      ain1Voltage: '',
      ain2Voltage: '',
      ain3Voltage: '',
      relay1Status: '',
      relay2Status: '',
      vccVoltage: '',
      digitalInputs: '',
      loraAddress: '',
      loraDetect: '',
      loraRawPush: '',
      tests: {},
      _eval: {},
      summary: null,
      info: {}
    };
  }

  confirmConnectOk() {
    this.showConnectConfirm = false;
    this.app.render();
    // start tests after user confirms
    try {
      // Only auto-run tests in Auto mode; manual waits for user action
      if (this.mode === 'auto' && !this.isTesting) {
        this.runFactoryTests();
      }
    } catch (e) { console.warn('Failed to start tests after confirm:', e && e.message); }
  }

  cancelConnectConfirm() {
    this.showConnectConfirm = false;
    this.app.render();
  }

  togglePreTesting() {
    this.preTestingCollapsed = !this.preTestingCollapsed;
    this.app.render();
  }

  stopAuto() {
    // stop auto detection/connect loop
    this.mode = 'manual';
    if (this._autoPollTimer) { clearTimeout(this._autoPollTimer); this._autoPollTimer = null; }
    this.app.render();
  }

  async forceDisconnectDevice() {
    if (!window.factoryTestingModule) return;
    this.testProgress = 'Force disconnecting...';
    this.app.render();
    try {
      const res = await window.factoryTestingModule.forceDisconnect();
      // Reset UI state
      this.isConnected = false;
      this._lastAutoConnectedPort = '';
      try {
        window.factoryTestingModule.selectedPort = '';
        window.factoryTestingModule.updatePortDropdown();
      } catch (_) {}
      if (res && res.success) {
        this.testProgress = '✅ Force disconnected';
      } else {
        this.testProgress = `❌ Force disconnect failed: ${res && res.error ? res.error : 'Unknown error'}`;
      }
    } catch (e) {
      this.testProgress = `❌ Force disconnect error: ${e && e.message}`;
    }
    this.app.render();
  }

  toggleRawJson() {
    this.showRawJson = !this.showRawJson;
    this.app.render();
  }

  selectVersion(version) {
    this.selectedVersion = version;
    this.selectedDevice = null;
    // Stop any auto detection when backing out of a device
    if (this._autoPollTimer) { clearTimeout(this._autoPollTimer); this._autoPollTimer = null; }
    this.resetData();
    this.app.render();
  }

  selectDevice(device) {
    this.selectedDevice = device;
    // Stop any ongoing auto detection when switching devices
    if (this._autoPollTimer) { clearTimeout(this._autoPollTimer); this._autoPollTimer = null; }
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
    // Default tabs: ACB-M, ZC-LCD, Droplet and Micro Edge start at Auto tab and pre-step
    if (this.selectedDevice === 'ACB-M') {
      this.mode = 'auto';
      this.acbStep = 'pre';
      console.log('[Factory Testing Page] ACB-M selected, waiting for Proceed to Testing...');
    } else if (this.selectedDevice === 'ZC-LCD') {
      this.mode = 'auto';
      this.zcStep = 'pre';
      console.log('[Factory Testing Page] ZC-LCD selected, waiting for Proceed to Testing...');
    } else if (this.selectedDevice === 'Droplet') {
      this.mode = 'auto';
      this.dropletStep = 'pre';
      console.log('[Factory Testing Page] Droplet selected, waiting for Proceed to Testing...');
    } else if (this.selectedDevice === 'Micro Edge') {
      this.mode = 'auto';
      this.microEdgeStep = 'pre';
      console.log('[Factory Testing Page] Micro Edge selected, waiting for Proceed to Testing...');
    } else if (this.selectedDevice === 'ZC-Controller') {
      this.mode = 'auto';
      this.zcControllerStep = 'pre';
      console.log('[Factory Testing Page] ZC-Controller selected, waiting for Proceed to Testing...');
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

  goToAcbMain() {
    // Validate required pre-testing info and printer state (optional)
    if (!this.validatePreTestingInfo()) {
      return;
    }
    // Stop printer polling when entering main testing page
    if (this._printerPollTimer) {
      clearTimeout(this._printerPollTimer);
      this._printerPollTimer = null;
    }
    this.acbStep = 'main';
    this.app.render();
    // If auto mode, kick off detection and connection
    if (this.selectedDevice === 'ACB-M' && this.mode === 'auto') {
      console.log('[Factory Testing Page] ACB-M Auto mode: starting auto workflow...');
      setTimeout(() => this._startAutoWorkflow(), 150);
    }
  }

  goToZcMain() {
    // Validate required pre-testing info
    if (!this.validatePreTestingInfo()) {
      return;
    }
    // Stop printer polling when entering main testing page
    if (this._printerPollTimer) {
      clearTimeout(this._printerPollTimer);
      this._printerPollTimer = null;
    }
    this.zcStep = 'main';
    this.app.render();
    // If auto mode, kick off detection and connection
    if (this.selectedDevice === 'ZC-LCD' && this.mode === 'auto') {
      console.log('[Factory Testing Page] ZC-LCD Auto mode: starting auto workflow...');
      setTimeout(() => this._startAutoWorkflow(), 150);
    }
  }

  goToZcControllerMain() {
    // Validate required pre-testing info
    if (!this.validatePreTestingInfo()) {
      return;
    }
    // Stop printer polling when entering main testing page
    if (this._printerPollTimer) {
      clearTimeout(this._printerPollTimer);
      this._printerPollTimer = null;
    }
    this.zcControllerStep = 'main';
    this.app.render();
    // If auto mode, kick off detection and connection
    if (this.selectedDevice === 'ZC-Controller' && this.mode === 'auto') {
      console.log('[Factory Testing Page] ZC-Controller Auto mode: starting auto workflow...');
      setTimeout(() => this._startAutoWorkflow(), 150);
    }
  }

  goToMicroEdgeMain() {
    // Validate required pre-testing info
    if (!this.validatePreTestingInfo()) {
      return;
    }
    // Stop printer polling when entering main testing page
    if (this._printerPollTimer) {
      clearTimeout(this._printerPollTimer);
      this._printerPollTimer = null;
    }
    this.microEdgeStep = 'main';
    this.app.render();
    // If auto mode, kick off detection and connection
    if (this.selectedDevice === 'Micro Edge' && this.mode === 'auto') {
      console.log('[Factory Testing Page] Micro Edge Auto mode: starting auto workflow...');
      setTimeout(() => this._startAutoWorkflow(), 150);
    }
  }

  goToDropletMain() {
    // Debug: Log current preTesting state
    console.log('[goToDropletMain] Current preTesting:', JSON.stringify(this.preTesting));
    
    // Validate required pre-testing info
    if (!this.validatePreTestingInfo()) {
      console.log('[goToDropletMain] Validation failed, staying on pre page');
      return;
    }
    
    console.log('[goToDropletMain] Validation passed, proceeding to main');
    
    // Stop printer polling when entering main testing page
    if (this._printerPollTimer) {
      clearTimeout(this._printerPollTimer);
      this._printerPollTimer = null;
    }
    this.dropletStep = 'main';
    this.app.render();
    // If auto mode, kick off detection and connection
    if (this.selectedDevice === 'Droplet' && this.mode === 'auto') {
      console.log('[Factory Testing Page] Droplet Auto mode: starting auto workflow...');
      setTimeout(() => this._startAutoWorkflow(), 150);
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
    this.factoryTestResults = this._createEmptyFactoryResults();
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

  shouldAutoConnectForContext() {
    if (!this.selectedDevice) {
      return false;
    }
    // ACB-M: only auto-connect when in main step (after clicking Proceed to Testing) and auto mode
    if (this.selectedDevice === 'ACB-M') {
      return this.acbStep === 'main' && this.mode === 'auto';
    }
    // ZC-LCD: only auto-connect when in main step (after clicking Proceed to Testing) and auto mode
    if (this.selectedDevice === 'ZC-LCD') {
      return this.zcStep === 'main' && this.mode === 'auto';
    }
    // ZC-Controller: only auto-connect when in main step (after clicking Proceed to Testing) and auto mode
    if (this.selectedDevice === 'ZC-Controller') {
      return this.zcControllerStep === 'main' && this.mode === 'auto';
    }
    // Micro Edge: only auto-connect when in main step (after clicking Proceed to Testing) and auto mode
    if (this.selectedDevice === 'Micro Edge') {
      return this.microEdgeStep === 'main' && this.mode === 'auto';
    }
    return false;
  }

  async handleAutoPortDetected(portPath) {
    if (!portPath) return;
    if (!this.shouldAutoConnectForContext()) return;
    if (this.isConnected || this._autoConnectInProgress) return;

    const now = Date.now();
    if (this._autoConnectManualSuppressUntil && now < this._autoConnectManualSuppressUntil) {
      return;
    }
    if (this._autoConnectLastPort === portPath && (now - this._autoConnectLastAttempt) < 4000) {
      return;
    }

    this._autoConnectInProgress = true;
    this._autoConnectLastPort = portPath;
    this._autoConnectLastAttempt = now;

    if (window.factoryTestingModule) {
      window.factoryTestingModule.selectedPort = portPath;
    }

    const dropdown = document.getElementById('factory-port-select');
    if (dropdown) {
      dropdown.value = portPath;
    }

    this.testProgress = `Auto-connecting to ${portPath}...`;
    this.app.render();

    try {
      await this.connectDevice({ silent: true, triggeredByAutoPort: true });
    } catch (error) {
      console.warn('[Factory Testing] Auto connect failed:', error && error.message);
    } finally {
      this._autoConnectInProgress = false;
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
          <li>Run LoRa test (verify TX/RX communication)</li>
          <li>Read battery voltage (valid range check)</li>
          <li>Read I2C temperature & humidity sensor</li>
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

  // Helper function for inline handlers (instance method, not static)
  updateField(field, value) {
    this.preTesting[field] = value;
    console.log('[Factory Testing] Field updated:', field, value);
    // Do NOT call this.app.render() here to avoid losing focus
  }

  attachPreTestingListeners() {
    // Use event delegation on document to avoid losing focus on re-render
    // Remove old listener if exists
    if (this._preTestingInputHandler) {
      document.removeEventListener('input', this._preTestingInputHandler);
    }

    // Add new listener with event delegation
    this._preTestingInputHandler = (e) => {
      const target = e.target;
      if (target.dataset && target.dataset.field) {
        this.preTesting[target.dataset.field] = target.value;
        console.log('[Factory Testing] Field updated:', target.dataset.field, target.value);
      }
    };

    document.addEventListener('input', this._preTestingInputHandler);
    console.log('[Factory Testing] Pre-testing event delegation attached to document');
  }

  // Save current preTesting as defaults for selected device type
  saveDefaultsForDevice() {
    if (!this.selectedDevice) return;
    try {
      const key = `factoryDefaults:${this.selectedDevice.replace(/\s+/g, '-').toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(this.preTesting));
      this.testProgress = 'Saved defaults for ' + this.selectedDevice;
      // Don't re-render to avoid losing focus on input fields
      console.log('[Factory Testing] Defaults saved for', this.selectedDevice);
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
      this.preTesting = { testerName: '', hardwareVersion: '', firmwareVersion: '', batchId: '', workOrderSerial: '' };
      this.testProgress = 'Reset defaults for ' + this.selectedDevice;
      this.app.render(); // Re-render is OK here since user clicked Reset button
    } catch (e) {
      console.error('[Factory Testing] Failed to reset defaults:', e && e.message);
    }
  }

  toggleProfilePanel() {
    this.showProfile = !this.showProfile;
    this.app.render();
  }

  // Toggle Auto/Manual mode
  toggleMode(newMode) {
    if (newMode === this.mode) return;
    this.mode = newMode;
    if (this.mode === 'auto') {
      // Only start auto workflow if we're in the main testing step
      // For ACB-M: must be in 'main' step (after Proceed to Testing)
      // For ZC-LCD: must be in 'main' step (after Proceed to Testing)
      // For Micro Edge: must be in 'main' step (after Proceed to Testing)
      if (this.selectedDevice === 'ACB-M' && this.acbStep === 'main') {
        this._startAutoWorkflow();
      } else if (this.selectedDevice === 'ZC-LCD' && this.zcStep === 'main') {
        this._startAutoWorkflow();
      } else if (this.selectedDevice === 'ZC-Controller' && this.zcControllerStep === 'main') {
        this._startAutoWorkflow();
      } else if (this.selectedDevice === 'Micro Edge' && this.microEdgeStep === 'main') {
        this._startAutoWorkflow();
      }
      // If still in 'pre' step, don't start workflow yet
    } else {
      // stop auto polling
      if (this._autoPollTimer) { clearTimeout(this._autoPollTimer); this._autoPollTimer = null; }
    }
    this.app.render();
  }

  _startAutoWorkflow() {
    // Begin polling for ports and attempt auto-connect/run
    if (this._autoPollTimer) { clearTimeout(this._autoPollTimer); this._autoPollTimer = null; }
    // Gate: only start auto workflow if service allows auto-next
    try {
      if (window.factoryTestingModule && window.factoryTestingModule.getStatus) {
        const st = window.factoryTestingModule.getStatus();
        if (st && st.autoNextEnabled !== true) {
          this.testProgress = 'Waiting for Next Device...';
          this.app.render();
          return;
        }
      }
    } catch (e) { /* ignore */ }
    const attempt = async () => {
      if (!window.factoryTestingModule) return;
      try {
        await window.factoryTestingModule.loadSerialPorts();
        window.factoryTestingModule.updatePortDropdown();
        const ports = window.factoryTestingModule.serialPorts || [];
        if (ports.length > 0) {
          const portPath = ports[0].path || ports[0].comName || ports[0].path;
          // set selected in module and dropdown
          window.factoryTestingModule.selectedPort = portPath;
          const sel = document.getElementById('factory-port-select');
          if (sel) sel.value = portPath;
          // If already connected, skip attempting to connect again
          if (this.isConnected) {
            // update status and schedule next poll
            this.testProgress = `Already connected to ${portPath}`;
            this.app.render();
            if (this.mode === 'auto') {
              this._autoPollTimer = setTimeout(attempt, 2000);
            }
            return;
          }

          // Attempt connect; connectDevice will trigger tests in Auto mode
          await this.connectDevice({ triggeredByAuto: true, silent: true });
          // If connected, connectDevice already triggers runFactoryTests() in Auto mode
          if (this.isConnected) return;
        } else {
          // No ports found - clear selection and connection state
          try {
            if (window.factoryTestingModule) {
              window.factoryTestingModule.selectedPort = '';
              window.factoryTestingModule.serialPorts = [];
              window.factoryTestingModule.updatePortDropdown();
            }
          } catch (e) { /* ignore */ }
          // If previously connected, mark disconnected
          if (this.isConnected) {
            this.isConnected = false;
            this.testProgress = 'Device disconnected (port lost)';
            this.app.render();
          }
          // schedule next attempt
          if (this.mode === 'auto') {
            this._autoPollTimer = setTimeout(attempt, 2000);
          }
          return;
        }
      } catch (e) {
        console.warn('[Factory Testing] Auto workflow error:', e && e.message);
      }
      // schedule next attempt if still auto
      if (this.mode === 'auto') {
        this._autoPollTimer = setTimeout(attempt, 2000);
      }
    };
    attempt();
  }

  // User action: enable auto-next and start scanning for the next device
  async startTestNextDevice() {
    try {
      if (window.factoryTestingModule && window.factoryTestingModule.setAutoNextEnabled) {
        window.factoryTestingModule.setAutoNextEnabled(true);
      }
      // If currently connected, disconnect first
      if (this.isConnected) {
        await this.disconnectDevice();
      }
    } catch (e) { /* ignore */ }
    // kick off auto workflow
    this._startAutoWorkflow();
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

    // 1. Battery Voltage: pass if 3.45..3.7 (user-specified)
    const batt = parseVolts(results.batteryVoltage);
    setStatus('me-battery-icon', 'me-battery-label', 'me-battery-box', (batt >= 3.45 && batt <= 3.7));
    // 2. AIN1: 1.55-1.75 (user-specified)
    const a1 = parseVolts(results.ain1Voltage);
    setStatus('me-ain1-icon', 'me-ain1-label', 'me-ain1-box', (a1 >= 1.55 && a1 <= 1.75));
    // 3. AIN2: 0.95-1.15 (user-specified)
    const a2 = parseVolts(results.ain2Voltage);
    setStatus('me-ain2-icon', 'me-ain2-label', 'me-ain2-box', (a2 >= 0.95 && a2 <= 1.15));
    // 4. AIN3: 0.75-0.95 (user-specified)
    const a3 = parseVolts(results.ain3Voltage);
    setStatus('me-ain3-icon', 'me-ain3-label', 'me-ain3-box', (a3 >= 0.75 && a3 <= 0.95));
    // 5. Pulse > 3 (user-specified)
    const pulses = Number(results.pulsesCounter || 0);
    setStatus('me-pulses-icon', 'me-pulses-label', 'me-pulse-box', (pulses > 3));
    // 6. LoRa: detect + raw push OK
    // Check if loraDetect is a valid hex address (8 characters) or contains 'detect'
    const loraDetectValue = String(results.loraDetect || '');
    const detectOk = loraDetectValue.toLowerCase().includes('detect') || /^[0-9a-f]{8}$/i.test(loraDetectValue);
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
    console.log('[validatePreTestingInfo] Checking device:', this.selectedDevice);
    console.log('[validatePreTestingInfo] Current preTesting:', JSON.stringify(this.preTesting));
    
    const missing = [];
    if (!this.preTesting.testerName) missing.push('Tester Name');
    if (!this.preTesting.hardwareVersion) missing.push('Hardware Version');
    
    // For ACB-M, only Tester Name and Hardware Version are required
    // For ZC-LCD and Droplet, also require Firmware Version
    // For Micro Edge, all fields are required
    if (this.selectedDevice === 'ZC-LCD' || this.selectedDevice === 'Droplet') {
      if (!this.preTesting.firmwareVersion) missing.push('Firmware Version');
    } else if (this.selectedDevice === 'Micro Edge') {
      if (!this.preTesting.firmwareVersion) missing.push('Firmware Version');
      if (!this.preTesting.batchId) missing.push('Batch ID');
      if (!this.preTesting.workOrderSerial) missing.push('Work Order Serial');
    }
    
    if (missing.length > 0) {
        console.log('[validatePreTestingInfo] Missing fields:', missing);
        const msg = `Please fill in the following required fields:\n- ${missing.join('\n- ')}`;
        if (this.mode === 'auto') {
          this.testProgress = msg;
          this.app.render();
        } else {
          alert(msg);
        }
        return false;
    }
    
    console.log('[validatePreTestingInfo] All required fields present, validation passed');
    return true;
  }

  async connectDevice(options = {}) {
    if (!window.factoryTestingModule) {
      alert('Factory Testing Module not initialized');
      return;
    }

    const silent = options.silent === true;
    const triggeredByAuto = options.triggeredByAuto === true;
    const triggeredByAutoPort = options.triggeredByAutoPort === true;

    try {
      console.log('[Factory Testing Page] === START CONNECT WORKFLOW ===');
      
      // Get selected port and baud rate (prefer module-selectedPort for Auto)
      const portSelect = document.getElementById('factory-port-select');
      const baudrateSelect = document.getElementById('factory-baudrate-select');
      
      const modulePort = (window.factoryTestingModule && window.factoryTestingModule.selectedPort) ? window.factoryTestingModule.selectedPort : '';
      const domPort = portSelect ? portSelect.value : '';
      const selectedPort = modulePort || domPort || '';
      
      console.log('[Factory Testing Page] Current selectedDevice:', this.selectedDevice);
      
      // ACB-M always uses 9600 baud, others use dropdown value or 115200
      let selectedBaud;
      if (this.selectedDevice === 'ACB-M') {
        selectedBaud = '9600';
        console.log('[Factory Testing Page] ACB-M detected, forcing baud to 9600');
      } else {
        selectedBaud = baudrateSelect ? baudrateSelect.value : '115200';
        console.log('[Factory Testing Page] Non-ACB-M device, using baud:', selectedBaud);
      }
      
      console.log('[Factory Testing Page] Selected port:', selectedPort);
      console.log('[Factory Testing Page] Selected baud:', selectedBaud);
      
      if (!selectedPort) {
        if (this.mode === 'auto' || silent) {
          console.warn('[Factory Testing Page] No port selected - waiting for detection');
          this.testProgress = 'Waiting for serial port...';
          this.app.render();
          return { success: false, error: 'No serial port selected' };
        }
        const msg = 'Please select a serial port';
        alert(msg);
        return { success: false, error: msg };
      }
      
      this.testProgress = `Connecting to ${selectedPort} @ ${selectedBaud} baud...`;
      this.app.render();
      
      console.log('[Factory Testing Page] Calling module.connect()...');
      // Determine whether to use AT+UNLOCK - only Micro Edge requires it
      const useUnlock = this.selectedDevice === 'Micro Edge';
      // Prefer the resolved selectedPort when calling module.connect
      const portToUse = selectedPort || this.selectedPort || (window.factoryTestingModule && window.factoryTestingModule.selectedPort);
      const result = await window.factoryTestingModule.connect(portToUse, parseInt(selectedBaud), useUnlock, this.selectedDevice);
      console.log('[Factory Testing Page] Connect result:', result);
      
      if (result.success) {
        this.isConnected = true;
        // Persist selected port/baud from backend result for UI rendering
        if (result.port) {
          window.factoryTestingModule.selectedPort = result.port;
          this.selectedPort = result.port;
        }
        if (result.baudRate) {
          this.selectedBaud = String(result.baudRate);
        }
        // Track last auto-connected port/baud for modal display
        this._lastAutoConnectedPort = result.port || selectedPort;
        this._lastAutoConnectedBaud = String(result.baudRate || selectedBaud);
        this._autoConnectManualSuppressUntil = 0;
        this.testProgress = `✅ Connected to ${result.port || selectedPort}`;
        console.log('[Factory Testing Page] Connection successful');
        // If backend returned device info (unique ID / MAC), set it in page state
        if (result.deviceInfo) {
          this.deviceInfo = result.deviceInfo;
        }
        
        // ACB-M: Device info already read during connect, show popup
        if (this.selectedDevice === 'ACB-M') {
          // Use device info returned from connect
          if (result.deviceInfo) {
            this.deviceInfo = result.deviceInfo;
            console.log('[Factory Testing Page] ACB-M device info from connect:', this.deviceInfo);
          }
          this.testProgress = `✅ Connected - Device info retrieved`;
          
          // Show connection success popup with device information (always show in manual mode)
          if (!silent || this.mode === 'manual') {
            const infoMsg = [
              `✅ Connected successfully to ${selectedPort} @ ${selectedBaud} baud`,
              ``,
              `Device Information:`,
              `  HW Version: ${this.deviceInfo?.hwVersion || 'N/A'}`,
              `  Unique ID: ${this.deviceInfo?.uniqueId || 'N/A'}`,
              `  Device Make: ${this.deviceInfo?.deviceMake || 'N/A'}`,
              `  Device Model: ${this.deviceInfo?.deviceModel || 'N/A'}`,
              ``,
              `Ready to run tests!`
            ].join('\n');
            alert(infoMsg);
          }
          
          this.app.render();
          
          // Auto mode: show popup then run full tests automatically
          if (this.mode === 'auto') {
            if (!silent) {
              this._lastAutoConnectedPort = selectedPort;
              this.showConnectConfirm = true;
              this.app.render();
            }
            try {
              this.testProgress = 'Starting auto tests...';
              this.app.render();
              
              const fullRes = await window.factoryTestingModule.acbFullTest();
              if (fullRes && fullRes.success) {
                this.factoryTestResults = fullRes.data || this.factoryTestResults;
                this.testProgress = '✅ ACB-M auto tests completed';
                // Save results to enable Print Label if all tests pass
                await this.saveResultsToFile();
              } else {
                this.testProgress = `❌ ACB-M auto tests failed: ${fullRes && fullRes.error ? fullRes.error : 'Unknown error'}`;
              }
            } catch (e) {
              console.warn('[Factory Testing] ACB-M auto test error:', e && e.message);
              this.testProgress = `❌ Auto test error: ${e && e.message}`;
            }
            this.app.render();
          }
        } else if (this.selectedDevice === 'Micro Edge') {
          // Micro Edge: Device info already read during connect, just show popup
          if (result.deviceInfo) {
            this.deviceInfo = result.deviceInfo;
            console.log('[Factory Testing Page] Device info from connect:', this.deviceInfo);
          }
          this.testProgress = `✅ Connected - Device info retrieved`;
          this.app.render();
          
          // Show popup: "Connected successfully, please press button 5 times"
          // Always show for Micro Edge, even in auto mode
          const di = this.deviceInfo || {};
          const hasError = ['uniqueId','deviceModel','deviceMake','firmwareVersion'].some(k => String(di[k] || '').toUpperCase() === 'ERROR');
          const infoMsg = [
            `✅ Connected successfully to ${selectedPort} @ ${selectedBaud} baud`,
            '',
            'Device Information:',
            `  Unique ID: ${di.uniqueId || 'N/A'}`,
            `  Device Make: ${di.deviceMake || 'N/A'}`,
            `  Device Model: ${di.deviceModel || 'N/A'}`,
            `  FW Version: ${di.firmwareVersion || di.fwVersion || 'N/A'}`,
            '',
            hasError ? '❌ Failed to read all fields over RS485' : 'Ready to run tests!'
          ].join('\n');
          alert(infoMsg);
          
          // After user closes popup, run tests in auto mode
          if (this.mode === 'auto') {
            try {
              this.testProgress = 'Starting auto tests...';
              this.app.render();
              
              const fullRes = await window.factoryTestingModule.runFactoryTests('Micro Edge');
              if (fullRes && fullRes.success) {
                this.factoryTestResults = fullRes.data || this.factoryTestResults;
                this.testProgress = '✅ Micro Edge auto tests completed';
                // Save results to enable Print Label if all tests pass
                await this.saveResultsToFile();
              } else {
                this.testProgress = `❌ Micro Edge auto tests failed: ${fullRes && fullRes.error ? fullRes.error : 'Unknown error'}`;
              }
            } catch (e) {
              console.warn('[Factory Testing] Micro Edge auto test error:', e && e.message);
              this.testProgress = `❌ Auto test error: ${e && e.message}`;
            }
            this.app.render();
          }
          
        } else if (this.selectedDevice === 'ZC-LCD') {
          // ZC-LCD: Device info already read during connect, show popup
          if (result.deviceInfo) {
            this.deviceInfo = result.deviceInfo;
            console.log('[Factory Testing Page] ZC-LCD device info from connect:', this.deviceInfo);
          }
          this.testProgress = `✅ Connected - Device info retrieved`;
          
          // Show connection success modal (same style as Droplet) in both modes
          this._lastAutoConnectedPort = selectedPort;
          this._lastAutoConnectedBaud = String(selectedBaud);
          this.showConnectConfirm = true;
          this.app.render();
          
          // Auto mode: pause here; user will press OK then run tests manually
          
        } else if (this.selectedDevice === 'Droplet') {
          // Droplet: Device info already read during connect, show popup
          if (result.deviceInfo) {
            this.deviceInfo = result.deviceInfo;
            console.log('[Factory Testing Page] Droplet device info from connect:', this.deviceInfo);
          }
          this.testProgress = `✅ Connected - Device info retrieved`;
          
          // Show connection success popup with device information (always show in manual mode)
          if (!silent || this.mode === 'manual') {
            const infoMsg = [
              `✅ Connected successfully to ${selectedPort} @ ${selectedBaud} baud`,
              ``,
              `Device Information:`,
              `  Device Model: ${this.deviceInfo?.deviceModel || 'N/A'}`,
              `  Device Make: ${this.deviceInfo?.deviceMake || 'N/A'}`,
              `  FW Version: ${this.deviceInfo?.fwVersion || 'N/A'}`,
              `  Unique ID: ${this.deviceInfo?.uniqueId || 'N/A'}`,
              ``,
              `Ready to run tests!`
            ].join('\n');
            alert(infoMsg);
          }
          
          this.app.render();
          
          // Auto mode: for Droplet, PAUSE after connect and show info only.
          // Do NOT auto-run tests; require user action.
          if (this.mode === 'auto') {
            this._lastAutoConnectedPort = selectedPort;
            this.testProgress = `✅ Connected to ${selectedPort} — review device info, then press Run all tests`;
            this.showConnectConfirm = true;
            this.app.render();
          }
          
        } else {
          // Default connect message for other devices
          if (!silent) {
            const di = this.deviceInfo || {};
            const hasError = ['uniqueId','deviceModel','deviceMake','firmwareVersion'].some(k => String(di[k] || '').toUpperCase() === 'ERROR');
            const infoMsg = [
              `✅ Connected successfully to ${selectedPort} @ ${selectedBaud} baud`,
              '',
              'Device Information:',
              `  Unique ID: ${di.uniqueId || 'N/A'}`,
              `  Device Make: ${di.deviceMake || 'N/A'}`,
              `  Device Model: ${di.deviceModel || 'N/A'}`,
              `  FW Version: ${di.firmwareVersion || di.fwVersion || 'N/A'}`,
              '',
              hasError ? '❌ Failed to read all fields over RS485' : 'Ready to run tests!'
            ].join('\n');
            alert(infoMsg);
          }
        }
      } else {
        this.testProgress = `❌ Connection failed: ${result.error}`;
        console.error('[Factory Testing Page] Connection failed:', result.error);
        if (this.mode !== 'auto' && !silent) {
          alert(`Connection failed: ${result.error}`);
        }
      }
      
      this.app.render();
      console.log('[Factory Testing Page] === END CONNECT WORKFLOW ===');
      return result;
    } catch (error) {
      console.error('[Factory Testing Page] Connection error:', error);
      console.error('[Factory Testing Page] Error stack:', error.stack);
      this.testProgress = `❌ Error: ${error.message}`;
      if (this.mode !== 'auto' && !silent) {
        alert(`Connection error: ${error.message}`);
      }
      this.app.render();
      return { success: false, error: error.message, triggeredByAuto, triggeredByAutoPort };
    }
  }

  async disconnectDevice() {
    if (!window.factoryTestingModule) {
      return;
    }

    try {
      // Disable auto-next on user disconnect to prevent immediate auto-reconnect
      try { if (window.factoryTestingModule.setAutoNextEnabled) { window.factoryTestingModule.setAutoNextEnabled(false); } } catch (e) { /* ignore */ }
      await window.factoryTestingModule.disconnect();
      this.isConnected = false;
      this.testProgress = 'Disconnected';
      this._autoConnectManualSuppressUntil = Date.now() + 10000; // avoid instant reconnect after manual disconnect
      // Clear module selected port so auto-detect can pick a new device
      try {
        if (window.factoryTestingModule) {
          window.factoryTestingModule.selectedPort = '';
          window.factoryTestingModule.updatePortDropdown();
        }
      } catch (e) { /* ignore */ }

      // In auto mode, do not immediately restart. Wait for explicit user action.

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
      
      const result = await window.factoryTestingModule.readDeviceInfo(this.selectedDevice);
      
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
    if (!window.factoryTestingModule || !this.isConnected) { const msg = 'Connect first'; if (this.mode === 'auto') { this.testProgress = msg; this.app.render(); } else { alert(msg); } return; }
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
    if (!window.factoryTestingModule || !this.isConnected) { const msg = 'Connect first'; if (this.mode === 'auto') { this.testProgress = msg; this.app.render(); } else { alert(msg); } return; }
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
    if (!window.factoryTestingModule || !this.isConnected) { const msg = 'Connect first'; if (this.mode === 'auto') { this.testProgress = msg; this.app.render(); } else { alert(msg); } return; }
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
      const msg = 'Please connect to device first';
      if (this.mode === 'auto') {
        this.testProgress = msg; this.app.render();
      } else {
        alert(msg);
      }
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
        const mergedResults = Object.assign(this._createEmptyFactoryResults(), result.data || {});
        this.factoryTestResults = mergedResults;
        if (!this.factoryTestResults.tests) this.factoryTestResults.tests = {};
        if (!this.factoryTestResults._eval) this.factoryTestResults._eval = {};
        if (!this.factoryTestResults.summary) this.factoryTestResults.summary = null;

        if (this.selectedDevice === 'ACB-M' && this.factoryTestResults.info) {
          this.deviceInfo = Object.assign({}, this.deviceInfo, this.factoryTestResults.info);
        }

        if (this.selectedDevice === 'ZC-LCD' && this.factoryTestResults.info) {
          this.deviceInfo = Object.assign({}, this.deviceInfo, this.factoryTestResults.info);
        }

        if (this.selectedDevice === 'ACB-M') {
          const success = !!(this.factoryTestResults.summary && this.factoryTestResults.summary.passAll);
          this.testProgress = success ? 'ACB-M factory tests passed' : 'ACB-M factory tests reported failures';
        } else if (this.selectedDevice === 'ZC-LCD') {
          const success = !!(this.factoryTestResults.summary && this.factoryTestResults.summary.passAll);
          this.testProgress = success ? 'ZC-LCD factory tests passed' : 'ZC-LCD factory tests reported failures';
        } else if (this.selectedDevice === 'ZC-Controller') {
          // Merge device info if provided by service
          if (this.factoryTestResults.info) {
            this.deviceInfo = Object.assign({}, this.deviceInfo, this.factoryTestResults.info);
          }
          const success = !!(this.factoryTestResults.summary && this.factoryTestResults.summary.passAll);
          this.testProgress = success ? 'ZC-Controller factory tests passed' : 'ZC-Controller factory tests reported failures';
        } else {
          this.testProgress = 'Factory tests completed successfully';
        }
        
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
        
        // If tests pass, enable Print button
        try {
          if (this.selectedDevice === 'Micro Edge') {
            const evals = (this.factoryTestResults && this.factoryTestResults._eval) ? this.factoryTestResults._eval : null;
            const allPass = evals ? ['pass_battery','pass_ain1','pass_ain2','pass_ain3','pass_pulses','pass_lora'].every(k => evals[k] === true) : false;
            if (allPass) {
              this.allowPrint = true;
              this.testProgress += '\n✅ All tests passed - Print Label enabled';
            }
          } else if (this.selectedDevice === 'ACB-M') {
            const evals = (this.factoryTestResults && this.factoryTestResults._eval) ? this.factoryTestResults._eval : null;
            const allPass = evals ? ['pass_uart','pass_rtc','pass_wifi','pass_eth','pass_rs4852'].every(k => evals[k] === true) : false;
            if (allPass) {
              this.allowPrint = true;
              this.testProgress += '\n✅ All tests passed - Print Label enabled';
            }
          } else if (this.selectedDevice === 'ZC-LCD') {
            const evals = (this.factoryTestResults && this.factoryTestResults._eval) ? this.factoryTestResults._eval : null;
            const allPass = evals ? ['pass_wifi','pass_rs485','pass_i2c','pass_lcd'].every(k => evals[k] === true) : false;
            if (allPass) {
              this.allowPrint = true;
              this.testProgress += '\n✅ All tests passed - Print Label enabled';
            }
          } else if (this.selectedDevice === 'ZC-Controller') {
            const summary = this.factoryTestResults && this.factoryTestResults.summary;
            const allPass = !!(summary && summary.passAll);
            if (allPass) {
              this.allowPrint = true;
              this.testProgress += '\n✅ All tests passed - Print Label enabled';
            }
          } else if (this.selectedDevice === 'Droplet') {
            const summary = this.factoryTestResults && this.factoryTestResults.summary;
            const allPass = !!(summary && summary.passAll);
            if (allPass) {
              this.allowPrint = true;
              this.testProgress += '\n✅ All tests passed - Print Label enabled';
            }
          }
        } catch (e) {}
      }
    } catch (error) {
      console.error('Save results error:', error);
    }
  }

  clearOutput() {
    // Clear all test results and progress
    this.factoryTestResults = this._createEmptyFactoryResults();
    this.testProgress = '';
    this.app.render();
    console.log('[Factory Testing Page] Output cleared');
  }

  async checkPrinterConnection(options = {}) {
    const force = options.force === true;
    const now = Date.now();
    
    // Don't auto-check printer - only check when force=true (user clicks button)
    if (!force) {
      return this.printerConnected;
    }

    if (this._printerCheckPromise) {
      return this._printerCheckPromise;
    }

    const checkTask = async () => {
      try {
        if (!window.printerAPI || !window.printerAPI.checkConnection) {
          console.warn('printerAPI.checkConnection not available');
          this._updatePrinterState(false);
          return this.printerConnected;
        }

        const result = await window.printerAPI.checkConnection();
        const isConnected = !!(result && result.connected);
        if (!isConnected) {
          const reason = result && result.error ? ` - ${result.error}` : '';
          console.warn(`Printer not detected${reason}`);
        }
        this._updatePrinterState(isConnected);
        return this.printerConnected;
      } catch (e) {
        console.warn('Failed to check printer:', e && e.message);
        this._updatePrinterState(false);
        return this.printerConnected;
      } finally {
        this._lastPrinterCheck = Date.now();
        this._printerCheckPromise = null;
      }
    };

    this._printerCheckPromise = checkTask();
    return this._printerCheckPromise;
  }

  _schedulePrinterPoll(delayMs) {
    // Printer polling is disabled - only manual checks via "Check Printer" button
    return;
  }

  _updatePrinterState(isConnected) {
    const prev = this.printerConnected;
    this.printerConnected = !!isConnected;
    if (prev !== this.printerConnected) {
      this.app.render();
    }
  }

  async printLabel() {
    try {
      if (!this.printerConnected) {
        await this.checkPrinterConnection({ force: true });
        if (!this.printerConnected) {
          alert('Brother PT-P900W printer not detected. Please connect via USB and try again.');
          return;
        }
      }

      // Build payload from device/preTesting and test results
      // Use LoRa Detect ID instead of full UID (e.g., F8AC119F)
      const loraId = (this.factoryTestResults && this.factoryTestResults.loraDetect) || '';
      const uid = loraId || ((this.deviceInfo && (this.deviceInfo.uniqueId || this.deviceInfo.uid || this.deviceInfo.mac)) || '');
      
      // MN = Make + Model (e.g., "ME-0005" or "ME-05")
      const deviceMake = (this.deviceInfo && this.deviceInfo.deviceMake) || '';
      const deviceModel = (this.deviceInfo && this.deviceInfo.deviceModel) || '';
      const mn = deviceMake && deviceModel ? `${deviceMake}-${deviceModel}` : '';
      
      // FW = Firmware Version
      const firmware = this.deviceInfo && this.deviceInfo.firmwareVersion ? this.deviceInfo.firmwareVersion : 
                       (this.preTesting && this.preTesting.firmwareVersion ? this.preTesting.firmwareVersion : '');
      
      // BA = Batch ID
      const batchId = this.preTesting && this.preTesting.batchId ? this.preTesting.batchId : '';
      
      // Date in YYYY/MM/DD format
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '/');
      
      // Barcode = LoRa ID for traceability
      const barcode = loraId || uid || '';

      const payload = { 
        uid,           // LoRa Detect ID (e.g., F8AC119F)
        mn,            // MN: Make + Model
        firmware,      // FW: Firmware version
        batchId,       // BA: Batch ID
        date: dateStr, // Date
        barcode        // Barcode data (LoRa ID)
      };
      
      console.log('Print payload:', payload);

      this.testProgress = 'Sending label to Brother PT-P900W via USB...'; 
      this.app.render();
      
      const res = await window.printerAPI.printLabel(payload);
      
      if (res && res.success) {
        this.testProgress = '✅ Label printed successfully via USB!';
        alert('✅ Label printed successfully!');
      } else {
        this.testProgress = `❌ Print failed: ${res && res.error ? res.error : 'Unknown error'}`;
        alert(`❌ Print failed: ${res && res.error ? res.error : 'Unknown error'}`);
      }
      
      this.app.render();
    } catch (e) {
      alert('Print error: ' + e.message);
      this.testProgress = `❌ Print error: ${e.message}`;
      this.app.render();
    }
  }

  render() {
    // Version selection screen
    if (!this.selectedVersion) {
      return `
        <div class="rounded-xl border border-gray-200 bg-white px-8 py-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 class="mb-6 text-2xl font-bold text-gray-800 dark:text-gray-100">Factory Testing - Select Version</h2>
          
          <div class="grid grid-cols-2 gap-6">
            <button
              onclick="window.factoryTestingPage.selectVersion('v1')"
              class="group rounded-xl border-2 border-gray-300 bg-gray-50 p-8 transition-all hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500 dark:hover:bg-gray-800"
            >
              <div class="mb-4 text-4xl text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">📟</div>
              <div class="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">Gen 1</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Micro Edge</div>
            </button>
            
            <button
              onclick="window.factoryTestingPage.selectVersion('v2')"
              class="group rounded-xl border-2 border-gray-300 bg-gray-50 p-8 transition-all hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500 dark:hover:bg-gray-800"
            >
              <div class="mb-4 text-4xl text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">📱</div>
              <div class="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">Gen 2</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">ZC-LCD, ACB-M, Droplet, ZC-Controller</div>
            </button>
          </div>
        </div>
      `;
    }

    // Device selection screen
    if (!this.selectedDevice) {
      const devices = this.selectedVersion === 'v1' ? this.v1Devices : this.v2Devices;

      return `
        <div class="rounded-xl border border-gray-200 bg-white px-8 py-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Factory Testing - ${this.selectedVersion === 'v1' ? 'Gen 1' : 'Gen 2'}
            </h2>
            <button
              onclick="window.factoryTestingPage.selectVersion(null)"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ← Back to Version Selection
            </button>
          </div>

          <p class="mb-6 text-gray-600 dark:text-gray-400">Select a device to test:</p>

          <div class="grid grid-cols-2 gap-6">
            ${devices.map(device => {
              const isMicroEdge = device === 'Micro Edge';
              const isZCLCD = device === 'ZC-LCD';
              const isZCController = device === 'ZC-Controller';
              const isACBM = device === 'ACB-M';
              const isDroplet = device === 'Droplet';

              let icon, description;

              if (isMicroEdge) {
                icon = '⚡';
                description = 'Digital, Analog, Pulse & LoRa';
              } else if (isZCLCD) {
                icon = '📺';
                description = 'Screen Testing';
              } else if (isZCController) {
                icon = '🔌';
                description = 'Relay Testing';
              } else if (isACBM) {
                icon = '🌐';
                description = 'Gateway Testing';
              } else if (isDroplet) {
                icon = '🌡️';
                description = 'Environmental Sensors & LoRa';
              } else {
                icon = '🔧';
                description = 'Factory Testing';
              }

              return `
                <button
                  onclick="window.factoryTestingPage.selectDevice('${device}')"
                  class="group rounded-xl border-2 border-gray-300 bg-gray-50 p-8 transition-all hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                >
                  <div class="mb-4 text-6xl text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">${icon}</div>
                  <div class="mb-2 text-2xl font-bold text-gray-800 dark:text-gray-100">${device}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">${description}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Testing interface: enable Gen1 Micro Edge and Gen2 ZC-LCD/ACB-M
    const isTestingEnabled = (this.selectedVersion === 'v1' && this.selectedDevice === 'Micro Edge') ||
           (this.selectedVersion === 'v2' && (this.selectedDevice === 'ZC-LCD' || this.selectedDevice === 'ACB-M' || this.selectedDevice === 'Droplet' || this.selectedDevice === 'ZC-Controller'));
    
    // Schedule port dropdown update after render
    if (isTestingEnabled && window.factoryTestingModule && !this._postRenderTicket) {
      this._postRenderTicket = true;
      setTimeout(() => {
        try {
          console.log('[Factory Testing Page] Post-render: updating dropdown');
          window.factoryTestingModule.updatePortDropdown();
          if (window.factoryTestingPage) {
            window.factoryTestingPage.checkPrinterConnection();
          }
        } finally {
          this._postRenderTicket = false;
        }
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

    const acbTests = this.factoryTestResults.tests || {};
    const acbEval = this.factoryTestResults._eval || {};
    const acbSummary = this.factoryTestResults.summary || {};
    const acbStatusBadge = (flag) => {
      if (flag === true) return { text: 'PASS', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700' };
      if (flag === false) return { text: 'FAIL', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700' };
      return { text: 'N/A', className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-700' };
    };
    const acbBadges = {
      uart: acbStatusBadge(acbEval.pass_uart),
      rtc: acbStatusBadge(acbEval.pass_rtc),
      wifi: acbStatusBadge(acbEval.pass_wifi),
      eth: acbStatusBadge(acbEval.pass_eth),
      rs4852: acbStatusBadge(acbEval.pass_rs4852)
    };
    const acbSummaryBadge = acbStatusBadge(typeof acbSummary.passAll === 'boolean' ? acbSummary.passAll : undefined);

    // ZC-LCD badges
    const zcTests = this.factoryTestResults.tests || {};
    const zcEval = this.factoryTestResults._eval || {};
    const zcSummary = this.factoryTestResults.summary || {};
    const zcStatusBadge = (flag) => {
      if (flag === true) return { text: 'PASS', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700' };
      if (flag === false) return { text: 'FAIL', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700' };
      return { text: 'N/A', className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-700' };
    };
    const zcBadges = {
      wifi: zcStatusBadge(zcEval.pass_wifi),
      rs485: zcStatusBadge(zcEval.pass_rs485),
      i2c: zcStatusBadge(zcEval.pass_i2c),
      lcd: zcStatusBadge(zcEval.pass_lcd)
    };
    const zcSummaryBadge = zcStatusBadge(typeof zcSummary.passAll === 'boolean' ? zcSummary.passAll : undefined);

    return `
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-2xl text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              ${this.selectedDevice === 'Micro Edge' ? '⚡' : this.selectedDevice === 'ZC-LCD' ? '📺' : this.selectedDevice === 'ZC-Controller' ? '🔌' : this.selectedDevice === 'ACB-M' ? '🌐' : this.selectedDevice === 'Droplet' ? '🌡️' : '🔧'}
            </div>
            <div>
              <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
                ${this.selectedDevice}
              </h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                ${this.selectedDevice === 'Micro Edge' ? 'Digital, Analog, Pulse & LoRa Testing' : 
                  this.selectedDevice === 'ZC-LCD' ? 'Screen Testing' : 
                  this.selectedDevice === 'ZC-Controller' ? 'Relay Testing' : 
                  this.selectedDevice === 'ACB-M' ? 'Gateway Testing' : 
                  this.selectedDevice === 'Droplet' ? 'Environmental Sensors & LoRa Testing' : 
                  'Factory Testing'} • Gen ${this.selectedVersion === 'v1' ? '1' : '2'}
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
              <span class="h-2 w-2 rounded-full ${this.isConnected ? 'bg-green-500' : 'bg-gray-400'}"></span>
              ${this.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <button
              onclick="window.factoryTestingPage.selectDevice(null)"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ← Back to Device Selection
            </button>
          </div>
        </div>

        ${!isTestingEnabled ? `
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <p class="text-yellow-800 dark:text-yellow-200 font-semibold">
              ⚠️ Testing is currently available for Gen 1 - Micro Edge and Gen 2 - ZC-LCD, ACB-M, Droplet
            </p>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Support for additional Gen 2 devices will be added soon.
            </p>
          </div>
        ` : ''}

        <!-- Micro Edge Pre Page (Mode + Pre-Testing + Printer) -->
        ${this.selectedDevice === 'Micro Edge' && this.microEdgeStep === 'pre' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🧭</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 1 · Select Mode</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Auto will detect COM and run tests</p>
                </div>
              </div>
              <div class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/40">
                <button onclick="window.factoryTestingPage.toggleMode('auto')" class="px-4 py-2 text-sm font-medium ${this.mode === 'auto' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Auto</button>
                <button onclick="window.factoryTestingPage.toggleMode('manual')" class="px-4 py-2 text-sm font-medium ${this.mode === 'manual' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Manual</button>
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">📝</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 2 · Pre-Testing Information</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Complete before running tests</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2">
              <button 
                onclick="window.factoryTestingPage.saveDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Save defaults
              </button>
              <button 
                onclick="window.factoryTestingPage.resetDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Reset
              </button>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Tester Name *</label>
                <input type="text" data-field="testerName" value="${this.preTesting.testerName || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Hardware Version *</label>
                <input type="text" data-field="hardwareVersion" value="${this.preTesting.hardwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Firmware Version *</label>
                <input type="text" data-field="firmwareVersion" value="${this.preTesting.firmwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Batch ID *</label>
                <input type="text" data-field="batchId" value="${this.preTesting.batchId || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Work Order Serial *</label>
                <input type="text" data-field="workOrderSerial" value="${this.preTesting.workOrderSerial || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🖨️</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 3 · Connect Brother PT-P900W</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Ensure USB printer is connected</p>
                </div>
              </div>
              <div>
                <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${this.printerConnected ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}">${this.printerConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button onclick="window.factoryTestingPage.checkPrinterConnection({ force: true })" class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Check Printer</button>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <button onclick="window.factoryTestingPage.goToMicroEdgeMain()" class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100">
              Proceed to Testing
            </button>
          </div>
        ` : ''}

        <!-- ACB-M Pre Page (Mode + Pre-Testing + Printer) -->
        ${this.selectedDevice === 'ACB-M' && this.acbStep === 'pre' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🧭</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 1 · Select Mode</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Auto will detect COM and run tests</p>
                </div>
              </div>
              <div class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/40">
                <button onclick="window.factoryTestingPage.toggleMode('auto')" class="px-4 py-2 text-sm font-medium ${this.mode === 'auto' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Auto</button>
                <button onclick="window.factoryTestingPage.toggleMode('manual')" class="px-4 py-2 text-sm font-medium ${this.mode === 'manual' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Manual</button>
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">📝</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 2 · Pre-Testing Information</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Complete before running tests</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2">
              <button 
                onclick="window.factoryTestingPage.saveDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Save defaults
              </button>
              <button 
                onclick="window.factoryTestingPage.resetDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Reset
              </button>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Tester Name *</label>
                <input type="text" data-field="testerName" value="${this.preTesting.testerName || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Hardware Version *</label>
                <input type="text" data-field="hardwareVersion" value="${this.preTesting.hardwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Batch ID</label>
                <input type="text" data-field="batchId" value="${this.preTesting.batchId || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Work Order Serial</label>
                <input type="text" data-field="workOrderSerial" value="${this.preTesting.workOrderSerial || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🖨️</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 3 · Connect Brother PT-P900W</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Ensure USB printer is connected</p>
                </div>
              </div>
              <div>
                <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${this.printerConnected ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}">${this.printerConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button onclick="window.factoryTestingPage.checkPrinterConnection({ force: true })" class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Check Printer</button>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <button onclick="window.factoryTestingPage.goToAcbMain()" class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100">
              Proceed to Testing
            </button>
          </div>
        ` : ''}

        <!-- ZC-LCD Pre Page (Mode + Pre-Testing) -->
        ${this.selectedDevice === 'ZC-LCD' && this.zcStep === 'pre' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🧭</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 1 · Select Mode</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Auto will detect COM and run tests</p>
                </div>
              </div>
              <div class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/40">
                <button onclick="window.factoryTestingPage.toggleMode('auto')" class="px-4 py-2 text-sm font-medium ${this.mode === 'auto' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Auto</button>
                <button onclick="window.factoryTestingPage.toggleMode('manual')" class="px-4 py-2 text-sm font-medium ${this.mode === 'manual' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Manual</button>
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">📝</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 2 · Pre-Testing Information</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Complete before running tests</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2">
              <button 
                onclick="window.factoryTestingPage.saveDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Save defaults
              </button>
              <button 
                onclick="window.factoryTestingPage.resetDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Reset
              </button>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Tester Name *</label>
                <input type="text" data-field="testerName" value="${this.preTesting.testerName || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Firmware Version *</label>
                <input type="text" data-field="firmwareVersion" value="${this.preTesting.firmwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Hardware Version *</label>
                <input type="text" data-field="hardwareVersion" value="${this.preTesting.hardwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Batch ID</label>
                <input type="text" data-field="batchId" value="${this.preTesting.batchId || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Work Order Serial</label>
                <input type="text" data-field="workOrderSerial" value="${this.preTesting.workOrderSerial || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🖨️</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 3 · Connect Brother PT-P900W</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Ensure USB printer is connected</p>
                </div>
              </div>
              <div>
                <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${this.printerConnected ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}">${this.printerConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button onclick="window.factoryTestingPage.checkPrinterConnection({ force: true })" class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Check Printer</button>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <button onclick="window.factoryTestingPage.goToZcMain()" class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100">
              Proceed to Testing
            </button>
          </div>
        ` : ''}

        <!-- ZC-Controller Pre Page (Mode + Pre-Testing) -->
        ${this.selectedDevice === 'ZC-Controller' && this.zcControllerStep === 'pre' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🧭</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 1 · Select Mode</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Auto will detect COM and run tests (enabled after Proceed)</p>
                </div>
              </div>
              <div class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/40">
                <button onclick="window.factoryTestingPage.toggleMode('auto')" class="px-4 py-2 text-sm font-medium ${this.mode === 'auto' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Auto</button>
                <button onclick="window.factoryTestingPage.toggleMode('manual')" class="px-4 py-2 text-sm font-medium ${this.mode === 'manual' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Manual</button>
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">📝</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 2 · Pre-Testing Information</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Complete before running tests</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2">
              <button 
                onclick="window.factoryTestingPage.saveDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Save defaults
              </button>
              <button 
                onclick="window.factoryTestingPage.resetDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Reset
              </button>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Tester Name *</label>
                <input type="text" data-field="testerName" value="${this.preTesting.testerName || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Firmware Version *</label>
                <input type="text" data-field="firmwareVersion" value="${this.preTesting.firmwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Hardware Version *</label>
                <input type="text" data-field="hardwareVersion" value="${this.preTesting.hardwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Batch ID</label>
                <input type="text" data-field="batchId" value="${this.preTesting.batchId || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Work Order Serial</label>
                <input type="text" data-field="workOrderSerial" value="${this.preTesting.workOrderSerial || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🖨️</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 3 · Connect Brother PT-P900W</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Ensure USB printer is connected</p>
                </div>
              </div>
              <div>
                <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${this.printerConnected ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}">${this.printerConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button onclick="window.factoryTestingPage.checkPrinterConnection({ force: true })" class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Check Printer</button>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <button onclick="window.factoryTestingPage.goToZcControllerMain()" class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100">
              Proceed to Testing
            </button>
          </div>
        ` : ''}

        <!-- Droplet Pre Page (Mode + Pre-Testing + Printer) -->
        ${this.selectedDevice === 'Droplet' && this.dropletStep === 'pre' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🧭</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 1 · Select Mode</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Auto will detect COM and run tests</p>
                </div>
              </div>
              <div class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/40">
                <button onclick="window.factoryTestingPage.toggleMode('auto')" class="px-4 py-2 text-sm font-medium ${this.mode === 'auto' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Auto</button>
                <button onclick="window.factoryTestingPage.toggleMode('manual')" class="px-4 py-2 text-sm font-medium ${this.mode === 'manual' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Manual</button>
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">📝</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 2 · Pre-Testing Information</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Complete before running tests</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2">
              <button 
                onclick="window.factoryTestingPage.saveDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Save defaults
              </button>
              <button 
                onclick="window.factoryTestingPage.resetDefaultsForDevice()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Reset
              </button>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Tester Name *</label>
                <input type="text" data-field="testerName" value="${this.preTesting.testerName || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Firmware Version *</label>
                <input type="text" data-field="firmwareVersion" value="${this.preTesting.firmwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Hardware Version *</label>
                <input type="text" data-field="hardwareVersion" value="${this.preTesting.hardwareVersion || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Batch ID</label>
                <input type="text" data-field="batchId" value="${this.preTesting.batchId || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600 dark:text-gray-300">Work Order Serial</label>
                <input type="text" data-field="workOrderSerial" value="${this.preTesting.workOrderSerial || ''}" class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100" />
              </div>
            </div>
          </div>

          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">🖨️</div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 3 · Connect Brother PT-P900W</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Ensure USB printer is connected</p>
                </div>
              </div>
              <div>
                <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${this.printerConnected ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}">${this.printerConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button onclick="window.factoryTestingPage.checkPrinterConnection({ force: true })" class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Check Printer</button>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <button onclick="window.factoryTestingPage.goToDropletMain()" class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100">
              Proceed to Testing
            </button>
          </div>
        ` : ''}

        ${isTestingEnabled && ((this.selectedDevice === 'ACB-M' && this.acbStep === 'main') || (this.selectedDevice === 'ZC-LCD' && this.zcStep === 'main') || (this.selectedDevice === 'Micro Edge' && this.microEdgeStep === 'main') || (this.selectedDevice === 'Droplet' && this.dropletStep === 'main') || (this.selectedDevice === 'ZC-Controller' && this.zcControllerStep === 'main')) ? `
          <!-- Connection Section (hidden in Auto mode) -->
          ${this.mode === 'manual' ? `
          <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Connect to Device</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect to the device via UART to communicate using AT commands.
            </p>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">Serial Port</label>
                <div class="flex gap-2">
                  ${this.isConnected ? `
                    <input
                      id="factory-port-connected"
                      class="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      type="text"
                      value="${window.factoryTestingModule?.selectedPort || window.factoryTestingPage?.selectedPort || 'Unknown'}"
                      readonly
                    />
                  ` : `
                    <select
                      id="factory-port-select"
                      class="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      onchange="window.factoryTestingModule.selectedPort = this.value; console.log('Port changed to:', this.value);"
                    >
                      <option value="">Select Port</option>
                    </select>
                  `}
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
                  ${this.isConnected ? 'Connected' : (window.factoryTestingModule ? `${window.factoryTestingModule.serialPorts.length} ports available` : 'Loading...')}
                </p>
              </div>
              <div>
                <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1">Baud Rate</label>
                <select
                  id="factory-baudrate-select"
                  class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  ${this.isConnected ? 'disabled' : ''}
                >
                  <option value="9600" ${this.selectedDevice === 'ACB-M' ? 'selected' : ''}>9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200" ${this.selectedDevice !== 'ACB-M' ? 'selected' : ''}>115200</option>
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
                <button
                  onclick="window.factoryTestingPage.forceDisconnectDevice()"
                  class="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                  title="Force release any stuck serial state"
                >
                  🛑 Force Disconnect
                </button>
              ` : `
                <button
                  onclick="window.factoryTestingPage.disconnectDevice()"
                  class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  🔌 Disconnect
                </button>
                <button
                  onclick="window.factoryTestingPage.forceDisconnectDevice()"
                  class="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                  title="Force release any stuck serial state"
                >
                  🛑 Force Disconnect
                </button>
              `}
            </div>
          </div>
          ` : `
          <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between">
            <div>
              <strong class="text-sm">Auto Mode</strong>
              <div class="text-xs text-gray-500">Ports: ${window.factoryTestingModule ? window.factoryTestingModule.serialPorts.length : '...'} • Selected: ${window.factoryTestingModule ? (window.factoryTestingModule.selectedPort || '—') : '—'}</div>
            </div>
            <div class="flex gap-2">
              ${this.isConnected ? `
                <button onclick="window.factoryTestingPage.disconnectDevice()" class="px-3 py-1 bg-red-500 text-white rounded">Disconnect</button>
              ` : ''}
              <button onclick="window.factoryTestingPage.forceDisconnectDevice()" class="px-3 py-1 bg-orange-500 text-white rounded" title="Force release serial">Force Disconnect</button>
              <button onclick="window.factoryTestingPage.startTestNextDevice()" class="px-3 py-1 bg-green-600 text-white rounded">Test Next Device</button>
              <button onclick="window.factoryTestingPage.stopAuto()" class="px-3 py-1 bg-red-500 text-white rounded">Stop Auto</button>
            </div>
          </div>
          `}

          <!-- Brother PT-P900W Printer Section -->
          <div class="mb-6 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  🖨️
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Brother PT-P900W</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Direct USB printing via py-brotherlabel</p>
                </div>
              </div>
              <span class="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
                <span class="h-2 w-2 rounded-full ${this.printerConnected ? 'bg-green-500' : 'bg-gray-400'}"></span>
                ${this.printerConnected ? 'Connected' : 'USB Direct'}
              </span>
            </div>
            <div class="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
              ${this.printerConnected ? 'Printer ready for label printing.' : 'Connect the printer via USB before printing.'}
            </div>
            <div class="mt-4 flex items-center gap-3">
              <button 
                onclick="window.factoryTestingPage.printLabel()" 
                class="flex-1 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                  this.allowPrint 
                    ? 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100' 
                    : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400'
                }" 
                ${this.allowPrint ? '' : 'disabled'}>
                <span class="flex items-center justify-center gap-2">
                  <span class="text-base">🏷️</span>
                  <span>Print Label</span>
                </span>
              </button>
              <div class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
                ${this.allowPrint ? 'Ready to print' : 'Waiting for tests'}
              </div>
            </div>
          </div>

          <!-- Pre-Testing Information Section -->
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  📝
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Pre-Testing Information</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Complete before running tests</p>
                </div>
              </div>
              <button 
                onclick="window.factoryTestingPage.togglePreTesting()" 
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                ${this.preTestingCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>

            ${this.preTestingCollapsed ? '' : (`
              <div class="mt-4 flex items-center gap-2">
                <button 
                  onclick="window.factoryTestingPage.saveDefaultsForDevice()" 
                  class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                  Save defaults
                </button>
                <button 
                  onclick="window.factoryTestingPage.resetDefaultsForDevice()" 
                  class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                  Reset
                </button>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
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
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:ring-0 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
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
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:ring-0 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
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
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:ring-0 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label class="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
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
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:ring-0 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div class="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-300">
                <strong class="text-gray-700 dark:text-gray-200">Note:</strong> fields marked with <span class="text-red-500">*</span> are required and will be stored in the report.
              </div>

              ${this.showProfile ? (`
                <div class="mt-4 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-xs uppercase tracking-wide text-gray-500">Saved profile</div>
                      <div class="font-mono text-sm text-gray-800 dark:text-gray-100">${this.preTesting.testerName || '—'} · ${this.preTesting.hardwareVersion || '—'} · ${this.preTesting.batchId || '—'} · ${this.preTesting.workOrderSerial || '—'}</div>
                    </div>
                    <div class="text-xs text-gray-500">Per-device defaults</div>
                  </div>
                </div>
              `) : ''}
            `)}
          </div>
          <!-- Device Information Section (compact single-row) -->
          ${this.acbStep === 'main' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                📟
              </div>
              <h4 class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Device information</h4>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                <span class="text-xs uppercase tracking-wide text-gray-500">FW</span>
                <span>${this.deviceInfo.firmwareVersion || this.deviceInfo.fwVersion || '—'}</span>
              </div>
              <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                <span class="text-xs uppercase tracking-wide text-gray-500">UID</span>
                <span>${(this.deviceInfo.uniqueId || '—').substring(0,24)}</span>
              </div>
              <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                <span class="text-xs uppercase tracking-wide text-gray-500">Make</span>
                <span>${this.deviceInfo.deviceMake || '—'}</span>
              </div>
              <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200">
                <span class="text-xs uppercase tracking-wide text-gray-500">Model</span>
                <span>${this.deviceInfo.deviceModel || '—'}</span>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Factory Testing Section -->
          ${this.acbStep === 'main' ? `
          <div class="mb-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  ${this.selectedDevice === 'Micro Edge' ? '⚡' : this.selectedDevice === 'ZC-LCD' ? '📺' : this.selectedDevice === 'ZC-Controller' ? '🔌' : this.selectedDevice === 'ACB-M' ? '🌐' : this.selectedDevice === 'Droplet' ? '🌡️' : '🧪'}
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Step 3 · Run Factory Tests</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${this.selectedDevice || 'Select device'} workflow</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                ${this.selectedDevice === 'Micro Edge' || this.selectedDevice === 'ACB-M' ? `
                  <div class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/40">
                    <button onclick="window.factoryTestingPage.toggleMode('auto')" class="px-4 py-2 text-sm font-medium ${this.mode === 'auto' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Auto</button>
                    <button onclick="window.factoryTestingPage.toggleMode('manual')" class="px-4 py-2 text-sm font-medium ${this.mode === 'manual' ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'} rounded-md">Manual</button>
                  </div>
                ` : ''}
                <button
                  onclick="window.factoryTestingPage.clearOutput()"
                  class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Clear Output
                </button>
                <button
                  onclick="window.factoryTestingPage.runFactoryTests()"
                  class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100"
                  ${(!this.isConnected || this.isTesting || (this.selectedDevice === 'ACB-M' && this.mode === 'auto')) ? 'disabled' : ''}
                >
                  ${this.isTesting ? `
                    <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Running...</span>
                  ` : '<span>Run all tests</span>'}
                </button>
              </div>
            </div>
            <!-- Pass/Fail Banner -->
            ${this.factoryTestResults && this.factoryTestResults._eval && Object.keys(this.factoryTestResults._eval).length ? `
              ${(() => {
                // For ACB-M: check ACB-M specific tests
                if (this.selectedDevice === 'ACB-M') {
                  const allPass = this.factoryTestResults._eval.pass_uart && 
                                  this.factoryTestResults._eval.pass_rtc && 
                                  this.factoryTestResults._eval.pass_wifi && 
                                  this.factoryTestResults._eval.pass_eth && 
                                  this.factoryTestResults._eval.pass_rs4852;
                  return allPass ? `
                    <div class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                      Device passed all checks.
                    </div>
                  ` : `
                    <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                      Device failed one or more checks. Review the results below.
                    </div>
                  `;
                }
                // For ZC-Controller: use summary.passAll (commandsOk + mismatches)
                if (this.selectedDevice === 'ZC-Controller') {
                  const ok = !!(this.factoryTestResults.summary && this.factoryTestResults.summary.passAll);
                  return ok ? `
                    <div class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                      Device passed all checks.
                    </div>
                  ` : `
                    <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                      Device failed one or more checks. Review the results below.
                    </div>
                  `;
                }
                // For Droplet: require LoRa + Battery + I2C all pass
                if (this.selectedDevice === 'Droplet') {
                  const allPass = !!(this.factoryTestResults.summary && this.factoryTestResults.summary.passAll);
                  return allPass ? `
                    <div class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                      Device passed all checks.
                    </div>
                  ` : `
                    <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                      Device failed one or more checks. Review the results below.
                    </div>
                  `;
                }
                // For ZC-LCD: check ZC-LCD specific tests
                if (this.selectedDevice === 'ZC-LCD') {
                  const allPass = this.factoryTestResults._eval.pass_wifi && 
                                  this.factoryTestResults._eval.pass_rs485 && 
                                  this.factoryTestResults._eval.pass_i2c && 
                                  this.factoryTestResults._eval.pass_lcd;
                  return allPass ? `
                    <div class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                      Device passed all checks.
                    </div>
                  ` : `
                    <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                      Device failed one or more checks. Review the results below.
                    </div>
                  `;
                }
                // For Micro Edge: check Micro Edge specific tests
                const allPass = this.factoryTestResults._eval.pass_battery && 
                                this.factoryTestResults._eval.pass_ain1 && 
                                this.factoryTestResults._eval.pass_ain2 && 
                                this.factoryTestResults._eval.pass_ain3 && 
                                this.factoryTestResults._eval.pass_pulses && 
                                this.factoryTestResults._eval.pass_lora;
                return allPass ? `
                  <div class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                    Device passed all checks.
                  </div>
                ` : `
                  <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    Device failed one or more checks. Review the results below.
                  </div>
                `;
              })()}
            ` : ''}
            
            <!-- ACB-M Test Controls -->
            ${this.selectedDevice === 'ACB-M' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <div class="flex items-center justify-between">
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">📊 Test Results</div>
                    <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${acbSummaryBadge.className}">${acbSummaryBadge.text}</span>
                  </div>
                  <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div class="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
                      <div class="flex items-center justify-between">
                        <div class="font-semibold text-gray-800 dark:text-gray-100">UART Loopback</div>
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${acbBadges.uart.className}">${acbBadges.uart.text}</span>
                      </div>
                      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">Response: ${acbTests.uart && acbTests.uart.value ? acbTests.uart.value : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">${acbTests.uart && acbTests.uart.message ? acbTests.uart.message : 'Awaiting test...'}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
                      <div class="flex items-center justify-between">
                        <div class="font-semibold text-gray-800 dark:text-gray-100">RTC</div>
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${acbBadges.rtc.className}">${acbBadges.rtc.text}</span>
                      </div>
                      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">Time: ${acbTests.rtc && acbTests.rtc.time ? acbTests.rtc.time : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">${acbTests.rtc && acbTests.rtc.message ? acbTests.rtc.message : 'Awaiting test...'}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
                      <div class="flex items-center justify-between">
                        <div class="font-semibold text-gray-800 dark:text-gray-100">Ethernet</div>
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${acbBadges.eth.className}">${acbBadges.eth.text}</span>
                      </div>
                      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">MAC: ${acbTests.eth && acbTests.eth.mac ? acbTests.eth.mac : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">IP: ${acbTests.eth && acbTests.eth.ip ? acbTests.eth.ip : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">${acbTests.eth && acbTests.eth.message ? acbTests.eth.message : 'Awaiting test...'}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
                      <div class="flex items-center justify-between">
                        <div class="font-semibold text-gray-800 dark:text-gray-100">WiFi</div>
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${acbBadges.wifi.className}">${acbBadges.wifi.text}</span>
                      </div>
                      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">Networks: ${acbTests.wifi && typeof acbTests.wifi.networks !== 'undefined' ? acbTests.wifi.networks : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Connected: ${acbTests.wifi && typeof acbTests.wifi.connected !== 'undefined' ? acbTests.wifi.connected : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">${acbTests.wifi && acbTests.wifi.message ? acbTests.wifi.message : 'Awaiting test...'}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/60 md:col-span-2">
                      <div class="flex items-center justify-between">
                        <div class="font-semibold text-gray-800 dark:text-gray-100">RS485-2</div>
                        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${acbBadges.rs4852.className}">${acbBadges.rs4852.text}</span>
                      </div>
                      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">Status: ${(acbTests.rs4852 && typeof acbTests.rs4852.status !== 'undefined') ? acbTests.rs4852.status : '—'}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">${acbTests.rs4852 && acbTests.rs4852.message ? acbTests.rs4852.message : 'Awaiting test...'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            ${this.selectedDevice === 'Micro Edge' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold mb-3">🧩 Micro Edge - Test Results</h4>
                <div class="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 text-sm">
                  <div class="font-semibold mb-2">Test Conditions</div>
                  <div class="grid grid-cols-3 gap-2">
                    <div><span class="text-gray-600">Battery:</span> <span class="font-mono">3.45 — 3.70 V</span></div>
                    <div><span class="text-gray-600">AIN1:</span> <span class="font-mono">1.55 — 1.75 V</span></div>
                    <div><span class="text-gray-600">AIN2:</span> <span class="font-mono">0.95 — 1.15 V</span></div>
                    <div><span class="text-gray-600">AIN3:</span> <span class="font-mono">0.75 — 0.95 V</span></div>
                    <div><span class="text-gray-600">Pulses:</span> <span class="font-mono">&gt; 3</span></div>
                    <div><span class="text-gray-600">LoRa:</span> <span class="font-mono">Detect + OK</span></div>
                  </div>
                </div>
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
                <!-- Header with Clear Output Button -->
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-semibold">📊 Test Results - ZC-LCD</h4>
                  <button onclick="window.factoryTestingModule.acbClearOutput()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-medium">🧹 Clear Output</button>
                </div>

                <!-- Test Results Grid -->
                <div class="grid grid-cols-2 gap-3">
                  <!-- WiFi Test -->
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">📶 WiFi Test</div>
                      ${this.factoryTestResults?.tests?.wifi ? `
                        <div class="text-xl">${this.factoryTestResults.tests.wifi.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.wifi?.pass ? 'PASS' : (this.factoryTestResults?.tests?.wifi ? 'FAIL' : '—')}</span></div>
                      <div><span class="font-medium">Networks:</span> <span class="font-mono">${this.factoryTestResults?.tests?.wifi?.networks ?? '—'}</span></div>
                      <div><span class="font-medium">Connected:</span> <span class="font-mono">${this.factoryTestResults?.tests?.wifi?.connected ?? '—'}</span></div>
                      ${this.factoryTestResults?.tests?.wifi?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.wifi.message}</div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- I2C Test -->
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🔬 I2C Temp/Humidity</div>
                      ${this.factoryTestResults?.tests?.i2c ? `
                        <div class="text-xl">${this.factoryTestResults.tests.i2c.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.pass ? 'PASS' : (this.factoryTestResults?.tests?.i2c ? 'FAIL' : '—')}</span></div>
                      <div><span class="font-medium">Address:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.i2cAddress ?? '—'}</span></div>
                      <div><span class="font-medium">Temperature:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.temperature != null ? this.factoryTestResults.tests.i2c.temperature : '—'}</span></div>
                      <div><span class="font-medium">Humidity:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.humidity != null ? this.factoryTestResults.tests.i2c.humidity : '—'}</span></div>
                      ${this.factoryTestResults?.tests?.i2c?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.i2c.message}</div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- RS485 Test -->
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🧭 RS485 Test</div>
                      ${this.factoryTestResults?.tests?.rs485 ? `
                        <div class="text-xl">${this.factoryTestResults.tests.rs485.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.rs485?.pass ? 'PASS' : (this.factoryTestResults?.tests?.rs485 ? 'FAIL' : '—')}</span></div>
                      <div><span class="font-medium">Value:</span> <span class="font-mono">${this.factoryTestResults?.tests?.rs485?.value ?? '—'}</span></div>
                      <div><span class="font-medium">Expected:</span> <span class="font-mono">4096</span></div>
                      ${this.factoryTestResults?.tests?.rs485?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.rs485.message}</div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- LCD Test -->
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">📺 LCD Test</div>
                      ${this.factoryTestResults?.tests?.lcd ? `
                        <div class="text-xl">${this.factoryTestResults.tests.lcd.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.lcd?.pass ? 'PASS' : (this.factoryTestResults?.tests?.lcd ? 'FAIL' : '—')}</span></div>
                      <div><span class="font-medium">Touch Count:</span> <span class="font-mono">${this.factoryTestResults?.tests?.lcd?.touchCount ?? '—'}</span></div>
                      <div><span class="font-medium">Required:</span> <span class="font-mono">> 2</span></div>
                      ${this.factoryTestResults?.tests?.lcd?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.lcd.message}</div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            ${this.selectedDevice === 'ZC-Controller' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-semibold">🔌 Test Results - ZC-Controller</h4>
                  <button onclick="window.factoryTestingModule.acbClearOutput()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-medium">🧹 Clear Output</button>
                </div>

                

                <div class="grid grid-cols-2 gap-3">
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🟢 Status OFF-1</div>
                      ${this.factoryTestResults?.tests?.status_off_1 ? (() => { const t = this.factoryTestResults.tests.status_off_1; const ok = (t.b3 || '').toUpperCase() === 'FF' && (t.b4 || '').toUpperCase() === '03'; return `<div class=\"text-xl\">${ok ? '✅' : '❌'}</div>`; })() : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Expected:</span> <span class="font-mono">FF 03</span></div>
                      <div><span class="font-medium">Bytes:</span> <span class="font-mono">${(this.factoryTestResults?.tests?.status_off_1?.b3 || '—')} ${(this.factoryTestResults?.tests?.status_off_1?.b4 || '')}</span></div>
                      <div><span class="font-medium">Bits:</span> <span class="font-mono">${this.factoryTestResults?.tests?.status_off_1?.bits ? this.factoryTestResults.tests.status_off_1.bits.join('') : '—'}</span></div>
                      <div><span class="font-medium">Mismatches:</span> <span class="font-mono">${(this.factoryTestResults?.tests?.status_off_1?.mismatches || []).length ? this.factoryTestResults.tests.status_off_1.mismatches.join(', ') : 'None'}</span></div>
                      ${(this.factoryTestResults?.tests?.status_off_1?.mismatches || []).length ? `
                        <div class=\"mt-1 flex flex-wrap gap-1\">${(() => { const map=[1,2,3,4,5,6,7,8,9,10]; return this.factoryTestResults.tests.status_off_1.mismatches.map(n => `<span class=\"px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 border border-red-300\">Relay ${map[n-1] || n}</span>`).join(' '); })()}</div>
                      ` : ''}
                      ${this.factoryTestResults?.tests?.status_off_1?.message ? `<div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.status_off_1.message}</div>` : ''}
                    </div>
                  </div>

                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🟢 Status Relay Close</div>
                      ${this.factoryTestResults?.tests?.status_on_1 ? (() => { const t = this.factoryTestResults.tests.status_on_1; const ok = (t.b3 || '').toUpperCase() === '00' && (t.b4 || '').toUpperCase() === '00'; return `<div class=\"text-xl\">${ok ? '✅' : '❌'}</div>`; })() : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Expected:</span> <span class="font-mono">00 00</span></div>
                      <div><span class="font-medium">Bytes:</span> <span class="font-mono">${(this.factoryTestResults?.tests?.status_on_1?.b3 || '—')} ${(this.factoryTestResults?.tests?.status_on_1?.b4 || '')}</span></div>
                      <div><span class="font-medium">Bits:</span> <span class="font-mono">${this.factoryTestResults?.tests?.status_on_1?.bits ? this.factoryTestResults.tests.status_on_1.bits.join('') : '—'}</span></div>
                      ${(() => {
                        const t = this.factoryTestResults?.tests?.status_on_1;
                        const bits = t?.bits || null;
                        const expectedOn = [1,3,5,7,9,19,17,15,13,11];
                        if (!Array.isArray(bits)) return '';
                        // Map bits to relay IDs following send order grouping
                        // Group-1 (bits 0..9) → 1,3,5,7,9,19,17,15,13,11
                        const g1 = [1,3,5,7,9,19,17,15,13,11];
                        // Group-2 (bits 10..19) → 2,4,6,8,10,20,18,16,14,12
                        const g2 = [2,4,6,8,10,20,18,16,14,12];
                        const failing = [];
                        bits.slice(0,10).forEach((b, idx) => {
                          const relayId = g1[idx];
                          const shouldOn = expectedOn.includes(relayId);
                          if ((shouldOn && b !== 0) || (!shouldOn && b !== 1)) failing.push(relayId);
                        });
                        bits.slice(10,20).forEach((b, idx) => {
                          const relayId = g2[idx];
                          const shouldOn = expectedOn.includes(relayId);
                          if ((shouldOn && b !== 0) || (!shouldOn && b !== 1)) failing.push(relayId);
                        });
                        return `
                          <div><span class=\"font-medium\">Expected ON (send order):</span> <span class=\"font-mono\">${expectedOn.join(', ')}</span></div>
                          <div><span class=\"font-medium\">Fail Relays:</span> <span class=\"font-mono\">${failing.length ? failing.join(', ') : 'None'}</span></div>
                          ${failing.length ? `<div class=\"mt-1 flex flex-wrap gap-1\">${failing.map(n => `<span class=\"px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 border border-red-300\">Relay ${n}</span>`).join(' ')}</div>` : ''}
                        `;
                      })()}
                      ${this.factoryTestResults?.tests?.status_on_1?.message ? `<div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.status_on_1.message}</div>` : ''}
                    </div>
                  </div>

                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🟢 Status OFF-1-again</div>
                      ${this.factoryTestResults?.tests?.status_off_1_again ? (() => { const t = this.factoryTestResults.tests.status_off_1_again; const ok = (t.b3 || '').toUpperCase() === 'FF' && (t.b4 || '').toUpperCase() === '03'; return `<div class=\"text-xl\">${ok ? '✅' : '❌'}</div>`; })() : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Expected:</span> <span class="font-mono">FF 03</span></div>
                      <div><span class="font-medium">Bytes:</span> <span class="font-mono">${(this.factoryTestResults?.tests?.status_off_1_again?.b3 || '—')} ${(this.factoryTestResults?.tests?.status_off_1_again?.b4 || '')}</span></div>
                      <div><span class="font-medium">Bits:</span> <span class="font-mono">${this.factoryTestResults?.tests?.status_off_1_again?.bits ? this.factoryTestResults.tests.status_off_1_again.bits.join('') : '—'}</span></div>
                      <div><span class="font-medium">Mismatches:</span> <span class="font-mono">${(this.factoryTestResults?.tests?.status_off_1_again?.mismatches || []).length ? this.factoryTestResults.tests.status_off_1_again.mismatches.join(', ') : 'None'}</span></div>
                      ${(this.factoryTestResults?.tests?.status_off_1_again?.mismatches || []).length ? `
                        <div class=\"mt-1 flex flex-wrap gap-1\">${(() => { const map=[1,2,3,4,5,6,7,8,9,10]; return this.factoryTestResults.tests.status_off_1_again.mismatches.map(n => `<span class=\"px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 border border-red-300\">Relay ${map[n-1] || n}</span>`).join(' '); })()}</div>
                      ` : ''}
                      ${this.factoryTestResults?.tests?.status_off_1_again?.message ? `<div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.status_off_1_again.message}</div>` : ''}
                    </div>
                  </div>

                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🟢 Status Relay Open</div>
                      ${this.factoryTestResults?.tests?.status_on_2 ? (() => { const t = this.factoryTestResults.tests.status_on_2; const ok = (t.b3 || '').toUpperCase() === '00' && (t.b4 || '').toUpperCase() === '00'; return `<div class=\"text-xl\">${ok ? '✅' : '❌'}</div>`; })() : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Expected:</span> <span class="font-mono">00 00</span></div>
                      <div><span class="font-medium">Bytes:</span> <span class="font-mono">${(this.factoryTestResults?.tests?.status_on_2?.b3 || '—')} ${(this.factoryTestResults?.tests?.status_on_2?.b4 || '')}</span></div>
                      <div><span class="font-medium">Bits:</span> <span class="font-mono">${this.factoryTestResults?.tests?.status_on_2?.bits ? this.factoryTestResults.tests.status_on_2.bits.join('') : '—'}</span></div>
                      ${(() => {
                        const t = this.factoryTestResults?.tests?.status_on_2;
                        const bits = t?.bits || null;
                        const expectedOn = [2,4,6,8,10,20,18,16,14,12];
                        if (!Array.isArray(bits)) return '';
                        // For ON-2, swap mapping so first 10 bits align to even relays (send order)
                        // Group-1 (bits 0..9) → 2,4,6,8,10,20,18,16,14,12
                        const g1 = [2,4,6,8,10,20,18,16,14,12];
                        // Group-2 (bits 10..19) → 1,3,5,7,9,19,17,15,13,11
                        const g2 = [1,3,5,7,9,19,17,15,13,11];
                        const failing = [];
                        bits.slice(0,10).forEach((b, idx) => {
                          const relayId = g1[idx];
                          const shouldOn = expectedOn.includes(relayId);
                          if ((shouldOn && b !== 0) || (!shouldOn && b !== 1)) failing.push(relayId);
                        });
                        bits.slice(10,20).forEach((b, idx) => {
                          const relayId = g2[idx];
                          const shouldOn = expectedOn.includes(relayId);
                          if ((shouldOn && b !== 0) || (!shouldOn && b !== 1)) failing.push(relayId);
                        });
                        return `
                          <div><span class=\"font-medium\">Expected ON (send order):</span> <span class=\"font-mono\">${expectedOn.join(', ')}</span></div>
                          <div><span class=\"font-medium\">Fail Relays:</span> <span class=\"font-mono\">${failing.length ? failing.join(', ') : 'None'}</span></div>
                          ${failing.length ? `<div class=\"mt-1 flex flex-wrap gap-1\">${failing.map(n => `<span class=\"px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 border border-red-300\">Relay ${n}</span>`).join(' ')}</div>` : ''}
                        `;
                      })()}
                      ${this.factoryTestResults?.tests?.status_on_2?.message ? `<div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.status_on_2.message}</div>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            ${this.selectedDevice === 'Droplet' ? `
              <div class="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <!-- Header with Clear Output Button -->
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-semibold">🌡️ Test Results - Droplet</h4>
                  <button onclick="window.factoryTestingModule.acbClearOutput()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-medium">🧹 Clear Output</button>
                </div>

                <!-- Test Results Grid -->
                <div class="grid grid-cols-2 gap-3">
                  <!-- LoRa Test -->
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">📡 LoRa Test</div>
                      ${this.factoryTestResults?.tests?.lora ? `
                        <div class="text-xl">${this.factoryTestResults.tests.lora.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.lora?.pass ? 'PASS' : (this.factoryTestResults?.tests?.lora ? 'FAIL' : '—')}</span></div>
                      <div><span class="font-medium">TX Done:</span> <span class="font-mono">${this.factoryTestResults?.tests?.lora?.txDone ?? '—'}</span></div>
                      <div><span class="font-medium">RX Done:</span> <span class="font-mono">${this.factoryTestResults?.tests?.lora?.rxDone ?? '—'}</span></div>
                      <div><span class="font-medium">Value RX:</span> <span class="font-mono">${this.factoryTestResults?.tests?.lora?.valueRx ?? '—'}</span></div>
                      ${this.factoryTestResults?.tests?.lora?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.lora.message}</div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Battery Test -->
                  <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🔋 Battery Test</div>
                      ${this.factoryTestResults?.tests?.battery ? `
                        <div class="text-xl">${this.factoryTestResults.tests.battery.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.battery?.pass ? 'PASS' : (this.factoryTestResults?.tests?.battery ? 'FAIL' : '—')}</span></div>
                      <div><span class="font-medium">Voltage:</span> <span class="font-mono">${this.factoryTestResults?.tests?.battery?.voltage != null ? this.factoryTestResults.tests.battery.voltage + 'V' : '—'}</span></div>
                      <div><span class="font-medium">Range:</span> <span class="font-mono">0-5V</span></div>
                      ${this.factoryTestResults?.tests?.battery?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.battery.message}</div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- I2C Test -->
                  <div class="col-span-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm font-semibold text-gray-700 dark:text-gray-300">🔬 I2C Temp/Humidity</div>
                      ${this.factoryTestResults?.tests?.i2c ? `
                        <div class="text-xl">${this.factoryTestResults.tests.i2c.pass ? '✅' : '❌'}</div>
                      ` : ''}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div class="grid grid-cols-2 gap-x-4">
                        <div><span class="font-medium">Status:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.pass ? 'PASS' : (this.factoryTestResults?.tests?.i2c ? 'FAIL' : '—')}</span></div>
                        <div><span class="font-medium">Address:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.i2cAddress ?? '—'}</span></div>
                        <div><span class="font-medium">Temperature:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.temperature != null ? this.factoryTestResults.tests.i2c.temperature : '—'}</span></div>
                        <div><span class="font-medium">Humidity:</span> <span class="font-mono">${this.factoryTestResults?.tests?.i2c?.humidity != null ? this.factoryTestResults.tests.i2c.humidity : '—'}</span></div>
                      </div>
                      ${this.factoryTestResults?.tests?.i2c?.message ? `
                        <div class="mt-2 text-xs italic text-gray-500">${this.factoryTestResults.tests.i2c.message}</div>
                      ` : ''}
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
WiFi: ${JSON.stringify((this.factoryTestResults.wifi && this.factoryTestResults.wifi.parsed) || this.factoryTestResults.wifi || {}, null, 2)}

I2C: ${JSON.stringify((this.factoryTestResults.i2c && this.factoryTestResults.i2c.parsed) || this.factoryTestResults.i2c || {}, null, 2)}

RS485: ${JSON.stringify((this.factoryTestResults.rs485 && this.factoryTestResults.rs485.parsed) || this.factoryTestResults.rs485 || {}, null, 2)}
                </pre>
              </div>
            ` : ''}
          ` : ''}
        ` : ''}
          ` : ''}

        <!-- Instructions -->
        ${this.acbStep === 'main' ? `
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">${this._instructionTitle()}</p>
          ${this.renderInstructionsByDevice()}
        </div>
        ` : ''}
      </div>
      ${this.showConnectConfirm ? `
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black opacity-40"></div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 w-11/12 max-w-md p-4">
            <h3 class="text-sm font-semibold mb-3">nube-io-toolkit</h3>
            ${(() => {
              const port = this._lastAutoConnectedPort || '';
              const baud = this._lastAutoConnectedBaud ? ` @ ${this._lastAutoConnectedBaud} baud` : '';
              const di = this.deviceInfo || {};
              const model = di.deviceModel || '';
              const make = di.deviceMake || '';
              const fw = di.firmwareVersion || di.fwVersion || '';
              const uid = di.uniqueIdShort || di.uniqueId || '';
              const text = [
                `☑ Connected successfully to ${port}${baud}`,
                '',
                'Device Information:',
                `Device Model: ${model}`,
                `Device Make: ${make}`,
                `FW Version: ${fw}`,
                `Unique ID: ${uid}`,
                '',
                'Ready to run tests!'
              ].join('\n');
              return `<pre class="text-xs whitespace-pre-wrap font-sans">${text}</pre>`;
            })()}
            <div class="mt-3 flex justify-end">
              <button onclick="window.factoryTestingPage.confirmConnectOk()" class="px-4 py-1 bg-gray-200 dark:bg-gray-700 rounded">OK</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  _instructionTitle() {
    if (this.selectedDevice === 'Micro Edge') return 'Micro Edge Testing:';
    if (this.selectedDevice === 'Droplet') return 'Droplet Testing:';
    if (this.selectedDevice === 'ACB-M') return 'ACB-M Testing:';
    return 'Factory Testing Instructions:';
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
