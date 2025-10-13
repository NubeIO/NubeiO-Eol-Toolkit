// Provisioning Page - ESP32 Device Provisioning
class ProvisioningPage {
  constructor(app) {
    this.app = app;
    this.config = {
      port: '',
      chip: 'esp32s3',
      offset: '0x3D0000',
      size: '0x10000',
      baudRate: '921600',
      caUrl: 'http://128.199.170.214:8080',
      customUuid: '',
      customPsk: '',
      wifiSsid: '',
      wifiPassword: ''
    };
    this.includeWiFi = false;
    this.configureWiFi = false; // Auto-configure WiFi via serial after provisioning
    this.macAddress = '';
    this.generatedUuid = '';
    this.generatedPsk = '';
    this.isProvisioning = false;
    this.stage = '';
    this.chipTypes = ['esp32', 'esp32s2', 'esp32s3', 'esp32c2', 'esp32c3', 'esp32c6', 'esp32h2'];
  }

  render() {
    return `
      <div class="provisioning-container p-6 max-w-6xl mx-auto">
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-2xl font-bold text-gray-800 mb-2">ESP32 Device Provisioning</h2>
          <p class="text-gray-600 mb-4">Generate device credentials, create NVS partition, and provision ESP32 devices for secure communication.</p>
          
          <!-- Configuration Section -->
          <div class="space-y-6">
            <!-- Device Configuration -->
            <div class="border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Device Configuration</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Serial Port</label>
                  <div class="flex gap-2">
                    <select id="prov-port" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${this.isProvisioning ? 'disabled' : ''}>
                      <option value="">Select Port</option>
                      ${this.app.serialPorts.map(port => `
                        <option value="${port}" ${this.config.port === port ? 'selected' : ''}>${port}</option>
                      `).join('')}
                    </select>
                    <button onclick="app.loadSerialPorts(); app.render();" class="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md" ${this.isProvisioning ? 'disabled' : ''} title="Refresh serial ports">🔄</button>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Chip Type</label>
                  <div class="flex gap-2">
                    <select id="prov-chip" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${this.isProvisioning ? 'disabled' : ''}>
                      ${this.chipTypes.map(chip => `<option value="${chip}" ${chip === this.config.chip ? 'selected' : ''}>${chip.toUpperCase()}</option>`).join('')}
                    </select>
                    <button onclick="window.provisioningPage.detectChip()" class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm" ${this.isProvisioning ? 'disabled' : ''}>🔍 Detect</button>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Baud Rate</label>
                  <select id="prov-baudrate" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${this.isProvisioning ? 'disabled' : ''}>
                    <option value="115200">115200</option>
                    <option value="460800">460800</option>
                    <option value="921600" selected>921600</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- NVS Configuration -->
            <div class="border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">NVS Configuration</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">NVS Offset</label>
                  <input type="text" id="prov-offset" value="${this.config.offset}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0x3D0000" ${this.isProvisioning ? 'disabled' : ''}>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">NVS Size</label>
                  <input type="text" id="prov-size" value="${this.config.size}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0x10000" ${this.isProvisioning ? 'disabled' : ''}>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">CA Service URL</label>
                  <input type="text" id="prov-caurl" value="${this.config.caUrl}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="http://128.199.170.214:8080" ${this.isProvisioning ? 'disabled' : ''}>
                </div>
              </div>
            </div>

            <!-- Optional Custom Values -->
            <div class="border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Optional Custom Values</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Custom UUID (optional)</label>
                  <input type="text" id="prov-uuid" value="${this.config.customUuid}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Leave empty to auto-generate from MAC" ${this.isProvisioning ? 'disabled' : ''}>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Custom PSK (optional)</label>
                  <input type="text" id="prov-psk" value="${this.config.customPsk}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Leave empty to auto-generate" ${this.isProvisioning ? 'disabled' : ''}>
                </div>
              </div>
            </div>

            <!-- WiFi Configuration -->
            <div class="border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">WiFi Configuration (Optional)</h3>
              <div class="mb-3">
                  <label class="inline-flex items-center">
                  <input type="checkbox" id="prov-include-wifi" ${this.includeWiFi ? 'checked' : ''} onchange="window.provisioningPage.toggleWiFi()" class="mr-2" ${this.isProvisioning ? 'disabled' : ''}>
                  <span class="text-sm text-gray-700">Include WiFi credentials in NVS</span>
                </label>
              </div>
              ${this.includeWiFi ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">WiFi SSID</label>
                    <input type="text" id="prov-wifi-ssid" value="${this.config.wifiSsid}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter WiFi network name" ${this.isProvisioning ? 'disabled' : ''}>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">WiFi Password</label>
                    <input type="password" id="prov-wifi-password" value="${this.config.wifiPassword}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter WiFi password" ${this.isProvisioning ? 'disabled' : ''}>
                  </div>
                </div>
                
                <!-- WiFi Auto-Configuration via Serial -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <label class="inline-flex items-center">
                    <input type="checkbox" id="prov-config-wifi" ${this.configureWiFi ? 'checked' : ''} onchange="window.provisioningPage.configureWiFi = this.checked; window.provisioningPage.render();" class="mr-2" ${this.isProvisioning ? 'disabled' : ''}>
                    <span class="text-sm font-semibold text-gray-800">🔌 Auto-configure WiFi via Serial Console after provisioning</span>
                  </label>
                  <p class="text-xs text-gray-600 mt-2 ml-6">
                    After flashing and database insertion, automatically connect to serial console and send WiFi configuration commands to ESP32.
                    This will configure WiFi settings via serial interface.
                  </p>
                </div>
              ` : ''}
            </div>

