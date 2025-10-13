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
      
      // Set esptool path (reuse from esp32-flasher-native)
      const esptoolDir = path.join(os.tmpdir(), 'fga-simulator-esptool');
      if (platform === 'win32') {
        this.esptoolPath = path.join(esptoolDir, 'esptool.exe');
      } else {
        this.esptoolPath = path.join(esptoolDir, 'esptool');
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
        config.offset || '0x3D0000',
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

      // Complete
      result.stage = 'complete';
      result.success = true;
      if (!result.message) {
        result.message = 'ESP32 provisioning completed successfully';
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
          // Erase NVS partition at 0x3D0000, size 0x10000 (64KB)
          args.push('erase_region', '0x3D0000', '0x10000');
          break;
        case 'allnvs':
          // Erase all NVS partitions: nvs (0x9000), zc_cfg (0x3D0000), cert_storage (0x3E0000)
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
            const args2 = ['--port', port, 'erase_region', '0x3D0000', '0x30000'];
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

