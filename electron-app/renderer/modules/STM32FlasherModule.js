/**
 * STM32 Droplet Flasher Module
 * UI for flashing STM32WLE5 Droplet devices
 */

class STM32FlasherModule {
    constructor() {
        this.firmwarePath = '';
        this.isFlashing = false;
        this.isDetecting = false;
        this.flashProgress = '';
        this.flashResult = null;
        this.version = 192; // Droplet version for LoRa ID calculation (default)
        this.stlinkDetected = false;
        this.mcuInfo = null;
    }

    async init() {
        // Listen for flash progress events
        electronAPI.onMenuEvent('stm32:flash-progress', (data) => {
            this.flashProgress = data.message;
            this.updateProgressDisplay();
        });

        electronAPI.onMenuEvent('stm32:flash-complete', (data) => {
            this.isFlashing = false;
            this.flashResult = data;
            this.render();
        });

        electronAPI.onMenuEvent('stm32:flash-error', (data) => {
            this.isFlashing = false;
            this.flashProgress = `Error: ${data.error}`;
            this.render();
        });
    }

    async detectSTLink() {
        if (this.isDetecting) {
            return;
        }

        try {
            this.isDetecting = true;
            this.flashProgress = 'Detecting ST-Link and MCU...';
            this.stlinkDetected = false;
            this.mcuInfo = null;
            this.render();

            const result = await electronAPI.detectSTM32();

            this.isDetecting = false;

            if (result.success) {
                this.stlinkDetected = true;
                this.mcuInfo = result.info;
                this.flashProgress = 'ST-Link detected successfully!';
            } else {
                this.flashProgress = 'ST-Link not detected. Please check connection.';
            }

            this.render();
        } catch (error) {
            this.isDetecting = false;
            this.flashProgress = `Detection failed: ${error.message}`;
            this.render();
            console.error('Detection error:', error);
        }
    }

    async disconnectSTLink() {
        try {
            this.flashProgress = 'Disconnecting ST-Link...';
            this.render();

            const result = await electronAPI.disconnectSTM32();

            if (result.success) {
                this.stlinkDetected = false;
                this.mcuInfo = null;
                this.flashResult = null;

                this.flashProgress = 'ST-Link disconnected successfully!';
            } else {
                this.flashProgress = 'Failed to disconnect ST-Link';
            }

            this.render();
        } catch (error) {
            this.flashProgress = `Disconnect failed: ${error.message}`;
            this.render();
            console.error('Disconnect error:', error);
        }
    }

