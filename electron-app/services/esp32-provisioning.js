/**
 * ESP32 Provisioning Service
 * Handles complete ESP32 provisioning workflow including:
 * - MAC address reading
 * - UUID generation from MAC
 * - PSK generation  
 * - NVS partition creation and flashing
 * - Database insertion (optional)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { Client } = require('pg');

class ESP32Provisioning {
  constructor() {
    this.isProvisioning = false;
    this.currentProcess = null;
    this.progressCallback = null;
    this.esptoolPath = null;
    this.nvsGenPath = null;
    this.initialized = false;
  }

  /**
   * Initialize the provisioning service
   */
  async initialize() {
    try {
      // Get platform-specific binary paths
      const platform = os.platform();
      
      // Extract esptool binary to temp (same logic as esp32-flasher-native)
      const esptoolDir = path.join(os.tmpdir(), 'fga-simulator-esptool');
      if (!fs.existsSync(esptoolDir)) {
        fs.mkdirSync(esptoolDir, { recursive: true });
      }

      let esptoolBinaryName, esptoolSourcePath;
      if (platform === 'win32') {
        esptoolBinaryName = 'esptool.exe';
        esptoolSourcePath = path.join(__dirname, '../embedded/esptool-binaries/windows', esptoolBinaryName);
        this.esptoolPath = path.join(esptoolDir, esptoolBinaryName);
      } else {
        esptoolBinaryName = 'esptool';
        esptoolSourcePath = path.join(__dirname, '../embedded/esptool-binaries/linux', esptoolBinaryName);
        this.esptoolPath = path.join(esptoolDir, esptoolBinaryName);
      }

      // Copy esptool binary if not exists or if source is newer
      if (fs.existsSync(esptoolSourcePath)) {
        const shouldCopyEsptool = !fs.existsSync(this.esptoolPath) ||
                                   fs.statSync(esptoolSourcePath).mtime > fs.statSync(this.esptoolPath).mtime;

        if (shouldCopyEsptool) {
          console.log(`Extracting esptool binary to: ${this.esptoolPath}`);
          fs.copyFileSync(esptoolSourcePath, this.esptoolPath);

          // Make executable on Unix-like systems
          if (platform !== 'win32') {
            fs.chmodSync(this.esptoolPath, 0o755);
          }
        }
      } else {
        console.warn(`esptool binary not found at: ${esptoolSourcePath}`);
      }

      // Set nvs_partition_gen path
      const nvsDir = path.join(os.tmpdir(), 'fga-simulator-nvs');
      if (!fs.existsSync(nvsDir)) {
        fs.mkdirSync(nvsDir, { recursive: true });
      }

      let sourcePath;
      if (platform === 'win32') {
        sourcePath = path.join(__dirname, '../embedded/nvs-binaries/windows/nvs_partition_gen.exe');
        this.nvsGenPath = path.join(nvsDir, 'nvs_partition_gen.exe');
      } else {
        sourcePath = path.join(__dirname, '../embedded/nvs-binaries/linux/nvs_partition_gen');
        this.nvsGenPath = path.join(nvsDir, 'nvs_partition_gen');
      }

      // Copy nvs_partition_gen binary to temp
      if (fs.existsSync(sourcePath)) {
        const shouldCopy = !fs.existsSync(this.nvsGenPath) ||
                          fs.statSync(sourcePath).mtime > fs.statSync(this.nvsGenPath).mtime;

        if (shouldCopy) {
          console.log(`Copying nvs_partition_gen to: ${this.nvsGenPath}`);
          fs.copyFileSync(sourcePath, this.nvsGenPath);

          // Make executable on Unix-like systems
          if (platform !== 'win32') {
            fs.chmodSync(this.nvsGenPath, 0o755);
          }
        }
      } else {
        console.warn(`nvs_partition_gen binary not found at: ${sourcePath}`);
      }

      this.initialized = true;
      console.log('ESP32 Provisioning service initialized');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize provisioning service:', error);
      throw error;
    }
  }

  /**
   * Get available serial ports
   */
  async getSerialPorts() {
    try {
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        serialNumber: port.serialNumber || '',
        productId: port.productId || '',
        vendorId: port.vendorId || ''
      }));
    } catch (error) {
      console.error('Error listing serial ports:', error);
      return [];
    }
  }

  /**
   * Read MAC address from ESP32
   */
  async readMacAddress(port, chip = 'esp32') {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.esptoolPath)) {
        reject(new Error('esptool binary not found. Please initialize first.'));
        return;
      }

      const args = ['--chip', chip, '--port', port, 'read_mac'];
      const cmd = spawn(this.esptoolPath, args);

      let output = '';
      let errorOutput = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      cmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          // Parse MAC address from output
          const macMatch = output.match(/MAC:\s*([0-9A-Fa-f:]{17})/);
          if (macMatch) {
            const mac = macMatch[1].toLowerCase().replace(/-/g, ':');
            resolve(mac);
          } else {
            reject(new Error(`Could not parse MAC address from output: ${output}`));
          }
        } else {
          reject(new Error(`Failed to read MAC: ${errorOutput || output}`));
        }
      });

      cmd.on('error', (error) => {
        reject(new Error(`Failed to execute esptool: ${error.message}`));
      });
    });
  }

  /**
   * Generate UUID from MAC address using UUID v5 (SHA-1 based)
   */
  generateUUIDFromMAC(macAddress) {
    const cleanMAC = macAddress.toLowerCase().replace(/:/g, '');
    
    // Use UUID v5 namespace URL
    const namespace = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'; // URL namespace UUID
    
    // Create SHA-1 hash
    const hash = crypto.createHash('sha1');
    hash.update(namespace + cleanMAC);
    const hashBytes = hash.digest();
    
    // Format as UUID v5
    const uuid = [
      hashBytes.slice(0, 4).toString('hex'),
      hashBytes.slice(4, 6).toString('hex'),
      hashBytes.slice(6, 8).toString('hex'),
      hashBytes.slice(8, 10).toString('hex'),
      hashBytes.slice(10, 16).toString('hex')
    ].join('-');
    
    // Set version (5) and variant bits
    const parts = uuid.split('-');
    parts[2] = '5' + parts[2].substring(1);
    parts[3] = (parseInt(parts[3][0], 16) & 0x3 | 0x8).toString(16) + parts[3].substring(1);
    
    return parts.join('-');
  }

  /**
   * Generate random Pre-Shared Key (32 hex characters)
   */
  generatePSK() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create NVS CSV file with provisioning data
   */
  createNVSCSV(globalUUID, pskSecret, caUrl, wifiSSID = '', wifiPassword = '') {
    const csvPath = path.join(os.tmpdir(), 'zc_seed.csv');
    
    let content = 'key,type,encoding,value\r\n';
    content += 'zc,namespace,,\r\n';
    content += `global_uuid,data,string,${globalUUID}\r\n`;
    content += `psk_secret,data,string,${pskSecret}\r\n`;
    content += `ca_service_url,data,string,${caUrl}\r\n`;
    
    // Add WiFi credentials if provided
    if (wifiSSID) {
      console.log(`Adding WiFi credentials to NVS - SSID: ${wifiSSID}`);
      content += `wifi_ssid,data,string,${wifiSSID}\r\n`;
      if (wifiPassword) {
        content += `wifi_password,data,string,${wifiPassword}\r\n`;
      }
    }
    
    fs.writeFileSync(csvPath, content, 'utf8');
    console.log(`Created NVS CSV file: ${csvPath}`);
    console.log(`Content:\n${content}`);
    
    return csvPath;
  }

  /**
   * Generate NVS binary from CSV
   */
  async generateNVSBinary(csvPath, size = '0x10000') {
    return new Promise((resolve, reject) => {
      const binPath = path.join(os.tmpdir(), 'zc_cfg_nvs.bin');
      
      // Remove existing binary
      if (fs.existsSync(binPath)) {
        fs.unlinkSync(binPath);
      }

      if (!fs.existsSync(this.nvsGenPath)) {
        reject(new Error(`nvs_partition_gen not found at: ${this.nvsGenPath}`));
        return;
      }

      const args = ['generate', csvPath, binPath, size];
      const cmd = spawn(this.nvsGenPath, args);

      let output = '';
      let errorOutput = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[nvs_gen]', data.toString().trim());
      });

      cmd.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('[nvs_gen]', data.toString().trim());
      });

      cmd.on('close', (code) => {
        if (code === 0 && fs.existsSync(binPath)) {
          console.log(`Successfully generated NVS binary: ${binPath}`);
          resolve(binPath);
        } else {
          reject(new Error(`Failed to generate NVS binary: ${errorOutput || output}`));
        }
      });

      cmd.on('error', (error) => {
        reject(new Error(`Failed to execute nvs_partition_gen: ${error.message}`));
      });
    });
  }

  /**
   * Flash NVS binary to ESP32
   */
  async flashNVSBinary(port, chip, offset, binPath, baudRate = '921600') {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.esptoolPath)) {
        reject(new Error('esptool binary not found'));
        return;
      }

      if (!fs.existsSync(binPath)) {
        reject(new Error(`NVS binary not found at: ${binPath}`));
        return;
      }

      const args = [
        '--chip', chip,
        '--port', port,
        '--baud', baudRate,
        '--after', 'no_reset',
        'write_flash', offset, binPath
      ];

      console.log(`Flashing NVS: ${this.esptoolPath} ${args.join(' ')}`);

      const cmd = spawn(this.esptoolPath, args);
      let output = '';
      let errorOutput = '';

      cmd.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[esptool]', text.trim());
        if (this.progressCallback) {
          this.parseFlashProgress(text);
        }
      });

      cmd.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[esptool]', text.trim());
        if (this.progressCallback) {
          this.parseFlashProgress(text);
        }
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          console.log('NVS flash completed successfully');
          resolve({ success: true, output });
        } else {
          reject(new Error(`Flash failed with code ${code}: ${errorOutput || output}`));
        }
      });

      cmd.on('error', (error) => {
        reject(new Error(`Failed to execute esptool: ${error.message}`));
      });
    });
  }

  /**
   * Parse flash progress from esptool output
   */
  parseFlashProgress(text) {
    if (!this.progressCallback) return;

    if (text.includes('Connecting')) {
      this.progressCallback({ stage: 'connecting', progress: 10, message: 'Connecting to ESP32...' });
    } else if (text.includes('Writing at')) {
      const progressMatch = text.match(/\((\d+)\s*%\)/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1]);
        this.progressCallback({
          stage: 'writing',
          progress: 10 + Math.floor(percent * 0.8),
          message: `Writing NVS partition... ${percent}%`
        });
      }
    } else if (text.includes('Hash of data verified') || text.includes('Leaving')) {
      this.progressCallback({ stage: 'complete', progress: 100, message: 'NVS flash complete!' });
    }
  }

  /**
   * Detect ESP32 chip type
   */
  async detectChipType(port) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.esptoolPath)) {
        reject(new Error('esptool binary not found'));
        return;
      }

      const args = ['--chip', 'auto', '--port', port, '--baud', '115200', 'chip_id'];
      const cmd = spawn(this.esptoolPath, args);

      let output = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      cmd.stderr.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          // Parse chip type from output
          let chipType = 'esp32';
          const lines = output.split('\n');
          
          for (const line of lines) {
            if (line.includes('Detecting chip type') || line.includes('Chip is') || line.includes('esp32')) {
              const lineLower = line.toLowerCase();
              if (lineLower.includes('esp32-s3') || lineLower.includes('esp32s3')) {
                chipType = 'esp32s3';
                break;
              } else if (lineLower.includes('esp32-s2') || lineLower.includes('esp32s2')) {
                chipType = 'esp32s2';
                break;
              } else if (lineLower.includes('esp32-c3') || lineLower.includes('esp32c3')) {
                chipType = 'esp32c3';
                break;
              } else if (lineLower.includes('esp32-c6') || lineLower.includes('esp32c6')) {
                chipType = 'esp32c6';
                break;
              }
            }
          }
          
          console.log(`Detected chip type: ${chipType}`);
          resolve(chipType);
        } else {
          reject(new Error(`Failed to detect chip: ${output}`));
        }
      });

      cmd.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Helper: Wait for serial port to be fully released
   */
  async waitForPortRelease(delayMs = 500) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Monitor serial port boot logs after reset
   */
  async monitorBootLogs(port, baudRate = 115200, durationMs = 5000) {
    return new Promise((resolve, reject) => {
      let serialPort = null;
      let parser = null;
      const bootLogs = [];

      try {
        console.log('');
        console.log('========================================');
        console.log('  Monitoring ESP32 Boot Logs');
        console.log(`  Port: ${port}`);
        console.log(`  Baud Rate: ${baudRate}`);
        console.log(`  Duration: ${durationMs}ms`);
        console.log('========================================');
        console.log('');

        // Open serial port
        serialPort = new SerialPort({
          path: port,
          baudRate: baudRate,
          autoOpen: false
        });

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

        // Setup data handler
        parser.on('data', (data) => {
          const line = data.toString().trim();
          if (line) {
            console.log(`[BOOT LOG]: ${line}`);
            bootLogs.push(line);
          }
        });

        // Timeout to stop monitoring
        const timeout = setTimeout(() => {
          console.log('');
          console.log('========================================');
          console.log(`  Boot log monitoring complete (${bootLogs.length} lines captured)`);
          console.log('========================================');
          console.log('');
          
          if (serialPort && serialPort.isOpen) {
            serialPort.close(() => {
              resolve({ success: true, logs: bootLogs });
            });
          } else {
            resolve({ success: true, logs: bootLogs });
          }
        }, durationMs);

        // Open the port
        serialPort.open((err) => {
          if (err) {
            clearTimeout(timeout);
            reject(new Error(`Failed to open serial port: ${err.message}`));
            return;
          }
          console.log('Serial port opened for boot log monitoring...');
        });

        // Handle errors
        serialPort.on('error', (err) => {
          clearTimeout(timeout);
          console.error('Serial port error:', err);
          reject(err);
        });

      } catch (error) {
        console.error('Boot log monitoring error:', error);
        if (serialPort && serialPort.isOpen) {
          serialPort.close();
        }
        reject(error);
      }
    });
  }

  /**
   * Complete provisioning workflow
   */
  async provisionESP32(config) {
    const result = {
      success: false,
      message: '',
      macAddress: '',
      globalUUID: '',
      presharedSecret: '',
      caUrl: config.caUrl,
      stage: 'starting'
    };

    try {
      // Step 1: Read MAC address
      result.stage = 'mac_read';
      result.macAddress = await this.readMacAddress(config.port, config.chip);
      console.log(`MAC Address: ${result.macAddress}`);
      
      // Wait for port to be fully released
      await this.waitForPortRelease(500);

      // Step 2: Generate UUID
      result.stage = 'uuid_gen';
      result.globalUUID = config.customUuid || this.generateUUIDFromMAC(result.macAddress);
      console.log(`UUID: ${result.globalUUID}`);

      // Step 3: Generate PSK
      result.stage = 'psk_gen';
      result.presharedSecret = config.customPsk || this.generatePSK();
      console.log(`PSK: ${result.presharedSecret}`);

      // Step 4: Create NVS CSV and binary
      result.stage = 'nvs_create';
      const csvPath = this.createNVSCSV(
        result.globalUUID,
        result.presharedSecret,
        config.caUrl,
        config.wifiSsid || '',
        config.wifiPassword || ''
      );

      const binPath = await this.generateNVSBinary(csvPath, config.size || '0x10000');

      // Step 5: Flash NVS binary
      result.stage = 'nvs_flash';
      await this.flashNVSBinary(
        config.port,
        config.chip,
        config.offset || '0xA20000',
        binPath,
        config.baudRate || '921600'
      );

      // Cleanup temp files
      try {
        fs.unlinkSync(csvPath);
        fs.unlinkSync(binPath);
      } catch (err) {
        console.warn('Failed to cleanup temp files:', err);
      }

      // Step 5.5: Monitor boot logs after reset (wait for port to be released first)
      result.stage = 'boot_monitor';
      console.log('Waiting for ESP32 to reset and start booting...');
      await this.waitForPortRelease(1000); // Wait 1 second for reset to complete
      
      try {
        if (this.progressCallback) {
          this.progressCallback({
            stage: 'boot_monitor',
            progress: 75,
            message: 'Monitoring ESP32 boot logs after reset...'
          });
        }
        
        const bootResult = await this.monitorBootLogs(
          config.port,
          115200, // Standard ESP32 boot log baud rate
          5000    // Monitor for 5 seconds
        );
        
        result.bootLogs = bootResult.logs;
        console.log(`Captured ${bootResult.logs.length} boot log lines`);
      } catch (bootError) {
        console.warn('Failed to monitor boot logs:', bootError.message);
        // Don't fail provisioning if we can't monitor boot logs
      }

      // Wait a bit more to ensure port is fully released before database operations
      await this.waitForPortRelease(500);

      // Step 6: Insert into database
      result.stage = 'db_insert';
      try {
        await this.insertDeviceToDatabase(result.globalUUID, result.presharedSecret);
        console.log(`Device credentials saved to database for UUID: ${result.globalUUID}`);
      } catch (dbError) {
        console.error('Failed to save to database:', dbError);
        // Don't fail the entire provisioning if database insert fails
        // The device is already provisioned on the ESP32
        result.message = `Provisioning succeeded but database insertion failed: ${dbError.message}`;
      }

      // Step 7: Configure WiFi via serial (optional)
      // if (config.configureWiFi && config.wifiSsid && config.wifiPassword) {
      //   result.stage = 'wifi_config';
      //   result.message = 'Configuring WiFi via serial console...';
      //   try {
      //     console.log('Starting WiFi configuration via serial...');
          
      //     // Send progress update
      //     if (this.progressCallback) {
      //       this.progressCallback({
      //         stage: 'wifi_config',
      //         progress: 85,
      //         message: 'Connecting to serial console for WiFi configuration...'
      //       });
      //     }
          
      //     const wifiResult = await this.configureWiFiViaSerial(
      //       config.port,
      //       config.wifiSsid,
      //       config.wifiPassword,
      //       115200, // Serial console uses 115200 baud (not provisioning baud rate)
      //       30000 // 30 second timeout
      //     );

      //     if (wifiResult.success) {
      //       console.log('✓ WiFi configured successfully');
      //       console.log('WiFi Responses:', wifiResult.responses.join(' | '));
      //       result.wifiConfigured = true;
      //       result.wifiResponses = wifiResult.responses;
      //       result.message = `Provisioning completed! WiFi configured (${wifiResult.responses.length} responses)`;
            
      //       // Send success update
      //       if (this.progressCallback) {
      //         this.progressCallback({
      //           stage: 'wifi_config',
      //           progress: 95,
      //           message: `✓ WiFi configured: ${wifiResult.responses.slice(-3).join(' → ')}`
      //         });
      //       }
      //     } else {
      //       console.warn('WiFi configuration incomplete:', wifiResult.message);
      //       console.warn('Responses received:', wifiResult.responses);
      //       result.wifiConfigured = false;
      //       result.wifiMessage = wifiResult.message;
      //       result.message = `Provisioning completed but WiFi config ${wifiResult.partial ? 'timed out' : 'failed'}: ${wifiResult.message}`;
            
      //       // Send warning update
      //       if (this.progressCallback) {
      //         this.progressCallback({
      //           stage: 'wifi_config',
      //           progress: 90,
      //           message: `⚠️ WiFi config incomplete: ${wifiResult.message}`
      //         });
      //       }
      //     }
      //   } catch (wifiError) {
      //     console.error('WiFi configuration error:', wifiError);
      //     result.wifiConfigured = false;
      //     result.wifiMessage = wifiError.message;
      //     result.message = `Provisioning completed but WiFi config error: ${wifiError.message}`;
          
      //     // Send error update
      //     if (this.progressCallback) {
      //       this.progressCallback({
      //         stage: 'wifi_config',
      //         progress: 90,
      //         message: `❌ WiFi config error: ${wifiError.message}`
      //       });
      //     }
      //   }
      // }

      // Step 8: Monitor logs after provisioning (optional, extended monitoring)
      if (config.monitorLogs !== false) { // Enabled by default
        result.stage = 'log_monitor';
        console.log('');
        console.log('Waiting for serial port to be released...');
        await this.waitForPortRelease(1000);
        
        try {
          if (this.progressCallback) {
            this.progressCallback({
              stage: 'log_monitor',
              progress: 95,
              message: 'Monitoring ESP32 logs...'
            });
          }
          
          console.log('Reopening serial port for extended log monitoring...');
          const logResult = await this.monitorBootLogs(
            config.port,
            115200,
            10000 // Monitor for 10 seconds to see app startup and MQTT connection
          );
          
          result.extendedLogs = logResult.logs;
          console.log(`Captured ${logResult.logs.length} extended log lines`);
        } catch (logError) {
          console.warn('Failed to monitor extended logs:', logError.message);
          // Don't fail provisioning if we can't monitor logs
        }
      }

      // Complete
      result.stage = 'complete';
      result.success = true;
      if (!result.message) {
        let msg = 'ESP32 provisioning completed successfully';
        if (result.wifiConfigured) {
          msg += ' with WiFi configuration';
        }
        result.message = msg;
      }
      
      return result;
    } catch (error) {
      result.success = false;
      result.message = error.message;
      console.error('Provisioning error:', error);
      throw error;
    }
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Erase flash memory on ESP32
   */
  async eraseFlash(port, eraseType) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.esptoolPath)) {
        reject(new Error('esptool binary not found'));
        return;
      }

      console.log(`Erasing flash on port ${port}, type: ${eraseType}`);

      let args = ['--port', port];

      // Add erase command based on type
      switch (eraseType) {
        case 'all':
          args.push('erase_flash');
          break;
        case 'nvs':
          // Erase NVS partition at 0xA20000, size 0x10000 (64KB)
          args.push('erase_region', '0xA20000', '0x10000');
          break;
        case 'allnvs':
          // Erase all NVS partitions: nvs (0x9000), zc_cfg (0xA20000), cert_storage (0x3E0000)
          args.push('erase_region', '0x9000', '0x10000');
          
          // Execute first erase
          const cmd1 = spawn(this.esptoolPath, args);
          let output1 = '';
          
          cmd1.stdout.on('data', (data) => { output1 += data.toString(); });
          cmd1.stderr.on('data', (data) => { output1 += data.toString(); });
          
          cmd1.on('close', (code1) => {
            if (code1 !== 0) {
              reject(new Error(`Failed to erase nvs partition: ${output1}`));
              return;
            }
            
            // Then erase zc_cfg and cert_storage together
            const args2 = ['--port', port, 'erase_region', '0xA20000', '0x1E0000'];
            const cmd2 = spawn(this.esptoolPath, args2);
            let output2 = '';
            
            cmd2.stdout.on('data', (data) => { output2 += data.toString(); });
            cmd2.stderr.on('data', (data) => { output2 += data.toString(); });
            
            cmd2.on('close', (code2) => {
              if (code2 === 0) {
                console.log('All NVS partitions erased successfully');
                resolve({ success: true, message: 'All NVS partitions erased' });
              } else {
                reject(new Error(`Failed to erase zc_cfg/cert_storage: ${output2}`));
              }
            });
            
            cmd2.on('error', (error) => reject(error));
          });
          
          cmd1.on('error', (error) => reject(error));
          return;
        default:
          reject(new Error(`Invalid erase type: ${eraseType}`));
          return;
      }

      const cmd = spawn(this.esptoolPath, args);
      let output = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[esptool]', data.toString().trim());
      });

      cmd.stderr.on('data', (data) => {
        output += data.toString();
        console.log('[esptool]', data.toString().trim());
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          console.log('Flash erase completed successfully');
          resolve({ success: true, message: 'Flash erase complete', output });
        } else {
          reject(new Error(`Flash erase failed with code ${code}: ${output}`));
        }
      });

      cmd.on('error', (error) => {
        reject(new Error(`Failed to execute esptool: ${error.message}`));
      });
    });
  }

  /**
   * Erase custom flash region
   */
  async eraseCustomRegion(port, address, size) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.esptoolPath)) {
        reject(new Error('esptool binary not found'));
        return;
      }

      console.log(`Erasing custom region on port ${port}, address: ${address}, size: ${size}`);

      const args = ['--port', port, 'erase_region', address, size];
      const cmd = spawn(this.esptoolPath, args);
      let output = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[esptool]', data.toString().trim());
      });

      cmd.stderr.on('data', (data) => {
        output += data.toString();
        console.log('[esptool]', data.toString().trim());
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          console.log('Custom region erase completed successfully');
          resolve({ success: true, message: 'Custom region erased', output });
        } else {
          reject(new Error(`Custom region erase failed with code ${code}: ${output}`));
        }
      });

      cmd.on('error', (error) => {
        reject(new Error(`Failed to execute esptool: ${error.message}`));
      });
    });
  }

  /**
   * Get available chip types
   */
  getChipTypes() {
    return ['esp32', 'esp32s2', 'esp32s3', 'esp32c2', 'esp32c3', 'esp32c6', 'esp32h2'];
  }

  /**
   * Insert device credentials into PostgreSQL database
   */
  async insertDeviceToDatabase(globalUUID, presharedSecret, dbConfig = null) {
    // Use provided config or default
    const config = dbConfig || {
      host: '128.199.170.214',
      port: 5432,
      user: 'user',
      password: 'password12345678',
      database: 'ca_database'
    };

    const client = new Client(config);

    try {
      console.log(`Connecting to database at ${config.host}:${config.port}`);
      await client.connect();
      console.log('Database connection successful');

      // Insert or update device record (UPSERT)
      const query = `
        INSERT INTO zc_devices (
          global_uuid,
          preshared_secret,
          number_of_certificate_assigned,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (global_uuid) DO UPDATE SET
          preshared_secret = EXCLUDED.preshared_secret,
          updated_at = EXCLUDED.updated_at
      `;

      const now = new Date();
      await client.query(query, [globalUUID, presharedSecret, 0, now, now]);

      console.log(`Successfully inserted/updated device credentials for UUID: ${globalUUID}`);
    } catch (error) {
      console.error('Database operation failed:', error);
      throw new Error(`Failed to insert into database: ${error.message}`);
    } finally {
      await client.end();
    }
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection(dbConfig = null) {
    const config = dbConfig || {
      host: '128.199.170.214',
      port: 5432,
      user: 'user',
      password: 'password12345678',
      database: 'ca_database'
    };

    const client = new Client(config);

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      return { success: false, message: `Database connection failed: ${error.message}` };
    }
  }

  /**
   * Configure WiFi via serial console after provisioning
   */
  async configureWiFiViaSerial(port, wifiSsid, wifiPassword, baudRate = 115200, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      let serialPort = null;
      let parser = null;
      let responses = [];
      let commandIndex = 0;
      let timeoutHandle = null;
      let commandSent = false;

      // Define WiFi configuration commands (based on actual ESP32 firmware)
      const commands = [
        { cmd: '', delay: 500 }, // Initial empty line to wake up console
        { cmd: `wifi_config -s "${wifiSsid}" -p "${wifiPassword}"`, delay: 1000, expect: ['Configure', 'OK', 'SSID', 'password'] },
        { cmd: 'wifi_enable -e', delay: 1000, expect: ['Enable', 'OK', 'enabled'] }, // Enable WiFi AFTER configuring
        { cmd: 'restart', delay: 5000, expect: ['Restarting', 'restart', 'ESP-ROM'] }, // Restart to apply WiFi settings
        { cmd: 'wifi_status', delay: 2000, expect: ['IP', 'Connected', 'CONNECTED'] },
      ];

      try {
        console.log(`Configuring WiFi via serial: ${port} @ ${baudRate}`);
        console.log(`WiFi SSID: ${wifiSsid}`);
        console.log('');
        console.log('=== WiFi Configuration Command Sequence ===');
        commands.forEach((cmd, idx) => {
          if (idx === 0) {
            console.log(`  ${idx + 1}. (empty line) - wake up console`);
          } else if (cmd.cmd === 'restart') {
            console.log(`  ${idx + 1}. ${cmd.cmd} - restart ESP32 (wait ${cmd.delay}ms for reboot)`);
          } else {
            console.log(`  ${idx + 1}. ${cmd.cmd}`);
          }
        });
        console.log('===========================================');
        console.log('');

        // Open serial port
        serialPort = new SerialPort({
          path: port,
          baudRate: baudRate,
          autoOpen: false
        });

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

        // Setup data handler
        parser.on('data', (data) => {
          const line = data.toString().trim();
          if (line) {
            console.log(`[Serial RX]: ${line}`);
            responses.push(line);

            // Check if expected response received
            if (commandSent && commandIndex < commands.length) {
              const currentCmd = commands[commandIndex];
              if (currentCmd.expect) {
                // Check if any of the expected strings are in the response
                const matched = currentCmd.expect.some(exp => 
                  line.toUpperCase().includes(exp.toUpperCase())
                );

                if (matched) {
                  console.log(`✓ Command ${commandIndex + 1}/${commands.length} successful`);
                  commandSent = false;
                  commandIndex++;
                  
                  // Send next command after delay
                  if (commandIndex < commands.length) {
                    const nextCmd = commands[commandIndex];
                    // Special logging for restart delay
                    if (currentCmd.cmd === 'restart') {
                      console.log(`⏳ Waiting ${currentCmd.delay}ms for ESP32 to reboot...`);
                    }
                    setTimeout(() => sendNextCommand(), currentCmd.delay);
                  } else {
                    // All commands completed
                    console.log('✓ WiFi configuration completed successfully');
                    cleanup();
                    resolve({
                      success: true,
                      message: 'WiFi configured successfully via serial',
                      responses: responses
                    });
                  }
                }
              } else {
                // No expect condition, just move to next
                commandSent = false;
                commandIndex++;
                setTimeout(() => sendNextCommand(), currentCmd.delay || 500);
              }
            }
          }
        });

        // Setup error handler
        serialPort.on('error', (err) => {
          console.error('Serial port error:', err);
          cleanup();
          reject(new Error(`Serial error: ${err.message}`));
        });

        // Send command function
        const sendNextCommand = () => {
          if (commandIndex >= commands.length) {
            cleanup();
            resolve({
              success: true,
              message: 'All WiFi commands sent',
              responses: responses
            });
            return;
          }
          
          const cmd = commands[commandIndex].cmd;
          console.log(`[Serial TX ${commandIndex + 1}/${commands.length}]: ${cmd || '(empty line)'}`);
          serialPort.write(cmd + '\r\n', (err) => {
            if (err) {
              cleanup();
              reject(new Error(`Failed to send command: ${err.message}`));
            } else {
              commandSent = true;
            }
          });
        };

        // Cleanup function
        const cleanup = () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (serialPort && serialPort.isOpen) {
            serialPort.close(() => {
              console.log('Serial port closed');
            });
          }
        };

        // Setup timeout
        timeoutHandle = setTimeout(() => {
          console.warn(`WiFi configuration timeout after ${timeout}ms`);
          console.warn(`Completed ${commandIndex}/${commands.length} commands`);
          console.warn(`Responses received (${responses.length}):`, responses);
          cleanup();
          resolve({
            success: false,
            message: `WiFi configuration timeout. Completed ${commandIndex}/${commands.length} commands. Responses: ${responses.length}`,
            responses: responses,
            partial: true
          });
        }, timeout);

        // Open port and start
        await new Promise((resolveOpen, rejectOpen) => {
          serialPort.open((err) => {
            if (err) {
              rejectOpen(new Error(`Failed to open port: ${err.message}`));
            } else {
              console.log('Serial port opened for WiFi configuration');
              resolveOpen();
            }
          });
        });

        // Wait for ESP32 to be ready after flashing
        console.log('Waiting 2 seconds for ESP32 to initialize...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Start sending commands
        console.log('Starting WiFi command sequence...');
        console.log(`Total commands to send: ${commands.length}`);
        sendNextCommand();

      } catch (error) {
        console.error('WiFi configuration error:', error);
        if (serialPort && serialPort.isOpen) {
          serialPort.close();
        }
        reject(error);
      }
    });
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isProvisioning: this.isProvisioning,
      initialized: this.initialized,
      esptoolPath: this.esptoolPath,
      nvsGenPath: this.nvsGenPath
    };
  }
}

module.exports = ESP32Provisioning;

