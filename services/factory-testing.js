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
    this.portPath = '';
    this.baudRate = 115200;
    this.commandTimeout = 5000; // 5 seconds timeout for AT commands
    this.progressCallback = null;
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
  async connect(portPath, baudRate = 115200, useUnlock = true) {
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

      // If device is non-AT, attempt to read MAC via esptool BEFORE opening the serial port
      let preDeviceInfo = null;
      if (!useUnlock) {
        try {
          console.log('[Factory Testing Service] Attempting to read MAC via esptool before opening port...');
          console.log('[Factory Testing Service] Platform:', process.platform);
          console.log('[Factory Testing Service] esptool attempt port:', this.portPath);
          const espMac = await this.readEsp32MAC(this.portPath);
          console.log('[Factory Testing Service] esptool returned MAC:', espMac);
          if (espMac) preDeviceInfo = { uniqueId: espMac };
        } catch (e) {
          console.warn('[Factory Testing Service] esptool read before open failed:', e.message);
          // continue, we'll try fallback later
        }
      }

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
        // If we previously read MAC before opening port, reuse it
        if (preDeviceInfo) {
          deviceInfo = preDeviceInfo;
        } else if (useUnlock) {
          // Micro Edge / AT-based devices: do NOT attempt esptool (it will conflict with the open port).
          // Simply read device info via AT commands.
          try {
            const infoRes = await this.readDeviceInfo();
            if (infoRes.success) deviceInfo = infoRes.data;
          } catch (err) {
            console.warn('[Factory Testing Service] readDeviceInfo failed for AT device:', err.message);
          }
        } else {
          // Non-AT devices: Prefer reading MAC using bundled esptool if available (will try with port open)
          try {
            const espMac = await this.readEsp32MAC(this.portPath);
            if (espMac) {
              deviceInfo = { uniqueId: espMac };
            }
          } catch (e) {
            console.warn('[Factory Testing Service] esptool read after open failed:', e.message);
            // fallback to AT-based readDeviceInfo
            try {
              const infoRes = await this.readDeviceInfo();
              if (infoRes.success) deviceInfo = infoRes.data;
            } catch (err) {
              console.warn('[Factory Testing Service] readDeviceInfo fallback failed:', err.message);
            }
          }
        }
      } catch (e) {
        console.warn('[Factory Testing Service] Failed to read device info after connect:', e.message);
      }

      console.log('[Factory Testing Service] === END CONNECT (SUCCESS) ===');
      return { success: true, port: portPath, baudRate: baudRate, deviceInfo };
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

        // Prefer reading unique ID via esptool
        this.updateProgress('Reading device unique ID (MAC) via esptool...');
        try {
          const mac = await this.readEsp32MAC(this.portPath);
          results.uniqueId = mac || null;
        } catch (e) {
          results.uniqueId = null;
        }

        // 1. WiFi test
        this.updateProgress('Running WiFi test...');
        try {
          const respObj = await this.awaitTestJSONResult('test_wifi', 10000);
          results.wifi = respObj;
        } catch (e) {
          results.wifi = { success: false, error: e.message };
        }

        // 2. I2C test (temp/humidity)
        this.updateProgress('Running I2C (Temp/Humidity) test...');
        try {
          const respObj = await this.awaitTestJSONResult('test_i2c', 10000);
          results.i2c = respObj;
        } catch (e) {
          results.i2c = { success: false, error: e.message };
        }

        // 3. LCD display test removed (firmware unsupported)

        // 4. RS485 test
        this.updateProgress('Running RS485 test...');
        try {
          const respObj = await this.awaitTestJSONResult('test_rs485', 10000);
          results.rs485 = respObj;
        } catch (e) {
          results.rs485 = { success: false, error: e.message };
        }

        // Duplicate LCD test block removed

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

        // LoRa: detected and raw push OK
        const loraDetectOk = typeof results.loraDetect === 'string' && /detect/i.test(results.loraDetect);
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
    try {
      this.updateProgress('ACB-M: Running FULL test...');
      const results = {};
      // Run sequence of subtests
      try {
        const v = await this.sendSerialCommand('test_vcc');
        results.vccVoltage = v;
      } catch (e) { results.vccVoltage = 'ERROR'; }

      try {
        const r1 = await this.sendSerialCommand('test_relay1');
        results.relay1Status = r1;
      } catch (e) { results.relay1Status = 'ERROR'; }
      try {
        const r2 = await this.sendSerialCommand('test_relay2');
        results.relay2Status = r2;
      } catch (e) { results.relay2Status = 'ERROR'; }

      try {
        const di = await this.sendSerialCommand('test_digitals');
        results.digitalInputs = di;
      } catch (e) { results.digitalInputs = 'ERROR'; }

      try {
        const a1 = await this.sendSerialCommand('test_ain1');
        results.ain1Voltage = a1;
      } catch (e) { results.ain1Voltage = 'ERROR'; }

      try {
        const a2 = await this.sendSerialCommand('test_ain2');
        results.ain2Voltage = a2;
      } catch (e) { results.ain2Voltage = 'ERROR'; }

      try {
        const l = await this.sendSerialCommand('test_lora');
        results.loraRawPush = l;
      } catch (e) { results.loraRawPush = 'ERROR'; }

      this.updateProgress('ACB-M FULL test completed');
      return { success: true, data: results };
    } catch (error) {
      console.error('[Factory Testing] ACB-M full test error:', error);
      return { success: false, error: error.message };
    }
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
}

module.exports = FactoryTestingService;
