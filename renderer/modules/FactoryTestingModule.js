/**
 * Factory Testing Module
 * Provides UI interactions for factory testing
 */

class FactoryTestingModule {
  constructor(app) {
    this.app = app;
    this.selectedPort = '';
    this.baudRate = 115200;
    this.serialPorts = [];
  }

  async init() {
    console.log('Initializing Factory Testing Module...');
    
    // Load available serial ports
    await this.loadSerialPorts();
    
    console.log('Factory Testing Module initialized');
  }

  async loadSerialPorts() {
    try {
      console.log('[Factory Testing] Loading serial ports...');
      const ports = await window.electronAPI.getSerialPorts();
      console.log('[Factory Testing] Raw ports from API:', ports);
      
      if (ports && ports.length > 0) {
        if (typeof ports[0] === 'string') {
          this.serialPorts = ports.map(path => ({ path }));
        } else {
          this.serialPorts = ports;
        }
        
        console.log('[Factory Testing] Processed ports:', this.serialPorts);
        
        // Auto-select first port if none selected
        if (this.serialPorts.length > 0 && !this.selectedPort) {
          this.selectedPort = this.serialPorts[0].path;
          console.log('[Factory Testing] Auto-selected port:', this.selectedPort);
        }
      } else {
        console.log('[Factory Testing] No serial ports found');
        this.serialPorts = [];
      }
      
      // Update UI dropdown if it exists
      this.updatePortDropdown();
      
      return { success: true, count: this.serialPorts.length };
    } catch (error) {
      console.error('[Factory Testing] Failed to load serial ports:', error);
      this.serialPorts = [];
      return { success: false, error: error.message };
    }
  }

  updatePortDropdown() {
    const dropdown = document.getElementById('factory-port-select');
    if (!dropdown) {
      console.log('[Factory Testing] Dropdown not found in DOM yet');
      return;
    }

    console.log('[Factory Testing] Updating port dropdown with', this.serialPorts.length, 'ports');

    // Save current selection
    const currentValue = dropdown.value || this.selectedPort;

    // Clear existing options
    dropdown.innerHTML = '<option value="">Select Port</option>';
    
    // Add port options
    this.serialPorts.forEach(port => {
      const option = document.createElement('option');
      option.value = port.path;
      option.textContent = port.path;
      if (port.path === currentValue) {
        option.selected = true;
        this.selectedPort = port.path;
      }
      dropdown.appendChild(option);
    });
    
    // Remove old listeners to prevent duplicates
    const newDropdown = dropdown.cloneNode(true);
    dropdown.parentNode.replaceChild(newDropdown, dropdown);
    
    // Add new change listener
    newDropdown.addEventListener('change', (e) => {
      this.selectedPort = e.target.value;
      console.log('[Factory Testing] Port selected:', this.selectedPort);
    });

    console.log('[Factory Testing] Dropdown updated, selected port:', this.selectedPort);
  }

