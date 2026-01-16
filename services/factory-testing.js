/**
 * Factory Testing Service
 * Handles AT command communication for factory testing NubeIO devices
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class FactoryTestingService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.isConnecting = false; // Flag to prevent concurrent connections
    this.portPath = '';
    this.baudRate = 115200;
    this.commandTimeout = 5000; // 5 seconds timeout for AT commands
    this.progressCallback = null;
    // Gate for auto connecting to next device; controlled by renderer
    this.autoNextEnabled = false;
    // Abort control for immediate cancellation/force disconnect
    this._abortRequested = false;
    this._currentAbort = null;
  }

  /**
   * Send a test_* command and wait for a JSON response indicating result.
   * Resolves object { raw, parsed, success } or rejects on timeout/error.
   */
  async awaitTestJSONResult(command, timeoutMs = 10000) {
    if (!this.isConnected || !this.port) throw new Error('Not connected');
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        this.parser.removeListener('data', onData);
        reject(new Error('Timeout waiting for JSON response'));
      }, timeoutMs);

      const onData = (data) => {
        const line = data.toString().trim();
        if (!line) return;
        console.log(`[Factory Testing] awaitTestJSONResult RX: ${line}`);
        // Try parse JSON
        try {
          const parsed = JSON.parse(line);
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          const ok = parsed && (parsed.result === 'done' || parsed.status === 'done' || parsed.result === 'OK' || parsed.status === 'OK' || parsed.ok === true);
          resolve({ raw: line, parsed, success: !!ok });
          return;
        } catch (e) {
          // Not JSON: treat explicit error markers as failure, OK/done as success
          const lLower = line.toLowerCase();
          if (line === 'OK' || lLower === 'done') {
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve({ raw: line, parsed: null, success: true });
            return;
          }

          if (lLower.includes('unknown command') || line.toUpperCase().startsWith('ERROR') || lLower.includes('fail') || lLower.includes('failed')) {
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve({ raw: line, parsed: null, success: false });
            return;
          }

          // otherwise keep listening until timeout or JSON arrives
        }
      };

      this.parser.on('data', onData);

      // send command
      const commandStr = command + '\r\n';
      console.log(`[Factory Testing] awaitTestJSONResult TX: ${command}`);
      this.port.write(commandStr, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  // Normalizers for test results to provide consistent fields for the UI
  _normalizeWifiResult(respObj) {
    const out = {
      success: !!(respObj && respObj.success),
      status: respObj && respObj.success ? 'done' : 'fail',
      rssi: null,
      networks: [],
      raw: respObj ? respObj.raw : null,
      parsed: respObj ? respObj.parsed : null
    };
    const p = respObj && respObj.parsed;
    if (p) {
      // common fields
      if (typeof p.rssi !== 'undefined') out.rssi = p.rssi;
      if (typeof p.rssi_dbm !== 'undefined') out.rssi = out.rssi === null ? p.rssi_dbm : out.rssi;
      // networks may be reported as array or single ssid
      if (Array.isArray(p.networks)) out.networks = p.networks;
      else if (p.ssid) out.networks = [p.ssid];
      else if (p.found) out.networks = Array.isArray(p.found) ? p.found : [p.found];
    }
    return out;
  }

  _normalizeI2cResult(respObj) {
    const out = {
      success: !!(respObj && respObj.success),
      status: respObj && respObj.success ? 'done' : 'fail',
      sensor_addr: null,
      sensor: null,
      temperature_c: null,
      humidity_rh: null,
      raw: respObj ? respObj.raw : null,
      parsed: respObj ? respObj.parsed : null
    };
    const p = respObj && respObj.parsed;
    if (p) {
      if (p.sensor_addr) out.sensor_addr = p.sensor_addr;
      if (p.sensor) out.sensor = p.sensor;
      if (typeof p.temperature_c !== 'undefined') out.temperature_c = p.temperature_c;
      if (typeof p.temperature !== 'undefined' && out.temperature_c === null) out.temperature_c = p.temperature;
      if (typeof p.humidity_rh !== 'undefined') out.humidity_rh = p.humidity_rh;
      if (typeof p.humidity !== 'undefined' && out.humidity_rh === null) out.humidity_rh = p.humidity;
    }
    return out;
  }

  _normalizeRs485Result(respObj) {
    const out = {
      success: !!(respObj && respObj.success),
      status: respObj && respObj.success ? 'done' : 'fail',
      temperature: null,
      humidity: null,
      raw: respObj ? respObj.raw : null,
      parsed: respObj ? respObj.parsed : null
    };
    const p = respObj && respObj.parsed;
    if (p) {
      if (typeof p.temperature !== 'undefined') out.temperature = p.temperature;
      if (typeof p.temperature_c !== 'undefined' && out.temperature === null) out.temperature = p.temperature_c;
      if (typeof p.humidity !== 'undefined') out.humidity = p.humidity;
      if (typeof p.humidity_rh !== 'undefined' && out.humidity === null) out.humidity = p.humidity_rh;
      // determine success from rs485-specific fields
      if (typeof p.slave_ok !== 'undefined' || typeof p.master_ok !== 'undefined') {
        out.success = !!(p.slave_ok || p.master_ok);
        out.status = out.success ? 'done' : 'fail';
      }
    }
    return out;
  }

  /**
   * Connect to serial port
   */
  async connect(portPath, baudRate = 115200, useUnlock = true, deviceType = null) {
    console.log('[Factory Testing Service] === START CONNECT ===');
    console.log('[Factory Testing Service] Port path:', portPath);
    console.log('[Factory Testing Service] Baud rate:', baudRate);
    console.log('[Factory Testing Service] Device type:', deviceType);
    console.log('[Factory Testing Service] Current isConnected:', this.isConnected);
    console.log('[Factory Testing Service] Current isConnecting:', this.isConnecting);
    // Clear any previous abort state to allow fresh AT flows post-connect
    this._abortRequested = false;
    this._currentAbort = null;
    
    if (this.isConnected) {
      const error = 'Already connected to a serial port';
      console.error('[Factory Testing Service]', error);
      return { success: false, error: error };
    }
    
    if (this.isConnecting) {
      const error = 'Connection already in progress';
      console.error('[Factory Testing Service]', error);
      return { success: false, error: error };
    }
    
    this.isConnecting = true;
    console.log('[Factory Testing Service] Set isConnecting = true');

    try {
      this.portPath = portPath;
      this.baudRate = baudRate;
      this.deviceType = deviceType; // Store device type for later use

      // Do NOT use esptool for any device in factory-testing flows
      const isEsp32Device = false;
      
      // Skip any esptool usage; rely on AT commands for info
      let preDeviceInfo = null;
      console.log('[Factory Testing Service] Skipping esptool for device type:', deviceType);

      console.log(`[Factory Testing Service] Creating SerialPort instance...`);

      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        autoOpen: false
      });
      
      console.log('[Factory Testing Service] SerialPort instance created:', typeof this.port, this.port ? 'EXISTS' : 'NULL');

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
            console.log('[Factory Testing Service] Port after open:', typeof this.port, this.port ? 'EXISTS' : 'NULL');
            console.log('[Factory Testing Service] Port isOpen:', this.port && this.port.isOpen);
            this.isConnected = true;
            resolve();
          }
        });
      });

      console.log('[Factory Testing Service] Serial port connected successfully');
      
      // Optionally send AT+UNLOCK=N00BIO after connection for AT-based devices
      if (useUnlock) {
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
          // Fail connection if unlock command fails for devices that require it
          this.cleanup();
          throw new Error(`Device unlock failed: ${error.message}`);
        }
      } else {
        console.log('[Factory Testing Service] Skipping AT+UNLOCK for non-AT device');
      }
      
      // Read device info (Unique ID / MAC) right after unlock
      let deviceInfo = null;
      try {
        // For ZC-LCD: Read device info via AT commands
        if (deviceType === 'ZC-LCD') {
          // ZC-LCD: Read device info via dedicated method
          console.log('[Factory Testing Service] Reading ZC-LCD device info...');
          // Small delay to ensure device is ready before sending AT commands
          await new Promise(resolve => setTimeout(resolve, 200));
          const zcDeviceInfo = await this.readZCLCDDeviceInfo();
          if (zcDeviceInfo.success) {
            deviceInfo = zcDeviceInfo.data;
            console.log('[Factory Testing Service] ZC-LCD device info:', deviceInfo);
          }
        } else if (deviceType === 'ZC-Controller') {
          // ZC-Controller: Read info via RS485 hex frames (no AT, no esptool)
          console.log('[Factory Testing Service] Reading ZC-Controller device info via RS485 hex...');
          const zcCtrlInfo = await this.readZCControllerInfo();
          if (zcCtrlInfo && zcCtrlInfo.success) {
            deviceInfo = zcCtrlInfo.data;
            console.log('[Factory Testing Service] ZC-Controller device info:', deviceInfo);
          }
        } else if (deviceType === 'Droplet') {
          // Droplet: Read device info via dedicated method
          console.log('[Factory Testing Service] Reading Droplet device info...');
          const dropletDeviceInfo = await this.readDropletDeviceInfo();
          if (dropletDeviceInfo.success) {
            deviceInfo = dropletDeviceInfo.data;
            // Normalize FW field for UI consistency
            if (deviceInfo && (deviceInfo.fwVersion || deviceInfo.firmwareVersion)) {
              deviceInfo.firmwareVersion = deviceInfo.fwVersion || deviceInfo.firmwareVersion;
            }
            console.log('[Factory Testing Service] Droplet device info:', deviceInfo);
          }
        } else if (useUnlock) {
          // Micro Edge / AT-based devices: do NOT attempt esptool (it will conflict with the open port).
          // Simply read device info via AT commands.
          try {
            const infoRes = await this.readDeviceInfo(this.deviceType);
            if (infoRes.success) deviceInfo = infoRes.data;
          } catch (err) {
            console.warn('[Factory Testing Service] readDeviceInfo failed for AT device:', err.message);
          }
        } else {
          // Non-ESP32 devices (like ACB-M STM32): Skip esptool, but read device info via AT commands
          console.log('[Factory Testing Service] Non-ESP32 device detected, reading device info via AT commands');
          try {
            const infoRes = await this.readDeviceInfo(this.deviceType);
            if (infoRes.success) {
              deviceInfo = infoRes.data;
              console.log('[Factory Testing Service] ACB-M device info:', deviceInfo);
            }
          } catch (err) {
            console.warn('[Factory Testing Service] Failed to read ACB-M device info:', err.message);
          }
        }
      } catch (e) {
        console.warn('[Factory Testing Service] Failed to read device info after connect:', e.message);
      }

      console.log('[Factory Testing Service] === END CONNECT (SUCCESS) ===');
      console.log('[Factory Testing Service] Final isConnected:', this.isConnected);
      console.log('[Factory Testing Service] Final port:', this.port ? 'SET' : 'NULL');
      console.log('[Factory Testing Service] Final parser:', this.parser ? 'SET' : 'NULL');
      this.isConnecting = false;
      console.log('[Factory Testing Service] Set isConnecting = false (success)');
      return { success: true, port: portPath, baudRate: baudRate, deviceInfo };
    } catch (error) {
      console.error('[Factory Testing Service] Failed to connect:', error);
      console.error('[Factory Testing Service] Error message:', error.message);
      console.error('[Factory Testing Service] Error stack:', error.stack);
      this.cleanup();
      this.isConnecting = false; // Clear connecting flag
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
      // Disable auto-next until user explicitly enables it again
      this.autoNextEnabled = false;
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
   * Forcefully disconnect and reset serial state
   * Use when the UI shows not connected but backend still holds the port
   */
  async forceDisconnect() {
    try {
      // Request abort of any in-flight command and cancel listeners immediately
      this._abortRequested = true;
      try { if (typeof this._currentAbort === 'function') this._currentAbort(); } catch (_) {}

      // Attempt to close port even if flags are inconsistent
      if (this.port) {
        try {
          // Lower DTR/RTS to release any pending operations (best-effort)
          if (typeof this.port.set === 'function') {
            try { await new Promise(resolve => this.port.set({ dtr: false, rts: false }, () => resolve())); } catch (_) {}
          }
          // Flush any pending IO if supported
          try { if (typeof this.port.flush === 'function') await new Promise(resolve => this.port.flush(() => resolve())); } catch (_) {}
          // Try a hard destroy first if available to avoid long close waits
          try { if (typeof this.port.destroy === 'function') this.port.destroy(); } catch (_) {}
          if (this.port.isOpen) {
            // Close quickly: race close with a short timeout to avoid hanging ~30s
            const closePromise = new Promise((resolve, reject) => {
              try {
                this.port.close((err) => {
                  if (err) reject(err); else resolve();
                });
              } catch (e) { resolve(); }
            });
            const quickTimeout = new Promise(resolve => setTimeout(resolve, 800));
            await Promise.race([closePromise, quickTimeout]);
          }
        } catch (e) {
          console.warn('[Factory Testing] forceDisconnect: close error (ignored):', e && e.message);
        }
        // Remove listeners to avoid leaks
        try { this.port.removeAllListeners && this.port.removeAllListeners(); } catch (_) {}
      }
      try { this.parser && this.parser.removeAllListeners && this.parser.removeAllListeners(); } catch (_) {}
      // Reset service state
      this.isConnected = false;
      this.isConnecting = false;
      this.portPath = '';
      this.autoNextEnabled = false;
      this._currentAbort = null;
      this.cleanup();
      console.log('[Factory Testing] Force disconnect completed');
      return { success: true };
    } catch (error) {
      console.error('[Factory Testing] Force disconnect error:', error);
      this.cleanup();
      return { success: false, error: error.message };
    }
  }

  /** Enable/disable auto proceed to next device (called from renderer) */
  setAutoNextEnabled(enabled) {
    this.autoNextEnabled = !!enabled;
  }

  /** Query whether service allows auto proceed to next device */
  shouldAutoProceedNext() {
    return this.autoNextEnabled === true;
  }

  /**
   * Send AT command and wait for response
   * @param {string} command - AT command to send
   * @param {string} expectedPrefix - Expected response prefix
   * @param {number} customTimeout - Optional custom timeout in ms (default: this.commandTimeout)
   * @param {boolean} requireOK - Whether to require OK after data (default: true for ACB-M, false for Micro Edge)
   */
  async sendATCommand(command, expectedPrefix, customTimeout = null, requireOK = true) {
    console.log('[Factory Testing Service] sendATCommand called');
    console.log('[Factory Testing Service] Current isConnected:', this.isConnected);
    console.log('[Factory Testing Service] Current port:', this.port ? 'SET' : 'NULL');
    
    if (!this.isConnected || !this.port) {
      throw new Error('Not connected to a serial port');
    }

    // Small delay to ensure previous command response is fully consumed
    await new Promise(resolve => setTimeout(resolve, 100));

    // For AT+TEST commands, default timeout is 20s unless caller overrides
    const isTestCommand = typeof command === 'string' && command.toUpperCase().startsWith('AT+TEST=');
    const timeoutDuration = customTimeout || (isTestCommand ? 20000 : this.commandTimeout);
    console.log(`[Factory Testing] Command timeout: ${timeoutDuration}ms, requireOK: ${requireOK}`);
    if (this._abortRequested) {
      throw new Error('Aborted');
    }

    return new Promise((resolve, reject) => {
      const expectedPrefixes = !expectedPrefix ? null : (Array.isArray(expectedPrefix) ? expectedPrefix : [expectedPrefix]);
      const timeout = setTimeout(() => {
        this.parser.removeListener('data', onData);
        console.error(`[Factory Testing] TIMEOUT: No response for ${command} with prefix ${expectedPrefixes ? expectedPrefixes.join('|') : 'NONE'}`);
        console.error(`[Factory Testing] State: responseData=${!!responseData}, gotOK=${gotOK}`);
        
        // If we have responseData but no OK, accept it (some devices don't send OK)
        if (responseData) {
          console.log(`[Factory Testing] Accepting response without OK: ${responseData}`);
          resolve(responseData);
        } else {
          reject(new Error(`Timeout waiting for response to: ${command}`));
        }
      }, timeoutDuration);

      let responseData = '';
      let gotOK = false;
      let commandSent = false;
      let dataReceivedTimer = null;

      const onData = (data) => {
        const line = data.toString().trim();
        console.log(`[Factory Testing] RX: ${line}`);
        
        if (!line) return; // Skip empty lines
        if (this._abortRequested) {
          clearTimeout(timeout);
          try { this.parser.removeListener('data', onData); } catch (_) {}
          reject(new Error('Aborted'));
          return;
        }
        
        // Check for error response (accept immediately to avoid long timeouts in auto flows)
        if (commandSent && (line === 'ERROR' || line.startsWith('ERROR') || line.startsWith('+CME ERROR:'))) {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          // Resolve with the error line so caller can proceed to next step without waiting 30s
          resolve(line);
          return;
        }

        // For AT+TEST commands, if we get a plain OK, resolve immediately and proceed to next test
        if (isTestCommand && (line === 'OK' || line.startsWith('OK'))) {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          resolve(responseData || 'OK');
          return;
        }
        
        // Collect data line with expected prefix (allow noise before prefix)
        if (!expectedPrefixes || expectedPrefixes.some(p => line.includes(p))) {
          responseData = line;
          console.log(`[Factory Testing] Got data line: ${line}`);
          
          // Clear any existing data timer
          if (dataReceivedTimer) {
            clearTimeout(dataReceivedTimer);
          }
          
          // If requireOK is false (Micro Edge), resolve immediately with data
          if (!requireOK) {
            console.log(`[Factory Testing] Got data without requiring OK, resolving immediately`);
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve(responseData);
            return;
          }
          
          // If we already got OK, resolve now
          if (gotOK) {
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve(responseData);
          } else {
            // For devices that require OK: Set a short timer - if no OK comes within 500ms, accept the data anyway
            dataReceivedTimer = setTimeout(() => {
              if (responseData && !gotOK) {
                // Accept data if OK hasn't arrived within 500ms to keep flows responsive
                clearTimeout(timeout);
                this.parser.removeListener('data', onData);
                resolve(responseData);
              }
            }, 500);
          }
        }
        
        // Check for OK: accept immediately even if no expectedPrefix yet
        if (line === 'OK') {
          console.log(`[Factory Testing] Got OK, responseData=${!!responseData}`);
          gotOK = true;
          
          // Clear data received timer if exists
          if (dataReceivedTimer) {
            clearTimeout(dataReceivedTimer);
          }
          
          // If we already have data, resolve now
          if (responseData) {
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve(responseData);
          }
          // Otherwise keep waiting for data line (within timeout)
          else {
            // No data line expected or device only returns OK → resolve OK immediately for non-blocking behavior
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve('OK');
          }
        }
      };

      // Add our specific listener
      this.parser.on('data', onData);

      // // Send command
      // this.port.flush(() => {
      //   console.log('[Factory Testing] Port flushed, writing command...');
      // });
      
      const commandStr = command.trim() + '\r\n';
      console.log(`[Factory Testing] TX:${commandStr}`);


      this.port.write(commandStr, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          reject(new Error(`Failed to send command: ${err.message}`));
        } else {
          commandSent = true;
        }
      });
    });
  }

  /**
   * Send a plain serial command (non-AT) and wait for a response line.
   * If expectedPrefix is provided, resolves when a line startsWith that prefix.
   * Otherwise resolves on first non-empty, non-ERROR line or when 'OK' received.
   */
  async sendSerialCommand(command, expectedPrefix = null) {
    if (!this.isConnected || !this.port) {
      throw new Error('Not connected to a serial port');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.parser.removeListener('data', onData);
        reject(new Error(`Timeout waiting for response to: ${command}`));
      }, this.commandTimeout);

      let got = null;

      const onData = (data) => {
        const line = data.toString().trim();
        console.log(`[Factory Testing] RX (serial): ${line}`);

        if (!line) return;

        if (line === 'ERROR') {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          reject(new Error(`Command failed: ${command}`));
          return;
        }

        if (expectedPrefix) {
          if (line.startsWith(expectedPrefix)) {
            got = line;
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve(got);
          }
        } else {
          // accept 'OK' or first non-empty non-ERROR line
          if (line === 'OK') {
            got = 'OK';
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve(got);
          } else {
            got = line;
            clearTimeout(timeout);
            this.parser.removeListener('data', onData);
            resolve(got);
          }
        }
      };

      this.parser.on('data', onData);

      const commandStr = command + '\r\n';
      console.log(`[Factory Testing] TX (serial): ${command}`);
      this.port.write(commandStr, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.parser.removeListener('data', onData);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  async readEsp32MAC(portPath) {
    return new Promise(async (resolve) => {
      // If the serial port is currently open on this service, close it temporarily
      let reopened = false;
      let hadOpenPort = false;
      try {
        if (this.port && this.port.isOpen) {
          hadOpenPort = true;
          console.log('[Factory Testing Service] Serial port is open; closing temporarily for esptool access...');
          try {
            await new Promise((res) => {
              this.port.close(() => { res(); });
            });
            this.isConnected = false;
            console.log('[Factory Testing Service] Serial port closed for esptool');
          } catch (e) {
            console.warn('[Factory Testing Service] Failed to close serial port before esptool:', e && e.message);
          }
        }
      } catch (e) {
        console.warn('[Factory Testing Service] Error checking/closing serial port before esptool:', e && e.message);
      }
      try {
        const triedPaths = [];

        // Build candidate paths, prefer temp-extracted esptool used by ESP32 flasher
        const toolsDir = path.join(__dirname, '..', 'tools', 'esptool');
        const candidates = [];

        // Check temp extraction location used by ESP32FlasherNative: {tmpdir}/fga-simulator-esptool/esptool[.exe]
        try {
          const tmpEsptoolDir = path.join(os.tmpdir(), 'fga-simulator-esptool');
          const tmpExe = process.platform === 'win32' ? path.join(tmpEsptoolDir, 'esptool.exe') : path.join(tmpEsptoolDir, 'esptool');
          candidates.push(tmpExe);
        } catch (e) {
          // ignore
        }

        candidates.push(path.join(toolsDir, 'esptool-win64', 'esptool.exe'));
        candidates.push(path.join(toolsDir, 'esptool-win64', 'esptool'));
        candidates.push(path.join(toolsDir, 'esptool-linux-amd64', 'esptool'));
        candidates.push(path.join(toolsDir, 'esptool.py'));

        // Also scan subfolders for any esptool executable
        try {
          if (fs.existsSync(toolsDir)) {
            const entries = fs.readdirSync(toolsDir);
            entries.forEach(e => {
              const full = path.join(toolsDir, e);
              if (e.toLowerCase().includes('esptool')) {
                candidates.push(path.join(full, 'esptool.exe'));
                candidates.push(path.join(full, 'esptool'));
                candidates.push(full);
              }
            });
          }
        } catch (e) {
          console.warn('[Factory Testing Service] Failed scanning tools/esptool directory:', e.message);
        }

        // Helper to attempt spawning and parse output; resolves mac string or null
        const attemptSpawn = (exe, args) => {
          return new Promise((res) => {
            triedPaths.push({ exe, args });
            let stdout = '';
            let stderr = '';
            let finished = false;

            let proc = null;
            try {
              proc = spawn(exe, args, { windowsHide: true });
            } catch (err) {
              console.error('[Factory Testing Service] spawn threw error for', exe, err && err.message);
              return res(null);
            }

            proc.on('error', (err) => {
              console.error('[Factory Testing Service] esptool spawn error:', exe, err && err.code, err && err.message);
              // command not found or other spawn error
              return res(null);
            });

            proc.stdout.on('data', (data) => {
              const s = data.toString();
              stdout += s;
              s.split(/\r?\n/).forEach(line => { if (line.trim()) console.log('[esptool stdout]', line); });
            });
            proc.stderr.on('data', (data) => {
              const s = data.toString();
              stderr += s;
              s.split(/\r?\n/).forEach(line => { if (line.trim()) console.error('[esptool stderr]', line); });
            });

            proc.on('close', (code) => {
              if (finished) return;
              finished = true;
              if (code !== 0) {
                console.warn(`[Factory Testing Service] esptool exited with ${code} for ${exe}`);
                return res(null);
              }

              // Parse MAC from stdout. esptool prints something like: MAC: aa:bb:cc:dd:ee:ff
              const macMatch = stdout.match(/MAC:\s*([0-9A-Fa-f:]{17})/);
              if (macMatch) return res(macMatch[1].toUpperCase());

              const altMatch = stdout.match(/([0-9A-Fa-f]{12})/);
              if (altMatch) {
                const hex = altMatch[1];
                const mac = hex.match(/.{1,2}/g).join(':').toUpperCase();
                return res(mac);
              }

              return res(null);
            });
          });
        };

        // Try packaged candidates first - only attempt files, and inspect directories for executables
        for (const candidate of candidates) {
          if (!candidate) continue;
          try {
            if (!fs.existsSync(candidate)) continue;
            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
              console.log('[Factory Testing Service] Found esptool candidate file:', candidate);
              const mac = await attemptSpawn(candidate, ['--port', portPath, 'read_mac']);
              if (mac) return resolve(mac);
            } else if (stat.isDirectory()) {
              // Look for typical executable names inside the directory
              const inside = [path.join(candidate, 'esptool.exe'), path.join(candidate, 'esptool'), path.join(candidate, 'esptool.py')];
              for (const f of inside) {
                try {
                  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
                    console.log('[Factory Testing Service] Found esptool inside dir:', f);
                    const mac = await attemptSpawn(f, ['--port', portPath, 'read_mac']);
                    if (mac) return resolve(mac);
                  }
                } catch (e) {
                  console.warn('[Factory Testing Service] Error checking candidate file:', f, e && e.message);
                }
              }
            }
          } catch (e) {
            console.warn('[Factory Testing Service] Error while inspecting candidate:', candidate, e && e.message);
            continue;
          }
        }

        // Try invoking 'esptool' on PATH
        console.log('[Factory Testing Service] Trying esptool from PATH...');
        const macFromPath = await attemptSpawn('esptool', ['--port', portPath, 'read_mac']);
        if (macFromPath) return resolve(macFromPath);

        // Try python -m esptool (common fallback)
        console.log('[Factory Testing Service] Trying python -m esptool fallback...');
        const macFromPy = await attemptSpawn('python', ['-m', 'esptool', '--port', portPath, 'read_mac']);
        if (macFromPy) return resolve(macFromPy);

        // Also try 'py' on Windows
        if (process.platform === 'win32') {
          const macFromPyLauncher = await attemptSpawn('py', ['-m', 'esptool', '--port', portPath, 'read_mac']);
          if (macFromPyLauncher) return resolve(macFromPyLauncher);
        }

        // Nothing worked - log attempted paths and return null to allow fallback
        console.warn('[Factory Testing Service] esptool attempts completed, no MAC found. Tried:', triedPaths);
        // Before returning, if we closed the serial port earlier, try to reopen it so service can continue
        if (hadOpenPort && this.port) {
          try {
            console.log('[Factory Testing Service] Re-opening serial port after esptool attempts...');
            await new Promise((res, rej) => {
              this.port.open((err) => {
                if (err) {
                  console.error('[Factory Testing Service] Failed to re-open serial port:', err && err.message);
                  return rej(err);
                }
                // restore parser
                try {
                  this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
                } catch (e) {
                  console.warn('[Factory Testing Service] Error restoring parser after reopen:', e && e.message);
                }
                this.isConnected = true;
                console.log('[Factory Testing Service] Serial port reopened after esptool');
                res();
              });
            });
            reopened = true;
          } catch (e) {
            console.warn('[Factory Testing Service] Could not reopen serial port after esptool:', e && e.message);
          }
        }

        return resolve(null);
      } catch (error) {
        console.error('[Factory Testing Service] readEsp32MAC unexpected error:', error && error.message);
        // Attempt to reopen serial port if it was closed earlier
        if (hadOpenPort && this.port) {
          try {
            await new Promise((res) => { this.port.open(() => res()); });
            this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
            this.isConnected = true;
          } catch (ee) {
            console.warn('[Factory Testing Service] Failed to reopen serial port after error:', ee && ee.message);
          }
        }
        return resolve(null);
      }
    });
  }

  /**
   * Sanitize a string to be safe for filesystem folder/file names on Windows and POSIX.
   */
  _sanitizeFilename(name) {
    if (!name) return 'UNKNOWN';
    // Replace forbidden characters on Windows: <>:"/\\|?* and control chars
    const sanitized = String(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+$/g, '');
    // Also replace colon which appears in MAC addresses
    return sanitized.replace(/:/g, '-');
  }

  /**
   * Parse a voltage-like string and return a numeric voltage in volts.
   * If the value looks normalized (<= 1.1) treat it as 0..1 and scale to 3.3V.
   * Returns null on parse failure.
   */
  _parseVoltageValue(val) {
    if (!val) return null;
    try {
      const s = String(val).trim();
      // remove trailing V and whitespace
      const withoutV = s.replace(/V$/i, '').trim();
      const n = parseFloat(withoutV);
      if (Number.isNaN(n)) return null;
      // Heuristic: if <= 1.1, treat as normalized (0..1) and scale to 3.3V
      if (n <= 1.1) return +(n * 3.3).toFixed(3);
      return +n;
    } catch (e) {
      return null;
    }
  }

  /**
   * Read device information
   */
  async readDeviceInfo(deviceType = null) {
    try {
      console.log('[Factory Testing] Reading device information...');
      
      // Determine if this is Micro Edge (doesn't require OK)
      const isMicroEdge = deviceType === 'Micro Edge';
      const requireOK = !isMicroEdge; // Micro Edge: false, others: true
      const quickTimeout = 2000; // 2s timeout for fast device info commands

      const deviceInfo = {};

      // ACB-M doesn't have firmware version command, don't include it
      // deviceInfo.firmwareVersion = 'N/A'; // Removed

      // 1. FW Version
      try {
        const fwResponse = await this.sendATCommand('AT+FWVERSION?', '+FWVERSION:', quickTimeout, requireOK);
        deviceInfo.fwVersion = fwResponse.replace('+FWVERSION:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read FW version:', error);
        deviceInfo.fwVersion = 'ERROR';
      }

      // 2. Unique ID
      try {
        const uidResponse = await this.sendATCommand('AT+UNIQUEID?', '+UNIQUEID:', quickTimeout, requireOK);
        deviceInfo.uniqueId = uidResponse.replace('+UNIQUEID:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read Unique ID:', error);
        deviceInfo.uniqueId = 'ERROR';
      }

      // 3. Device Make
      try {
        const makeResponse = await this.sendATCommand('AT+DEVICEMAKE?', '+DEVICEMAKE:', quickTimeout, requireOK);
        deviceInfo.deviceMake = makeResponse.replace('+DEVICEMAKE:', '').trim();
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Make:', error);
        deviceInfo.deviceMake = 'ERROR';
      }
      // 4. Device Model (with retry)
      try {
        let modelResponse = null;
        let retries = 3;
        const timeout = 1000; // 1 second timeout per command

        for (let i = 0; i < retries; i++) {
          try {
            modelResponse = await this.sendATCommand('AT+DEVICEMODEL?', '+DEVICEMODEL:', timeout, requireOK);
            if (modelResponse) break; // Exit on success
          } catch (err) {
            console.warn(`[Factory Testing] Device Model attempt ${i + 1}/${retries} failed:`, err.message);
            if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 300)); // Reduce retry delay
          }
        }
        deviceInfo.deviceModel = modelResponse ? modelResponse.replace('+DEVICEMODEL:', '').trim() : 'ERROR';
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
   * Read ZC-LCD device information using AT commands with 30s timeout
   * Commands: AT+FWVERSION?, AT+UNIQUEID?, AT+DEVICEMAKE?, AT+DEVICEMODEL?
   */
  async readZCLCDDeviceInfo() {
    try {
      console.log('[Factory Testing] Reading ZC-LCD device information...');
      
      const deviceInfo = {};
      const timeout = 30000; // 30 seconds timeout per command

      // 1. FW Version: AT+FWVERSION? → +FWVERSION:v1.0
      try {
        const fwResponse = await this.sendATCommand('AT+FWVERSION?', '+FWVERSION:', timeout, false);
        // Extract after prefix if noise exists
        const idx = fwResponse.indexOf('+FWVERSION:');
        deviceInfo.fwVersion = idx >= 0 ? fwResponse.substring(idx + 11).trim() : fwResponse.replace('+FWVERSION:', '').trim();
        console.log('[Factory Testing] FW Version:', deviceInfo.fwVersion);
      } catch (error) {
        console.error('[Factory Testing] Failed to read FW version:', error.message);
        deviceInfo.fwVersion = 'ERROR';
      }

      // 2. Unique ID: AT+UNIQUEID? → +UNIQUEID:1CDBD4963210
      try {
        const uidResponse = await this.sendATCommand('AT+UNIQUEID?', '+UNIQUEID:', timeout, false);
        deviceInfo.uniqueId = uidResponse.replace('+UNIQUEID:', '').trim();
        console.log('[Factory Testing] Unique ID:', deviceInfo.uniqueId);
      } catch (error) {
        console.error('[Factory Testing] Failed to read Unique ID:', error.message);
        deviceInfo.uniqueId = 'ERROR';
      }

      // 3. Device Make: AT+DEVICEMAKE? → +DEVICEMAKE:ZC-LCD
      try {
        const makeResponse = await this.sendATCommand('AT+DEVICEMAKE?', '+DEVICEMAKE:', timeout, false);
        const idx = makeResponse.indexOf('+DEVICEMAKE:');
        deviceInfo.deviceMake = idx >= 0 ? makeResponse.substring(idx + 12).trim() : makeResponse.replace('+DEVICEMAKE:', '').trim();
        console.log('[Factory Testing] Device Make:', deviceInfo.deviceMake);
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Make:', error.message);
        deviceInfo.deviceMake = 'ERROR';
      }
      // 4. Device Model (with retry)
      try {
        let modelResponse = null;
        let retries = 3;
        const modelTimeout = 30000; // use same 30s timeout

        for (let i = 0; i < retries; i++) {
          try {
            modelResponse = await this.sendATCommand('AT+DEVICEMODEL?', '+DEVICEMODEL:', modelTimeout, false);
            // if (modelResponse) break;
          } catch (err) {
            console.warn(`[Factory Testing] Device Model attempt ${i + 1}/${retries} failed:`, err.message);
            if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        if (modelResponse) {
          const parts = modelResponse.split('+DEVICEMODEL:');
          deviceInfo.deviceModel = parts.length > 1 ? parts[parts.length - 1].trim() : modelResponse.replace('+DEVICEMODEL:', '').trim();
        } else {
          deviceInfo.deviceModel = 'ERROR';
        }
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Model:', error);
        deviceInfo.deviceModel = 'ERROR';
      }

      console.log('[Factory Testing] ZC-LCD device information read successfully:', deviceInfo);
      return { success: true, data: deviceInfo };
    } catch (error) {
      console.error('[Factory Testing] Error reading ZC-LCD device info:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Read Droplet device information using AT commands with 30s timeout
   * Commands: AT+DEVICEMODEL?, AT+DEVICEMAKE?, AT+FWVERSION?, AT+UNIQUEID?
   */
  async readDropletDeviceInfo() {
    try {
      console.log('[Factory Testing] Reading Droplet device information AHUHU ...');
      
      const deviceInfo = {};
      const timeout = 5000; // 30 seconds timeout per command

      // 1. Device Model: AT+ATBUG? → +ATBUG:0002
      try {
        const modelResponse = await this.sendATCommand('AT+ATBUG?', '+ATBUG:', 500, false);

        deviceInfo.deviceModel = modelResponse.replace('+DEVICEMODEL:', '').trim();
        console.log('[Factory Testing] Device Model:', deviceInfo.deviceModel);
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Model:', error.message);
        deviceInfo.deviceModel = 'ERROR';
      }

      try {
        const modelResponse = await this.sendATCommand('AT+DEVICEMODEL?', '+DEVICEMODEL:', timeout, false);

        deviceInfo.deviceModel = modelResponse.replace('+DEVICEMODEL:', '').trim();
        console.log('[Factory Testing] Device Model:', deviceInfo.deviceModel);
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Model:', error.message);
        deviceInfo.deviceModel = 'ERROR';
      }

      // 2. Device Make: AT+DEVICEMAKE? → +DEVICEMAKE:ACB-M
      try {
        const makeResponse = await this.sendATCommand('AT+DEVICEMAKE?', '+DEVICEMAKE:', timeout, false);
        deviceInfo.deviceMake = makeResponse.replace('+DEVICEMAKE:', '').trim();
        console.log('[Factory Testing] Device Make:', deviceInfo.deviceMake);
      } catch (error) {
        console.error('[Factory Testing] Failed to read Device Make:', error.message);
        deviceInfo.deviceMake = 'ERROR';
      }

      // 3. FW Version: AT+FWVERSION? → +FWVERSION:0001
      try {
        const fwResponse = await this.sendATCommand('AT+FWVERSION?', '+FWVERSION:', timeout, false);
        deviceInfo.fwVersion = fwResponse.replace('+FWVERSION:', '').trim();
        console.log('[Factory Testing] FW Version:', deviceInfo.fwVersion);
      } catch (error) {
        console.error('[Factory Testing] Failed to read FW version:', error.message);
        deviceInfo.fwVersion = 'ERROR';
      }

      // 4. Unique ID: AT+UNIQUEID? → +UNIQUEID:841FE8109E38
      try {
        const uidResponse = await this.sendATCommand('AT+UNIQUEID?', '+UNIQUEID:', timeout, false);
        deviceInfo.uniqueId = uidResponse.replace('+UNIQUEID:', '').trim();
        console.log('[Factory Testing] Unique ID:', deviceInfo.uniqueId);
      } catch (error) {
        console.error('[Factory Testing] Failed to read Unique ID:', error.message);
        deviceInfo.uniqueId = 'ERROR';
      }

      console.log('[Factory Testing] Droplet device information read successfully:', deviceInfo);
      return { success: true, data: deviceInfo };
    } catch (error) {
      console.error('[Factory Testing] Error reading Droplet device info:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run factory tests
   */
  async runFactoryTests(device) {
    try {
      // Clear any previous abort state at the start of a run
      this._abortRequested = false;
      this._currentAbort = null;
      console.log('[Factory Testing] Running factory tests for device:', device);

      // Route tests based on device type
      if (device === 'ZC-LCD') {
        const resultsZC = {
          info: {},
          tests: {},
          _eval: {}
        };

        const setEval = (key, state) => {
          resultsZC._eval[key] = state === true;
        };

        this.updateProgress('ZC-LCD: Starting tests...');

        // WiFi test: AT+TEST=wifi → +WIFI:6,1 (networks>1, connected=1)
        this.updateProgress('ZC-LCD: Running WiFi test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=wifi', '+WIFI:', 30000, false);
          const payload = resp.replace('+WIFI:', '').trim();
          const parts = payload.split(',');
          const networkCount = Number(parts[0] || '0');
          const connected = Number(parts[1] || '0');
          const pass = Number.isFinite(networkCount) && networkCount > 1 && connected === 1;
          resultsZC.tests.wifi = {
            pass,
            networks: networkCount,
            connected,
            raw: resp,
            message: pass ? `Networks: ${networkCount}, connected` : `Networks=${networkCount}, connected=${connected}`
          };
          setEval('pass_wifi', pass);
        } catch (err) {
          resultsZC.tests.wifi = {
            pass: false,
            networks: null,
            connected: null,
            raw: null,
            message: err.message || 'WiFi test failed'
          };
          setEval('pass_wifi', false);
        }

        // RS485 test: AT+TEST=rs485 → +RS485:4096 (must be exactly 4096)
        this.updateProgress('ZC-LCD: Running RS485 test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=rs485', '+RS485:', 30000, false);
          const payload = resp.replace('+RS485:', '').trim();
          // Expected format: +RS485:4096 (value should be 4096 for pass)
          const value = Number(payload);
          const pass = value === 4096;
          resultsZC.tests.rs485 = {
            pass,
            value,
            raw: resp,
            message: pass ? 'RS485 test passed (value=4096)' : `Expected 4096, received ${value}`
          };
          setEval('pass_rs485', pass);
        } catch (err) {
          resultsZC.tests.rs485 = {
            pass: false,
            value: null,
            raw: null,
            message: err.message || 'RS485 test failed'
          };
          setEval('pass_rs485', false);
        }

        // I2C test: AT+TEST=i2c → +I2C:0x40,266,671 (address, temp, humidity with OK)
        this.updateProgress('ZC-LCD: Running I2C test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=i2c', '+I2C:', 30000, false);
          const payload = resp.replace('+I2C:', '').trim();
          // Expected format: +I2C:0x40,266,671 (i2c_address, temp*10, hum*10)
          const parts = payload.split(',');
          const i2cAddress = parts[0] ? parts[0].trim() : '';
          const temp = parts[1] ? Number(parts[1].trim()) : null;
          const hum = parts[2] ? Number(parts[2].trim()) : null;
          
          // Validate: must have valid address and reasonable sensor values
          const addressValid = i2cAddress && i2cAddress.startsWith('0x');
          const tempValid = temp !== null && Number.isFinite(temp);
          const humValid = hum !== null && Number.isFinite(hum);
          const pass = addressValid && tempValid && humValid;
          
          resultsZC.tests.i2c = {
            pass,
            i2cAddress,
            temperature: temp,
            humidity: hum,
            raw: resp,
            message: pass ? `I2C: ${i2cAddress}, Temp: ${temp}, Hum: ${hum}` : 'Invalid I2C values'
          };
          setEval('pass_i2c', pass);
        } catch (err) {
          resultsZC.tests.i2c = {
            pass: false,
            i2cAddress: null,
            temperature: null,
            humidity: null,
            raw: null,
            message: err.message || 'I2C test failed'
          };
          setEval('pass_i2c', false);
        }

        // LCD test: AT+TEST=lcd → +LCD:5 (touch count > 2 for pass)
        this.updateProgress('ZC-LCD: Running LCD test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=lcd', '+LCD:', 30000, false);
          const payload = resp.replace('+LCD:', '').trim();
          // Expected format: +LCD:5 (touch count must be > 2)
          const touchCount = Number(payload);
          const pass = Number.isFinite(touchCount) && touchCount > 2;
          resultsZC.tests.lcd = {
            pass,
            touchCount,
            raw: resp,
            message: pass ? `LCD test passed (touches: ${touchCount})` : `Touch count: ${touchCount} (need > 2)`
          };
          setEval('pass_lcd', pass);
        } catch (err) {
          resultsZC.tests.lcd = {
            pass: false,
            touchCount: null,
            raw: null,
            message: err.message || 'LCD test failed'
          };
          setEval('pass_lcd', false);
        }

        const allPass = Object.keys(resultsZC._eval).length > 0 && Object.values(resultsZC._eval).every(Boolean);
        resultsZC.summary = {
          passAll: allPass
        };

        this.updateProgress('ZC-LCD tests completed');
        return { success: true, data: resultsZC };
      }

      // ZC-Controller device specific tests (RS485 + 20 relays)
      if (device === 'ZC-Controller') {
        const resultsZCC = { info: {}, tests: {}, _eval: {}, summary: null };
        const setEval = (key, state) => { resultsZCC._eval[key] = state === true; };

        this.updateProgress('ZC-Controller: Starting RS485 and relay tests...');

        // Write OFF for 10 relays (group-1)
        this.updateProgress('ZC-Controller: OFF 10 relays (group-1)...');
        try {
          const offCmd1 = '01 10 07 CF 00 0A 14 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 FE 69';
          const offResp1 = await this.sendRs485Hex(offCmd1);
          const okWrite = offResp1 && offResp1.startsWith('01 10 07 CF 00 0A');
          resultsZCC.tests.write_off_1 = { pass: !!okWrite, raw: offResp1 || null, message: okWrite ? 'Write confirmed' : 'Unexpected write response' };
          setEval('pass_rs485', !!okWrite);
        } catch (e) {
          resultsZCC.tests.write_off_1 = { pass: false, raw: null, message: e.message || 'RS485 write failed' };
          setEval('pass_rs485', false);
        }

        // Helper: read relay status with 02 02 command and decode
        const readStatus = async (label) => {
          const cmd = '02 02 00 00 00 0A F8 3E';
          const resp = await this.sendRs485Hex(cmd);
          const parts = String(resp || '').trim().split(/\s+/);
          const validPrefix = resp && resp.startsWith('02 02 02');
          const b3 = parts[3] ? parts[3].toUpperCase() : '';
          const b4 = parts[4] ? parts[4].toUpperCase() : '';
          const toBits = (hex) => { const v = parseInt(hex || '0', 16); return Array.from({length:8}, (_,i)=>((v>>i)&1)); };
          const bits = validPrefix ? [...toBits(b3), ...toBits(b4)].slice(0,10) : null;
          const onCount = bits ? bits.filter(b => b === 1).length : null;
          const offCount = bits ? bits.filter(b => b === 0).length : null;
          const msg = `Status ${label}: ${b3} ${b4} · bits=${bits ? bits.join('') : 'N/A'} · on=${onCount ?? 'N/A'} · off=${offCount ?? 'N/A'}`;
          return { pass: !!validPrefix, raw: resp || null, message: msg, validPrefix, b3, b4, bits, onCount, offCount };
        };

        // Status after OFF group-1 (expect FF 03)
        this.updateProgress('ZC-Controller: Status after OFF (group-1)...');
        try {
          const st1 = await readStatus('OFF-1');
          resultsZCC.tests.status_off_1 = st1;
          const expected = st1.validPrefix && st1.b3 === 'FF' && st1.b4 === '03';
          // Relay mismatch list for OFF should be bits=1111111111 (1=OFF)
          resultsZCC.tests.status_off_1.mismatches = st1.bits ? st1.bits.map((b, idx) => (b !== 1 ? idx+1 : null)).filter(v => v !== null) : [];
          setEval('pass_relay_off_1', !!expected);
        } catch (e) {
          resultsZCC.tests.status_off_1 = { pass: false, raw: null, message: e.message || 'Status read failed' };
          setEval('pass_relay_off_1', false);
        }

        // ON 10 relays (group-1)
        this.updateProgress('ZC-Controller: ON 10 relays (group-1)...');
        try {
          const onCmd1 = '01 10 07 CF 00 0A 14 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 00 01 E5 E8';
          const onResp1 = await this.sendRs485Hex(onCmd1);
          const okWrite = onResp1 && onResp1.startsWith('01 10 07 CF 00 0A');
          resultsZCC.tests.write_on_1 = { pass: !!okWrite, raw: onResp1 || null, message: okWrite ? 'Write confirmed' : 'Unexpected write response' };
          setEval('pass_rs485_on1', !!okWrite);
        } catch (e) {
          resultsZCC.tests.write_on_1 = { pass: false, raw: null, message: e.message || 'RS485 write failed' };
          setEval('pass_rs485_on1', false);
        }

        // Status after ON group-1 (expect 00 00)
        this.updateProgress('ZC-Controller: Status after ON (group-1)...');
        try {
          const stOn1 = await readStatus('ON-1');
          resultsZCC.tests.status_on_1 = stOn1;
          const expected = stOn1.validPrefix && stOn1.b3 === '00' && stOn1.b4 === '00';
          // Relay mismatch list for ON should be bits=0000000000 (0=ON)
          resultsZCC.tests.status_on_1.mismatches = stOn1.bits ? stOn1.bits.map((b, idx) => (b !== 0 ? idx+1 : null)).filter(v => v !== null) : [];
          setEval('pass_relay_on_1', !!expected);
        } catch (e) {
          resultsZCC.tests.status_on_1 = { pass: false, raw: null, message: e.message || 'Status read failed' };
          setEval('pass_relay_on_1', false);
        }

        // OFF again group-1 and status check (expect FF 03)
        this.updateProgress('ZC-Controller: OFF again (group-1)...');
        try {
          const offCmd2 = '01 10 07 CF 00 0A 14 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 FE 69';
          const offResp2 = await this.sendRs485Hex(offCmd2);
          const okWrite2 = offResp2 && offResp2.startsWith('01 10 07 CF 00 0A');
          resultsZCC.tests.write_off_1_again = { pass: !!okWrite2, raw: offResp2 || null, message: okWrite2 ? 'Write confirmed' : 'Unexpected write response' };
          setEval('pass_rs485_off2', !!okWrite2);
        } catch (e) {
          resultsZCC.tests.write_off_1_again = { pass: false, raw: null, message: e.message || 'RS485 write failed' };
          setEval('pass_rs485_off2', false);
        }
        this.updateProgress('ZC-Controller: Status after OFF again (group-1)...');
        try {
          const stOff2 = await readStatus('OFF-1-again');
          resultsZCC.tests.status_off_1_again = stOff2;
          const expected = stOff2.validPrefix && stOff2.b3 === 'FF' && stOff2.b4 === '03';
          resultsZCC.tests.status_off_1_again.mismatches = stOff2.bits ? stOff2.bits.map((b, idx) => (b !== 1 ? idx+1 : null)).filter(v => v !== null) : [];
          setEval('pass_relay_off_1_again', !!expected);
        } catch (e) {
          resultsZCC.tests.status_off_1_again = { pass: false, raw: null, message: e.message || 'Status read failed' };
          setEval('pass_relay_off_1_again', false);
        }

        // ON 10 relays (group-2) and status
        this.updateProgress('ZC-Controller: ON 10 relays (group-2)...');
        try {
          const onCmd2 = '01 10 07 CF 00 0A 14 00 02 00 02 00 02 00 02 00 02 00 02 00 02 00 02 00 02 00 02 CB 2B';
          const onResp2 = await this.sendRs485Hex(onCmd2);
          const okWrite2 = onResp2 && onResp2.startsWith('01 10 07 CF 00 0A');
          resultsZCC.tests.write_on_2 = { pass: !!okWrite2, raw: onResp2 || null, message: okWrite2 ? 'Write confirmed' : 'Unexpected write response' };
          setEval('pass_rs485_on2', !!okWrite2);
        } catch (e) {
          resultsZCC.tests.write_on_2 = { pass: false, raw: null, message: e.message || 'RS485 write failed' };
          setEval('pass_rs485_on2', false);
        }
        this.updateProgress('ZC-Controller: Status after ON (group-2)...');
        try {
          const stOn2 = await readStatus('ON-2');
          resultsZCC.tests.status_on_2 = stOn2;
          const expected = stOn2.validPrefix && stOn2.b3 === '00' && stOn2.b4 === '00';
          resultsZCC.tests.status_on_2.mismatches = stOn2.bits ? stOn2.bits.map((b, idx) => (b !== 0 ? idx+1 : null)).filter(v => v !== null) : [];
          setEval('pass_relay_on_2', !!expected);
        } catch (e) {
          resultsZCC.tests.status_on_2 = { pass: false, raw: null, message: e.message || 'Status read failed' };
          setEval('pass_relay_on_2', false);
        }

        const allPass = Object.keys(resultsZCC._eval).length > 0 && Object.values(resultsZCC._eval).every(Boolean);
        // Summarize command-level success (all writes confirmed and all status reads valid)
        const commandsOk = [
          resultsZCC.tests.write_off_1?.pass,
          resultsZCC.tests.status_off_1?.pass,
          resultsZCC.tests.write_on_1?.pass,
          resultsZCC.tests.status_on_1?.pass,
          resultsZCC.tests.write_off_1_again?.pass,
          resultsZCC.tests.status_off_1_again?.pass,
          resultsZCC.tests.write_on_2?.pass,
          resultsZCC.tests.status_on_2?.pass
        ].every(Boolean);
        const relayMismatches = {
          off_1: resultsZCC.tests.status_off_1?.mismatches || [],
          on_1: resultsZCC.tests.status_on_1?.mismatches || [],
          off_1_again: resultsZCC.tests.status_off_1_again?.mismatches || [],
          on_2: resultsZCC.tests.status_on_2?.mismatches || []
        };
        resultsZCC.summary = {
          passAll: allPass && commandsOk && relayMismatches.on_1.length === 0 && relayMismatches.off_1.length === 0 && relayMismatches.off_1_again.length === 0 && relayMismatches.on_2.length === 0,
          commandsOk,
          relayMismatches
        };
        this.updateProgress('ZC-Controller tests completed');
        return { success: true, data: resultsZCC };
      }

      // ACB-M device specific tests
      if (device === 'ACB-M') {
        const resultsACB = {
          info: {},
          tests: {},
          _eval: {}
        };

        const ensureString = (value) => {
          if (value === null || typeof value === 'undefined') return '';
          return String(value);
        };

        const parseRtcTimestamp = (raw) => {
          if (!raw) return null;
          const match = raw.trim().match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
          if (!match) return null;
          const [_, y, m, d, hh, mm, ss] = match;
          const ts = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
          return {
            iso: new Date(ts).toISOString(),
            utc: ts,
            display: `${y}-${m}-${d} ${hh}:${mm}:${ss}`
          };
        };

        const withinRtcWindow = (ts) => {
          if (!ts && ts !== 0) return false;
          const start = Date.UTC(2001, 0, 1, 0, 0, 30);
          const end = Date.UTC(2001, 0, 2, 0, 0, 0);
          return ts >= start && ts <= end;
        };

        const setEval = (key, state) => {
          resultsACB._eval[key] = state === true;
        };

        // Device info already read after connection, just use it
        // No need to read again
        this.updateProgress('ACB-M: Starting tests...');

        // UART loopback test (with 30 second timeout)
        this.updateProgress('ACB-M: Running UART test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=uart', '+VALUE_UART:', 30000);
          const value = resp.replace('+VALUE_UART:', '').trim();
          const pass = value.toUpperCase() === 'EE';
          resultsACB.tests.uart = {
            pass,
            value,
            raw: resp,
            message: pass ? 'Loopback value EE received' : `Expected EE, received ${ensureString(value) || 'N/A'}`
          };
          setEval('pass_uart', pass);
        } catch (err) {
          resultsACB.tests.uart = {
            pass: false,
            value: null,
            raw: null,
            message: err.message || 'UART test failed'
          };
          setEval('pass_uart', false);
        }

        // RTC test (with 30 second timeout)
        this.updateProgress('ACB-M: Running RTC test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=rtc', '+RTC:', 30000);
          const timeStr = resp.replace('+RTC:', '').trim();
          const parsed = parseRtcTimestamp(timeStr);
          const pass = parsed ? withinRtcWindow(parsed.utc) : false;
          resultsACB.tests.rtc = {
            pass,
            time: parsed ? parsed.display : timeStr,
            raw: resp,
            message: pass ? 'RTC within expected window' : 'RTC value outside expected window'
          };
          setEval('pass_rtc', pass);
        } catch (err) {
          resultsACB.tests.rtc = {
            pass: false,
            time: null,
            raw: null,
            message: err.message || 'RTC test failed'
          };
          setEval('pass_rtc', false);
        }

        // WiFi test (with 30 second timeout)
        this.updateProgress('ACB-M: Running WiFi test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=wifi', '+WIFI:', 30000);
          const payload = resp.replace('+WIFI:', '').trim();
          const parts = payload.split(',');
          const networkCount = Number(parts[0] || '0');
          const connected = Number(parts[1] || '0');
          const pass = Number.isFinite(networkCount) && networkCount > 1 && connected === 1;
          resultsACB.tests.wifi = {
            pass,
            networks: networkCount,
            connected,
            raw: resp,
            message: pass ? `Networks: ${networkCount}, connected` : `Networks=${networkCount}, connected=${connected}`
          };
          setEval('pass_wifi', pass);
        } catch (err) {
          resultsACB.tests.wifi = {
            pass: false,
            networks: null,
            connected: null,
            raw: null,
            message: err.message || 'WiFi test failed'
          };
          setEval('pass_wifi', false);
        }

        // LoRa test (with 30 second timeout)
        this.updateProgress('ACB-M: Running LoRa test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=lora', '+LORA:', 30000);
          const payload = resp.replace('+LORA:', '').trim();
          const parts = payload.split(',');
          const txDone = Number(parts[0] || '0');
          const rxDone = Number(parts[1] || '0');
          const value = (parts[2] || '').trim();
          const pass = txDone === 1 && rxDone === 1;
          resultsACB.tests.lora = {
            pass,
            txDone,
            rxDone,
            value,
            raw: resp,
            message: pass ? `LoRa TX=${txDone}, RX=${rxDone}, Value=${value}` : 'LoRa failed'
          };
          setEval('pass_lora', pass);
        } catch (err) {
          resultsACB.tests.lora = {
            pass: false,
            raw: null,
            message: err.message || 'LoRa test failed'
          };
          setEval('pass_lora', false);
        }

        // Ethernet test (with 30 second timeout)
        this.updateProgress('ACB-M: Running Ethernet test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=eth', '+ETH:', 30000);
          const payload = resp.replace('+ETH:', '').trim();
          
          let mac = '';
          let ip = '';
          let linkStatus = '';
          
          // Handle two formats:
          // Format 1: MAC=84:1F:E8:10:9E:3B,IP=192.168.0.100
          // Format 2: 841FE8109E38,0.0.0.0,4/4
          if (payload.includes('MAC=') || payload.includes('IP=')) {
            // Format 1: MAC=xxx,IP=yyy
            const macMatch = payload.match(/MAC\s*=\s*([^,]+)/i);
            const ipMatch = payload.match(/IP\s*=\s*([^,\s]+)/i);
            mac = macMatch ? macMatch[1].trim() : '';
            ip = ipMatch ? ipMatch[1].trim() : '';
          } else {
            // Format 2: MAC,IP,link_status
            const parts = payload.split(',');
            mac = parts[0] ? parts[0].trim() : '';
            ip = parts[1] ? parts[1].trim() : '';
            linkStatus = parts[2] ? parts[2].trim() : '';
          }
          
          const macInvalid = !mac || mac.length < 12;
          const ipInvalid = !ip || ip === '0.0.0.0';
          const pass = !macInvalid && !ipInvalid;
          resultsACB.tests.eth = {
            pass,
            mac,
            ip,
            linkStatus,
            raw: resp,
            message: pass ? `${mac} · ${ip}${linkStatus ? ' · ' + linkStatus : ''}` : 'Invalid MAC or IP'
          };
          setEval('pass_eth', pass);
        } catch (err) {
          resultsACB.tests.eth = {
            pass: false,
            mac: null,
            ip: null,
            linkStatus: null,
            raw: null,
            message: err.message || 'Ethernet test failed'
          };
          setEval('pass_eth', false);
        }

        // RS485-2 test (with 30 second timeout)
        this.updateProgress('ACB-M: Running RS485-2 test...');
        try {
          // Some firmware returns "+RS4852:count,status" while others return "+RS485:count,status" for the rs4852 command
          const resp = await this.sendATCommand('AT+TEST=rs4852', ['+RS4852:', '+RS485:'], 30000);
          const raw = resp || '';
          // If device reports any ERROR, treat as failure immediately
          if (raw.startsWith('+CME ERROR:') || raw.startsWith('ERROR')) {
            resultsACB.tests.rs4852 = {
              pass: false,
              status: null,
              count: null,
              raw,
              message: 'RS485-2 hardware init failed'
            };
            setEval('pass_rs4852', false);
          } else {
            // Accept two possible payload formats:
            // 1) "+RS4852:count,status" (preferred)
            // 1b) "+RS485:count,status" (legacy)
            // 2) "+RS4852:value" then later ERROR (we already handle ERROR above)
            const payload = raw.replace(/^\+RS4852?:/i, '').trim();
            const parts = payload.split(',');
            const count = Number(parts[0] || '0');
            const status = parts.length > 1 ? Number(parts[1] || '1') : NaN;
            const haveStatus = parts.length > 1 && Number.isFinite(status);
            const pass = haveStatus ? (status === 0) : false;
            resultsACB.tests.rs4852 = {
              pass,
              count,
              status: haveStatus ? status : null,
              raw,
              message: pass ? `RS485-2 test passed (count=${count})` : (haveStatus ? `RS485-2 test failed (status=${status})` : 'RS485-2 response incomplete')
            };
            setEval('pass_rs4852', pass);
          }
        } catch (err) {
          resultsACB.tests.rs4852 = {
            pass: false,
            status: null,
            count: null,
            raw: null,
            message: err.message || 'RS485-2 test failed'
          };
          setEval('pass_rs4852', false);
        }

        const allPass = Object.keys(resultsACB._eval).length > 0 && Object.values(resultsACB._eval).every(Boolean);
        resultsACB.summary = {
          passAll: allPass
        };

        this.updateProgress('ACB-M tests completed');
        return { success: true, data: resultsACB };
      }

      // LoRa UART (Gen2) device specific tests: only UART loopback + LoRa
      if (device === 'LoRa UART') {
        const resultsLU = {
          info: {},
          tests: {},
          _eval: {},
          summary: null
        };

        const setEval = (key, state) => {
          resultsLU._eval[key] = state === true;
        };

        this.updateProgress('LoRa UART: Starting tests...');

        // UART loopback test (expect +VALUE_UART:EE)
        this.updateProgress('LoRa UART: Running UART test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=uart', '+VALUE_UART:', 30000);
          const value = resp.replace('+VALUE_UART:', '').trim();
          const pass = value.toUpperCase() === 'EE';
          resultsLU.tests.uart = {
            pass,
            value,
            raw: resp,
            message: pass ? 'Loopback value EE received' : `Expected EE, received ${value || 'N/A'}`
          };
          setEval('pass_uart', pass);
        } catch (err) {
          resultsLU.tests.uart = {
            pass: false,
            value: null,
            raw: null,
            message: err.message || 'UART test failed'
          };
          setEval('pass_uart', false);
        }

        // LoRa test (expect +LORA:tx_done,rx_done,value_hex)
        this.updateProgress('LoRa UART: Running LoRa test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=lora', '+LORA:', 30000);
          const payload = resp.replace('+LORA:', '').trim();
          const parts = payload.split(',');
          const txDone = Number(parts[0] || '0');
          const rxDone = Number(parts[1] || '0');
          const value = (parts[2] || '').trim();
          const pass = txDone === 1 && rxDone === 1;
          resultsLU.tests.lora = {
            pass,
            txDone,
            rxDone,
            value,
            raw: resp,
            message: pass ? `LoRa TX=${txDone}, RX=${rxDone}, Value=${value}` : 'LoRa failed'
          };
          setEval('pass_lora', pass);
        } catch (err) {
          resultsLU.tests.lora = {
            pass: false,
            raw: null,
            message: err.message || 'LoRa test failed'
          };
          setEval('pass_lora', false);
        }

        const allPass = !!(resultsLU._eval.pass_uart && resultsLU._eval.pass_lora);
        resultsLU.summary = { passAll: allPass };
        this.updateProgress('LoRa UART tests completed');
        return { success: true, data: resultsLU };
      }

      // Droplet device specific tests
      if (device === 'Droplet') {
        const resultsDroplet = {
          info: {},
          tests: {},
          _eval: {}
        };

        const setEval = (key, state) => {
          resultsDroplet._eval[key] = state === true;
        };

        this.updateProgress('Droplet: Starting tests...');

        // LoRa test: AT+TEST=lora → +LORA:1,1,4F4B (tx_done, rx_done, value_rx hex)
        this.updateProgress('Droplet: Running LoRa test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=lora', '+LORA:', 30000, false);
          const payload = resp.replace('+LORA:', '').trim();
          const parts = payload.split(',');
          const txDone = Number(parts[0] || '0');
          const rxDone = Number(parts[1] || '0');
          const valueHex = (parts[2] || '').trim();
          // decode hex payload to ASCII when possible
          let valueAscii = '';
          try {
            const buf = Buffer.from(valueHex, 'hex');
            valueAscii = buf.toString('ascii');
          } catch (_) { valueAscii = ''; }
          const pass = txDone === 1 && rxDone === 1;
          resultsDroplet.tests.lora = {
            pass,
            txDone,
            rxDone,
            valueRx: valueHex,
            valueAscii,
            raw: resp,
            message: pass ? `LoRa: TX=${txDone}, RX=${rxDone}, Value=${valueAscii || valueHex}` : `TX=${txDone}, RX=${rxDone} (need both=1)`
          };
          setEval('pass_lora', pass);
        } catch (err) {
          resultsDroplet.tests.lora = {
            pass: false,
            txDone: null,
            rxDone: null,
            valueRx: null,
            raw: null,
            message: err.message || 'LoRa test failed'
          };
          setEval('pass_lora', false);
        }

        // Battery test: AT+TEST=bat → +BAT:3.66 (voltage). Pass range: 3.4V–3.8V
        this.updateProgress('Droplet: Running Battery test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=bat', '+BAT:', 30000, false);
          const payload = resp.replace('+BAT:', '').trim();
          const voltage = Number(payload);
          // Pass if voltage within specified window 3.4–3.8V
          const pass = Number.isFinite(voltage) && voltage >= 3.4 && voltage <= 3.8;
          resultsDroplet.tests.battery = {
            pass,
            voltage,
            raw: resp,
            message: pass ? `Battery: ${voltage}V (pass 3.4–3.8V)` : payload.includes('NOT VALUE') ? 'No battery value' : `Out of range: ${voltage}V`
          };
          setEval('pass_battery', pass);
        } catch (err) {
          resultsDroplet.tests.battery = {
            pass: false,
            voltage: null,
            raw: null,
            message: err.message || 'Battery test failed'
          };
          setEval('pass_battery', false);
        }

        // I2C test: AT+TEST=i2c → +I2C:0x40,2800,6843 (address, temp*100, hum*100)
        this.updateProgress('Droplet: Running I2C test...');
        try {
          const resp = await this.sendATCommand('AT+TEST=i2c', '+I2C:', 30000, false);
          const payload = resp.replace('+I2C:', '').trim();
          const parts = payload.split(',');
          const i2cAddress = parts[0] ? parts[0].trim() : '';
          const tempRaw = parts[1] ? Number(parts[1].trim()) : null;
          const humRaw = parts[2] ? Number(parts[2].trim()) : null;
          const tempC = tempRaw !== null && Number.isFinite(tempRaw) ? tempRaw / 100 : null;
          const humPct = humRaw !== null && Number.isFinite(humRaw) ? humRaw / 100 : null;
          const tempDisplay = tempC !== null ? tempC.toFixed(2) : null;
          const humDisplay = humPct !== null ? humPct.toFixed(2) : null;
          
          const addressValid = i2cAddress && i2cAddress.startsWith('0x');
          const tempValid = tempC !== null && Number.isFinite(tempC);
          const humValid = humPct !== null && Number.isFinite(humPct);
          const pass = addressValid && tempValid && humValid;
          
          resultsDroplet.tests.i2c = {
            pass,
            i2cAddress,
            temperature: tempRaw,
            humidity: humRaw,
            temperature_c: tempC,
            humidity_percent: humPct,
            raw: resp,
            message: pass ? `I2C: ${i2cAddress}, Temp: ${tempDisplay} C, Hum: ${humDisplay} %` : 'Invalid I2C values'
          };
          setEval('pass_i2c', pass);
        } catch (err) {
          resultsDroplet.tests.i2c = {
            pass: false,
            i2cAddress: null,
            temperature: null,
            humidity: null,
            temperature_c: null,
            humidity_percent: null,
            raw: null,
            message: err.message || 'I2C test failed'
          };
          setEval('pass_i2c', false);
        }

        // Pass only if all three Droplet tests passed
        const passLora = !!resultsDroplet._eval.pass_lora;
        const passBattery = !!resultsDroplet._eval.pass_battery;
        const passI2c = !!resultsDroplet._eval.pass_i2c;
        const allPass = passLora && passBattery && passI2c;
        resultsDroplet.summary = {
          passAll: allPass,
          breakdown: { lora: passLora, battery: passBattery, i2c: passI2c }
        };

        this.updateProgress('Droplet tests completed');
        return { success: true, data: resultsDroplet };
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
        if (this._abortRequested) throw error;
      }

      // 2. Pulses Counter
      this.updateProgress('Testing pulses counter...');
      try {
        const pulseResponse = await this.sendATCommand('AT+VALUE_PULSE?', '+VALUE_PULSE:');
        results.pulsesCounter = pulseResponse.replace('+VALUE_PULSE:', '').trim();
      } catch (error) {
        results.pulsesCounter = 'ERROR';
        if (this._abortRequested) throw error;
      }

      // 3. DIP Switches
      this.updateProgress('Reading DIP switches...');
      try {
        const dipResponse = await this.sendATCommand('AT+VALUE_DIPSWITCHES?', '+VALUE_DIPSWITCHES:');
        results.dipSwitches = dipResponse.replace('+VALUE_DIPSWITCHES:', '').trim();
      } catch (error) {
        results.dipSwitches = 'ERROR';
        if (this._abortRequested) throw error;
      }

      // 4. AIN 1 Voltage
      this.updateProgress('Testing AIN 1 voltage...');
      try {
        const ain1Response = await this.sendATCommand('AT+VALUE_UI1_RAW?', '+VALUE_UI1_RAW:');
        results.ain1Voltage = ain1Response.replace('+VALUE_UI1_RAW:', '').trim() + ' V';
      } catch (error) {
        results.ain1Voltage = 'ERROR';
        if (this._abortRequested) throw error;
      }

      // 5. AIN 2 Voltage
      this.updateProgress('Testing AIN 2 voltage...');
      try {
        const ain2Response = await this.sendATCommand('AT+VALUE_UI2_RAW?', '+VALUE_UI2_RAW:');
        results.ain2Voltage = ain2Response.replace('+VALUE_UI2_RAW:', '').trim() + ' V';
      } catch (error) {
        results.ain2Voltage = 'ERROR';
        if (this._abortRequested) throw error;
      }

      // 6. AIN 3 Voltage
      this.updateProgress('Testing AIN 3 voltage...');
      try {
        const ain3Response = await this.sendATCommand('AT+VALUE_UI3_RAW?', '+VALUE_UI3_RAW:');
        results.ain3Voltage = ain3Response.replace('+VALUE_UI3_RAW:', '').trim() + ' V';
      } catch (error) {
        results.ain3Voltage = 'ERROR';
        if (this._abortRequested) throw error;
      }

      // 7. LoRa Unique Address
      this.updateProgress('Reading LoRa address...');
      try {
        const loraAddrResponse = await this.sendATCommand('AT+LRRADDRUNQ?', '+LRRADDRUNQ:');
        results.loraAddress = loraAddrResponse.replace('+LRRADDRUNQ:', '').trim();
        // Use loraAddress as loraDetect for label printing (no need to call AT+LORADETECT?)
        results.loraDetect = results.loraAddress;
      } catch (error) {
        results.loraAddress = 'ERROR';
        results.loraDetect = 'ERROR';
        if (this._abortRequested) throw error;
      }

      // 8. Push LoRaRaw packet
      this.updateProgress('Testing LoRa transmission...');
      try {
        const resp = await this.sendATCommand('AT+LORARAWPUSH', 'OK', this.commandTimeout, false);
        results.loraRawPush = (resp && resp.includes('OK')) ? 'OK' : 'ERROR';
      } catch (error) {
        results.loraRawPush = 'ERROR';
        if (this._abortRequested) throw error;
      }

      this.updateProgress('All tests completed!');
      console.log('[Factory Testing] Factory tests completed:', results);
      // Evaluate pass/fail rules for Micro Edge here so service-side CSV can include flags
      try {
        const evalFlags = {};
        // batteryVoltage expected between 2.5 and 4.5
        const bv = this._parseVoltageValue(results.batteryVoltage);
        evalFlags.pass_battery = bv !== null && bv >= 2.5 && bv <= 4.5;

        // AIN thresholds (expected in volts after parsing)
        const a1 = this._parseVoltageValue(results.ain1Voltage);
        const a2 = this._parseVoltageValue(results.ain2Voltage);
        const a3 = this._parseVoltageValue(results.ain3Voltage);
        evalFlags.pass_ain1 = a1 !== null && a1 >= 1.4 && a1 <= 1.7;
        evalFlags.pass_ain2 = a2 !== null && a2 >= 0.75 && a2 <= 1.2;
        evalFlags.pass_ain3 = a3 !== null && a3 >= 0.5 && a3 <= 0.9;

        // pulses > 3
        const pulsesNum = parseInt(String(results.pulsesCounter || '').replace(/\D/g, ''), 10);
        evalFlags.pass_pulses = !Number.isNaN(pulsesNum) && pulsesNum > 3;

        // LoRa: valid address (8 hex chars) or contains 'detect', and raw push OK
        const loraDetectValue = String(results.loraDetect || '');
        const loraDetectOk = /detect/i.test(loraDetectValue) || /^[0-9a-f]{8}$/i.test(loraDetectValue);
        const loraPushOk = String(results.loraRawPush || '').toUpperCase() === 'OK';
        evalFlags.pass_lora = loraDetectOk && loraPushOk;

        // Attach flags into results for CSV saving
        results._eval = evalFlags;
      } catch (e) {
        console.warn('[Factory Testing] Failed to evaluate micro edge flags:', e && e.message);
      }

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
      const safeUnique = this._sanitizeFilename(uniqueId);
      const deviceFolder = path.join(deviceTypePath, safeUnique);
      
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

      // CSV filename with timestamp (use sanitized unique id for filenames)
      const csvFilename = `${safeUnique}_${timestamp}.csv`;
      const csvPath = path.join(deviceFolder, csvFilename);
      
      // Log filename with timestamp
      const logFilename = `${safeUnique}_${timestamp}.txt`;
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
      csvContent += `Device Info,FW Version,${deviceInfo.fwVersion}\n`;
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
        const acbTests = testResults.tests || {};
        const formatStatus = (res) => {
          if (!res) return 'N/A';
          const state = res.pass === true ? 'PASS' : res.pass === false ? 'FAIL' : 'N/A';
          const detail = res.message || res.raw || '';
          return detail ? `${state} (${detail})` : state;
        };
        csvContent += `Test Results,UART Loopback,${formatStatus(acbTests.uart)}\n`;
        csvContent += `Test Results,RTC Time,${acbTests.rtc ? (acbTests.rtc.time || formatStatus(acbTests.rtc)) : 'N/A'}\n`;
        csvContent += `Test Results,RTC Status,${formatStatus(acbTests.rtc)}\n`;
        csvContent += `Test Results,WiFi Networks,${acbTests.wifi && typeof acbTests.wifi.networks !== 'undefined' ? acbTests.wifi.networks : 'N/A'}\n`;
        csvContent += `Test Results,WiFi Connected,${acbTests.wifi && typeof acbTests.wifi.connected !== 'undefined' ? acbTests.wifi.connected : 'N/A'}\n`;
        csvContent += `Test Results,WiFi Status,${formatStatus(acbTests.wifi)}\n`;
        csvContent += `Test Results,ETH MAC,${acbTests.eth ? (acbTests.eth.mac || 'N/A') : 'N/A'}\n`;
        csvContent += `Test Results,ETH IP,${acbTests.eth ? (acbTests.eth.ip || 'N/A') : 'N/A'}\n`;
        csvContent += `Test Results,ETH Status,${formatStatus(acbTests.eth)}\n`;
        csvContent += `Test Results,RS485 Cycles,${acbTests.rs4852 && typeof acbTests.rs4852.cycles !== 'undefined' ? acbTests.rs4852.cycles : 'N/A'}\n`;
        csvContent += `Test Results,RS485 Failures,${acbTests.rs4852 && typeof acbTests.rs4852.failures !== 'undefined' ? acbTests.rs4852.failures : 'N/A'}\n`;
        csvContent += `Test Results,RS485 Status,${formatStatus(acbTests.rs4852)}\n`;
      }

      // ZC-LCD CSV entries
      if (device === 'ZC-LCD') {
        const zcTests = testResults.tests || {};
        const ta = testResults.testerAnnotations || {};
        const formatStatus = (res) => {
          if (!res) return 'N/A';
          const state = res.pass === true ? 'PASS' : res.pass === false ? 'FAIL' : 'N/A';
          const detail = res.message || res.raw || '';
          return detail ? `${state} (${detail})` : state;
        };
        csvContent += `Test Results,WiFi Networks,${zcTests.wifi && typeof zcTests.wifi.networks !== 'undefined' ? zcTests.wifi.networks : 'N/A'}\n`;
        csvContent += `Test Results,WiFi Connected,${zcTests.wifi && typeof zcTests.wifi.connected !== 'undefined' ? zcTests.wifi.connected : 'N/A'}\n`;
        csvContent += `Test Results,WiFi Status,${formatStatus(zcTests.wifi)}\n`;
        csvContent += `Test Results,RS485 Value,${zcTests.rs485 && typeof zcTests.rs485.value !== 'undefined' ? zcTests.rs485.value : 'N/A'}\n`;
        csvContent += `Test Results,RS485 Status,${formatStatus(zcTests.rs485)}\n`;
        csvContent += `Test Results,I2C Address,${zcTests.i2c ? (zcTests.i2c.i2cAddress || 'N/A') : 'N/A'}\n`;
        csvContent += `Test Results,I2C Temperature,${zcTests.i2c && typeof zcTests.i2c.temperature !== 'undefined' ? zcTests.i2c.temperature : 'N/A'}\n`;
        csvContent += `Test Results,I2C Humidity,${zcTests.i2c && typeof zcTests.i2c.humidity !== 'undefined' ? zcTests.i2c.humidity : 'N/A'}\n`;
        csvContent += `Test Results,I2C Status,${formatStatus(zcTests.i2c)}\n`;
        csvContent += `Test Results,LCD Status,${formatStatus(zcTests.lcd)}\n`;
        // Tester annotations
        csvContent += `Tester, LCD Outcome,${ta.lcdOutcome ? ta.lcdOutcome : 'N/A'}\n`;
        csvContent += `Tester, LCD Fail Reason,${ta.lcdFailReason ? ta.lcdFailReason : 'N/A'}\n`;
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
      logContent += `FW Version:        ${deviceInfo.fwVersion}\n`;
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
        const acbTests = testResults.tests || {};
        const statusToString = (res) => {
          if (!res) return 'N/A';
          const state = res.pass === true ? 'PASS' : res.pass === false ? 'FAIL' : 'N/A';
          return res.message ? `${state} - ${res.message}` : state;
        };
        logContent += `UART Loopback:     ${statusToString(acbTests.uart)}\n`;
        logContent += `RTC Time:          ${acbTests.rtc ? (acbTests.rtc.time || 'N/A') : 'N/A'}\n`;
        logContent += `RTC Status:        ${statusToString(acbTests.rtc)}\n`;
        logContent += `WiFi Networks:     ${acbTests.wifi && typeof acbTests.wifi.networks !== 'undefined' ? acbTests.wifi.networks : 'N/A'}\n`;
        logContent += `WiFi Connected:    ${acbTests.wifi && typeof acbTests.wifi.connected !== 'undefined' ? acbTests.wifi.connected : 'N/A'}\n`;
        logContent += `WiFi Status:       ${statusToString(acbTests.wifi)}\n`;
        logContent += `ETH MAC:           ${acbTests.eth ? (acbTests.eth.mac || 'N/A') : 'N/A'}\n`;
        logContent += `ETH IP:            ${acbTests.eth ? (acbTests.eth.ip || 'N/A') : 'N/A'}\n`;
        logContent += `ETH Status:        ${statusToString(acbTests.eth)}\n`;
        logContent += `RS485 Cycles:      ${acbTests.rs4852 && typeof acbTests.rs4852.cycles !== 'undefined' ? acbTests.rs4852.cycles : 'N/A'}\n`;
        logContent += `RS485 Failures:    ${acbTests.rs4852 && typeof acbTests.rs4852.failures !== 'undefined' ? acbTests.rs4852.failures : 'N/A'}\n`;
        logContent += `RS485 Status:      ${statusToString(acbTests.rs4852)}\n`;
      }
      // ZC-LCD log entries
      if (device === 'ZC-LCD') {
        const zcTests = testResults.tests || {};
        const ta = testResults.testerAnnotations || {};
        const statusToString = (res) => {
          if (!res) return 'N/A';
          const state = res.pass === true ? 'PASS' : res.pass === false ? 'FAIL' : 'N/A';
          return res.message ? `${state} - ${res.message}` : state;
        };
        logContent += `WiFi Networks:     ${zcTests.wifi && typeof zcTests.wifi.networks !== 'undefined' ? zcTests.wifi.networks : 'N/A'}\n`;
        logContent += `WiFi Connected:    ${zcTests.wifi && typeof zcTests.wifi.connected !== 'undefined' ? zcTests.wifi.connected : 'N/A'}\n`;
        logContent += `WiFi Status:       ${statusToString(zcTests.wifi)}\n`;
        logContent += `RS485 Value:       ${zcTests.rs485 && typeof zcTests.rs485.value !== 'undefined' ? zcTests.rs485.value : 'N/A'}\n`;
        logContent += `RS485 Status:      ${statusToString(zcTests.rs485)}\n`;
        logContent += `I2C Address:       ${zcTests.i2c ? (zcTests.i2c.i2cAddress || 'N/A') : 'N/A'}\n`;
        logContent += `I2C Temperature:   ${zcTests.i2c && typeof zcTests.i2c.temperature !== 'undefined' ? zcTests.i2c.temperature : 'N/A'}\n`;
        logContent += `I2C Humidity:      ${zcTests.i2c && typeof zcTests.i2c.humidity !== 'undefined' ? zcTests.i2c.humidity : 'N/A'}\n`;
        logContent += `I2C Status:        ${statusToString(zcTests.i2c)}\n`;
        logContent += `LCD Status:        ${statusToString(zcTests.lcd)}\n`;
        logContent += `LCD Outcome:       ${ta.lcdOutcome ? ta.lcdOutcome : 'N/A'}\n`;
        logContent += `LCD Fail Reason:   ${ta.lcdFailReason ? ta.lcdFailReason : 'N/A'}\n`;
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
          header += 'UART Loopback,RTC Time,RTC Status,WiFi Networks,WiFi Connected,WiFi Status,ETH MAC,ETH IP,ETH Status,RS485 Cycles,RS485 Failures,RS485 Status,Test Result\n';
        } else if (device === 'ZC-LCD') {
          header += 'WiFi Networks,WiFi Connected,WiFi Status,RS485 Value,RS485 Status,I2C Address,I2C Temperature,I2C Humidity,I2C Status,LCD Status,LCD Outcome,LCD Fail Reason,Test Result\n';
        } else if (device === 'Droplet') {
          header += 'Temperature,Humidity,Pressure,CO2,AIN 1 Voltage,AIN 2 Voltage,AIN 3 Voltage,LoRa Address,LoRa Detect,LoRa Raw Push,Test Result\n';
        } else {
          header += 'Battery Voltage,Pulses Counter,DIP Switches,AIN 1 Voltage,AIN 2 Voltage,AIN 3 Voltage,LoRa Address,LoRa Detect,LoRa Raw Push,Pass_Battery,Pass_AIN1,Pass_AIN2,Pass_AIN3,Pass_Pulses,Pass_LoRa,Test Result\n';
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
      } else if (device === 'ACB-M' || device === 'ZC-LCD') {
        const evalFlags = testResults && testResults._eval ? Object.values(testResults._eval) : [];
        if (!evalFlags.length || evalFlags.some(flag => flag !== true)) {
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
                  `${escapeCSV(deviceInfo.fwVersion)},` +
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
                  `${escapeCSV(testResults._eval?.pass_battery ? 'PASS' : 'FAIL')},` +
                  `${escapeCSV(testResults._eval?.pass_ain1 ? 'PASS' : 'FAIL')},` +
                  `${escapeCSV(testResults._eval?.pass_ain2 ? 'PASS' : 'FAIL')},` +
                  `${escapeCSV(testResults._eval?.pass_ain3 ? 'PASS' : 'FAIL')},` +
                  `${escapeCSV(testResults._eval?.pass_pulses ? 'PASS' : 'FAIL')},` +
                  `${escapeCSV(testResults._eval?.pass_lora ? 'PASS' : 'FAIL')},` +
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
                  `${escapeCSV(deviceInfo.fwVersion)},` +
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
        const acbTests = testResults.tests || {};
        const statusValue = (res) => {
          if (!res) return 'N/A';
          return res.pass === true ? 'PASS' : res.pass === false ? 'FAIL' : 'N/A';
        };
        csvLine += `${escapeCSV(timestamp)},` +
                  `${escapeCSV(preTesting?.testerName || 'N/A')},` +
                  `${escapeCSV(preTesting?.hardwareVersion || 'N/A')},` +
                  `${escapeCSV(preTesting?.batchId || 'N/A')},` +
                  `${escapeCSV(preTesting?.workOrderSerial || 'N/A')},` +
                  `${escapeCSV(version)},` +
                  `${escapeCSV(device)},` +
                  `${escapeCSV(deviceInfo.firmwareVersion)},` +
                  `${escapeCSV(deviceInfo.fwVersion)},` +
                  `${escapeCSV(deviceInfo.uniqueId)},` +
                  `${escapeCSV(deviceInfo.deviceMake)},` +
                  `${escapeCSV(deviceInfo.deviceModel)},` +
                  `${escapeCSV(statusValue(acbTests.uart))},` +
                  `${escapeCSV(acbTests.rtc ? (acbTests.rtc.time || 'N/A') : 'N/A')},` +
                  `${escapeCSV(statusValue(acbTests.rtc))},` +
                  `${escapeCSV(typeof acbTests.wifi?.networks !== 'undefined' ? acbTests.wifi.networks : 'N/A')},` +
                  `${escapeCSV(typeof acbTests.wifi?.connected !== 'undefined' ? acbTests.wifi.connected : 'N/A')},` +
                  `${escapeCSV(statusValue(acbTests.wifi))},` +
                  `${escapeCSV(acbTests.eth ? (acbTests.eth.mac || 'N/A') : 'N/A')},` +
                  `${escapeCSV(acbTests.eth ? (acbTests.eth.ip || 'N/A') : 'N/A')},` +
                  `${escapeCSV(statusValue(acbTests.eth))},` +
                  `${escapeCSV(typeof acbTests.rs4852?.cycles !== 'undefined' ? acbTests.rs4852.cycles : 'N/A')},` +
                  `${escapeCSV(typeof acbTests.rs4852?.failures !== 'undefined' ? acbTests.rs4852.failures : 'N/A')},` +
                  `${escapeCSV(statusValue(acbTests.rs4852))},` +
                  `${escapeCSV(testResult)}\n`;
      }
      else if (device === 'ZC-LCD') {
        const zcTests = testResults.tests || {};
        const ta = testResults.testerAnnotations || {};
        const statusValue = (res) => {
          if (!res) return 'N/A';
          return res.pass === true ? 'PASS' : res.pass === false ? 'FAIL' : 'N/A';
        };
        csvLine += `${escapeCSV(timestamp)},` +
                  `${escapeCSV(preTesting?.testerName || 'N/A')},` +
                  `${escapeCSV(preTesting?.hardwareVersion || 'N/A')},` +
                  `${escapeCSV(preTesting?.batchId || 'N/A')},` +
                  `${escapeCSV(preTesting?.workOrderSerial || 'N/A')},` +
                  `${escapeCSV(version)},` +
                  `${escapeCSV(device)},` +
                  `${escapeCSV(deviceInfo.firmwareVersion)},` +
                  `${escapeCSV(deviceInfo.fwVersion)},` +
                  `${escapeCSV(deviceInfo.uniqueId)},` +
                  `${escapeCSV(deviceInfo.deviceMake)},` +
                  `${escapeCSV(deviceInfo.deviceModel)},` +
                  `${escapeCSV(typeof zcTests.wifi?.networks !== 'undefined' ? zcTests.wifi.networks : 'N/A')},` +
                  `${escapeCSV(typeof zcTests.wifi?.connected !== 'undefined' ? zcTests.wifi.connected : 'N/A')},` +
                  `${escapeCSV(statusValue(zcTests.wifi))},` +
                  `${escapeCSV(typeof zcTests.rs485?.value !== 'undefined' ? zcTests.rs485.value : 'N/A')},` +
                  `${escapeCSV(statusValue(zcTests.rs485))},` +
                  `${escapeCSV(zcTests.i2c ? (zcTests.i2c.i2cAddress || 'N/A') : 'N/A')},` +
                  `${escapeCSV(typeof zcTests.i2c?.temperature !== 'undefined' ? zcTests.i2c.temperature : 'N/A')},` +
                  `${escapeCSV(typeof zcTests.i2c?.humidity !== 'undefined' ? zcTests.i2c.humidity : 'N/A')},` +
                  `${escapeCSV(statusValue(zcTests.i2c))},` +
                  `${escapeCSV(statusValue(zcTests.lcd))},` +
                  `${escapeCSV(ta.lcdOutcome || 'N/A')},` +
                  `${escapeCSV(ta.lcdFailReason || 'N/A')},` +
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
      baudRate: this.baudRate,
      autoNextEnabled: this.autoNextEnabled
    };
  }

  // --- ACB-M specific test methods ---
  async acbWifiTest() {
    try {
      this.updateProgress('ACB-M: Running WiFi test...');
      try {
        const r = await this.sendSerialCommand('test_wifi');
        return { success: true, data: r };
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
        const r = await this.sendSerialCommand('test_rs485');
        return { success: true, data: r };
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
        const r = await this.sendSerialCommand('test_rs485_2');
        return { success: true, data: r };
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
        const r = await this.sendSerialCommand('test_eth');
        return { success: true, data: r };
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
      try {
        const r = await this.sendSerialCommand('test_lora');
        return { success: true, data: r };
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
        const r = await this.sendSerialCommand('test_rtc');
        return { success: true, data: r };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async acbFullTest() {
    return this.runFactoryTests('ACB-M');
  }

  // --- ZC-LCD specific test methods ---
  async zcWifiTest() {
    try {
      this.updateProgress('ZC-LCD: Running WiFi test...');
      // Ensure we have device unique id via esptool if possible
      let uid = null;
      try {
        const mac = await this.readEsp32MAC(this.portPath);
        if (mac) uid = mac;
      } catch (e) {
        // ignore
      }

      try {
        const respObj = await this.awaitTestJSONResult('test_wifi', 10000);
        const norm = this._normalizeWifiResult(respObj);
        norm.uniqueId = uid;
        return norm;
      } catch (e) {
        return { success: false, error: e.message, uniqueId: uid };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async zcRs485Test() {
    try {
      this.updateProgress('ZC-LCD: Running RS485 test...');
      let uid = null;
      try { const mac = await this.readEsp32MAC(this.portPath); if (mac) uid = mac; } catch (e) {}

      try {
        const respObj = await this.awaitTestJSONResult('test_rs485', 10000);
        const norm = this._normalizeRs485Result(respObj);
        norm.uniqueId = uid;
        return norm;
      } catch (e) {
        return { success: false, error: e.message, uniqueId: uid };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async zcI2cTest() {
    try {
      this.updateProgress('ZC-LCD: Running I2C test...');
      let uid = null;
      try { const mac = await this.readEsp32MAC(this.portPath); if (mac) uid = mac; } catch (e) {}

      try {
        const respObj = await this.awaitTestJSONResult('test_i2c', 10000);
        const norm = this._normalizeI2cResult(respObj);
        norm.uniqueId = uid;
        return norm;
      } catch (e) {
        return { success: false, error: e.message, uniqueId: uid };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // LCD test method removed (firmware unsupported)

  async zcFullTest() {
    try {
      this.updateProgress('ZC-LCD: Running FULL test...');
      const results = {};
      try {
        const w = await this.awaitTestJSONResult('test_wifi', 10000);
        results.wifi = this._normalizeWifiResult(w);
      } catch (e) { results.wifi = { success: false, error: e.message }; }

      try {
        const i = await this.awaitTestJSONResult('test_i2c', 10000);
        results.i2c = this._normalizeI2cResult(i);
      } catch (e) { results.i2c = { success: false, error: e.message }; }

      try {
        const r = await this.awaitTestJSONResult('test_rs485', 10000);
        results.rs485 = this._normalizeRs485Result(r);
      } catch (e) { results.rs485 = { success: false, error: e.message }; }

      this.updateProgress('ZC-LCD FULL test completed');
      return { success: true, data: results };
    } catch (error) {
      console.error('[Factory Testing] ZC-LCD full test error:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== ZC-Controller RS485 info (no AT, no esptool) =====
  async readZCControllerInfo() {
    try {
      const info = {};

      // Decode helpers based on provided structure:
      // Addr | Func(0x03) | ByteCount(N*2) | [Hi Lo]*N | CRCLo | CRCHi
      const parseAscii = (rxHex, expectedLenBytes) => {
        const hex = String(rxHex || '').trim().replace(/\s+/g, '').toUpperCase();
        if (hex.length < 8) return 'ERROR';
        const buf = Buffer.from(hex, 'hex');
        const byteCount = buf[2];
        const dataLen = Math.min(byteCount, expectedLenBytes);
        const data = buf.slice(3, 3 + dataLen);
        return data.toString('ascii').trim();
      };
      const parseUID = (rxHex) => {
        const hex = String(rxHex || '').trim().replace(/\s+/g, '').toUpperCase();
        const buf = Buffer.from(hex, 'hex');
        if (buf.length < 3 + 12) return { rawHex: 'ERROR', short: 'ERROR' };
        const data = buf.slice(3, 15); // 12 bytes UID
        const rawHex = data.toString('hex').toUpperCase();
        // Create a compact display: last 8 hex chars (4 bytes) for brevity
        const short = rawHex.slice(-8);
        return { rawHex, short };
      };

      // Use exact commands with CRC from your spec/logs
      const CMD_UID = '01 03 00 00 00 06 C5 C8';
      // Corrected quantities + CRCs per request
      const CMD_MODEL = '01 03 00 13 00 02 35 CE';
      const CMD_MAKE = '01 03 00 1D 00 07 94 0E';
      const CMD_FW = '01 03 00 31 00 02 95 C4';

      // Send and log each frame
      try {
        const rx = await this.sendRs485Hex(CMD_UID);
        console.log('[RS485] 000-Tx:', CMD_UID);
        console.log('[RS485] 001-Rx:', rx);
        const uid = parseUID(rx);
        info.uniqueId = uid.rawHex;
        info.uniqueIdShort = uid.short;
      } catch (e) { info.uniqueId = 'ERROR'; }
      await new Promise(res => setTimeout(res, 100));

      try {
        const rx = await this.sendRs485Hex(CMD_MODEL);
        console.log('[RS485] 002-Tx:', CMD_MODEL);
        console.log('[RS485] 003-Rx:', rx);
        info.deviceModel = parseAscii(rx, 4); // e.g., '1.0'
      } catch (e) { info.deviceModel = 'ERROR'; }
      await new Promise(res => setTimeout(res, 100));

      try {
        const rx = await this.sendRs485Hex(CMD_MAKE);
        console.log('[RS485] 004-Tx:', CMD_MAKE);
        console.log('[RS485] 005-Rx:', rx);
        info.deviceMake = parseAscii(rx, 14); // 'ZC-Controller'
      } catch (e) { info.deviceMake = 'ERROR'; }
      await new Promise(res => setTimeout(res, 100));

      try {
        const rx = await this.sendRs485Hex(CMD_FW);
        console.log('[RS485] 006-Tx:', CMD_FW);
        console.log('[RS485] 007-Rx:', rx);
        info.firmwareVersion = parseAscii(rx, 4); // '1.0'
      } catch (e) { info.firmwareVersion = 'ERROR'; }

      return { success: true, data: info };
    } catch (error) {
      console.error('[Factory Testing] Error reading ZC-Controller info:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send RS485 raw hex string (space-separated) and return response as uppercase spaced hex.
   */
  async sendRs485Hex(hexStr) {
    if (!this.port || !this.isConnected) throw new Error('Not connected');
    const bytes = hexStr.trim().split(/\s+/).map(h => parseInt(h, 16));
    const buf = Buffer.from(bytes);
    return new Promise((resolve, reject) => {
      const toUpperHexSpaced = (buffer) => Array.from(buffer).map(v => v.toString(16).toUpperCase().padStart(2,'0')).join(' ');
      let accum = Buffer.alloc(0);
      let settleTimer = null;
      let timeout = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (settleTimer) clearTimeout(settleTimer);
        this.port.removeListener('data', onRaw);
      };

      const finish = () => {
        cleanup();
        const rx = toUpperHexSpaced(accum);
        console.log('[RS485] RX:', rx);
        resolve(rx);
      };

      const onRaw = (data) => {
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
        accum = Buffer.concat([accum, chunk]);
        // settle briefly to allow complete frame to arrive
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => finish(), 50);
      };

      // Listen to raw port bytes (not line parser) to avoid UTF-8 mangling and interleaving
      this.port.on('data', onRaw);
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout waiting for RS485 response'));
      }, 3000);

      console.log('[RS485] TX:', hexStr);
      this.port.write(buf, (err) => {
        if (err) {
          cleanup();
          reject(new Error('Failed to send RS485 frame: ' + err.message));
        }
      });
    });
  }

}

module.exports = FactoryTestingService;
