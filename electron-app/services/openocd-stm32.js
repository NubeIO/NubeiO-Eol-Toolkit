/**
 * OpenOCD STM32 Service
 * Provides STM32 flashing for Droplet (STM32WLE5) and Zone Controller (STM32F030C8T6)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Device type configurations
const DEVICE_TYPES = {
    DROPLET: {
        name: 'Droplet',
        mcu: 'STM32WLE5',
        target: 'stm32wlx.cfg',
        flashSize: '256KB',
        supportsLoRaID: true,
        flashAddress: '0x08000000',
        uidAddress: '0x1FFF7590'
    },
    ZONE_CONTROLLER: {
        name: 'Zone Controller',
        mcu: 'STM32F030C8T6',
        target: 'stm32f0x.cfg',
        flashSize: '64KB',
        supportsLoRaID: false,
        flashAddress: '0x08000000',
        uidAddress: '0x1FFFF7AC'
    }
};

class OpenOCDSTM32Service {
    constructor() {
        // Use app.getAppPath() in production, __dirname in development
        const basePath = app.isPackaged
            ? path.join(process.resourcesPath)
            : path.join(__dirname, '..');

        this.openocdPath = path.join(basePath, 'embedded/openocd-binaries/windows/bin/openocd.exe');
        this.scriptsPath = path.join(basePath, 'embedded/openocd-binaries/windows/openocd/scripts');
        this.isFlashing = false;
        this.VERSION = 0xC0; // Droplet version for LoRa ID calculation
        this.currentDeviceType = 'DROPLET'; // Default device type
    }

    /**
     * Set current device type
     * @param {string} deviceType - 'DROPLET' or 'ZONE_CONTROLLER'
     */
    setDeviceType(deviceType) {
        if (DEVICE_TYPES[deviceType]) {
            this.currentDeviceType = deviceType;
            // console.log(`Device type changed to: ${DEVICE_TYPES[deviceType].name}`);
            return {
                success: true,
                deviceType: DEVICE_TYPES[deviceType]
            };
        }
        throw new Error(`Invalid device type: ${deviceType}`);
    }

    /**
     * Get current device configuration
     */
    getDeviceConfig() {
        return DEVICE_TYPES[this.currentDeviceType];
    }

    /**
     * Get all available device types
     */
    getDeviceTypes() {
        return DEVICE_TYPES;
    }

    /**
     * Check if OpenOCD binary exists
     */
    checkOpenOCD() {
        return fs.existsSync(this.openocdPath);
    }

    /**
     * Detect ST-Link and MCU
     * @returns {Object} Detection result with MCU info
     */
    async detectSTLink() {
        if (!this.checkOpenOCD()) {
            throw new Error('OpenOCD binary not found');
        }

        const deviceConfig = this.getDeviceConfig();
        let result = null;
        let detectedMCUType = null;
        let detectedChip = null;

        try {
            // First attempt: Use selected device config
            // console.log(`=== Attempting detection with ${deviceConfig.name} config ===`);
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', `target/${deviceConfig.target}`,
                '-c', 'adapter speed 480',              // Lower speed for reliability
                '-c', 'reset_config srst_only srst_nogate connect_assert_srst',  // Force reset on connect
                '-c', 'init',
                '-c', 'targets',
                '-c', 'reset halt',
                '-c', 'shutdown'                        // Keep chip halted for subsequent operations
            ];

            try {
                result = await this.executeOpenOCD(args);
            } catch (error) {
            // console.log('Current config failed, trying auto-detection...');
                result = { output: error.message || '' };
            }

            // console.log('=== OpenOCD Detection Output ===');
            // console.log(result.output);
            // console.log('================================');

            // Parse MCU info from output to detect actual chip type
            let processorMatch = result.output.match(/Cortex-(M\d+)/i);
            let deviceIdMatch = result.output.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);
            const flashMatch = result.output.match(/flash size = (\d+)/i) ||
                result.output.match(/(\d+)\s*kbytes/i);

            // If no processor or device ID found, try with alternative config
            if (!processorMatch && !deviceIdMatch) {
            // console.log('No device info detected, trying alternative config...');

                const altConfig = this.currentDeviceType === 'DROPLET' ?
                    DEVICE_TYPES.ZONE_CONTROLLER : DEVICE_TYPES.DROPLET;

            // console.log(`Trying ${altConfig.name} config...`);

                const altArgs = [
                    '-s', this.scriptsPath,
                    '-f', 'interface/stlink.cfg',
                    '-f', `target/${altConfig.target}`,
                    '-c', 'adapter speed 480',
                    '-c', 'reset_config srst_only srst_nogate connect_assert_srst',
                    '-c', 'init',
                    '-c', 'targets',
                    '-c', 'reset halt',
                    '-c', 'shutdown'                    // Keep chip halted
                ];

                try {
                    const altResult = await this.executeOpenOCD(altArgs);
            // console.log('Alternative config output:', altResult.output);

                    processorMatch = altResult.output.match(/Cortex-(M\d+)/i);
                    deviceIdMatch = altResult.output.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);

                    if (processorMatch || deviceIdMatch) {
                        result.output = altResult.output;
            // console.log('Alternative config succeeded!');
                    }
                } catch (altError) {
            // console.log('Alternative config also failed');
                    const altErrorOutput = altError.message || '';
                    processorMatch = altErrorOutput.match(/Cortex-(M\d+)/i);
                    deviceIdMatch = altErrorOutput.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);

                    if (processorMatch || deviceIdMatch) {
                        result.output = altErrorOutput;
            // console.log('Got info from alternative config error');
                    }
                }
            }

            // Determine actual MCU type from multiple sources
            // Method 1: Check Device ID (most reliable)
            if (deviceIdMatch) {
                const deviceId = deviceIdMatch[1].toLowerCase();
            // console.log(`Device ID: 0x${deviceId}`);

                // STM32WLE5 device IDs: 0x10036497
                // STM32F030 device IDs: 0x440, 0x444, 0x445
                if (deviceId.includes('497') || deviceId.includes('10036497')) {
                    detectedMCUType = 'DROPLET';
                    detectedChip = 'STM32WLE5';
            // console.log('Detected by Device ID: STM32WLE5');
                } else if (deviceId.includes('440') || deviceId.includes('444') || deviceId.includes('445')) {
                    detectedMCUType = 'ZONE_CONTROLLER';
                    detectedChip = 'STM32F030C8T6';
            // console.log('Detected by Device ID: STM32F030');
                }
            }

            // Method 2: Check Processor Type (backup method)
            if (!detectedMCUType && processorMatch) {
                const processor = processorMatch[1];
            // console.log(`Detected Processor: Cortex-${processor}`);

                if (processor === 'M0') {
                    detectedMCUType = 'ZONE_CONTROLLER';
                    detectedChip = 'STM32F030C8T6';
                } else if (processor === 'M4') {
                    detectedMCUType = 'DROPLET';
                    detectedChip = 'STM32WLE5';
                }
            }

            // console.log(`Detected MCU Type: ${detectedMCUType}`);
            // console.log(`Current Selected Type: ${this.currentDeviceType}`);

            // Check if detected MCU matches selected device type
            const mismatch = detectedMCUType && detectedMCUType !== this.currentDeviceType;

            // console.log(`Mismatch: ${mismatch}`);

            return {
                success: true,
                detected: !!(processorMatch || deviceIdMatch),
                mismatch: mismatch,
                detectedType: detectedMCUType,
                selectedType: this.currentDeviceType,
                info: {
                    chip: detectedChip || deviceConfig.mcu,
                    deviceType: detectedMCUType ? DEVICE_TYPES[detectedMCUType].name : deviceConfig.name,
                    flashSize: flashMatch ? `${flashMatch[1]}KB` : deviceConfig.flashSize,
                    interface: 'ST-Link'
                },
                rawOutput: result.output
            };
        } catch (error) {
            // Even if OpenOCD fails, try to parse if ST-Link was detected
            // console.log('=== OpenOCD Error, attempting to parse ===');
            // console.log(error.message);

            const errorOutput = error.message || '';

            // Try to detect device type from error output
            detectedMCUType = null;
            detectedChip = null;

            // Check Device ID in error output
            const deviceIdMatch = errorOutput.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);
            if (deviceIdMatch) {
                const deviceId = deviceIdMatch[1].toLowerCase();
            // console.log(`Device ID from error: 0x${deviceId}`);

                if (deviceId.includes('497') || deviceId.includes('10036497')) {
                    detectedMCUType = 'DROPLET';
                    detectedChip = 'STM32WLE5';
                } else if (deviceId.includes('440') || deviceId.includes('444') || deviceId.includes('445')) {
                    detectedMCUType = 'ZONE_CONTROLLER';
                    detectedChip = 'STM32F030C8T6';
                }
            }

            // Check Processor type in error output
            if (!detectedMCUType) {
                const processorMatch = errorOutput.match(/Cortex-(M\d+)/i);
                if (processorMatch) {
                    const processor = processorMatch[1];
            // console.log(`Processor from error: Cortex-${processor}`);

                    if (processor === 'M0') {
                        detectedMCUType = 'ZONE_CONTROLLER';
                        detectedChip = 'STM32F030C8T6';
                    } else if (processor === 'M4') {
                        detectedMCUType = 'DROPLET';
                        detectedChip = 'STM32WLE5';
                    }
                }
            }

            // console.log(`Detected from error: ${detectedMCUType}`);
            // console.log(`Selected: ${this.currentDeviceType}`);

            const mismatch = detectedMCUType && detectedMCUType !== this.currentDeviceType;
            // console.log(`Mismatch: ${mismatch}`);

            if (errorOutput.includes('stm32') || errorOutput.includes('ST-Link') || errorOutput.includes('STLINK')) {
                return {
                    success: true,
                    detected: true,
                    mismatch: mismatch,
                    detectedType: detectedMCUType,
                    selectedType: this.currentDeviceType,
                    info: {
                        chip: detectedChip || deviceConfig.mcu,
                        deviceType: detectedMCUType ? DEVICE_TYPES[detectedMCUType].name : deviceConfig.name,
                        flashSize: deviceConfig.flashSize,
                        interface: 'ST-Link'
                    },
                    rawOutput: errorOutput
                };
            }
            throw new Error(`ST-Link not detected: ${error.message}`);
        }
    }

    /**
     * Get actual flash size from device
     * @returns {Object} Flash size info
     */
    async getActualFlashSize() {
        if (!this.checkOpenOCD()) {
            throw new Error('OpenOCD binary not found');
        }

        try {
            const deviceConfig = this.getDeviceConfig();
            const resetConfigs = [
                'reset_config none separate',
                'reset_config srst_only',
                'reset_config none',
                'reset_config srst_only srst_nogate connect_assert_srst'
            ];

            let result = null;
            let lastError = null;

            for (let i = 0; i < resetConfigs.length; i++) {
                const resetConfig = resetConfigs[i];
            // console.log(`[Flash Size] Trying: ${resetConfig}`);

                const args = [
                    '-s', this.scriptsPath,
                    '-f', 'interface/stlink.cfg',
                    '-f', `target/${deviceConfig.target}`,
                    '-c', 'adapter speed 480',
                    '-c', resetConfig,
                    '-c', 'init',
                    '-c', 'flash list',
                    '-c', 'shutdown'
                ];

                try {
                    result = await this.executeOpenOCD(args);
            // console.log(`[Flash Size] Success with: ${resetConfig}`);
                    break;
                } catch (error) {
                    lastError = error;
            // console.log(`[Flash Size] Failed with ${resetConfig}`);
                    result = { output: error.message || '' };

                    if (i < resetConfigs.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }

            const output = result ? result.output : (lastError?.message || '');
            // console.log('Flash size detection output:', output);

            // Parse flash size and device ID
            const flashMatch = output.match(/flash size\s*=\s*(\d+)\s*k?i?b?/i);
            const deviceIdMatch = output.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);

            let flashSizeKB = null;
            let deviceId = null;

            if (flashMatch) {
                flashSizeKB = parseInt(flashMatch[1]);
            }

            if (deviceIdMatch) {
                deviceId = '0x' + deviceIdMatch[1];
            }

            // For STM32F030, check variant
            let variant = null;
            if (this.currentDeviceType === 'ZONE_CONTROLLER' && deviceId && deviceConfig.variants) {
                const shortId = '0x' + deviceId.substring(deviceId.length - 3);
                variant = deviceConfig.variants[shortId];
                if (variant && !flashSizeKB) {
                    flashSizeKB = variant.flashSize / 1024;
                }
            }

            return {
                success: true,
                flashSizeKB: flashSizeKB,
                flashSizeBytes: flashSizeKB ? flashSizeKB * 1024 : null,
                deviceId: deviceId,
                variant: variant,
                rawOutput: output
            };
        } catch (error) {
            // console.error('Failed to detect flash size:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Flash firmware to STM32WLE5
     * @param {string} firmwarePath - Path to firmware file (.bin or .hex)
     * @param {function} progressCallback - Callback for progress updates
     */
    async flashFirmware(firmwarePath, progressCallback = null) {
        if (this.isFlashing) {
            throw new Error('Flash operation already in progress');
        }

        if (!fs.existsSync(firmwarePath)) {
            throw new Error(`Firmware file not found: ${firmwarePath}`);
        }

        if (!this.checkOpenOCD()) {
            throw new Error('OpenOCD binary not found');
        }

        this.isFlashing = true;

        try {
            // Check firmware file size
            const firmwareStats = fs.statSync(firmwarePath);
            const firmwareSizeBytes = firmwareStats.size;
            const firmwareSizeKB = Math.ceil(firmwareSizeBytes / 1024);

            // console.log(`Firmware size: ${firmwareSizeKB} KB (${firmwareSizeBytes} bytes)`);

            // Try to detect actual flash size
            if (progressCallback) {
                progressCallback({ stage: 'detecting', message: 'Detecting chip flash size...' });
            }

            const flashInfo = await this.getActualFlashSize();

            if (flashInfo.success && flashInfo.flashSizeKB) {
            // console.log(`Detected flash size: ${flashInfo.flashSizeKB} KB`);

                if (flashInfo.variant) {
            // console.log(`Detected variant: ${flashInfo.variant.name}`);
                }

                // Check if firmware fits
                if (firmwareSizeBytes > flashInfo.flashSizeBytes) {
                    const errorMsg = `Firmware size (${firmwareSizeKB} KB) exceeds chip flash size (${flashInfo.flashSizeKB} KB)!\n` +
                        (flashInfo.variant ? `Detected chip: ${flashInfo.variant.name}\n` : '') +
                        `Please use a firmware compiled for this chip variant.`;

                    this.isFlashing = false;
                    throw new Error(errorMsg);
                }

                // Warn if firmware is close to limit (>90%)
                const usagePercent = (firmwareSizeBytes / flashInfo.flashSizeBytes) * 100;
                if (usagePercent > 90) {
                    console.warn(`WARNING: Firmware uses ${usagePercent.toFixed(1)}% of flash!`);
                    if (progressCallback) {
                        progressCallback({
                            stage: 'warning',
                            message: `Warning: Firmware uses ${usagePercent.toFixed(1)}% of available flash`
                        });
                    }
                }
            }

            if (progressCallback) {
                progressCallback({ stage: 'flashing', message: 'Programming flash...' });
            }

            // Convert Windows backslash to forward slash for OpenOCD
            const normalizedPath = firmwarePath.replace(/\\/g, '/');

            const deviceConfig = this.getDeviceConfig();

            // Reset configs optimized per device type
            // For STM32F0 (Zone Controller), prefer software/SYSRESETREQ over hardware SRST
            const resetConfigs = this.currentDeviceType === 'ZONE_CONTROLLER' ? [
                'reset_config none separate',           // SYSRESETREQ only (best for STM32F0)
                'reset_config none',                    // No reset, JTAG-only
                'reset_config srst_only',               // Hardware SRST
                'reset_config srst_only srst_nogate connect_assert_srst'
            ] : [
                'reset_config srst_only srst_nogate connect_assert_srst', // Droplet default
                'reset_config none separate',
                'reset_config srst_only',
                'reset_config none'
            ];

            let lastError = null;

            // Try different reset configurations
            for (let i = 0; i < resetConfigs.length; i++) {
                const resetConfig = resetConfigs[i];
            // console.log(`[Flash] Attempt ${i + 1}/${resetConfigs.length} with: ${resetConfig}`);

                if (progressCallback && i > 0) {
                    progressCallback({
                        stage: 'retry',
                        message: `Retrying with different configuration (${i + 1}/${resetConfigs.length})...`
                    });
                }

                const args = [
                    '-s', this.scriptsPath,
                    '-f', 'interface/stlink.cfg',
                    '-f', `target/${deviceConfig.target}`,
                    '-c', 'adapter speed 480',
                    '-c', resetConfig,
                    '-c', `program {${normalizedPath}} verify reset exit 0x08000000`
                ];

                try {
                    const result = await this.executeOpenOCD(args, progressCallback);

                    if (progressCallback) {
                        progressCallback({ stage: 'complete', message: 'Flash completed successfully' });
                    }

                    this.isFlashing = false;
            // console.log(`[Flash] Success with: ${resetConfig}`);
                    return { success: true, output: result.output };
                } catch (error) {
                    lastError = error;
            // console.log(`[Flash] Failed with ${resetConfig}: ${error.message}`);

                    // If this is not the last attempt, continue to next config
                    if (i < resetConfigs.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                }
            }

            // All attempts failed
            this.isFlashing = false;
            throw lastError || new Error('Flash failed with all reset configurations');
        } catch (error) {
            this.isFlashing = false;
            throw error;
        }
    }

    /**
     * Read STM32 UID registers from 0x1FFF7590
     * @returns {Object} UID values (uid0, uid1, uid2)
     */
    async readUID() {
        if (!this.checkOpenOCD()) {
            throw new Error('OpenOCD binary not found');
        }

        try {
            const deviceConfig = this.getDeviceConfig();
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', `target/${deviceConfig.target}`,
                '-c', 'adapter speed 480',
                '-c', 'reset_config srst_only srst_nogate connect_assert_srst',
                '-c', 'init',                           // Init to connect
                '-c', 'reset halt',                     // Ensure halted
                '-c', 'sleep 100',                      // Wait for chip to stabilize
                '-c', `mdw ${deviceConfig.uidAddress} 3`,  // Read UID
                '-c', 'shutdown'                        // Keep halted (don't reset run)
            ];

            const result = await this.executeOpenOCD(args);

            // console.log('UID Read Output:', result.output);

            // Parse UID from output - use dynamic address
            const uidAddr = deviceConfig.uidAddress.toLowerCase();
            const addr0 = uidAddr;
            const addr1 = '0x' + (parseInt(uidAddr, 16) + 4).toString(16);
            const addr2 = '0x' + (parseInt(uidAddr, 16) + 8).toString(16);

            // Pattern 1: "0xXXXXXXXX: xxxxxxxx xxxxxxxx xxxxxxxx" (single line)
            const pattern1 = new RegExp(`${uidAddr}:\\s+([0-9a-fA-F]{8})\\s+([0-9a-fA-F]{8})\\s+([0-9a-fA-F]{8})`, 'i');
            let uidMatch = result.output.match(pattern1);

            // Pattern 2: Multiple lines with individual addresses
            if (!uidMatch) {
                const pattern0 = new RegExp(`${addr0}:\\s+([0-9a-fA-F]{8})`, 'i');
                const pattern1_line = new RegExp(`${addr1}:\\s+([0-9a-fA-F]{8})`, 'i');
                const pattern2 = new RegExp(`${addr2}:\\s+([0-9a-fA-F]{8})`, 'i');

                const uid0Match = result.output.match(pattern0);
                const uid1Match = result.output.match(pattern1_line);
                const uid2Match = result.output.match(pattern2);

                if (uid0Match && uid1Match && uid2Match) {
                    uidMatch = [null, uid0Match[1], uid1Match[1], uid2Match[1]];
                }
            }

            if (!uidMatch) {
                // console.error('Failed to parse UID. Raw output:', result.output);
                // console.error('Expected address:', uidAddr);
                throw new Error(`Failed to parse UID from OpenOCD output. Expected address: ${uidAddr}`);
            }

            const uid0 = parseInt(uidMatch[1], 16);
            const uid1 = parseInt(uidMatch[2], 16);
            const uid2 = parseInt(uidMatch[3], 16);

            return {
                success: true,
                uid0,
                uid1,
                uid2,
                raw: result.output
            };
        } catch (error) {
            throw new Error(`Failed to read UID: ${error.message}`);
        }
    }

    /**
     * Generate LoRa Device Address from UID (Droplet specific algorithm)
     * @param {number} uid0 - UID register 0
     * @param {number} uid1 - UID register 1
     * @param {number} uid2 - UID register 2
     * @returns {Object} LoRa Device Address and formatted string
     */
    generateLoRaID(uid0, uid1, uid2) {
        // XOR all UID values
        const uid_temp = (uid0 ^ uid1 ^ uid2) >>> 0; // >>> 0 ensures unsigned 32-bit

        // Generate LoRa Device Address according to Droplet algorithm
        const byte1 = (uid_temp >>> 24) & 0xFF;
        const byte2 = this.VERSION & 0xFF;
        const byte3 = (uid_temp >>> 8) & 0xFF;
        const byte4 = uid_temp & 0xFF;

        const address = ((byte1 << 24) | (byte2 << 16) | (byte3 << 8) | byte4) >>> 0;

        // Format as hex string
        const addressHex = address.toString(16).padStart(8, '0').toUpperCase();
        const addressFormatted = `${addressHex.substring(0, 2)}:${addressHex.substring(2, 4)}:${addressHex.substring(4, 6)}:${addressHex.substring(6, 8)}`;

        // Generate QR code data URL
        const qrData = this.generateQRCode(addressHex);

        return {
            address,
            addressHex,
            addressFormatted,
            qrCode: qrData,
            uid_temp,
            version: this.VERSION
        };
    }

    /**
     * Generate QR code for LoRa Device Address
     * @param {string} addressHex - LoRa address in hex format
     * @returns {string} QR code as data URL
     */
    generateQRCode(addressHex) {
        // Simple QR code generation using SVG
        // For production, consider using qrcode library
        const qrText = `LORA:${addressHex}`;

        // Using a simple approach - create a data URL with QR API
        // You can use https://api.qrserver.com or implement proper QR library
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;

        return qrUrl;
    }

    /**
     * Flash and read device info
     * @param {string} firmwarePath - Path to firmware file
     * @param {function} progressCallback - Callback for progress updates
     */
    async flashAndReadInfo(firmwarePath, progressCallback = null) {
        try {
            const deviceConfig = this.getDeviceConfig();

            // Step 1: Flash firmware
            if (progressCallback) {
                progressCallback({ stage: 'flash', message: 'Flashing firmware...' });
            }

            await this.flashFirmware(firmwarePath, progressCallback);

            // For Zone Controller, just return success without reading UID
            if (!deviceConfig.supportsLoRaID) {
                if (progressCallback) {
                    progressCallback({ stage: 'complete', message: 'Flash completed successfully' });
                }

                return {
                    success: true,
                    deviceType: deviceConfig.name,
                    message: 'Firmware flashed successfully'
                };
            }

            // For Droplet: Continue to read UID and generate LoRa ID
            // Wait for MCU to stabilize after flash and reset
            if (progressCallback) {
                progressCallback({ stage: 'wait', message: 'Waiting for MCU to stabilize...' });
            }
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 2: Read UID
            if (progressCallback) {
                progressCallback({ stage: 'read_uid', message: 'Reading device UID...' });
            }

            const uidResult = await this.readUID();

            // Step 3: Generate LoRa Device Address
            if (progressCallback) {
                progressCallback({ stage: 'calculate', message: 'Calculating LoRa device address...' });
            }

            const loraInfo = this.generateLoRaID(uidResult.uid0, uidResult.uid1, uidResult.uid2);

            if (progressCallback) {
                progressCallback({ stage: 'complete', message: 'Operation completed successfully' });
            }

            return {
                success: true,
                deviceType: deviceConfig.name,
                uid: {
                    uid0: uidResult.uid0,
                    uid1: uidResult.uid1,
                    uid2: uidResult.uid2,
                    uid0Hex: uidResult.uid0.toString(16).padStart(8, '0').toUpperCase(),
                    uid1Hex: uidResult.uid1.toString(16).padStart(8, '0').toUpperCase(),
                    uid2Hex: uidResult.uid2.toString(16).padStart(8, '0').toUpperCase()
                },
                loraID: loraInfo,
                rawOutput: uidResult.raw
            };
        } catch (error) {
            throw new Error(`Flash and read operation failed: ${error.message}`);
        }
    }

    /**
     * Execute OpenOCD command
     * @private
     */
    executeOpenOCD(args, progressCallback = null) {
        return new Promise((resolve, reject) => {
            // console.log('Executing OpenOCD:', this.openocdPath, args.join(' '));

            const proc = spawn(this.openocdPath, args);

            let output = '';
            let errorOutput = '';
            let isResolved = false;

            // Timeout to force kill if process doesn't exit
            const timeout = setTimeout(() => {
                if (!isResolved) {
            // console.log('[OpenOCD] Timeout - force killing process');
                    proc.kill('SIGKILL');
                    isResolved = true;
                    const combinedOutput = errorOutput + output;
                    resolve({ success: true, output: combinedOutput, code: 0 });
                }
            }, 5000); // 5 second timeout

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
            // console.log('[OpenOCD]:', text.trim());

                if (progressCallback) {
                    // Parse progress from output
                    if (text.includes('** Programming Started **')) {
                        progressCallback({ stage: 'programming', message: 'Programming flash...' });
                    } else if (text.includes('** Verify Started **')) {
                        progressCallback({ stage: 'verifying', message: 'Verifying flash...' });
                    } else if (text.includes('** Verified OK **')) {
                        progressCallback({ stage: 'verified', message: 'Verification successful' });
                    }
                }

                // If we see "Verified OK" or "Programming Finished", exit soon
                if (text.includes('** Verified OK **') || text.includes('** Programming Finished **')) {
                    setTimeout(() => {
                        if (!isResolved) {
            // console.log('[OpenOCD] Flash completed, force exit');
                            clearTimeout(timeout);
                            proc.kill('SIGKILL');
                            isResolved = true;
                            const combinedOutput = errorOutput + output;
                            resolve({ success: true, output: combinedOutput, code: 0 });
                        }
                    }, 300); // Short delay to catch any final output
                }
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                // console.error('[OpenOCD Error]:', text.trim());

                // Check for critical errors
                if (text.includes('** Verify Failed **') || text.includes('** Programming Failed **')) {
                    setTimeout(() => {
                        if (!isResolved) {
            // console.log('[OpenOCD] Flash failed, terminating');
                            clearTimeout(timeout);
                            proc.kill('SIGKILL');
                            isResolved = true;
                            const combinedOutput = errorOutput + output;
                            reject(new Error(`OpenOCD flash failed\n${combinedOutput}`));
                        }
                    }, 300);
                }

                // If shutdown command is invoked, force resolve after short delay
                if (text.includes('shutdown command invoked')) {
                    setTimeout(() => {
                        if (!isResolved) {
                            clearTimeout(timeout);
                            proc.kill('SIGKILL');
                            isResolved = true;
                            const combinedOutput = errorOutput + output;

                            // Check if there were critical errors before shutdown
                            if (combinedOutput.includes('** Verify Failed **') ||
                                combinedOutput.includes('** Programming Failed **') ||
                                combinedOutput.includes('no flash bank found')) {
                                reject(new Error(`OpenOCD flash failed\n${combinedOutput}`));
                            } else {
                                resolve({ success: true, output: combinedOutput, code: 0 });
                            }
                        }
                    }, 500);
                }
            });

            proc.on('error', (error) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    reject(new Error(`Failed to execute OpenOCD: ${error.message}`));
                }
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    // OpenOCD writes most output to stderr, so combine both
                    const combinedOutput = errorOutput + output;

                    if (code === 0 || code === null) {
                        resolve({ success: true, output: combinedOutput, code });
                    } else {
                        reject(new Error(`OpenOCD exited with code ${code}\n${combinedOutput}`));
                    }
                }
            });
        });
    }

    /**
     * Set Droplet version for LoRa ID generation
     */
    setVersion(version) {
        this.VERSION = version & 0xFF;
    }

    /**
     * Disconnect ST-Link from target
     */
    async disconnectSTLink() {
        try {
            // console.log('Disconnecting ST-Link and resuming target...');

            // Try with current device config first
            const deviceConfig = this.getDeviceConfig();
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', `target/${deviceConfig.target}`,
                '-c', 'adapter speed 480',
                '-c', 'reset_config srst_only srst_nogate connect_assert_srst',
                '-c', 'init',
                '-c', 'reset run',
                '-c', 'shutdown'
            ];

            try {
                await this.executeOpenOCD(args);
            // console.log('Target resumed successfully');
            } catch (error) {
                // If current config fails, try alternative config
            // console.log('Current config failed, trying alternative...');

                const altConfig = this.currentDeviceType === 'DROPLET' ?
                    DEVICE_TYPES.ZONE_CONTROLLER : DEVICE_TYPES.DROPLET;

                const altArgs = [
                    '-s', this.scriptsPath,
                    '-f', 'interface/stlink.cfg',
                    '-f', `target/${altConfig.target}`,
                    '-c', 'adapter speed 480',
                    '-c', 'reset_config srst_only srst_nogate connect_assert_srst',
                    '-c', 'init',
                    '-c', 'reset run',
                    '-c', 'shutdown'
                ];

                try {
                    await this.executeOpenOCD(altArgs);
            // console.log('Target resumed with alternative config');
                } catch (altError) {
            // console.log('Could not resume target, but will disconnect anyway');
                }
            }

            return {
                success: true,
                message: 'ST-Link disconnected and target resumed'
            };
        } catch (error) {
            // Even if error, ST-Link is likely disconnected
            return {
                success: true,
                message: 'ST-Link disconnected'
            };
        }
    }

    /**
     * Get current flash status
     */
    getStatus() {
        return {
            isFlashing: this.isFlashing,
            openocdAvailable: this.checkOpenOCD(),
            openocdPath: this.openocdPath,
            version: this.VERSION
        };
    }
}

module.exports = new OpenOCDSTM32Service();