    async selectFirmware() {
        try {
            const result = await electronAPI.selectFile({
                title: 'Select STM32 Firmware',
                filters: [
                    { name: 'Binary Files', extensions: ['bin'] },
                    { name: 'Hex Files', extensions: ['hex'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result && !result.canceled && result.filePaths.length > 0) {
                this.firmwarePath = result.filePaths[0];
                this.render();
            }
        } catch (error) {
            console.error('Failed to select firmware:', error);
            alert('Failed to select firmware file');
        }
    }

    async flashFirmware() {
        if (!this.firmwarePath) {
            alert('Please select a firmware file first');
            return;
        }

        if (this.isFlashing) {
            return;
        }

        try {
            this.isFlashing = true;
            this.flashProgress = 'Starting flash operation...';
            this.flashResult = null;
            this.render();

            const result = await electronAPI.flashSTM32Droplet(this.firmwarePath, this.version);

            this.isFlashing = false;
            this.flashResult = result;
            this.flashProgress = 'Flash completed successfully!';
            this.render();
        } catch (error) {
            this.isFlashing = false;
            this.flashProgress = `Flash failed: ${error.message}`;
            this.render();
            console.error('Flash error:', error);
        }
    }

    async readDeviceInfo() {
        try {
            this.flashProgress = 'Reading device info...';
            this.render();

            const result = await electronAPI.readSTM32UID();

            this.flashResult = result;
            this.flashProgress = 'Device info read successfully!';
            this.render();
        } catch (error) {
            this.flashProgress = `Failed to read device info: ${error.message}`;
            this.render();
            console.error('Read UID error:', error);
        }
    }

    updateProgressDisplay() {
        const progressEl = document.getElementById('stm32-flash-progress');
        if (progressEl) {
            progressEl.textContent = this.flashProgress;
        }
    }

    handleVersionChange(value) {
        this.version = parseInt(value) || 1;
        // Update version via API
        electronAPI.setSTM32Version(this.version);
        // Only update hex display without full re-render
        this.updateVersionHexDisplay();
    }

    updateVersionHexDisplay() {
        const hexDisplay = document.getElementById('version-hex-display');
        if (hexDisplay) {
            hexDisplay.textContent = `0x${this.version.toString(16).padStart(2, '0').toUpperCase()}`;
        }
    }

    render() {
        const container = document.getElementById('stm32-flasher-container');
        if (!container) return;

        container.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold mb-6 text-gray-800">
          <i class="fas fa-microchip mr-2"></i>STM32WLE5 Droplet Flasher
        </h2>

        <!-- Step 1: Detect ST-Link -->
        <div class="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full mr-2">1</span>
            Detect ST-Link & MCU
          </h3>
          <div class="flex gap-2">
            <button 
              onclick="window.stm32Flasher.detectSTLink()"
              class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              ${this.isDetecting || this.isFlashing ? 'disabled' : ''}
            >
              <i class="fas ${this.isDetecting ? 'fa-spinner fa-spin' : 'fa-search'} mr-2"></i>
              ${this.isDetecting ? 'Detecting...' : 'Detect ST-Link'}
            </button>
            
            ${this.stlinkDetected ? `
              <button 
                onclick="window.stm32Flasher.disconnectSTLink()"
                class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                ${this.isFlashing ? 'disabled' : ''}
              >
                <i class="fas fa-unlink mr-2"></i>Disconnect
              </button>
            ` : ''}
          </div>

          ${this.stlinkDetected && this.mcuInfo ? `
            <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center mb-2">
                <i class="fas fa-check-circle text-green-600 mr-2"></i>
                <span class="font-semibold text-green-800">ST-Link Detected!</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><span class="text-gray-600">Chip:</span> <code class="ml-1 text-blue-600">${this.mcuInfo.chip || 'STM32WLE5'}</code></div>
                <div><span class="text-gray-600">Flash Size:</span> <code class="ml-1 text-blue-600">${this.mcuInfo.flashSize || '256KB'}</code></div>
              </div>
            </div>
          ` : ''}
        </div>

        ${this.stlinkDetected ? `
        <!-- Step 2: Version Setting -->
        <div class="mb-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-purple-500 text-white rounded-full mr-2">2</span>
            Set Droplet Version
          </h3>
          <div class="flex items-center gap-4">
            <label class="text-sm font-medium text-gray-700">
              Version (for LoRa ID calculation):
            </label>
            <input 
              type="number" 
              value="${this.version}"
              min="0"
              max="255"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              oninput="window.stm32Flasher.handleVersionChange(this.value)"
            />
            <span class="text-sm text-gray-600">Hex: <code id="version-hex-display" class="text-purple-600 font-mono">0x${this.version.toString(16).padStart(2, '0').toUpperCase()}</code></span>
          </div>
        </div>

        <!-- Step 3: Firmware Selection -->
        <div class="mb-6 p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-orange-500 text-white rounded-full mr-2">3</span>
            Select Firmware
          </h3>
          <div class="flex gap-2">
            <input 
              type="text" 
              value="${this.firmwarePath || 'No file selected'}"
              readonly
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              placeholder="Click Browse to select firmware file..."
            />
            <button 
              onclick="window.stm32Flasher.selectFirmware()"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              ${this.isFlashing ? 'disabled' : ''}
            >
              <i class="fas fa-folder-open mr-2"></i>Browse
            </button>
          </div>
          ${this.firmwarePath ? `
            <div class="mt-2 text-sm text-green-600">
              <i class="fas fa-check-circle mr-1"></i>
              File selected: ${this.firmwarePath.split(/[\\/]/).pop()}
            </div>
          ` : ''}
        </div>

        <!-- Step 4: Flash Action -->
        <div class="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full mr-2">4</span>
            Flash & Read Info
          </h3>
          <div class="flex gap-4">
            <button 
              onclick="window.stm32Flasher.flashFirmware()"
              class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              ${this.isFlashing || !this.firmwarePath ? 'disabled' : ''}
            >
              <i class="fas ${this.isFlashing ? 'fa-spinner fa-spin' : 'fa-upload'} mr-2"></i>
              ${this.isFlashing ? 'Flashing...' : 'Flash & Read Info'}
            </button>

            <button 
              onclick="window.stm32Flasher.readDeviceInfo()"
              class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              ${this.isFlashing ? 'disabled' : ''}
            >
              <i class="fas fa-info-circle mr-2"></i>Read Info Only
            </button>
          </div>
        </div>
        ` : `
        <div class="p-8 text-left text-gray-700 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h4 class="text-lg font-bold mb-3 text-red-700"><i class="fas fa-exclamation-circle mr-2"></i>ST-Link Detection Troubleshooting</h4>
          <ol class="list-decimal ml-6 space-y-2 text-base">
            <li>Press and hold the <b>RESET</b> button on your device.</li>
            <li>While holding <b>RESET</b>, click <b>Detect ST-Link</b> in the app.</li>
            <li>Release the <b>RESET</b> button immediately after clicking detect.</li>
            <li>If detection still fails:
              <ul class="list-disc ml-6">
                <li>Ensure your ST-Link is properly connected to the PC and the target device.</li>
                <li>Try unplugging and re-plugging the ST-Link USB cable.</li>
                <li>Verify that no other software (e.g. ST-Link Utility, CubeProgrammer) is using the ST-Link.</li>
              </ul>
            </li>
          </ol>
          <p class="mt-4 text-sm text-gray-500">If the problem persists, check your wiring and ST-Link drivers.</p>
        </div>
        `}

        <!-- Progress Display -->
        ${this.flashProgress ? `
          <div class="mb-6 p-4 ${this.flashProgress.includes('Error') || this.flashProgress.includes('failed') ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg">
            <div class="flex items-center">
              ${this.isFlashing || this.isDetecting ?
                    '<i class="fas fa-spinner fa-spin mr-2 text-blue-600"></i>' :
                    this.flashProgress.includes('Error') || this.flashProgress.includes('failed') ?
                        '<i class="fas fa-times-circle mr-2 text-red-600"></i>' :
                        '<i class="fas fa-check-circle mr-2 text-green-600"></i>'
                }
              <span id="stm32-flash-progress" class="text-sm ${this.flashProgress.includes('Error') || this.flashProgress.includes('failed') ? 'text-red-700' : 'text-gray-700'}">${this.flashProgress}</span>
            </div>
          </div>
        ` : ''}

        <!-- Device Info Display -->
        ${this.flashResult && this.flashResult.success ? `
          <div class="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-blue-200 rounded-lg p-6 shadow-inner">
            <h3 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
              <i class="fas fa-info-circle text-blue-600 mr-2"></i>
              Device Information
            </h3>
            
            <!-- UID Information -->
            <div class="mb-6 bg-white rounded-lg p-4 shadow-sm">
              <h4 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Unique ID (UID)</h4>
              <div class="grid grid-cols-1 gap-3">
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span class="text-gray-600 font-medium">UID0:</span>
                  <code class="text-blue-600 font-mono font-bold">0x${this.flashResult.uid.uid0Hex}</code>
                </div>
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span class="text-gray-600 font-medium">UID1:</span>
                  <code class="text-blue-600 font-mono font-bold">0x${this.flashResult.uid.uid1Hex}</code>
                </div>
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span class="text-gray-600 font-medium">UID2:</span>
                  <code class="text-blue-600 font-mono font-bold">0x${this.flashResult.uid.uid2Hex}</code>
                </div>
              </div>
            </div>

            <!-- LoRa Device Address Information -->
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5 shadow-md">
              <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <i class="fas fa-broadcast-tower text-green-600 mr-2"></i>
                LoRa Device Address
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Address Info -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                    <span class="text-gray-600 font-medium">Address (Hex):</span>
                    <code class="text-2xl font-mono font-bold text-green-600">0x${this.flashResult.loraID.addressHex}</code>
                  </div>
                  <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                    <span class="text-gray-600 font-medium">Formatted:</span>
                    <code class="text-xl font-mono font-bold text-blue-600">${this.flashResult.loraID.addressFormatted}</code>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-white rounded">
                    <span class="text-gray-600 text-sm">Decimal:</span>
                    <code class="font-mono text-gray-700">${this.flashResult.loraID.address}</code>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-white rounded">
                    <span class="text-gray-600 text-sm">Version:</span>
                    <code class="font-mono text-gray-700">0x${this.flashResult.loraID.version.toString(16).padStart(2, '0').toUpperCase()}</code>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-white rounded">
                    <span class="text-gray-600 text-sm">UID XOR:</span>
                    <code class="font-mono text-gray-700">0x${this.flashResult.loraID.uid_temp.toString(16).padStart(8, '0').toUpperCase()}</code>
                  </div>
                  
                  <!-- Copy Button -->
                  <button 
                    onclick="navigator.clipboard.writeText('0x${this.flashResult.loraID.addressHex}').then(() => alert('LoRa address copied to clipboard!'))"
                    class="w-full mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    <i class="fas fa-copy mr-2"></i>Copy Address
                  </button>
                </div>
                
                <!-- QR Code -->
                <div class="flex flex-col items-center justify-center bg-white rounded-lg shadow-sm p-4">
                  <h5 class="text-sm font-semibold text-gray-700 mb-3">QR Code</h5>
                  <img 
                    src="${this.flashResult.loraID.qrCode}" 
                    alt="LoRa Device Address QR Code"
                    class="w-48 h-48 border-4 border-gray-200 rounded-lg"
                  />
                  <p class="text-xs text-gray-500 mt-2 text-center">Scan to copy address</p>
                </div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    }

    hide() {
        const container = document.getElementById('stm32-flasher-container');
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Initialize module
window.stm32Flasher = new STM32FlasherModule();
