/**
 * Factory Testing Service
 * Handles AT command communication for factory testing NubeIO devices
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');
const path = require('path');

class FactoryTestingService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.portPath = '';
    this.baudRate = 115200;
    this.commandTimeout = 5000; // 5 seconds timeout for AT commands
    this.progressCallback = null;
  }

  /**
   * Connect to serial port
   */
  async connect(portPath, baudRate = 115200) {
    console.log('[Factory Testing Service] === START CONNECT ===');
    console.log('[Factory Testing Service] Port path:', portPath);
    console.log('[Factory Testing Service] Baud rate:', baudRate);
    console.log('[Factory Testing Service] Current isConnected:', this.isConnected);
    
    if (this.isConnected) {
      const error = 'Already connected to a serial port';
      console.error('[Factory Testing Service]', error);
      return { success: false, error: error };
    }

    try {
      this.portPath = portPath;
      this.baudRate = baudRate;

      console.log(`[Factory Testing Service] Creating SerialPort instance...`);

      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        autoOpen: false
      });

      console.log('[Factory Testing Service] SerialPort created, creating parser...');
      
      // Create parser for line-based reading
      // Note: Device sends \n only, not \r\n
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

      console.log('[Factory Testing Service] Opening port...');
      
      // Open the port
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) {
            console.error('[Factory Testing Service] Port open failed:', err);
            reject(new Error(`Failed to open port: ${err.message}`));
          } else {
            console.log('[Factory Testing Service] Port opened successfully!');
            this.isConnected = true;
            resolve();
          }
        });
      });

      console.log('[Factory Testing Service] Serial port connected successfully');
      
      // Immediately send AT+UNLOCK=N00BIO after connection
      try {
        console.log('[Factory Testing Service] Waiting 500ms before AT+UNLOCK=N00BIO...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms for device to be ready
        console.log('[Factory Testing Service] Sending AT+UNLOCK=N00BIO command...');
        
        // Send unlock command and wait for OK response
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.parser.removeAllListeners('data');
            reject(new Error('Timeout waiting for unlock response'));
          }, this.commandTimeout);

          const onData = (data) => {
            const line = data.toString().trim();
            console.log(`[Factory Testing Service] RX: ${line}`);
            
            if (line === 'OK') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              console.log('[Factory Testing Service] Device unlocked successfully');
              resolve('OK');
            } else if (line === 'ERROR') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error('Unlock failed - received ERROR'));
            }
          };

          this.parser.on('data', onData);

          const command = 'AT+UNLOCK=N00BIO\r\n';
          console.log(`[Factory Testing Service] TX: AT+UNLOCK=N00BIO`);
          this.port.write(command, (err) => {
            if (err) {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error(`Failed to send unlock command: ${err.message}`));
            }
          });
        });
      } catch (error) {
        console.error('[Factory Testing Service] Failed to unlock device:', error.message);
        // Fail connection if unlock command fails
        this.cleanup();
        throw new Error(`Device unlock failed: ${error.message}`);
      }
      
      console.log('[Factory Testing Service] === END CONNECT (SUCCESS) ===');
      return { success: true, port: portPath, baudRate: baudRate };
    } catch (error) {
      console.error('[Factory Testing Service] Failed to connect:', error);
      console.error('[Factory Testing Service] Error message:', error.message);
      console.error('[Factory Testing Service] Error stack:', error.stack);
      this.cleanup();
      console.log('[Factory Testing Service] === END CONNECT (FAILED) ===');
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from serial port
   */
  async disconnect() {
    if (!this.isConnected) {
      return { success: true, message: 'Not connected' };
    }

    try {
      if (this.port && this.port.isOpen) {
        await new Promise((resolve, reject) => {
          this.port.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      this.cleanup();
      console.log('[Factory Testing] Serial port disconnected');
      return { success: true };
    } catch (error) {
      console.error('[Factory Testing] Error disconnecting:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Send AT command and wait for response
   */
  async sendATCommand(command, expectedPrefix) {
    if (!this.isConnected || !this.port) {
      throw new Error('Not connected to a serial port');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.parser.removeListener('data', onData);
        console.error(`[Factory Testing] TIMEOUT: No response for ${command} with prefix ${expectedPrefix}`);
        reject(new Error(`Timeout waiting for response to: ${command}`));
      }, this.commandTimeout);

      let responseData = '';

      const onData = (data) => {
        const line = data.toString().trim();
        console.log(`[Factory Testing] RX: ${line}`);
        
        if (line.startsWith(expectedPrefix)) {
          responseData = line;
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          resolve(responseData);
        } else if (line === 'ERROR') {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          reject(new Error(`Command failed: ${command}`));
        }
      };

      // Add our specific listener
      this.parser.on('data', onData);

      // Send command
      const commandStr = command + '\r\n';
      console.log(`[Factory Testing] TX: ${command}`);
      this.port.write(commandStr, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  /**
   * Read device information
   */
  async readDeviceInfo() {
    try {
      console.log('[Factory Testing] Reading device information...');

      const deviceInfo = {};

      // 1. Firmware Version
      try {
        const fwResponse = await this.sendATCommand('AT+FWVERSION?', '+FWVERSION:');
        deviceInfo.firmwareVersion = fwResponse.replace('+FWVERSION:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read firmware version:', error);
        deviceInfo.firmwareVersion = 'ERROR';
      }

      // 2. HW Version
      try {
        const hwResponse = await this.sendATCommand('AT+HWVERSION?', '+HWVERSION:');
        deviceInfo.hwVersion = hwResponse.replace('+HWVERSION:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read HW version:', error);
        deviceInfo.hwVersion = 'ERROR';
      }

      // 3. Unique ID
      try {
        const uidResponse = await this.sendATCommand('AT+UNIQUEID?', '+UNIQUEID:');
        deviceInfo.uniqueId = uidResponse.replace('+UNIQUEID:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read Unique ID:', error);
        deviceInfo.uniqueId = 'ERROR';
      }

      // 4. Device Make
      try {
        const makeResponse = await this.sendATCommand('AT+DEVICEMAKE?', '+DEVICEMAKE:');
        deviceInfo.deviceMake = makeResponse.replace('+DEVICEMAKE:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Make:', error);
        deviceInfo.deviceMake = 'ERROR';
      }

      // 5. Device Model
      try {
        const modelResponse = await this.sendATCommand('AT+DEVICEMODEL?', '+DEVICEMODEL:');
        deviceInfo.deviceModel = modelResponse.replace('+DEVICEMODEL:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Model:', error);
        deviceInfo.deviceModel = 'ERROR';
      }

      console.log('[Factory Testing] Device information read successfully:', deviceInfo);
      return { success: true, data: deviceInfo };
    } catch (error) {
      console.error('[Factory Testing] Error reading device info:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run factory tests
   */
  async runFactoryTests(device) {
    try {
      console.log('[Factory Testing] Running factory tests for device:', device);

      // Route tests based on device type
      if (device === 'ZC-LCD') {
        const results = {};

        // 1. Check LCD info
        this.updateProgress('Checking LCD info...');
        try {
          const lcdInfo = await this.sendATCommand('AT+LCDINFO?', '+LCDINFO:');
          results.lcdInfo = lcdInfo.replace('+LCDINFO:', '').trim();
        } catch (e) {
          results.lcdInfo = 'ERROR';
        }

        // 2. Backlight status
        this.updateProgress('Checking backlight...');
        try {
          const back = await this.sendATCommand('AT+BACKLIGHT?', '+BACKLIGHT:');
          results.backlight = back.replace('+BACKLIGHT:', '').trim();
        } catch (e) {
          results.backlight = 'ERROR';
        }

        // 3. Check button/key input presence
        this.updateProgress('Checking button inputs...');
        try {
          const btn = await this.sendATCommand('AT+BTNSTATUS?', '+BTNSTATUS:');
          results.buttonStatus = btn.replace('+BTNSTATUS:', '').trim();
        } catch (e) {
          results.buttonStatus = 'ERROR';
        }

        // 4. Read basic device info using existing method
        this.updateProgress('Reading base device info...');
        try {
          const base = await this.readDeviceInfo();
          if (base.success) {
            results.baseInfo = base.data;
          } else {
            results.baseInfo = { error: 'Failed to read base info' };
          }
        } catch (e) {
          results.baseInfo = { error: e.message };
        }

        this.updateProgress('ZC-LCD tests completed');
        return { success: true, data: results };
      }

      // ACB-M device specific tests
      if (device === 'ACB-M') {
        const resultsACB = {};

        // 1. VCC / main voltage
        this.updateProgress('Checking VCC voltage...');
        try {
          const vccResp = await this.sendATCommand('AT+VCCV?', '+VCCV:');
          resultsACB.vccVoltage = vccResp.replace('+VCCV:', '').trim() + ' V';
        } catch (e) {
          resultsACB.vccVoltage = 'ERROR';
        }

        // 2. Relay statuses
        this.updateProgress('Checking relay statuses...');
        try {
          const r1 = await this.sendATCommand('AT+RELAY1?', '+RELAY1:');
          resultsACB.relay1Status = r1.replace('+RELAY1:', '').trim();
        } catch (e) {
          resultsACB.relay1Status = 'ERROR';
        }
        try {
          const r2 = await this.sendATCommand('AT+RELAY2?', '+RELAY2:');
          resultsACB.relay2Status = r2.replace('+RELAY2:', '').trim();
        } catch (e) {
          resultsACB.relay2Status = 'ERROR';
        }

        // 3. Digital inputs
        this.updateProgress('Reading digital inputs...');
        try {
          const di = await this.sendATCommand('AT+DIGITALS?', '+DIGITALS:');
          resultsACB.digitalInputs = di.replace('+DIGITALS:', '').trim();
        } catch (e) {
          resultsACB.digitalInputs = 'ERROR';
        }

        // 4. Analog inputs (reuse general commands)
        this.updateProgress('Testing AIN 1 voltage...');
        try {
          const ain1Response = await this.sendATCommand('AT+VALUE_UI1_RAW?', '+VALUE_UI1_RAW:');
          resultsACB.ain1Voltage = ain1Response.replace('+VALUE_UI1_RAW:', '').trim() + ' V';
        } catch (error) {
          resultsACB.ain1Voltage = 'ERROR';
        }

        this.updateProgress('Testing AIN 2 voltage...');
        try {
          const ain2Response = await this.sendATCommand('AT+VALUE_UI2_RAW?', '+VALUE_UI2_RAW:');
          resultsACB.ain2Voltage = ain2Response.replace('+VALUE_UI2_RAW:', '').trim() + ' V';
        } catch (error) {
          resultsACB.ain2Voltage = 'ERROR';
        }

        // 5. LoRa checks (address/detect/push)
        this.updateProgress('Reading LoRa address...');
        try {
          const loraAddrResponse = await this.sendATCommand('AT+LRRADDRUNQ?', '+LRRADDRUNQ:');
          resultsACB.loraAddress = loraAddrResponse.replace('+LRRADDRUNQ:', '').trim();
        } catch (error) {
          resultsACB.loraAddress = 'ERROR';
        }

        this.updateProgress('Detecting LoRa module...');
        try {
          const loraDetectResponse = await this.sendATCommand('AT+LORADETECT?', '+LORADETECT:');
          const detectValue = loraDetectResponse.replace('+LORADETECT:', '').trim();
          resultsACB.loraDetect = detectValue === '1' ? 'Detected' : 'Not Detected';
        } catch (error) {
          resultsACB.loraDetect = 'ERROR';
        }

        this.updateProgress('Testing LoRa transmission...');
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.parser.removeAllListeners('data');
              reject(new Error('Timeout waiting for LoRa push response'));
            }, this.commandTimeout);

            const onData = (data) => {
              const line = data.toString().trim();
              console.log(`[Factory Testing] RX: ${line}`);
              if (line === 'OK') {
                clearTimeout(timeout);
                this.parser.removeListener('data', onData);
                resolve('OK');
              } else if (line === 'ERROR') {
                clearTimeout(timeout);
                this.parser.removeListener('data', onData);
                reject(new Error('LoRa push failed'));
              }
            };

            this.parser.on('data', onData);
            const command = 'AT+LORARAWPUSH\r\n';
            console.log(`[Factory Testing] TX: AT+LORARAWPUSH`);
            this.port.write(command, (err) => {
              if (err) {
                clearTimeout(timeout);
                this.parser.removeListener('data', onData);
                reject(new Error(`Failed to send command: ${err.message}`));
              }
            });
          });
          resultsACB.loraRawPush = 'OK';
        } catch (error) {
          resultsACB.loraRawPush = 'ERROR';
        }

        this.updateProgress('ACB-M tests completed');
        return { success: true, data: resultsACB };
      }

      // Default: run Micro Edge / general tests (existing flow)
      console.log('[Factory Testing] Running Micro Edge / default tests');
      const results = {};

      // 1. Battery voltage
      this.updateProgress('Testing battery voltage...');
      try {
        const vbatResponse = await this.sendATCommand('AT+VALUE_VBAT?', '+VALUE_VBAT:');
        results.batteryVoltage = vbatResponse.replace('+VALUE_VBAT:', '').trim() + ' V';
      } catch (error) {
        results.batteryVoltage = 'ERROR';
      }

      // 2. Pulses Counter
      this.updateProgress('Testing pulses counter...');
      try {
        const pulseResponse = await this.sendATCommand('AT+VALUE_PULSE?', '+VALUE_PULSE:');
        results.pulsesCounter = pulseResponse.replace('+VALUE_PULSE:', '').trim();
      } catch (error) {
        results.pulsesCounter = 'ERROR';
      }

      // 3. DIP Switches
      this.updateProgress('Reading DIP switches...');
      try {
        const dipResponse = await this.sendATCommand('AT+VALUE_DIPSWITCHES?', '+VALUE_DIPSWITCHES:');
        results.dipSwitches = dipResponse.replace('+VALUE_DIPSWITCHES:', '').trim();
      } catch (error) {
        results.dipSwitches = 'ERROR';
      }

      // 4. AIN 1 Voltage
      this.updateProgress('Testing AIN 1 voltage...');
      try {
        const ain1Response = await this.sendATCommand('AT+VALUE_UI1_RAW?', '+VALUE_UI1_RAW:');
        results.ain1Voltage = ain1Response.replace('+VALUE_UI1_RAW:', '').trim() + ' V';
      } catch (error) {
        results.ain1Voltage = 'ERROR';
      }

      // 5. AIN 2 Voltage
      this.updateProgress('Testing AIN 2 voltage...');
      try {
        const ain2Response = await this.sendATCommand('AT+VALUE_UI2_RAW?', '+VALUE_UI2_RAW:');
        results.ain2Voltage = ain2Response.replace('+VALUE_UI2_RAW:', '').trim() + ' V';
      } catch (error) {
        results.ain2Voltage = 'ERROR';
      }

      // 6. AIN 3 Voltage
      this.updateProgress('Testing AIN 3 voltage...');
      try {
        const ain3Response = await this.sendATCommand('AT+VALUE_UI3_RAW?', '+VALUE_UI3_RAW:');
        results.ain3Voltage = ain3Response.replace('+VALUE_UI3_RAW:', '').trim() + ' V';
      } catch (error) {
        results.ain3Voltage = 'ERROR';
      }

      // 7. LoRa Unique Address
      this.updateProgress('Reading LoRa address...');
      try {
        const loraAddrResponse = await this.sendATCommand('AT+LRRADDRUNQ?', '+LRRADDRUNQ:');
        results.loraAddress = loraAddrResponse.replace('+LRRADDRUNQ:', '').trim();
      } catch (error) {
        results.loraAddress = 'ERROR';
      }

      // 8. LoRa Detect
      this.updateProgress('Detecting LoRa module...');
      try {
        const loraDetectResponse = await this.sendATCommand('AT+LORADETECT?', '+LORADETECT:');
        const detectValue = loraDetectResponse.replace('+LORADETECT:', '').trim();
        results.loraDetect = detectValue === '1' ? 'Detected' : 'Not Detected';
      } catch (error) {
        results.loraDetect = 'ERROR';
      }

      // 9. Push LoRaRaw packet
      this.updateProgress('Testing LoRa transmission...');
      try {
        // This command expects OK response instead of a value
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.parser.removeAllListeners('data');
            reject(new Error('Timeout waiting for LoRa push response'));
          }, this.commandTimeout);

          const onData = (data) => {
            const line = data.toString().trim();
            console.log(`[Factory Testing] RX: ${line}`);
            
            if (line === 'OK') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              resolve('OK');
            } else if (line === 'ERROR') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error('LoRa push failed'));
            }
          };

          this.parser.on('data', onData);

          const command = 'AT+LORARAWPUSH\r\n';
          console.log(`[Factory Testing] TX: AT+LORARAWPUSH`);
          this.port.write(command, (err) => {
            if (err) {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error(`Failed to send command: ${err.message}`));
            }
          });
        });
        results.loraRawPush = 'OK';
      } catch (error) {
        results.loraRawPush = 'ERROR';
      }

      this.updateProgress('All tests completed!');
      console.log('[Factory Testing] Factory tests completed:', results);
      return { success: true, data: results };
    } catch (error) {
      console.error('[Factory Testing] Error running factory tests:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save test results to CSV file in folder named by uniqueID
   */
  async saveResults(version, device, deviceInfo, testResults, preTesting) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dateTimeReadable = new Date().toLocaleString();
      const uniqueId = deviceInfo.uniqueId || 'UNKNOWN';
      
      // Create hierarchical folder structure: 
      // factory-tests / Gen1 or Gen2 / Device Type / UniqueID /
      const userDataPath = require('electron').app.getPath('userData');
      const genFolder = version === 'v1' ? 'Gen1' : 'Gen2';
      
      const factoryTestsRoot = path.join(userDataPath, 'factory-tests');
      const genPath = path.join(factoryTestsRoot, genFolder);
      const deviceTypePath = path.join(genPath, device.replace(/\s+/g, '-')); // Replace spaces with dashes
      const deviceFolder = path.join(deviceTypePath, uniqueId);
      
      // Create all directories if they don't exist
      if (!fs.existsSync(deviceFolder)) {
        fs.mkdirSync(deviceFolder, { recursive: true });
      }

      // Master CSV file path for this device type (e.g., Gen1/Micro-Edge/master.csv)
      const masterCsvPath = path.join(deviceTypePath, 'factory-tests-master.csv');
      
      // Append to master CSV file for this device type
      await this.appendToMasterCSV(masterCsvPath, {
        timestamp: dateTimeReadable,
        version,
        device,
        deviceInfo,
        testResults,
        preTesting
      });

      // CSV filename with timestamp
      const csvFilename = `${uniqueId}_${timestamp}.csv`;
      const csvPath = path.join(deviceFolder, csvFilename);
      
      // Log filename with timestamp
      const logFilename = `${uniqueId}_${timestamp}.txt`;
      const logPath = path.join(deviceFolder, logFilename);

      // Generate CSV content
      let csvContent = '';
      
      // CSV Header
      csvContent += 'Category,Parameter,Value\n';
      
      // Pre-Testing Information
      if (preTesting) {
        csvContent += `Pre-Testing,Date,${new Date().toLocaleString()}\n`;
        csvContent += `Pre-Testing,Tester Name,${preTesting.testerName || 'N/A'}\n`;
        csvContent += `Pre-Testing,Hardware Version,${preTesting.hardwareVersion || 'N/A'}\n`;
        csvContent += `Pre-Testing,Batch ID,${preTesting.batchId || 'N/A'}\n`;
        csvContent += `Pre-Testing,Work Order Serial,${preTesting.workOrderSerial || 'N/A'}\n`;
      }
      
      // Device Information
      csvContent += `Device Info,Version,${version}\n`;
      csvContent += `Device Info,Device Type,${device}\n`;
      csvContent += `Device Info,Firmware Version,${deviceInfo.firmwareVersion}\n`;
      csvContent += `Device Info,HW Version,${deviceInfo.hwVersion}\n`;
      csvContent += `Device Info,Unique ID,${deviceInfo.uniqueId}\n`;
      csvContent += `Device Info,Device Make,${deviceInfo.deviceMake}\n`;
      csvContent += `Device Info,Device Model,${deviceInfo.deviceModel}\n`;
      
      // Test Results - different for each device type
      if (device === 'Micro Edge') {
        csvContent += `Test Results,Battery Voltage,${testResults.batteryVoltage}\n`;
        csvContent += `Test Results,Pulses Counter,${testResults.pulsesCounter}\n`;
        csvContent += `Test Results,DIP Switches,${testResults.dipSwitches}\n`;
        csvContent += `Test Results,AIN 1 Voltage,${testResults.ain1Voltage}\n`;
        csvContent += `Test Results,AIN 2 Voltage,${testResults.ain2Voltage}\n`;
        csvContent += `Test Results,AIN 3 Voltage,${testResults.ain3Voltage}\n`;
        csvContent += `Test Results,LoRa Address,${testResults.loraAddress}\n`;
        csvContent += `Test Results,LoRa Detect,${testResults.loraDetect}\n`;
        csvContent += `Test Results,LoRa Raw Push,${testResults.loraRawPush}\n`;
      } else if (device === 'Droplet') {
        // Droplet environmental sensor tests
        csvContent += `Test Results,Temperature,${testResults.temperature || 'N/A'}\n`;
        csvContent += `Test Results,Humidity,${testResults.humidity || 'N/A'}\n`;
        csvContent += `Test Results,Pressure,${testResults.pressure || 'N/A'}\n`;
        csvContent += `Test Results,CO2,${testResults.co2 || 'N/A'}\n`;
        csvContent += `Test Results,LoRa Address,${testResults.loraAddress}\n`;
        csvContent += `Test Results,LoRa Detect,${testResults.loraDetect}\n`;
        csvContent += `Test Results,LoRa Raw Push,${testResults.loraRawPush}\n`;
      }

      // ACB-M CSV entries
      if (device === 'ACB-M') {
        csvContent += `Test Results,VCC Voltage,${testResults.vccVoltage || 'N/A'}\n`;
        csvContent += `Test Results,Relay 1,${testResults.relay1Status || 'N/A'}\n`;
        csvContent += `Test Results,Relay 2,${testResults.relay2Status || 'N/A'}\n`;
        csvContent += `Test Results,Digital Inputs,${testResults.digitalInputs || 'N/A'}\n`;
        csvContent += `Test Results,AIN 1 Voltage,${testResults.ain1Voltage || 'N/A'}\n`;
        csvContent += `Test Results,AIN 2 Voltage,${testResults.ain2Voltage || 'N/A'}\n`;
        csvContent += `Test Results,LoRa Address,${testResults.loraAddress || 'N/A'}\n`;
        csvContent += `Test Results,LoRa Detect,${testResults.loraDetect || 'N/A'}\n`;
        csvContent += `Test Results,LoRa Raw Push,${testResults.loraRawPush || 'N/A'}\n`;
      }

      // Write CSV file
      fs.writeFileSync(csvPath, csvContent, 'utf8');

      // Generate detailed log file
      let logContent = '';
      logContent += '='.repeat(80) + '\n';
      logContent += 'NUBE IO FACTORY TEST RESULTS\n';
      logContent += '='.repeat(80) + '\n';
      logContent += `Date: ${new Date().toLocaleString()}\n`;
      logContent += `Version: ${version}\n`;
      logContent += `Device: ${device}\n`;
      logContent += `Unique ID: ${uniqueId}\n`;
      logContent += '='.repeat(80) + '\n\n';

      // Pre-Testing Information
      if (preTesting) {
        logContent += 'PRE-TESTING INFORMATION\n';
        logContent += '-'.repeat(80) + '\n';
        logContent += `Tester Name:       ${preTesting.testerName || 'N/A'}\n`;
        logContent += `Hardware Version:  ${preTesting.hardwareVersion || 'N/A'}\n`;
        logContent += `Batch ID:          ${preTesting.batchId || 'N/A'}\n`;
        logContent += `Work Order Serial: ${preTesting.workOrderSerial || 'N/A'}\n`;
        logContent += '\n';
      }

      logContent += 'DEVICE INFORMATION\n';
      logContent += '-'.repeat(80) + '\n';
      logContent += `Firmware Version:  ${deviceInfo.firmwareVersion}\n`;
      logContent += `HW Version:        ${deviceInfo.hwVersion}\n`;
      logContent += `Unique ID:         ${deviceInfo.uniqueId}\n`;
      logContent += `Device Make:       ${deviceInfo.deviceMake}\n`;
      logContent += `Device Model:      ${deviceInfo.deviceModel}\n`;
      logContent += '\n';

      logContent += 'FACTORY TEST RESULTS\n';
      logContent += '-'.repeat(80) + '\n';
      
      if (device === 'Micro Edge') {
        logContent += `Battery Voltage:   ${testResults.batteryVoltage}\n`;
        logContent += `Pulses Counter:    ${testResults.pulsesCounter}\n`;
        logContent += `DIP Switches:      ${testResults.dipSwitches}\n`;
        logContent += `AIN 1 Voltage:     ${testResults.ain1Voltage}\n`;
        logContent += `AIN 2 Voltage:     ${testResults.ain2Voltage}\n`;
        logContent += `AIN 3 Voltage:     ${testResults.ain3Voltage}\n`;
        logContent += `LoRa Address:      ${testResults.loraAddress}\n`;
        logContent += `LoRa Detect:       ${testResults.loraDetect}\n`;
        logContent += `LoRa Raw Push:     ${testResults.loraRawPush}\n`;
      } else if (device === 'Droplet') {
        logContent += `Temperature:       ${testResults.temperature || 'N/A'}\n`;
        logContent += `Humidity:          ${testResults.humidity || 'N/A'}\n`;
        logContent += `Pressure:          ${testResults.pressure || 'N/A'}\n`;
        logContent += `CO2:               ${testResults.co2 || 'N/A'}\n`;
        logContent += `LoRa Address:      ${testResults.loraAddress}\n`;
        logContent += `LoRa Detect:       ${testResults.loraDetect}\n`;
        logContent += `LoRa Raw Push:     ${testResults.loraRawPush}\n`;
      }
      // ACB-M log entries
      if (device === 'ACB-M') {
        logContent += `VCC Voltage:       ${testResults.vccVoltage || 'N/A'}\n`;
        logContent += `Relay 1:           ${testResults.relay1Status || 'N/A'}\n`;
        logContent += `Relay 2:           ${testResults.relay2Status || 'N/A'}\n`;
        logContent += `Digital Inputs:    ${testResults.digitalInputs || 'N/A'}\n`;
        logContent += `AIN 1 Voltage:     ${testResults.ain1Voltage || 'N/A'}\n`;
        logContent += `AIN 2 Voltage:     ${testResults.ain2Voltage || 'N/A'}\n`;
        logContent += `LoRa Address:      ${testResults.loraAddress || 'N/A'}\n`;
        logContent += `LoRa Detect:       ${testResults.loraDetect || 'N/A'}\n`;
        logContent += `LoRa Raw Push:     ${testResults.loraRawPush || 'N/A'}\n`;
      }
      
      logContent += '\n';
      logContent += '='.repeat(80) + '\n';
      logContent += 'END OF REPORT\n';
      logContent += '='.repeat(80) + '\n';

      // Write log file
      fs.writeFileSync(logPath, logContent, 'utf8');

      console.log(`[Factory Testing] Results saved to folder: ${deviceFolder}`);
      console.log(`[Factory Testing] CSV file: ${csvPath}`);
      console.log(`[Factory Testing] Log file: ${logPath}`);
      console.log(`[Factory Testing] Master CSV file: ${masterCsvPath}`);
      
      return { 
        success: true, 
        folder: deviceFolder,
        csvPath: csvPath,
        logPath: logPath,
        masterCsvPath: masterCsvPath
      };
    } catch (error) {
      console.error('[Factory Testing] Error saving results:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Append test results to master CSV file (all devices)
   */
  async appendToMasterCSV(masterCsvPath, data) {
    try {
      const { timestamp, version, device, deviceInfo, testResults, preTesting } = data;
      
      // Check if file exists, if not create with header
      let fileExists = fs.existsSync(masterCsvPath);
      
      let csvLine = '';
      
      if (!fileExists) {
        // Create header depending on device type
        let header = 'Test Date,Tester Name,Hardware Version,Batch ID,Work Order Serial,' +
                     'Version,Device Type,Firmware Version,HW Version,Unique ID,Device Make,Device Model,';
        if (device === 'ACB-M') {
          header += 'VCC Voltage,Relay 1,Relay 2,Digital Inputs,AIN 1 Voltage,AIN 2 Voltage,LoRa Address,LoRa Detect,LoRa Raw Push,Test Result\n';
        } else if (device === 'Droplet') {
          header += 'Temperature,Humidity,Pressure,CO2,AIN 1 Voltage,AIN 2 Voltage,AIN 3 Voltage,LoRa Address,LoRa Detect,LoRa Raw Push,Test Result\n';
        } else {
          header += 'Battery Voltage,Pulses Counter,DIP Switches,AIN 1 Voltage,AIN 2 Voltage,AIN 3 Voltage,LoRa Address,LoRa Detect,LoRa Raw Push,Test Result\n';
        }
        csvLine = header;
      }
      
      // Determine overall test result
      let testResult = 'PASS';
      if (device === 'Micro Edge') {
        const criticalTests = [
          testResults.batteryVoltage,
          testResults.loraAddress,
          testResults.loraDetect,
          testResults.loraRawPush
        ];
        if (criticalTests.some(test => test === 'ERROR' || test === 'Not Detected')) {
          testResult = 'FAIL';
        }
      }
      
      // Build data row
      const escapeCSV = (str) => {
        if (!str) return '';
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      if (device === 'Micro Edge') {
        csvLine += `${escapeCSV(timestamp)},` +
                  `${escapeCSV(preTesting?.testerName || 'N/A')},` +
                  `${escapeCSV(preTesting?.hardwareVersion || 'N/A')},` +
                  `${escapeCSV(preTesting?.batchId || 'N/A')},` +
                  `${escapeCSV(preTesting?.workOrderSerial || 'N/A')},` +
                  `${escapeCSV(version)},` +
                  `${escapeCSV(device)},` +
                  `${escapeCSV(deviceInfo.firmwareVersion)},` +
                  `${escapeCSV(deviceInfo.hwVersion)},` +
                  `${escapeCSV(deviceInfo.uniqueId)},` +
                  `${escapeCSV(deviceInfo.deviceMake)},` +
                  `${escapeCSV(deviceInfo.deviceModel)},` +
                  `${escapeCSV(testResults.batteryVoltage)},` +
                  `${escapeCSV(testResults.pulsesCounter)},` +
                  `${escapeCSV(testResults.dipSwitches)},` +
                  `${escapeCSV(testResults.ain1Voltage)},` +
                  `${escapeCSV(testResults.ain2Voltage)},` +
                  `${escapeCSV(testResults.ain3Voltage)},` +
                  `${escapeCSV(testResults.loraAddress)},` +
                  `${escapeCSV(testResults.loraDetect)},` +
                  `${escapeCSV(testResults.loraRawPush)},` +
                  `${escapeCSV(testResult)}\n`;
      } else if (device === 'Droplet') {
        // For Droplet, use similar structure but with different test fields
        csvLine += `${escapeCSV(timestamp)},` +
                  `${escapeCSV(preTesting?.testerName || 'N/A')},` +
                  `${escapeCSV(preTesting?.hardwareVersion || 'N/A')},` +
                  `${escapeCSV(preTesting?.batchId || 'N/A')},` +
                  `${escapeCSV(preTesting?.workOrderSerial || 'N/A')},` +
                  `${escapeCSV(version)},` +
                  `${escapeCSV(device)},` +
                  `${escapeCSV(deviceInfo.firmwareVersion)},` +
                  `${escapeCSV(deviceInfo.hwVersion)},` +
                  `${escapeCSV(deviceInfo.uniqueId)},` +
                  `${escapeCSV(deviceInfo.deviceMake)},` +
                  `${escapeCSV(deviceInfo.deviceModel)},` +
                  `${escapeCSV(testResults.temperature || 'N/A')},` +
                  `${escapeCSV(testResults.humidity || 'N/A')},` +
                  `${escapeCSV(testResults.pressure || 'N/A')},` +
                  `${escapeCSV(testResults.co2 || 'N/A')},` +
                  `N/A,N/A,` + // Placeholder for AIN voltages
                  `${escapeCSV(testResults.loraAddress)},` +
                  `${escapeCSV(testResults.loraDetect)},` +
                  `${escapeCSV(testResults.loraRawPush)},` +
                  `${escapeCSV(testResult)}\n`;
      }
      else if (device === 'ACB-M') {
        csvLine += `${escapeCSV(timestamp)},` +
                  `${escapeCSV(preTesting?.testerName || 'N/A')},` +
                  `${escapeCSV(preTesting?.hardwareVersion || 'N/A')},` +
                  `${escapeCSV(preTesting?.batchId || 'N/A')},` +
                  `${escapeCSV(preTesting?.workOrderSerial || 'N/A')},` +
                  `${escapeCSV(version)},` +
                  `${escapeCSV(device)},` +
                  `${escapeCSV(deviceInfo.firmwareVersion)},` +
                  `${escapeCSV(deviceInfo.hwVersion)},` +
                  `${escapeCSV(deviceInfo.uniqueId)},` +
                  `${escapeCSV(deviceInfo.deviceMake)},` +
                  `${escapeCSV(deviceInfo.deviceModel)},` +
                  `${escapeCSV(testResults.vccVoltage || 'N/A')},` +
                  `${escapeCSV(testResults.relay1Status || 'N/A')},` +
                  `${escapeCSV(testResults.relay2Status || 'N/A')},` +
                  `${escapeCSV(testResults.digitalInputs || 'N/A')},` +
                  `${escapeCSV(testResults.ain1Voltage || 'N/A')},` +
                  `${escapeCSV(testResults.ain2Voltage || 'N/A')},` +
                  `${escapeCSV(testResults.loraAddress)},` +
                  `${escapeCSV(testResults.loraDetect)},` +
                  `${escapeCSV(testResults.loraRawPush)},` +
                  `${escapeCSV(testResult)}\n`;
      }
      
      // Append to file
      fs.appendFileSync(masterCsvPath, csvLine, 'utf8');
      
      console.log(`[Factory Testing] Appended to master CSV: ${masterCsvPath}`);
      return true;
    } catch (error) {
      console.error('[Factory Testing] Error appending to master CSV:', error);
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
   * Update progress
   */
  updateProgress(message) {
    console.log(`[Factory Testing] ${message}`);
    if (this.progressCallback) {
      this.progressCallback(message);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isConnected = false;
    this.port = null;
    this.parser = null;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      port: this.portPath,
      baudRate: this.baudRate
    };
  }

  // --- ACB-M specific test methods ---
  async acbWifiTest() {
    try {
      this.updateProgress('ACB-M: Running WiFi test...');
      // Placeholder: check WiFi firmware/status
      try {
        const r = await this.sendATCommand('AT+WIFISTATUS?', '+WIFISTATUS:');
        return { success: true, data: r.replace('+WIFISTATUS:', '').trim() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbRs485Test() {
    try {
      this.updateProgress('ACB-M: Running RS485 test...');
      try {
        const r = await this.sendATCommand('AT+RS485TEST?', '+RS485TEST:');
        return { success: true, data: r.replace('+RS485TEST:', '').trim() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbRs485_2Test() {
    try {
      this.updateProgress('ACB-M: Running RS485-2 test...');
      try {
        const r = await this.sendATCommand('AT+RS485TEST2?', '+RS485TEST2:');
        return { success: true, data: r.replace('+RS485TEST2:', '').trim() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbEthTest() {
    try {
      this.updateProgress('ACB-M: Running ETH test...');
      try {
        const r = await this.sendATCommand('AT+ETHTEST?', '+ETHTEST:');
        return { success: true, data: r.replace('+ETHTEST:', '').trim() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbLoraTest() {
    try {
      this.updateProgress('ACB-M: Running LoRa test...');
      // Reuse existing lora checks
      try {
        const addr = await this.sendATCommand('AT+LRRADDRUNQ?', '+LRRADDRUNQ:');
        const detect = await this.sendATCommand('AT+LORADETECT?', '+LORADETECT:');
        // Attempt LoRa push
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.parser.removeAllListeners('data');
            reject(new Error('Timeout waiting for LoRa push response'));
          }, this.commandTimeout);

          const onData = (data) => {
            const line = data.toString().trim();
            if (line === 'OK') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              resolve('OK');
            } else if (line === 'ERROR') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error('LoRa push failed'));
            }
          };

          this.parser.on('data', onData);
          const command = 'AT+LORARAWPUSH\r\n';
          this.port.write(command, (err) => {
            if (err) {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error(`Failed to send command: ${err.message}`));
            }
          });
        });

        return { success: true, data: { address: addr.replace('+LRRADDRUNQ:', '').trim(), detect: detect.replace('+LORADETECT:', '').trim(), push: 'OK' } };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbRtcTest() {
    try {
      this.updateProgress('ACB-M: Running RTC test...');
      try {
        const r = await this.sendATCommand('AT+RTCTIME?', '+RTCTIME:');
        return { success: true, data: r.replace('+RTCTIME:', '').trim() };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbFullTest() {
    try {
      this.updateProgress('ACB-M: Running FULL test...');
      const results = {};
      // Run sequence of subtests
      try {
        const vcc = await this.sendATCommand('AT+VCCV?', '+VCCV:');
        results.vccVoltage = vcc.replace('+VCCV:', '').trim() + ' V';
      } catch (e) { results.vccVoltage = 'ERROR'; }

      try {
        const r1 = await this.sendATCommand('AT+RELAY1?', '+RELAY1:');
        results.relay1Status = r1.replace('+RELAY1:', '').trim();
      } catch (e) { results.relay1Status = 'ERROR'; }
      try {
        const r2 = await this.sendATCommand('AT+RELAY2?', '+RELAY2:');
        results.relay2Status = r2.replace('+RELAY2:', '').trim();
      } catch (e) { results.relay2Status = 'ERROR'; }

      try {
        const di = await this.sendATCommand('AT+DIGITALS?', '+DIGITALS:');
        results.digitalInputs = di.replace('+DIGITALS:', '').trim();
      } catch (e) { results.digitalInputs = 'ERROR'; }

      try {
        const a1 = await this.sendATCommand('AT+VALUE_UI1_RAW?', '+VALUE_UI1_RAW:');
        results.ain1Voltage = a1.replace('+VALUE_UI1_RAW:', '').trim() + ' V';
      } catch (e) { results.ain1Voltage = 'ERROR'; }

      try {
        const a2 = await this.sendATCommand('AT+VALUE_UI2_RAW?', '+VALUE_UI2_RAW:');
        results.ain2Voltage = a2.replace('+VALUE_UI2_RAW:', '').trim() + ' V';
      } catch (e) { results.ain2Voltage = 'ERROR'; }

      // LoRa
      try {
        const addr = await this.sendATCommand('AT+LRRADDRUNQ?', '+LRRADDRUNQ:');
        results.loraAddress = addr.replace('+LRRADDRUNQ:', '').trim();
      } catch (e) { results.loraAddress = 'ERROR'; }
      try {
        const detect = await this.sendATCommand('AT+LORADETECT?', '+LORADETECT:');
        results.loraDetect = detect.replace('+LORADETECT:', '').trim() === '1' ? 'Detected' : 'Not Detected';
      } catch (e) { results.loraDetect = 'ERROR'; }

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.parser.removeAllListeners('data');
            reject(new Error('Timeout waiting for LoRa push response'));
          }, this.commandTimeout);

          const onData = (data) => {
            const line = data.toString().trim();
            if (line === 'OK') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              resolve('OK');
            } else if (line === 'ERROR') {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error('LoRa push failed'));
            }
          };

          this.parser.on('data', onData);
          const command = 'AT+LORARAWPUSH\r\n';
          this.port.write(command, (err) => {
            if (err) {
              clearTimeout(timeout);
              this.parser.removeListener('data', onData);
              reject(new Error(`Failed to send command: ${err.message}`));
            }
          });
        });
        results.loraRawPush = 'OK';
      } catch (e) { results.loraRawPush = 'ERROR'; }

      this.updateProgress('ACB-M FULL test completed');
      return { success: true, data: results };
    } catch (error) {
      console.error('[Factory Testing] ACB-M full test error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = FactoryTestingService;
