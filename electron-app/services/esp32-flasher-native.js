/**
 * ESP32 Flasher Service (Native esptool binary)
 * Uses embedded esptool binaries for reliable ESP32 flashing with auto chip detection
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ESP32FlasherNative {
  constructor() {
    this.esptoolPath = null;
    this.isFlashing = false;
    this.flashProcess = null;
    this.progressCallback = null;
  }

  /**
   * Initialize the flasher by extracting the appropriate esptool binary
   */
  async initialize() {
    try {
      // Determine platform-specific binary path
      const platform = os.platform();
      let binaryName, sourcePath;

      if (platform === 'win32') {
        binaryName = 'esptool.exe';
        sourcePath = path.join(__dirname, '../embedded/esptool-binaries/windows', binaryName);
      } else if (platform === 'linux') {
        binaryName = 'esptool';
        sourcePath = path.join(__dirname, '../embedded/esptool-binaries/linux', binaryName);
      } else if (platform === 'darwin') {
        // macOS not included yet, can add later
        throw new Error('macOS not currently supported');
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Create temp directory for esptool
      const tempDir = os.tmpdir();
      const esptoolDir = path.join(tempDir, 'fga-simulator-esptool');

      if (!fs.existsSync(esptoolDir)) {
        fs.mkdirSync(esptoolDir, { recursive: true });
      }

      this.esptoolPath = path.join(esptoolDir, binaryName);

      // Copy binary if not exists or if source is newer
      const shouldCopy = !fs.existsSync(this.esptoolPath) ||
                        fs.statSync(sourcePath).mtime > fs.statSync(this.esptoolPath).mtime;

      if (shouldCopy) {
        console.log(`Extracting esptool binary to: ${this.esptoolPath}`);
        fs.copyFileSync(sourcePath, this.esptoolPath);

        // Make executable on Unix-like systems
        if (platform !== 'win32') {
          fs.chmodSync(this.esptoolPath, 0o755);
        }
      }

      // Test the binary
      await this.testBinary();

      console.log('ESP32 Flasher initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize ESP32 flasher:', error);
      throw error;
    }
  }

  /**
   * Test if the esptool binary works
   */
  async testBinary() {
    return new Promise((resolve, reject) => {
      const process = spawn(this.esptoolPath, ['version']);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('esptool')) {
          console.log('Esptool binary test passed:', output.trim().split('\n')[0]);
          resolve();
        } else {
          reject(new Error(`Esptool binary test failed: ${output}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute esptool: ${error.message}`));
      });
    });
  }

  /**
   * Detect the chip type and flash size
   */
  async detectChip(port) {
    return new Promise((resolve, reject) => {
      const args = ['--port', port, 'flash_id'];
      const process = spawn(this.esptoolPath, args);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Extract chip type from output
          const chipMatch = output.match(/Detecting chip type\.\.\. (ESP32[-\w]*)/i) ||
                           output.match(/Chip is (ESP32[-\w]*)/i);

          const chipType = chipMatch ? chipMatch[1] : 'ESP32';
          
          // Extract flash size from output
          // Look for patterns like "Detected flash size: 8MB", "Flash size: 8MB", or manufacturer/device IDs
          let flashSize = '4MB'; // Default
          
          // Method 1: Direct flash size mention
          const flashSizeMatch = output.match(/(?:Detected\s+)?flash\s+size[:\s]+(\d+)MB/i);
          if (flashSizeMatch) {
            flashSize = `${flashSizeMatch[1]}MB`;
          } else {
            // Method 2: Parse from manufacturer/device ID (e.g., "Manufacturer: c8, Device: 4016" = 4MB)
            // Common flash IDs: 4016=4MB, 4017=8MB, 4018=16MB, 4015=2MB
            const deviceMatch = output.match(/Device:\s*([0-9a-fA-F]+)/i);
            if (deviceMatch) {
              const deviceId = deviceMatch[1].toLowerCase();
              const flashSizeMap = {
                '4015': '2MB',
                '4016': '4MB',
                '4017': '8MB',
                '4018': '16MB',
                '4019': '32MB'
              };
              if (flashSizeMap[deviceId]) {
                flashSize = flashSizeMap[deviceId];
              }
            }
          }
          
          console.log('Detected chip:', chipType, 'Flash size:', flashSize);
          console.log('Full output:', output);
          resolve({ success: true, chipType, flashSize, output });
        } else {
          reject(new Error(`Chip detection failed: ${output}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Flash firmware to ESP32
   */
  async flashFirmware(options) {
    const {
      port,
      firmwarePath,
      baudRate = 460800,
      flashAddress = '0x10000',
      eraseFlash = true,
      chipType = null,
      onProgress
    } = options;

    if (this.isFlashing) {
      throw new Error('Flash operation already in progress');
    }

    this.isFlashing = true;
    this.progressCallback = onProgress;

    return new Promise((resolve, reject) => {
      // Determine the actual flash address based on chip type if not explicitly set
      let actualFlashAddress = flashAddress;

      // If using default address and chip is ESP32-S3, use 0x20000
      if (flashAddress === '0x10000' && chipType && chipType.includes('ESP32-S3')) {
        actualFlashAddress = '0x20000';
        console.log(`Auto-adjusted flash address from ${flashAddress} to ${actualFlashAddress} for ${chipType}`);
      }

      const args = [
        '--port', port,
        '--baud', baudRate.toString(),
        '--before', 'default-reset',
        '--after', 'hard-reset',
        '--chip', chipType || 'auto'
      ];

      // Add write-flash command with firmware - use ESP-IDF format
      args.push('write-flash');
      args.push('-z');  // Compress
      
      // Add erase flag if requested
      if (eraseFlash) {
        args.push('--erase-all');
      }
      
      args.push(actualFlashAddress);
      args.push(firmwarePath);

      console.log('Flashing ESP32 with command:', this.esptoolPath, args.join(' '));

      this.flashProcess = spawn(this.esptoolPath, args);
      let output = '';
      let errorOutput = '';

      this.flashProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[esptool]', text.trim());
        this.parseProgress(text);
      });

      this.flashProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[esptool]', text.trim());
        this.parseProgress(text);
      });

      this.flashProcess.on('close', (code) => {
        this.isFlashing = false;
        this.flashProcess = null;

        if (code === 0) {
          console.log('Flash completed successfully');
          resolve({
            success: true,
            message: 'Flash completed successfully',
            output: output + errorOutput
          });
        } else {
          console.error('Flash failed:', errorOutput || output);
          reject(new Error(`Flash failed with code ${code}: ${errorOutput || output}`));
        }
      });

      this.flashProcess.on('error', (error) => {
        this.isFlashing = false;
        this.flashProcess = null;
        reject(error);
      });
    });
  }

  /**
   * Parse progress from esptool output
   */
  parseProgress(text) {
    if (!this.progressCallback) return;

    // Detect stages
    if (text.includes('Detecting chip type')) {
      const progressData = { stage: 'detecting', progress: 5, message: 'Detecting chip type...' };
      console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
      this.progressCallback(progressData);
    } else if (text.includes('Chip is')) {
      const chipMatch = text.match(/Chip is (ESP32[-\w]*)/i);
      if (chipMatch) {
        const progressData = {
          stage: 'detected',
          progress: 10,
          message: `Detected ${chipMatch[1]}`,
          chipType: chipMatch[1]
        };
        console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
        this.progressCallback(progressData);
      }
    } else if (text.includes('Changing baud rate')) {
      const progressData = { stage: 'connecting', progress: 15, message: 'Changing baud rate...' };
      console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
      this.progressCallback(progressData);
    } else if (text.includes('Erasing flash')) {
      const progressData = { stage: 'erasing', progress: 20, message: 'Erasing flash...' };
      console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
      this.progressCallback(progressData);
    } else if (text.includes('Writing at')) {
      // Extract progress from "Writing at 0x00010000 [========>  ]  31.8% 458752/1444045 bytes..."
      const progressMatch = text.match(/\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        const progressData = {
          stage: 'writing',
          progress: 20 + Math.floor(percent * 0.75), // 20-95%
          message: `Writing firmware... ${percent.toFixed(1)}%`
        };
        // Only log every 5% to reduce console spam
        if (Math.floor(percent) % 5 === 0 || percent > 99) {
          console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
        }
        this.progressCallback(progressData);
      }
    } else if (text.includes('Hash of data verified')) {
      const progressData = { stage: 'verifying', progress: 98, message: 'Verifying...' };
      console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
      this.progressCallback(progressData);
    } else if (text.includes('Leaving') || text.includes('Hard resetting')) {
      const progressData = { stage: 'complete', progress: 100, message: 'Flash complete!' };
      console.log(`[Flash Progress] ${progressData.progress}% - ${progressData.message}`);
      this.progressCallback(progressData);
    }
  }

  /**
   * Cancel ongoing flash operation
   */
  cancelFlash() {
    if (this.flashProcess) {
      this.flashProcess.kill();
      this.flashProcess = null;
      this.isFlashing = false;
      return { success: true };
    }
    return { success: false, message: 'No flash operation in progress' };
  }

  /**
   * Scan folder for .bin files and categorize them
   */
  scanFolderForBinFiles(folderPath) {
    const discovered = {
      bootloader: '',
      partition: '',
      otaData: '',
      firmware: ''
    };

    try {
      const files = fs.readdirSync(folderPath);
      const potentialFirmware = [];

      for (const file of files) {
        const fullPath = path.join(folderPath, file);
        const stats = fs.statSync(fullPath);

        if (!stats.isDirectory() && file.toLowerCase().endsWith('.bin')) {
          const fileName = file.toLowerCase();

          // Categorize based on naming patterns
          if (fileName.includes('bootloader') && !discovered.bootloader) {
            discovered.bootloader = fullPath;
          } else if (fileName.includes('partition') && !discovered.partition) {
            discovered.partition = fullPath;
          } else if (fileName === 'ota_data_initial.bin' && !discovered.otaData) {
            discovered.otaData = fullPath;
          } else {
            // Any other .bin file is potential firmware
            potentialFirmware.push(fullPath);
          }
        }
      }

      // Use first potential firmware if no firmware found yet
      if (!discovered.firmware && potentialFirmware.length > 0) {
        discovered.firmware = potentialFirmware[0];
      }

      // Check subfolders for missing files
      if (!discovered.bootloader) {
        const bootloaderSubfolder = path.join(folderPath, 'bootloader');
        if (fs.existsSync(bootloaderSubfolder)) {
          const subFiles = this.scanFolderForBinFiles(bootloaderSubfolder);
          if (subFiles.bootloader) discovered.bootloader = subFiles.bootloader;
        }
      }

      if (!discovered.partition) {
        const partitionSubfolder = path.join(folderPath, 'partition_table');
        if (fs.existsSync(partitionSubfolder)) {
          const subFiles = this.scanFolderForBinFiles(partitionSubfolder);
          if (subFiles.partition) discovered.partition = subFiles.partition;
        }
      }

    } catch (error) {
      console.error('Error scanning folder:', error);
    }

    return discovered;
  }

  /**
   * Flash complete firmware (bootloader + partition + OTA + firmware)
   */
  async flashComplete(options) {
    const {
      port,
      baudRate = 460800,
      bootloaderPath = '',
      partitionPath = '',
      otaDataPath = '',
      firmwarePath = '',
      eraseFlash = true,
      chipType = null,
      flashMode = 'dio',
      flashFreq = '80m',
      flashSize = '4MB',
      onProgress = null
    } = options;

    if (!firmwarePath) {
      return { success: false, error: 'Firmware file is required' };
    }

    this.isFlashing = true;
    this.progressCallback = onProgress;

    return new Promise((resolve) => {
      try {
        // Build esptool command matching ESP-IDF format
        const args = [
          '--port', port,
          '--baud', baudRate.toString(),
          '--before', 'default-reset',
          '--after', 'hard-reset',
          '--chip', chipType || 'auto',
          'write-flash',
          '--flash-mode', flashMode,
          '--flash-freq', flashFreq,
          '--flash-size', flashSize
        ];
        
        // Add erase flag if requested
        if (eraseFlash) {
          args.push('--erase-all');
        }

        // Determine chip-specific addresses
        console.log('flashComplete: chipType =', chipType);
        const isESP32S = chipType && (chipType.includes('ESP32-S') || chipType.includes('ESP32-C') || chipType.includes('ESP32-H'));
        const isESP32S3 = chipType && chipType.includes('ESP32-S3');
        console.log('flashComplete: isESP32S =', isESP32S, ', isESP32S3 =', isESP32S3);

        // Bootloader address
        const bootloaderAddr = isESP32S ? '0x0' : '0x1000';

        // Partition table address (always 0x8000)
        const partitionAddr = '0x8000';

        // OTA data address (optional, not always included)
        const otaDataAddr = '0xd000';

        // Firmware address - ESP32-S3 uses 0x20000, others use 0x10000
        const firmwareAddr = isESP32S3 ? '0x20000' : '0x10000';
        console.log('flashComplete: firmwareAddr =', firmwareAddr, 'for chipType:', chipType);

        // Add files in address order (ascending) - esptool format
        // Match ESP-IDF command: bootloader, partition, firmware (OTA data is optional)

        // Add bootloader
        if (bootloaderPath && fs.existsSync(bootloaderPath)) {
          args.push(bootloaderAddr, bootloaderPath);
        }

        // Add partition table
        if (partitionPath && fs.existsSync(partitionPath)) {
          args.push(partitionAddr, partitionPath);
        }

        // Add OTA data if exists (optional - not in your ESP-IDF command)
        if (otaDataPath && fs.existsSync(otaDataPath)) {
          args.push(otaDataAddr, otaDataPath);
        }

        // Add firmware (required)
        args.push(firmwareAddr, firmwarePath);

        console.log('Complete flash command:', this.esptoolPath, args.join(' '));

        this.flashProcess = spawn(this.esptoolPath, args);

        let output = '';
        let errorOutput = '';

        this.flashProcess.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log('[esptool]', text.trim());

          // Parse progress
          this.parseProgress(text);
        });

        this.flashProcess.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          console.log('[esptool]', text.trim());

          // Parse progress from stderr too
          this.parseProgress(text);
        });

        this.flashProcess.on('close', (code) => {
          this.isFlashing = false;
          this.flashProcess = null;

          if (code === 0) {
            if (this.progressCallback) {
              this.progressCallback({
                stage: 'complete',
                progress: 100,
                message: 'Complete flash successful!'
              });
            }
            resolve({ success: true, output });
          } else {
            if (this.progressCallback) {
              this.progressCallback({
                stage: 'failed',
                progress: 0,
                message: `Flash failed with code ${code}`
              });
            }
            resolve({ success: false, error: `Flash failed with code ${code}`, output: errorOutput || output });
          }
        });

        this.flashProcess.on('error', (error) => {
          this.isFlashing = false;
          this.flashProcess = null;

          if (this.progressCallback) {
            this.progressCallback({
              stage: 'failed',
              progress: 0,
              message: error.message
            });
          }
          resolve({ success: false, error: error.message });
        });

      } catch (error) {
        this.isFlashing = false;
        if (this.progressCallback) {
          this.progressCallback({
            stage: 'failed',
            progress: 0,
            message: error.message
          });
        }
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Erase entire flash memory
   */
  async eraseFlash(port) {
    if (this.isFlashing) {
      throw new Error('Flash operation already in progress');
    }

    this.isFlashing = true;

    return new Promise((resolve, reject) => {
      const args = [
        '--port', port,
        '--baud', '460800',
        '--before', 'default-reset',
        '--after', 'hard-reset',
        'erase_flash'
      ];

      console.log('Erasing flash with command:', this.esptoolPath, args.join(' '));

      this.flashProcess = spawn(this.esptoolPath, args);
      let output = '';
      let errorOutput = '';

      this.flashProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[esptool erase]', text.trim());
      });

      this.flashProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[esptool erase]', text.trim());
      });

      this.flashProcess.on('close', (code) => {
        this.isFlashing = false;
        this.flashProcess = null;

        if (code === 0) {
          console.log('Flash erase completed successfully');
          resolve({
            success: true,
            message: 'Flash erased successfully',
            output: output + errorOutput
          });
        } else {
          console.error('Flash erase failed:', errorOutput || output);
          reject(new Error(`Flash erase failed with code ${code}: ${errorOutput || output}`));
        }
      });

      this.flashProcess.on('error', (error) => {
        this.isFlashing = false;
        this.flashProcess = null;
        reject(error);
      });
    });
  }

  /**
   * Get flash status
   */
  getStatus() {
    return {
      isFlashing: this.isFlashing,
      ready: this.esptoolPath !== null
    };
  }
}

module.exports = ESP32FlasherNative;