            <!-- Step 0: Erase Flash (Optional) -->
            <div class="border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">🗑️ Step 0: Erase Flash (Optional)</h3>
              <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-2">Erase Type</label>
                <select id="prov-erase-type" onchange="window.provisioningPage.toggleCustomErase()" class="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" ${this.isProvisioning ? 'disabled' : ''}>
                  <option value="all">Erase All Flash</option>
                  <option value="nvs">Erase NVS Only (0x3D0000)</option>
                  <option value="allnvs">Erase All NVS Partitions</option>
                  <option value="custom">Custom Region</option>
                </select>
              </div>
              
              <div id="custom-erase-inputs" class="mb-3 hidden">
                <div class="grid grid-cols-2 gap-4 md:w-1/2">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <input type="text" id="prov-erase-address" value="0x3D0000" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="0x3D0000" ${this.isProvisioning ? 'disabled' : ''}>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Size</label>
                    <input type="text" id="prov-erase-size" value="0x10000" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="0x10000" ${this.isProvisioning ? 'disabled' : ''}>
                  </div>
                </div>
              </div>
              
              <button onclick="window.provisioningPage.eraseFlash()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium" ${this.isProvisioning ? 'disabled' : ''}>
                🗑️ Erase Flash
              </button>
              <p class="text-xs text-gray-500 mt-2">⚠️ Warning: This will erase data on the ESP32. Put ESP32 in download mode first.</p>
            </div>

            <!-- Step-by-Step Actions -->
            <div class="border-t pt-4">
              <h3 class="text-lg font-semibold text-gray-800 mb-3">Step-by-Step Provisioning</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onclick="window.provisioningPage.readMAC()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium" ${this.isProvisioning ? 'disabled' : ''}>
                  📡 Read MAC
                </button>
                <button onclick="window.provisioningPage.generateUUID()" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium" ${this.isProvisioning || !this.macAddress ? 'disabled' : ''}>
                  🔑 Generate UUID
                </button>
                <button onclick="window.provisioningPage.generatePSK()" class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md text-sm font-medium" ${this.isProvisioning ? 'disabled' : ''}>
                  🔐 Generate PSK
                </button>
                <button onclick="window.provisioningPage.flashNVS()" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium" ${this.isProvisioning || !this.generatedUuid || !this.generatedPsk ? 'disabled' : ''}>
                  ⚡ Flash NVS
                </button>
              </div>
            </div>

            <!-- Complete Provisioning Button -->
            <div class="border-t pt-4">
              <button onclick="window.provisioningPage.provisionComplete()" class="w-full py-3 ${this.isProvisioning ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'} text-white rounded-md text-lg font-semibold" ${this.isProvisioning ? 'disabled' : ''}>
                ${this.isProvisioning ? '⏳ Provisioning...' : '🚀 Complete Provisioning'}
              </button>
              <p class="text-xs text-gray-500 mt-2 text-center">Put ESP32 in download mode (hold BOOT, press RESET, release BOOT) before clicking</p>
            </div>

