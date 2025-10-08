const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SerialPort } = require('serialport');

/**
 * ESP32 Flasher Service
 * Handles ESP32 firmware flashing using esptool
 */
class ESP32Flasher {
  constructor() {
    this.isFlashing = false;
    this.currentProcess = null;
    this.progressCallback = null;
    this.serialPorts = [];
  }

  /**
   * Get list of available serial ports
   * @returns {Promise<Array>} - Array of port objects
   */
  async getSerialPorts() {
    try {
      const ports = await SerialPort.list();
      this.serialPorts = ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        serialNumber: port.serialNumber || '',
        productId: port.productId || '',
        vendorId: port.vendorId || ''
      }));
      return this.serialPorts;
    } catch (error) {
      console.error('Error listing serial ports:', error);
      return [];
    }
  }

  /**
   * Get esptool path (bundled with app)
   * @returns {string} - Path to esptool
   */
  getEsptoolPath() {
    const path = require('path');
    const { app } = require('electron');
    const os = require('os');
    
    // Determine platform
    const platform = os.platform();
    
    // Get app resource path
    const resourcePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'tools', 'esptool')
      : path.join(__dirname, '..', 'tools', 'esptool');
    
    // Select appropriate esptool binary
    if (platform === 'win32') {
      return path.join(resourcePath, 'esptool-win64', 'esptool.exe');
    } else {
      // Linux/Mac - use the bundled linux binary
      const esptoolPath = path.join(resourcePath, 'esptool-linux-amd64', 'esptool');
      
      // Make it executable (in case permissions are lost)
      try {
        const fs = require('fs');
        fs.chmodSync(esptoolPath, '755');
      } catch (err) {
        console.warn('Could not set esptool permissions:', err);
      }
      
      return esptoolPath;
    }
  }

  /**
   * Flash firmware to ESP32
   * @param {object} options - Flash options
   * @returns {Promise<object>} - Result object
   */
  async flashFirmware(options) {
    const {
      port,
      baudRate = 460800,
      firmwarePath,
      chipType = 'esp32',
      flashMode = 'dio',
      flashFreq = '40m',
      flashSize = '4MB',
      eraseFlash = false,
      address = '0x10000'
    } = options;

    return new Promise((resolve, reject) => {
      if (this.isFlashing) {
        reject(new Error('Flash operation already in progress'));
        return;
      }

      if (!fs.existsSync(firmwarePath)) {
        reject(new Error(`Firmware file not found: ${firmwarePath}`));
        return;
      }

      this.isFlashing = true;
      const esptool = this.getEsptoolPath();
      const args = [
        '--chip', chipType,
        '--port', port,
        '--baud', baudRate.toString()
      ];

      // Add erase flash if requested
      if (eraseFlash) {
        args.push('erase_flash');
      } else {
        // Write flash command
        args.push('write_flash');
        args.push('--flash_mode', flashMode);
        args.push('--flash_freq', flashFreq);
        args.push('--flash_size', flashSize);
        args.push(address, firmwarePath);
      }

      console.log('Flashing with command:', esptool, args.join(' '));

      this.currentProcess = spawn(esptool, args);

      let output = '';
      let errorOutput = '';

      this.currentProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('esptool:', text);
        
        // Parse progress from output
        this.parseProgress(text);
      });

      this.currentProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error('esptool error:', text);
        
        // esptool outputs progress to stderr too
        this.parseProgress(text);
      });

      this.currentProcess.on('close', (code) => {
        this.isFlashing = false;
        this.currentProcess = null;

        if (code === 0) {
          resolve({
            success: true,
            message: 'Firmware flashed successfully',
            output: output,
            exitCode: code
          });
        } else {
          reject({
            success: false,
            message: `Flash failed with exit code ${code}`,
            output: output,
            error: errorOutput,
            exitCode: code
          });
        }
      });

      this.currentProcess.on('error', (error) => {
        this.isFlashing = false;
        this.currentProcess = null;
        reject({
          success: false,
          message: `Failed to start esptool: ${error.message}`,
          error: error.message
        });
      });
    });
  }

  /**
   * Parse progress from esptool output
   * @param {string} text - Output text
   */
  parseProgress(text) {
    // esptool outputs progress like "Writing at 0x00010000... (10 %)"
    const progressMatch = text.match(/\((\d+)\s*%\)/);
    if (progressMatch && this.progressCallback) {
      const progress = parseInt(progressMatch[1]);
      this.progressCallback({
        progress: progress,
        stage: this.getFlashStage(text)
      });
    }

    // Also detect stages
    if (this.progressCallback) {
      if (text.includes('Connecting')) {
        this.progressCallback({ stage: 'connecting', progress: 0 });
      } else if (text.includes('Erasing')) {
        this.progressCallback({ stage: 'erasing', progress: 0 });
      } else if (text.includes('Writing')) {
        this.progressCallback({ stage: 'writing', progress: 0 });
      } else if (text.includes('Verifying')) {
        this.progressCallback({ stage: 'verifying', progress: 0 });
      } else if (text.includes('Hash of data verified')) {
        this.progressCallback({ stage: 'complete', progress: 100 });
      }
    }
  }

  /**
   * Get flash stage from output text
   * @param {string} text - Output text
   * @returns {string} - Stage name
   */
  getFlashStage(text) {
    if (text.includes('Connecting')) return 'connecting';
    if (text.includes('Erasing')) return 'erasing';
    if (text.includes('Writing')) return 'writing';
    if (text.includes('Verifying')) return 'verifying';
    if (text.includes('Hash of data verified')) return 'complete';
    return 'unknown';
  }

  /**
   * Set progress callback
   * @param {function} callback - Callback function
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Cancel current flash operation
   * @returns {object} - Result object
   */
  cancelFlash() {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
      this.isFlashing = false;
      return {
        success: true,
        message: 'Flash operation cancelled'
      };
    }
    return {
      success: false,
      message: 'No flash operation in progress'
    };
  }

  /**
   * Get current status
   * @returns {object} - Status object
   */
  getStatus() {
    return {
      isFlashing: this.isFlashing,
      hasProcess: this.currentProcess !== null,
      portsAvailable: this.serialPorts.length
    };
  }

  /**
   * Verify firmware file
   * @param {string} filePath - Path to firmware file
   * @returns {object} - Verification result
   */
  verifyFirmware(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: 'File not found'
        };
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (!['.bin', '.elf'].includes(ext)) {
        return {
          success: false,
          message: 'Invalid file type. Expected .bin or .elf'
        };
      }

      return {
        success: true,
        message: 'Firmware file is valid',
        size: stats.size,
        sizeHuman: this.formatBytes(stats.size),
        extension: ext
      };
    } catch (error) {
      return {
        success: false,
        message: `Error verifying firmware: ${error.message}`
      };
    }
  }

  /**
   * Format bytes to human readable
   * @param {number} bytes - Bytes
   * @returns {string} - Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = ESP32Flasher;