  async connect() {
    console.log('[Factory Testing Module] === START CONNECT ===');
    console.log('[Factory Testing Module] Current selectedPort:', this.selectedPort);
    console.log('[Factory Testing Module] Current baudRate:', this.baudRate);
    
    const portSelect = document.getElementById('factory-port-select');
    const baudrateSelect = document.getElementById('factory-baudrate-select');
    
    console.log('[Factory Testing Module] Port dropdown:', portSelect);
    console.log('[Factory Testing Module] Baud dropdown:', baudrateSelect);
    
    // Only update from dropdown if not already set
    if (portSelect && portSelect.value && !this.selectedPort) {
      this.selectedPort = portSelect.value;
      console.log('[Factory Testing Module] Port from dropdown:', this.selectedPort);
    }
    if (baudrateSelect) {
      this.baudRate = parseInt(baudrateSelect.value);
      console.log('[Factory Testing Module] Baud rate from dropdown:', this.baudRate);
    }

    if (!this.selectedPort) {
      console.error('[Factory Testing Module] No port selected!');
      console.error('[Factory Testing Module] selectedPort is:', this.selectedPort);
      console.error('[Factory Testing Module] dropdown value is:', portSelect?.value);
      return { success: false, error: 'Please select a serial port' };
    }

    try {
      console.log('[Factory Testing Module] Calling factoryTestingAPI.connect...');
      console.log('[Factory Testing Module] Parameters:', this.selectedPort, this.baudRate);
      
      const result = await window.factoryTestingAPI.connect(this.selectedPort, this.baudRate);
      
      console.log('[Factory Testing Module] API returned:', result);
      console.log('[Factory Testing Module] === END CONNECT ===');
      return result;
    } catch (error) {
      console.error('[Factory Testing Module] Connection error:', error);
      console.error('[Factory Testing Module] Error details:', error.message);
      console.log('[Factory Testing Module] === END CONNECT (ERROR) ===');
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    try {
      const result = await window.factoryTestingAPI.disconnect();
      return result;
    } catch (error) {
      console.error('Disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async readDeviceInfo() {
    try {
      const result = await window.factoryTestingAPI.readDeviceInfo();
      return result;
    } catch (error) {
      console.error('Read device info error:', error);
      return { success: false, error: error.message };
    }
  }

  async runFactoryTests(device, progressCallback) {
    try {
      // Setup progress callback
      if (progressCallback) {
        window.factoryTestingAPI.onProgress((progress) => {
          progressCallback(progress);
        });
      }

      const result = await window.factoryTestingAPI.runFactoryTests(device);
      return result;
    } catch (error) {
      console.error('Factory test error:', error);
      return { success: false, error: error.message };
    }
  }

  async saveResults(version, device, deviceInfo, testResults, preTesting) {
    try {
      const result = await window.factoryTestingAPI.saveResults(version, device, deviceInfo, testResults, preTesting);
      return result;
    } catch (error) {
      console.error('Save results error:', error);
      return { success: false, error: error.message };
    }
  }

  // ACB-M specific tests
  async acbWifiTest() {
    try {
      if (window.factoryTestingAPI.onProgress) window.factoryTestingAPI.onProgress(() => {});
      const result = await window.factoryTestingAPI.acbWifiTest();
      console.log('[FactoryTestingModule] ACB WiFi test result:', result);
      return result;
    } catch (error) {
      console.error('ACB WiFi test error:', error);
      return { success: false, error: error.message };
    }
  }

  async acbRs485Test() {
    try {
      const result = await window.factoryTestingAPI.acbRs485Test();
      return result;
    } catch (error) {
      console.error('ACB RS485 test error:', error);
      return { success: false, error: error.message };
    }
  }

  async acbRs485_2Test() {
    try {
      const result = await window.factoryTestingAPI.acbRs485_2Test();
      return result;
    } catch (error) {
      console.error('ACB RS485-2 test error:', error);
      return { success: false, error: error.message };
    }
  }

  async acbEthTest() {
    try {
      const result = await window.factoryTestingAPI.acbEthTest();
      return result;
    } catch (error) {
      console.error('ACB ETH test error:', error);
      return { success: false, error: error.message };
    }
  }

  async acbLoraTest() {
    try {
      if (window.factoryTestingAPI.onProgress) {
        // forward progress to console for now
        window.factoryTestingAPI.onProgress((p) => console.log('[ACB-LoRa Progress]', p));
      }
      const result = await window.factoryTestingAPI.acbLoraTest();
      return result;
    } catch (error) {
      console.error('ACB LoRa test error:', error);
      return { success: false, error: error.message };
    }
  }

  async acbRtcTest() {
    try {
      const result = await window.factoryTestingAPI.acbRtcTest();
      return result;
    } catch (error) {
      console.error('ACB RTC test error:', error);
      return { success: false, error: error.message };
    }
  }

  async acbFullTest() {
    try {
      if (window.factoryTestingAPI.onProgress) {
        window.factoryTestingAPI.onProgress((p) => {
          if (window.factoryTestingPage) {
            window.factoryTestingPage.testProgress = p;
            window.factoryTestingPage.app.render();
          }
        });
      }
      const result = await window.factoryTestingAPI.acbFullTest();
      return result;
    } catch (error) {
      console.error('ACB Full test error:', error);
      return { success: false, error: error.message };
    }
  }

  acbClearOutput() {
    if (window.factoryTestingPage) {
      window.factoryTestingPage.testProgress = '';
      window.factoryTestingPage.app.render();
    }
  }
}

// Make it globally accessible
if (typeof window !== 'undefined') {
  window.FactoryTestingModule = FactoryTestingModule;
}