            <!-- Status Display -->
            ${this.stage || this.macAddress || this.generatedUuid || this.generatedPsk ? `
              <div class="border-t pt-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Status</h3>
                <div class="bg-gray-50 rounded-md p-4 space-y-2 font-mono text-sm">
                  ${this.stage ? `<div class="text-blue-600">📝 ${this.stage}</div>` : ''}
                  ${this.macAddress ? `<div class="text-gray-700"><strong>MAC:</strong> ${this.macAddress}</div>` : ''}
                  ${this.generatedUuid ? `<div class="text-gray-700"><strong>UUID:</strong> ${this.generatedUuid}</div>` : ''}
                  ${this.generatedPsk ? `<div class="text-gray-700"><strong>PSK:</strong> ${this.generatedPsk}</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Instructions -->
        <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">📋 Instructions</h3>
          <ol class="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Connect ESP32 to computer via USB</li>
            <li>Select the correct serial port from dropdown</li>
            <li>Configure NVS settings (or use defaults)</li>
            <li><strong>Put ESP32 in download mode:</strong> Hold BOOT, press & release RESET, release BOOT</li>
            <li>Click "Complete Provisioning" to start the full process</li>
            <li>Wait for completion (~30-60 seconds)</li>
          </ol>
        </div>
      </div>
    `;
  }


  async detectChip() {
    const port = document.getElementById('prov-port').value;
    if (!port) {
      alert('Please select a serial port first');
      return;
    }

    try {
      this.stage = 'Detecting chip type...';
      this.app.render();
      const chipType = await window.provisioningService.detectChipType(port);
      this.config.chip = chipType;
      const chipSelect = document.getElementById('prov-chip');
      if (chipSelect) {
        chipSelect.value = chipType;
      }
      this.stage = `Detected: ${chipType.toUpperCase()}`;
      this.app.render();
    } catch (error) {
      this.stage = '';
      alert(`Failed to detect chip: ${error.message}`);
      this.app.render();
    }
  }

  async readMAC() {
    const port = document.getElementById('prov-port').value;
    const chip = document.getElementById('prov-chip').value;
    
    if (!port) {
      alert('Please select a serial port first');
      return;
    }

    try {
      this.stage = 'Reading MAC address...';
      this.app.render();
      
      this.macAddress = await window.provisioningService.readMacAddress(port, chip);
      this.stage = 'MAC address read successfully';
      this.app.render();
    } catch (error) {
      this.stage = '';
      alert(`Failed to read MAC: ${error.message}`);
      this.app.render();
    }
  }

  generateUUID() {
    if (!this.macAddress) {
      alert('Please read MAC address first');
      return;
    }

    this.generatedUuid = window.provisioningService.generateUUIDFromMAC(this.macAddress);
    this.stage = 'UUID generated successfully';
    this.app.render();
  }

  generatePSK() {
    this.generatedPsk = window.provisioningService.generatePSK();
    this.stage = 'PSK generated successfully';
    this.app.render();
  }

  async flashNVS() {
    if (!this.generatedUuid || !this.generatedPsk) {
      alert('Please generate UUID and PSK first');
      return;
    }

    const port = document.getElementById('prov-port').value;
    const chip = document.getElementById('prov-chip').value;
    const offset = document.getElementById('prov-offset').value;
    const size = document.getElementById('prov-size').value;
    const baudRate = document.getElementById('prov-baudrate').value;
    const caUrl = document.getElementById('prov-caurl').value;
    const wifiSsid = this.includeWiFi ? document.getElementById('prov-wifi-ssid').value : '';
    const wifiPassword = this.includeWiFi ? document.getElementById('prov-wifi-password').value : '';

    if (!port || !caUrl) {
      alert('Please select port and enter CA URL');
      return;
    }

    const confirmFlash = confirm(
      '⚠️ IMPORTANT: Flash NVS to ESP32\n\n' +
      'Before proceeding, make sure your ESP32 is in DOWNLOAD MODE:\n\n' +
      '1. Hold the BOOT button (GPIO0)\n' +
      '2. Press and release the RESET button\n' +
      '3. Release the BOOT button\n\n' +
      'Click OK to continue, or Cancel to abort.'
    );

    if (!confirmFlash) return;

    try {
      this.isProvisioning = true;
      this.stage = 'Creating NVS partition...';
      this.app.render();

      // Create CSV
      const csvPath = window.provisioningService.createNVSCSV(
        this.generatedUuid,
        this.generatedPsk,
        caUrl,
        wifiSsid,
        wifiPassword
      );

      this.stage = 'Generating NVS binary...';
      this.app.render();

      // Generate binary
      const binPath = await window.provisioningService.generateNVSBinary(csvPath, size);

      this.stage = 'Flashing NVS to ESP32...';
      this.app.render();

      // Flash
      await window.provisioningService.flashNVSBinary(port, chip, offset, binPath, baudRate);

      this.stage = '✅ NVS flashed successfully!';
      this.isProvisioning = false;
      this.app.render();
    } catch (error) {
      this.isProvisioning = false;
      this.stage = '❌ Flash failed';
      alert(`Failed to flash NVS: ${error.message}`);
      this.app.render();
    }
  }

  async provisionComplete() {
    const port = document.getElementById('prov-port').value;
    const chip = document.getElementById('prov-chip').value;
    const offset = document.getElementById('prov-offset').value;
    const size = document.getElementById('prov-size').value;
    const baudRate = document.getElementById('prov-baudrate').value;
    const caUrl = document.getElementById('prov-caurl').value;
    const customUuid = document.getElementById('prov-uuid').value;
    const customPsk = document.getElementById('prov-psk').value;
    const wifiSsid = this.includeWiFi ? document.getElementById('prov-wifi-ssid').value : '';
    const wifiPassword = this.includeWiFi ? document.getElementById('prov-wifi-password').value : '';

    if (!port || !caUrl) {
      alert('Please select port and enter CA URL');
      return;
    }

    const confirmProvision = confirm(
      '⚠️ IMPORTANT: Complete Provisioning\n\n' +
      'This will perform the complete provisioning process:\n' +
      '1. Read MAC address\n' +
      '2. Generate UUID and PSK\n' +
      '3. Create and flash NVS partition\n\n' +
      'Make sure ESP32 is in DOWNLOAD MODE first!\n\n' +
      'Click OK to continue.'
    );

    if (!confirmProvision) return;

    try {
      this.isProvisioning = true;
      this.stage = 'Starting complete provisioning...';
      this.app.render();

      const config = {
        port, chip, offset, size, baudRate, caUrl,
        customUuid, customPsk, wifiSsid, wifiPassword,
        configureWiFi: this.configureWiFi // Add WiFi auto-configuration flag
      };

      const result = await window.provisioningService.provisionESP32(config);

      this.macAddress = result.macAddress;
      this.generatedUuid = result.globalUUID;
      this.generatedPsk = result.presharedSecret;
      this.stage = '✅ Complete provisioning finished successfully!';
      this.isProvisioning = false;
      this.app.render();

      alert(`Provisioning Complete!\n\nMAC: ${result.macAddress}\nUUID: ${result.globalUUID}\nPSK: ${result.presharedSecret}`);
    } catch (error) {
      this.isProvisioning = false;
      this.stage = '❌ Provisioning failed';
      alert(`Provisioning failed: ${error.message}`);
      this.app.render();
    }
  }

  toggleWiFi() {
    this.includeWiFi = document.getElementById('prov-include-wifi').checked;
    this.app.render();
  }

  toggleCustomErase() {
    const eraseType = document.getElementById('prov-erase-type').value;
    const customInputs = document.getElementById('custom-erase-inputs');
    if (customInputs) {
      if (eraseType === 'custom') {
        customInputs.classList.remove('hidden');
      } else {
        customInputs.classList.add('hidden');
      }
    }
  }

  async eraseFlash() {
    const port = document.getElementById('prov-port').value;
    const eraseType = document.getElementById('prov-erase-type').value;
    
    if (!port) {
      alert('Please select a serial port first');
      return;
    }

    // Confirmation dialog
    const eraseTypeNames = {
      'all': 'ALL FLASH MEMORY',
      'nvs': 'NVS partition only (0x3D0000)',
      'allnvs': 'ALL NVS partitions',
      'custom': 'custom region'
    };

    const confirmErase = confirm(
      `⚠️ WARNING: Erase Flash\n\n` +
      `This will erase ${eraseTypeNames[eraseType]} on the ESP32.\n\n` +
      `Make sure ESP32 is in DOWNLOAD MODE:\n` +
      `1. Hold BOOT button\n` +
      `2. Press & release RESET button\n` +
      `3. Release BOOT button\n\n` +
      `Continue with erase?`
    );

    if (!confirmErase) return;

    try {
      this.stage = `Erasing flash (${eraseType})...`;
      this.app.render();

      if (eraseType === 'custom') {
        const address = document.getElementById('prov-erase-address').value;
        const size = document.getElementById('prov-erase-size').value;
        await window.provisioningService.eraseCustomRegion(port, address, size);
      } else {
        await window.provisioningService.eraseFlash(port, eraseType);
      }

      this.stage = `✅ Flash erase complete (${eraseType})`;
      alert(`Flash erase completed successfully!\n\nType: ${eraseTypeNames[eraseType]}`);
      this.app.render();
    } catch (error) {
      this.stage = '❌ Erase failed';
      alert(`Failed to erase flash: ${error.message}`);
      this.app.render();
    }
  }
}

// Make provisioningPage globally accessible for onclick handlers
let provisioningPage = null;

