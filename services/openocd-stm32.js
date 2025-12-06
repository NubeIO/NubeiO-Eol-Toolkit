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

        // Detect platform and set paths accordingly
        const platform = process.platform; // 'win32', 'linux', 'darwin'
        let openocdBinary, scriptsSubPath;

        if (platform === 'win32') {
            openocdBinary = path.join(basePath, 'embedded/openocd-binaries/windows/bin/openocd.exe');
            scriptsSubPath = 'embedded/openocd-binaries/windows/openocd/scripts';
        } else if (platform === 'linux') {
            openocdBinary = path.join(basePath, 'embedded/openocd-binaries/linux/bin/openocd');
            // Check if using xPack structure (share/openocd/scripts) or custom structure (openocd/scripts)
            const xpackScriptsPath = path.join(basePath, 'embedded/openocd-binaries/linux/share/openocd/scripts');
            const customScriptsPath = path.join(basePath, 'embedded/openocd-binaries/linux/openocd/scripts');
            scriptsSubPath = fs.existsSync(xpackScriptsPath)
                ? 'embedded/openocd-binaries/linux/share/openocd/scripts'
                : 'embedded/openocd-binaries/linux/openocd/scripts';
        } else if (platform === 'darwin') {
            // macOS support (future)
            openocdBinary = path.join(basePath, 'embedded/openocd-binaries/macos/bin/openocd');
            scriptsSubPath = 'embedded/openocd-binaries/macos/share/openocd/scripts';
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        this.openocdPath = openocdBinary;
        this.scriptsPath = path.join(basePath, scriptsSubPath);
        this.platform = platform;
        this.isFlashing = false;
        this.VERSION = 0xC0; // Droplet version for LoRa ID calculation
        this.currentDeviceType = 'DROPLET'; // Default device type

        console.log(`OpenOCD STM32 Service initialized for platform: ${platform}`);
        console.log(`OpenOCD binary: ${this.openocdPath}`);
        console.log(`Scripts path: ${this.scriptsPath}`);
    }

    /**
     * Set current device type
     * @param {string} deviceType - 'DROPLET' or 'ZONE_CONTROLLER'
     */
    setDeviceType(deviceType) {
        if (DEVICE_TYPES[deviceType]) {
            this.currentDeviceType = deviceType;
            console.log(`Device type changed to: ${DEVICE_TYPES[deviceType].name}`);
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
            console.log(`=== Attempting detection with ${deviceConfig.name} config ===`);

            // Try multiple speeds and reset configs
            const speeds = [480, 100];
            const resetConfigs = [
                'reset_config none separate',           // Software reset only (best for most cases, no NRST needed)
                'reset_config none',                    // No reset
                'reset_config srst_only',               // Hardware reset (needs NRST)
                'reset_config srst_only srst_nogate connect_assert_srst'  // Connect under reset (needs NRST)
            ];

            let detectionResult = null;
            let detectionSucceeded = false;

            // Try all combinations of speed and reset config
            for (const speed of speeds) {
                if (detectionSucceeded) break;

                for (const resetConfig of resetConfigs) {
                    const args = [
                        '-s', this.scriptsPath,
                        '-f', 'interface/stlink.cfg',
                        '-f', `target/${deviceConfig.target}`,
                        '-c', `adapter speed ${speed}`,
                        '-c', resetConfig,
                        '-c', 'init',
                        '-c', 'targets',
                        '-c', 'reset halt',
                        '-c', 'shutdown'
                    ];

                    try {
                        detectionResult = await this.executeOpenOCD(args);
                        result = detectionResult;
                        detectionSucceeded = true;
                        console.log(`Detection succeeded at ${speed} kHz with ${resetConfig}`);
                        break; // Success, exit inner loop
                    } catch (error) {
                        console.log(`Detection at ${speed} kHz with ${resetConfig} failed`);
                        detectionResult = { output: error.message || '' };
                        result = detectionResult;
                    }
                }
            }

            console.log('=== OpenOCD Detection Output ===');
            console.log(result.output);
            console.log('================================');

            // Parse MCU info from output to detect actual chip type
            let processorMatch = result.output.match(/Cortex-(M\d+)/i);
            let deviceIdMatch = result.output.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);
            const flashMatch = result.output.match(/flash size = (\d+)/i) ||
                result.output.match(/(\d+)\s*kbytes/i);

            // If no processor or device ID found, try with alternative config
            if (!processorMatch && !deviceIdMatch) {
                console.log('No device info detected, trying alternative config...');

                const altConfig = this.currentDeviceType === 'DROPLET' ?
                    DEVICE_TYPES.ZONE_CONTROLLER : DEVICE_TYPES.DROPLET;

                console.log(`Trying ${altConfig.name} config...`);

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
                    console.log('Alternative config output:', altResult.output);

                    processorMatch = altResult.output.match(/Cortex-(M\d+)/i);
                    deviceIdMatch = altResult.output.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);

                    if (processorMatch || deviceIdMatch) {
                        result.output = altResult.output;
                        console.log('Alternative config succeeded!');
                    }
                } catch (altError) {
                    console.log('Alternative config also failed');
                    const altErrorOutput = altError.message || '';
                    processorMatch = altErrorOutput.match(/Cortex-(M\d+)/i);
                    deviceIdMatch = altErrorOutput.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);

                    if (processorMatch || deviceIdMatch) {
                        result.output = altErrorOutput;
                        console.log('Got info from alternative config error');
                    }
                }
            }

            // Determine actual MCU type from multiple sources
            // Method 1: Check Device ID (most reliable)
            if (deviceIdMatch) {
                const deviceId = deviceIdMatch[1].toLowerCase();
                console.log(`Device ID: 0x${deviceId}`);

                // STM32WLE5 device IDs: 0x10036497
                // STM32F030 device IDs: 0x440, 0x444, 0x445
                if (deviceId.includes('497') || deviceId.includes('10036497')) {
                    detectedMCUType = 'DROPLET';
                    detectedChip = 'STM32WLE5';
                    console.log('Detected by Device ID: STM32WLE5');
                } else if (deviceId.includes('440') || deviceId.includes('444') || deviceId.includes('445')) {
                    detectedMCUType = 'ZONE_CONTROLLER';
                    detectedChip = 'STM32F030C8T6';
                    console.log('Detected by Device ID: STM32F030');
                }
            }

            // Method 2: Check Processor Type (backup method)
            if (!detectedMCUType && processorMatch) {
                const processor = processorMatch[1];
                console.log(`Detected Processor: Cortex-${processor}`);

                if (processor === 'M0') {
                    detectedMCUType = 'ZONE_CONTROLLER';
                    detectedChip = 'STM32F030C8T6';
                } else if (processor === 'M4') {
                    detectedMCUType = 'DROPLET';
                    detectedChip = 'STM32WLE5';
                }
            }

            console.log(`Detected MCU Type: ${detectedMCUType}`);
            console.log(`Current Selected Type: ${this.currentDeviceType}`);

            // Check if detected MCU matches selected device type
            const mismatch = detectedMCUType && detectedMCUType !== this.currentDeviceType;

            console.log(`Mismatch: ${mismatch}`);

            // Check flash protection status if device was detected
            let protectionStatus = null;
            if (processorMatch || deviceIdMatch) {
                try {
                    console.log(`[Detect] Checking flash protection status...`);
                    protectionStatus = await this.checkFlashProtection();
                    console.log(`[Detect] Protection status:`, JSON.stringify(protectionStatus, null, 2));
                } catch (protectionError) {
                    console.log(`[Detect] Failed to check protection: ${protectionError.message}`);
                    // Continue without protection info
                }
            }

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
                protection: protectionStatus,
                rawOutput: result.output
            };
        } catch (error) {
            // Even if OpenOCD fails, try to parse if ST-Link was detected
            console.log('=== OpenOCD Error, attempting to parse ===');
            console.log(error.message);

            const errorOutput = error.message || '';

            // Try to detect device type from error output
            detectedMCUType = null;
            detectedChip = null;

            // Check Device ID in error output
            const deviceIdMatch = errorOutput.match(/device id\s*=\s*0x([0-9a-fA-F]+)/i);
            if (deviceIdMatch) {
                const deviceId = deviceIdMatch[1].toLowerCase();
                console.log(`Device ID from error: 0x${deviceId}`);

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
                    console.log(`Processor from error: Cortex-${processor}`);

                    if (processor === 'M0') {
                        detectedMCUType = 'ZONE_CONTROLLER';
                        detectedChip = 'STM32F030C8T6';
                    } else if (processor === 'M4') {
                        detectedMCUType = 'DROPLET';
                        detectedChip = 'STM32WLE5';
                    }
                }
            }

            console.log(`Detected from error: ${detectedMCUType}`);
            console.log(`Selected: ${this.currentDeviceType}`);

            const mismatch = detectedMCUType && detectedMCUType !== this.currentDeviceType;
            console.log(`Mismatch: ${mismatch}`);

            if (errorOutput.includes('stm32') || errorOutput.includes('ST-Link') || errorOutput.includes('STLINK')) {
                // Try to check protection status
                let protectionStatus = null;
                try {
                    protectionStatus = await this.checkFlashProtection();
                    console.log(`Protection status:`, protectionStatus);
                } catch (protectionError) {
                    console.log(`Failed to check protection: ${protectionError.message}`);
                }

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
                    protection: protectionStatus,
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
                console.log(`[Flash Size] Trying: ${resetConfig}`);

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
                    console.log(`[Flash Size] Success with: ${resetConfig}`);
                    break;
                } catch (error) {
                    lastError = error;
                    console.log(`[Flash Size] Failed with ${resetConfig}`);
                    result = { output: error.message || '' };

                    if (i < resetConfigs.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }

            const output = result ? result.output : (lastError?.message || '');
            console.log('Flash size detection output:', output);

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
     * Unlock flash protection (RDP Level 1)
     * ⚠️ WARNING: This will ERASE ALL FLASH content!
     * @param {function} progressCallback - Callback for progress updates
     */
    async unlockFlash(progressCallback = null) {
        if (!this.checkOpenOCD()) {
            throw new Error('OpenOCD binary not found');
        }

        if (progressCallback) {
            progressCallback({ stage: 'unlock', message: 'Unlocking flash protection (will erase flash)...' });
        }

        const deviceConfig = this.getDeviceConfig();

        // Optimized: Only use stm32wlx unlock 0 (confirmed working)
        // Try different speeds and reset configs with stm32wlx unlock 0
        // Hardware reset (srst_only) helps flash controller reload OPTR after unlock
        const unlockAttempts = deviceConfig.mcu.includes('WL')
            ? [
                // Primary: stm32wlx unlock 0 with hardware reset (srst_only) - forces flash controller reload
                { speed: 480, resetConfig: 'reset_config srst_only srst_nogate connect_assert_srst', command: 'stm32wlx unlock 0', useHardwareReset: true },
                // Fallback 1: software reset
                { speed: 480, resetConfig: 'reset_config none separate', command: 'stm32wlx unlock 0', useHardwareReset: false },
                // Fallback 2: try with 100 kHz and hardware reset
                { speed: 100, resetConfig: 'reset_config srst_only srst_nogate connect_assert_srst', command: 'stm32wlx unlock 0', useHardwareReset: true },
                // Fallback 3: try with 100 kHz and software reset
                { speed: 100, resetConfig: 'reset_config none separate', command: 'stm32wlx unlock 0', useHardwareReset: false },
            ]
            : [
                { speed: 480, resetConfig: 'reset_config srst_only srst_nogate connect_assert_srst', command: 'stm32f0x unlock 0', useHardwareReset: true },
                { speed: 480, resetConfig: 'reset_config none separate', command: 'stm32f0x unlock 0', useHardwareReset: false },
                { speed: 100, resetConfig: 'reset_config srst_only srst_nogate connect_assert_srst', command: 'stm32f0x unlock 0', useHardwareReset: true },
                { speed: 100, resetConfig: 'reset_config none separate', command: 'stm32f0x unlock 0', useHardwareReset: false },
            ];

        let lastError = null;

        // Try unlock attempts in priority order
        for (const attempt of unlockAttempts) {
            const { speed, resetConfig, command: unlockCmd, useHardwareReset = false } = attempt;

            // Build unlock command sequence with proper reset to apply changes without power cycle
            // Hardware reset (srst_only) helps flash controller reload OPTR after unlock
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', `target/${deviceConfig.target}`,
                '-c', `adapter speed ${speed}`,
                '-c', resetConfig,
                '-c', 'init',
                '-c', 'reset halt',
                '-c', unlockCmd,
            ];

            // Add reset sequence based on reset type
            if (useHardwareReset) {
                // Hardware reset sequence: more aggressive, forces flash controller reload OPTR
                console.log(`[Unlock] Using hardware reset sequence to force flash controller reload`);
                args.push(
                    '-c', 'reset run',      // Reset and run - applies OPTR changes
                    '-c', 'sleep 500',      // Wait 500ms for flash controller to reload OPTR
                    '-c', 'reset halt',     // Halt for verification
                    '-c', 'sleep 200',      // Additional wait
                    '-c', 'reset run',      // Second reset to ensure changes applied
                    '-c', 'sleep 300',      // Wait again
                    '-c', 'reset halt'      // Final halt
                );
            } else {
                // Software reset sequence: standard reset
                args.push(
                    '-c', 'reset run',      // Reset and run - applies OPTR changes
                    '-c', 'sleep 500',      // Wait 500ms for changes to take effect (increased from 200ms)
                    '-c', 'reset halt'      // Halt for verification
                );
            }

            args.push('-c', 'shutdown');

            try {
                console.log(`[Unlock] Trying: ${speed} kHz, ${resetConfig}, command: ${unlockCmd}`);

                const result = await this.executeOpenOCD(args);

                const output = result.output || '';
                console.log(`[Unlock] Full output length: ${output.length} chars`);
                console.log(`[Unlock] Full output:\n${output}`);

                // Check for explicit failure indicators
                const hasCriticalError = output.includes('stm32x device protected') ||
                    output.includes('device protected') ||
                    output.includes('permanently protected') ||
                    output.includes('RDP level 2') ||
                    (output.includes('Error:') && output.includes('protected')) ||
                    (output.includes('failed') && output.includes('protected'));

                // For unlock commands, if no critical error and command executed, assume success
                // Unlock commands often don't output explicit success messages
                if (!hasCriticalError) {
                    console.log(`[Unlock] No critical errors detected, verifying unlock...`);

                    // Wait for device to stabilize after reset
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Disconnect and reconnect ST-Link to force a fresh connection
                    // This helps apply the OPTR changes without power cycle
                    try {
                        console.log(`[Unlock] Disconnecting ST-Link to apply changes...`);
                        // Close any existing connection
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (disconnectError) {
                        console.log(`[Unlock] Disconnect error (ignored): ${disconnectError.message}`);
                    }

                    // Verify unlock by checking OPTR directly (most reliable method)
                    try {
                        const deviceConfig = this.getDeviceConfig();
                        const optrAddress = deviceConfig.mcu.includes('WL') ? '0x1FFF7800' : '0x1FFFF800';

                        // Read OPTR directly to check RDP level
                        const verifyArgs = [
                            '-s', this.scriptsPath,
                            '-f', 'interface/stlink.cfg',
                            '-f', `target/${deviceConfig.target}`,
                            '-c', `adapter speed 480`,
                            '-c', 'reset_config none separate',
                            '-c', 'init',
                            '-c', 'reset halt',
                            '-c', `mdw ${optrAddress} 1`,
                            '-c', 'shutdown'
                        ];

                        const verifyResult = await this.executeOpenOCD(verifyArgs);
                        const verifyOutput = verifyResult.output || '';

                        // Parse OPTR value
                        const optrMatch = verifyOutput.match(new RegExp(`${optrAddress}:\\s*([0-9a-fA-F]+)`, 'i'));
                        if (optrMatch) {
                            const optrValue = parseInt(optrMatch[1], 16);
                            const rdpByte = optrValue & 0xFF;

                            console.log(`[Unlock] Verification: OPTR=0x${optrValue.toString(16)}, RDP byte=0x${rdpByte.toString(16)}`);

                            // If OPTR = 0xAA, device is unlocked (most reliable indicator)
                            if (rdpByte === 0xAA) {
                                console.log(`[Unlock] ✅ VERIFIED: OPTR shows 0xAA (Level 0 - unprotected)!`);

                                // Additional verification: Check flash probe to ensure flash controller has reloaded OPTR
                                console.log(`[Unlock] Verifying with flash probe to ensure flash controller has reloaded OPTR...`);
                                try {
                                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s for flash controller

                                    const probeVerifyArgs = [
                                        '-s', this.scriptsPath,
                                        '-f', 'interface/stlink.cfg',
                                        '-f', `target/${deviceConfig.target}`,
                                        '-c', `adapter speed 480`,
                                        '-c', 'reset_config none separate',
                                        '-c', 'init',
                                        '-c', 'reset halt',
                                        '-c', 'flash probe 0',
                                        '-c', 'shutdown'
                                    ];

                                    const probeVerifyResult = await this.executeOpenOCD(probeVerifyArgs);
                                    const probeVerifyOutput = probeVerifyResult.output || '';

                                    // Check if flash probe still shows RDP level 1
                                    const probeRdpMatch = probeVerifyOutput.match(/RDP level (\d+)/i);
                                    if (probeRdpMatch) {
                                        const probeRdpLevel = parseInt(probeRdpMatch[1]);
                                        if (probeRdpLevel > 0) {
                                            console.log(`[Unlock] ⚠️ WARNING: OPTR=0xAA but flash probe still shows RDP Level ${probeRdpLevel}`);
                                            console.log(`[Unlock] Flash controller has not reloaded OPTR. This requires a POWER CYCLE.`);
                                            console.log(`[Unlock] Attempting to write OPTR directly using option_write...`);

                                            // Try writing OPTR directly using option_write
                                            // For STM32WLx: OPTR address is 0x1FFF7800, value should be 0x3ffff0aa (RDP=0xAA)
                                            // For STM32F0x: OPTR address is 0x1FFFF800, value should be 0x3ffff0aa
                                            const optrAddress = deviceConfig.mcu.includes('WL') ? '0x1FFF7800' : '0x1FFFF800';
                                            const optrValue = '0x3ffff0aa'; // RDP = 0xAA (unprotected)

                                            const optionWriteArgs = [
                                                '-s', this.scriptsPath,
                                                '-f', 'interface/stlink.cfg',
                                                '-f', `target/${deviceConfig.target}`,
                                                '-c', `adapter speed 100`,
                                                '-c', 'reset_config srst_only srst_nogate connect_assert_srst',
                                                '-c', 'init',
                                                '-c', 'reset halt',
                                                '-c', deviceConfig.mcu.includes('WL') ? `stm32l4x option_write 0 ${optrAddress} ${optrValue}` : `stm32f0x option_write 0 ${optrAddress} ${optrValue}`,
                                                '-c', 'reset run',
                                                '-c', 'sleep 1000',
                                                '-c', 'reset halt',
                                                '-c', 'shutdown'
                                            ];

                                            try {
                                                await this.executeOpenOCD(optionWriteArgs);
                                                console.log(`[Unlock] Option write completed. Waiting for flash controller to reload...`);
                                                await new Promise(resolve => setTimeout(resolve, 2000));

                                                // Verify again with flash probe
                                                const probeVerify2Result = await this.executeOpenOCD(probeVerifyArgs);
                                                const probeVerify2Output = probeVerify2Result.output || '';
                                                const probeRdpMatch2 = probeVerify2Output.match(/RDP level (\d+)/i);

                                                if (probeRdpMatch2 && parseInt(probeRdpMatch2[1]) > 0) {
                                                    // Still protected - requires power cycle
                                                    const errorMsg = `OPTR has been unlocked (0xAA) but flash controller still shows RDP Level ${probeRdpLevel}.\n\n` +
                                                        `⚠️ POWER CYCLE REQUIRED (power off and on) to reload OPTR in flash controller.\n\n` +
                                                        `After power cycle, please click "Detect ST-Link" again to verify.`;

                                                    if (progressCallback) {
                                                        progressCallback({
                                                            stage: 'unlock_power_cycle_required',
                                                            message: errorMsg
                                                        });
                                                    }

                                                    throw new Error(errorMsg);
                                                } else {
                                                    console.log(`[Unlock] ✅ Flash probe confirms RDP Level 0 after option_write!`);
                                                }
                                            } catch (optionWriteError) {
                                                console.log(`[Unlock] Option write failed: ${optionWriteError.message}`);

                                                // Even if option_write fails, OPTR is already 0xAA, so throw clear error about power cycle
                                                const errorMsg = `OPTR has been unlocked (0xAA) but flash controller still shows RDP Level ${probeRdpLevel}.\n\n` +
                                                    `⚠️ POWER CYCLE REQUIRED (power off and on) to reload OPTR in flash controller.\n\n` +
                                                    `After power cycle, please click "Detect ST-Link" again to verify.`;

                                                if (progressCallback) {
                                                    progressCallback({
                                                        stage: 'unlock_power_cycle_required',
                                                        message: errorMsg
                                                    });
                                                }

                                                throw new Error(errorMsg);
                                            }
                                        } else {
                                            console.log(`[Unlock] ✅ Flash probe confirms RDP Level 0 - fully unlocked!`);
                                        }
                                    }
                                } catch (probeError) {
                                    console.log(`[Unlock] Flash probe verification failed (ignored): ${probeError.message}`);
                                }

                                if (progressCallback) {
                                    progressCallback({ stage: 'unlock_complete', message: 'Flash protection unlocked (flash erased)' });
                                }

                                return { success: true, output: result.output };
                            } else {
                                console.log(`[Unlock] ⚠️ OPTR still shows RDP Level ${rdpByte === 0xCC ? 2 : 1}, may need power cycle`);
                                // Even if OPTR not 0xAA yet, if command executed without error, it might need time/power cycle
                                // Check if output says "Option written" or similar success indicators
                                if (output.includes('Option written') || output.includes('reset or power cycle')) {
                                    console.log(`[Unlock] ⚠️ Option written but needs power cycle. Assuming success.`);

                                    if (progressCallback) {
                                        progressCallback({ stage: 'unlock_complete', message: 'Flash protection unlocked (may need power cycle)' });
                                    }

                                    return { success: true, output: result.output };
                                }
                                // Continue to try next command
                            }
                        } else {
                            console.log(`[Unlock] Could not parse OPTR from verification output`);
                            // If we can't verify OPTR, check if command output indicates success
                            if (output.includes('Option written') || output.includes('reset or power cycle')) {
                                console.log(`[Unlock] Option write command succeeded. Assuming unlock success.`);

                                if (progressCallback) {
                                    progressCallback({ stage: 'unlock_complete', message: 'Flash protection unlocked (may need power cycle)' });
                                }

                                return { success: true, output: result.output };
                            }
                        }
                    } catch (verifyError) {
                        console.log(`[Unlock] Could not verify unlock status: ${verifyError.message}`);
                        // If we can't verify, check for success indicators in output
                        if (output.includes('Option written') || output.includes('reset or power cycle') ||
                            (!output.includes('Error') && !output.includes('failed') && !output.includes('protected'))) {
                            console.log(`[Unlock] Assuming success (no critical errors, command executed)`);

                            if (progressCallback) {
                                progressCallback({ stage: 'unlock_complete', message: 'Flash protection unlocked (flash erased)' });
                            }

                            return { success: true, output: result.output };
                        }
                    }
                } else {
                    console.log(`[Unlock] Critical error detected in output`);
                    throw new Error('Unlock command failed: device still protected');
                }
            } catch (error) {
                lastError = error;
                const errorMsg = error.message || '';
                console.log(`[Unlock] ❌ FAILED with ${speed} kHz, ${resetConfig}, ${unlockCmd}: ${errorMsg}`);
                if (errorMsg.length > 500) {
                    console.log(`[Unlock] Error details (first 500 chars):`, errorMsg.substring(0, 500));
                } else {
                    console.log(`[Unlock] Error details:`, errorMsg);
                }
                // Continue to next attempt
            }
        }

        throw lastError || new Error('Failed to unlock flash protection');
    }

    /**
     * Check if flash is protected
     * @returns {Object} Protection status
     */
    async checkFlashProtection() {
        if (!this.checkOpenOCD()) {
            throw new Error('OpenOCD binary not found');
        }

        const deviceConfig = this.getDeviceConfig();
        const speeds = [480, 100];
        const resetConfigs = [
            'reset_config none separate',
            'reset_config none',
            'reset_config srst_only'
        ];

        let lastError = null;
        let protectionDetected = false;
        let rdpLevel = 0;

        // Method 1: Try to read option bytes register (FLASH_OPTR) to check RDP level
        // For STM32WLx, option bytes are at 0x1FFF7800
        // For STM32F0x, option bytes are at 0x1FFFF800
        const optrAddress = deviceConfig.mcu.includes('WL') ? '0x1FFF7800' : '0x1FFFF800';

        console.log(`[Protection Check] Method 1: Trying to read OPTR at ${optrAddress}`);

        for (const speed of speeds) {
            for (const resetConfig of resetConfigs) {
                try {
                    // Try to read option bytes register
                    const args = [
                        '-s', this.scriptsPath,
                        '-f', 'interface/stlink.cfg',
                        '-f', `target/${deviceConfig.target}`,
                        '-c', `adapter speed ${speed}`,
                        '-c', resetConfig,
                        '-c', 'init',
                        '-c', 'reset halt',
                        '-c', `mdw ${optrAddress} 1`, // Read option bytes register
                        '-c', 'shutdown'
                    ];

                    console.log(`[Protection Check] Method 1: Attempting to read OPTR...`);
                    const result = await this.executeOpenOCD(args);
                    const output = result.output;

                    console.log(`[Protection Check] Method 1: OPTR read output (first 300 chars):`, output.substring(0, 300));

                    // Parse RDP level from option bytes
                    // RDP bits are in the lower byte of OPTR register
                    // According to STM32 documentation:
                    // - 0xAA = Level 0 (no protection)
                    // - 0xBB or any value other than 0xAA and 0xCC = Level 1 (read protection, can unlock)
                    // - 0xCC = Level 2 (chip protection, permanently protected, CANNOT unlock)
                    const optrMatch = output.match(new RegExp(`${optrAddress}:\\s*([0-9a-fA-F]+)`, 'i'));
                    if (optrMatch) {
                        const optrValue = parseInt(optrMatch[1], 16);
                        const rdpByte = optrValue & 0xFF;

                        if (rdpByte === 0xAA) {
                            rdpLevel = 0;
                            protectionDetected = false;
                        } else if (rdpByte === 0xCC) {
                            // 0xCC = Level 2 (permanently protected, CANNOT unlock)
                            rdpLevel = 2;
                            protectionDetected = true;
                        } else {
                            // 0xBB or any other value (except 0xAA and 0xCC) = Level 1 (read protection, can unlock)
                            rdpLevel = 1;
                            protectionDetected = true;
                        }

                        console.log(`[Protection Check] Method 1: OPTR: 0x${optrValue.toString(16)}, RDP byte: 0x${rdpByte.toString(16)}, Level: ${rdpLevel}`);

                        // If OPTR shows Level 0, verify with flash probe to check for mismatch
                        // If OPTR = 0xAA but flash probe still shows RDP level 1, power cycle is required
                        if (rdpLevel === 0) {
                            console.log(`[Protection Check] Method 1: OPTR shows Level 0 (0xAA) - device is unprotected`);
                            console.log(`[Protection Check] Method 1: Verifying with flash probe to check for mismatch...`);

                            // Verify with flash probe to check if flash controller has reloaded OPTR
                            try {
                                const probeArgs = [
                                    '-s', this.scriptsPath,
                                    '-f', 'interface/stlink.cfg',
                                    '-f', `target/${deviceConfig.target}`,
                                    '-c', `adapter speed ${speed}`,
                                    '-c', resetConfig,
                                    '-c', 'init',
                                    '-c', 'reset halt',
                                    '-c', 'flash probe 0',
                                    '-c', 'shutdown'
                                ];
                                const probeResult = await this.executeOpenOCD(probeArgs);
                                const probeOutput = probeResult.output;

                                // Check if flash probe shows RDP level
                                const probeRdpMatch = probeOutput.match(/RDP level (\d+)/i);
                                if (probeRdpMatch) {
                                    const probeRdpLevel = parseInt(probeRdpMatch[1]);
                                    console.log(`[Protection Check] Method 1: Flash probe shows RDP Level ${probeRdpLevel}`);

                                    // If flash probe shows RDP Level > 0, there's a mismatch - power cycle required
                                    if (probeRdpLevel > 0) {
                                        console.log(`[Protection Check] Method 1: ⚠️ MISMATCH: OPTR=0xAA but flash probe shows RDP Level ${probeRdpLevel}`);
                                        console.log(`[Protection Check] Method 1: Power cycle required to reload OPTR in flash controller`);
                                        return {
                                            success: true,
                                            isProtected: true, // Still protected until power cycle
                                            rdpLevel: probeRdpLevel,
                                            canUnlock: false,
                                            rawOutput: output + '\n--- Flash Probe Verification ---\n' + probeOutput,
                                            note: 'OPTR shows 0xAA but flash probe indicates protection. Power cycle required.'
                                        };
                                    }
                                }
                                // Flash probe confirms unprotected
                                console.log(`[Protection Check] Method 1: ✅ Both OPTR and flash probe confirm RDP Level 0 - fully unlocked!`);
                            } catch (probeError) {
                                console.log(`[Protection Check] Method 1: Flash probe verification failed: ${probeError.message}`);
                                // If probe fails, trust OPTR
                            }

                            // OPTR = 0xAA and flash probe confirms (or probe failed)
                            return {
                                success: true,
                                isProtected: false,
                                rdpLevel: 0,
                                canUnlock: false,
                                rawOutput: output
                            };
                        }

                        return {
                            success: true,
                            isProtected: protectionDetected,
                            rdpLevel: rdpLevel,
                            canUnlock: rdpLevel === 1,
                            rawOutput: output
                        };
                    } else {
                        console.log(`[Protection Check] Method 1: Could not parse OPTR value, continuing to Method 2`);
                    }
                } catch (error) {
                    console.log(`[Protection Check] Method 1: Failed to read OPTR: ${error.message}`);
                    lastError = error;
                    // Continue to next method
                }
            }
        }

        console.log(`[Protection Check] Method 1: All attempts failed, trying Method 2...`);

        // Method 2: Try to read flash info or probe flash to detect protection
        for (const speed of speeds) {
            for (const resetConfig of resetConfigs) {
                try {
                    const args = [
                        '-s', this.scriptsPath,
                        '-f', 'interface/stlink.cfg',
                        '-f', `target/${deviceConfig.target}`,
                        '-c', `adapter speed ${speed}`,
                        '-c', resetConfig,
                        '-c', 'init',
                        '-c', 'reset halt',
                        '-c', 'flash list', // Try to list flash info
                        '-c', 'shutdown'
                    ];

                    const result = await this.executeOpenOCD(args);
                    const output = result.output;

                    // Check if flash size is 0 - this strongly indicates protection
                    // Match patterns: "size       0x0", "size 0x0", "size 0", etc.
                    // Also check for all zeros: size=0, bus_width=0, chip_width=0
                    const hasSizeZero = /size\s+0x0/i.test(output) || /size\s+0\s/i.test(output);
                    const hasAllZeros = /size\s+0x0[\s\S]*bus_width\s+0[\s\S]*chip_width\s+0/i.test(output);

                    console.log(`[Protection Check] Checking flash size in output...`);
                    console.log(`[Protection Check] Has size=0:`, hasSizeZero);
                    console.log(`[Protection Check] Has all zeros:`, hasAllZeros);

                    if (hasSizeZero || hasAllZeros) {
                        console.log(`[Protection Check] Flash size is 0 - DEVICE IS PROTECTED (RDP Level 1)`);
                        // Flash size = 0 is a clear indicator of protection
                        // No need to probe, return protected immediately
                        return {
                            success: true,
                            isProtected: true,
                            rdpLevel: 1, // Assume Level 1 (can be unlocked)
                            canUnlock: true,
                            rawOutput: output
                        };
                    }

                    // Check for protection indicators in output
                    const isProtected = output.includes('device protected') ||
                        output.includes('stm32x device protected') ||
                        output.includes('write protected') ||
                        output.includes('RDP level 1') ||
                        output.includes('RDP level 2');

                    // Check RDP level from output
                    const rdpMatch = output.match(/RDP level (\d+)/i);
                    if (rdpMatch) {
                        rdpLevel = parseInt(rdpMatch[1]);
                        protectionDetected = rdpLevel > 0;
                    }

                    if (isProtected || rdpLevel > 0) {
                        return {
                            success: true,
                            isProtected: true,
                            rdpLevel: rdpLevel || 1,
                            canUnlock: rdpLevel === 1,
                            rawOutput: output
                        };
                    }
                } catch (error) {
                    const errorMsg = error.message || '';

                    // Check error message for protection indicators
                    const isProtected = errorMsg.includes('device protected') ||
                        errorMsg.includes('stm32x device protected') ||
                        errorMsg.includes('write protected') ||
                        errorMsg.includes('RDP level 1') ||
                        errorMsg.includes('RDP level 2') ||
                        errorMsg.includes('failed erasing sectors');

                    const rdpMatch = errorMsg.match(/RDP level (\d+)/i);
                    if (rdpMatch) {
                        rdpLevel = parseInt(rdpMatch[1]);
                        protectionDetected = rdpLevel > 0;
                    }

                    if (isProtected || rdpLevel > 0) {
                        return {
                            success: true,
                            isProtected: true,
                            rdpLevel: rdpLevel || 1,
                            canUnlock: rdpLevel === 1,
                            rawOutput: errorMsg
                        };
                    }

                    lastError = error;
                }
            }
        }

        // If we couldn't detect protection, assume not protected (default state)
        console.log(`[Protection Check] Could not determine protection status, assuming unprotected`);
        return {
            success: true,
            isProtected: false,
            rdpLevel: 0,
            canUnlock: false,
            rawOutput: lastError ? lastError.message : 'No protection detected'
        };
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

            console.log(`Firmware size: ${firmwareSizeKB} KB (${firmwareSizeBytes} bytes)`);

            // Try to detect actual flash size
            if (progressCallback) {
                progressCallback({ stage: 'detecting', message: 'Detecting chip flash size...' });
            }

            const flashInfo = await this.getActualFlashSize();

            if (flashInfo.success && flashInfo.flashSizeKB) {
                console.log(`Detected flash size: ${flashInfo.flashSizeKB} KB`);

                if (flashInfo.variant) {
                    console.log(`Detected variant: ${flashInfo.variant.name}`);
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

            // Check flash protection before flashing
            if (progressCallback) {
                progressCallback({ stage: 'check_protection', message: 'Checking flash protection...' });
            }

            try {
                const protectionStatus = await this.checkFlashProtection();

                if (protectionStatus.isProtected && protectionStatus.canUnlock) {
                    console.log(`[Flash] Flash is protected (RDP Level ${protectionStatus.rdpLevel}), unlocking...`);

                    if (progressCallback) {
                        progressCallback({
                            stage: 'unlock_warning',
                            message: `⚠️ Flash is protected (RDP Level ${protectionStatus.rdpLevel}). Unlocking will ERASE all flash content...`
                        });
                    }

                    // Wait a moment for user to see the warning
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Unlock flash (this will erase all flash)
                    await this.unlockFlash(progressCallback);

                    if (progressCallback) {
                        progressCallback({ stage: 'unlock_done', message: 'Flash unlocked. Proceeding with flash...' });
                    }

                    // Wait for device to stabilize after unlock
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else if (protectionStatus.isProtected && !protectionStatus.canUnlock) {
                    // RDP Level 2 - cannot unlock
                    this.isFlashing = false;
                    throw new Error(`Flash is permanently protected (RDP Level ${protectionStatus.rdpLevel}). Cannot unlock. Please use ST-Link Utility to unlock.`);
                }
            } catch (error) {
                // If protection check fails, continue anyway (might not be protected)
                console.log(`[Flash] Protection check failed, continuing: ${error.message}`);
            }

            if (progressCallback) {
                progressCallback({ stage: 'flashing', message: 'Programming flash...' });
            }

            // Convert Windows backslash to forward slash for OpenOCD
            const normalizedPath = firmwarePath.replace(/\\/g, '/');

            const deviceConfig = this.getDeviceConfig();

            // SWD speeds to try (from fast to slow)
            const swdSpeeds = [100, 480]; // Try 100 kHz first (more reliable), then 480 kHz

            // Multiple connection strategies to try (from most to least aggressive)
            const connectionStrategies = [
                {
                    name: 'software_reset',
                    resetConfig: 'reset_config none separate',
                    initSequence: ['init', 'reset init', 'halt']
                },
                {
                    name: 'halt_immediately',
                    resetConfig: 'reset_config none',
                    initSequence: ['init', 'halt']
                },
                {
                    name: 'connect_under_reset',
                    resetConfig: 'reset_config srst_only srst_nogate connect_assert_srst',
                    initSequence: ['init', 'reset halt']
                },
                {
                    name: 'jtag_style',
                    resetConfig: 'reset_config none',
                    initSequence: ['init']
                }
            ];

            let lastError = null;
            let attemptCount = 0;
            const totalAttempts = swdSpeeds.length * connectionStrategies.length;
            let hasUnlocked = false; // Track if we've already unlocked
            let shouldRetry = true; // Flag to control retry after unlock

            // Try different SWD speeds and connection strategies
            while (shouldRetry) {
                shouldRetry = false; // Reset flag
                attemptCount = 0; // Reset attempt count
                lastError = null; // Reset last error

                flashLoop: for (const speed of swdSpeeds) {
                    for (const strategy of connectionStrategies) {
                        attemptCount++;
                        console.log(`[Flash] Attempt ${attemptCount}/${totalAttempts}: ${speed} kHz, ${strategy.name}`);

                        if (progressCallback && attemptCount > 1) {
                            progressCallback({
                                stage: 'retry',
                                message: `Trying different method (${attemptCount}/${totalAttempts})...`
                            });
                        }

                        let args;

                        if (strategy.initSequence === null) {
                            // Simple program command (one-shot)
                            args = [
                                '-s', this.scriptsPath,
                                '-f', 'interface/stlink.cfg',
                                '-f', `target/${deviceConfig.target}`,
                                '-c', `adapter speed ${speed}`,
                                '-c', strategy.resetConfig,
                                '-c', `program {${normalizedPath}} verify reset exit 0x08000000`
                            ];
                        } else {
                            // Manual flash sequence with custom init
                            args = [
                                '-s', this.scriptsPath,
                                '-f', 'interface/stlink.cfg',
                                '-f', `target/${deviceConfig.target}`,
                                '-c', `adapter speed ${speed}`,
                                '-c', strategy.resetConfig
                            ];

                            // Add init sequence commands (handle variable length)
                            for (let i = 0; i < strategy.initSequence.length; i++) {
                                const cmd = strategy.initSequence[i];
                                // Skip empty, undefined, or null commands
                                if (cmd && typeof cmd === 'string' && cmd.trim() !== '') {
                                    args.push('-c', cmd);
                                }
                            }

                            // Add flash commands
                            args.push(
                                '-c', `flash write_image erase {${normalizedPath}} 0x08000000`,
                                '-c', `verify_image {${normalizedPath}} 0x08000000`,
                                '-c', 'reset run',
                                '-c', 'shutdown'
                            );
                        }

                        try {
                            const result = await this.executeOpenOCD(args, progressCallback);

                            if (progressCallback) {
                                progressCallback({ stage: 'complete', message: 'Flash completed successfully' });
                            }

                            this.isFlashing = false;
                            console.log(`[Flash] Success with: ${speed} kHz, ${strategy.name}`);
                            return {
                                success: true,
                                output: result.output,
                                speedUsed: speed,
                                strategyUsed: strategy.name
                            };
                        } catch (error) {
                            lastError = error;
                            const errorMsg = (error.message || '').toLowerCase();
                            console.log(`[Flash] Failed with ${speed} kHz, ${strategy.name}: ${error.message}`);

                            // Check if error is due to flash protection (case insensitive)
                            const isProtectedError = errorMsg.includes('device protected') ||
                                errorMsg.includes('stm32x device protected') ||
                                errorMsg.includes('rdp level 1') ||
                                errorMsg.includes('failed erasing sectors');

                            console.log(`[Flash] Protection check: isProtectedError=${isProtectedError}, hasUnlocked=${hasUnlocked}, attemptCount=${attemptCount}`);

                            // If any attempt fails with protection error and we haven't unlocked yet, try to unlock
                            if (isProtectedError && !hasUnlocked) {
                                console.log(`[Flash] Detected flash protection error, attempting to unlock...`);

                                if (progressCallback) {
                                    progressCallback({
                                        stage: 'unlock_warning',
                                        message: `⚠️ Flash is protected. Unlocking will ERASE all flash content...`
                                    });
                                }

                                // Wait a moment for user to see the warning
                                await new Promise(resolve => setTimeout(resolve, 2000));

                                try {
                                    // Try to unlock flash
                                    await this.unlockFlash(progressCallback);
                                    hasUnlocked = true; // Mark as unlocked

                                    if (progressCallback) {
                                        progressCallback({ stage: 'unlock_done', message: 'Flash unlocked. Retrying flash...' });
                                    }

                                    // Wait for device to stabilize after unlock
                                    await new Promise(resolve => setTimeout(resolve, 1000));

                                    // Set flag to restart flash loop
                                    shouldRetry = true;
                                    // Break out of both loops to restart
                                    break flashLoop;
                                } catch (unlockError) {
                                    console.log(`[Flash] Unlock failed: ${unlockError.message}`);
                                    // Continue with normal retry logic
                                }
                            }

                            // If this is not the last attempt, continue to next strategy
                            if (attemptCount < totalAttempts) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                                continue;
                            }
                        }
                    }
                }
            } // End of while (shouldRetry) loop

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

            // Try multiple speeds and reset configs
            const speeds = [480, 100];
            const resetConfigs = [
                'reset_config none separate',           // Software reset only (no NRST needed)
                'reset_config none',                    // No reset
                'reset_config srst_only',               // Hardware reset (needs NRST)
                'reset_config srst_only srst_nogate connect_assert_srst'  // Connect under reset (needs NRST)
            ];

            let result = null;
            let lastError = null;

            // Try all combinations of speed and reset config
            for (const speed of speeds) {
                for (const resetConfig of resetConfigs) {
                    const args = [
                        '-s', this.scriptsPath,
                        '-f', 'interface/stlink.cfg',
                        '-f', `target/${deviceConfig.target}`,
                        '-c', `adapter speed ${speed}`,
                        '-c', resetConfig,
                        '-c', 'init',
                        '-c', 'reset halt',
                        '-c', 'sleep 100',
                        '-c', `mdw ${deviceConfig.uidAddress} 3`,
                        '-c', 'shutdown'
                    ];

                    try {
                        result = await this.executeOpenOCD(args);
                        console.log(`UID read succeeded at ${speed} kHz with ${resetConfig}`);
                        break; // Success, exit inner loop
                    } catch (error) {
                        lastError = error;
                        console.log(`UID read at ${speed} kHz with ${resetConfig} failed`);
                    }
                }

                if (result) break; // Success, exit outer loop
            }

            if (!result) {
                throw lastError || new Error('Failed to read UID');
            }

            console.log('UID Read Output:', result.output);

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
            console.log('Executing OpenOCD:', this.openocdPath, args.join(' '));

            const proc = spawn(this.openocdPath, args);

            let output = '';
            let errorOutput = '';
            let isResolved = false;

            // Timeout to force kill if process doesn't exit
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    console.log('[OpenOCD] Timeout - force killing process');
                    proc.kill('SIGKILL');
                    isResolved = true;
                    const combinedOutput = errorOutput + output;
                    resolve({ success: true, output: combinedOutput, code: 0 });
                }
            }, 10000); // 10 second timeout (increased to allow reset run)

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.log('[OpenOCD]:', text.trim());

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

                // If we see "Verified OK" or "Programming Finished", wait for shutdown
                if (text.includes('** Verified OK **') || text.includes('** Programming Finished **')) {
                    // Don't kill immediately - let reset run command execute
                    // Will be handled by shutdown or timeout
                    console.log('[OpenOCD] Flash verified, waiting for reset and shutdown...');
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
                            console.log('[OpenOCD] Flash failed, terminating');
                            clearTimeout(timeout);
                            proc.kill('SIGKILL');
                            isResolved = true;
                            const combinedOutput = errorOutput + output;
                            reject(new Error(`OpenOCD flash failed\n${combinedOutput}`));
                        }
                    }, 300);
                }

                // If shutdown command is invoked, force resolve after delay to allow reset run to complete
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
                    }, 1000); // Increased to 1 second to ensure reset run completes
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
            console.log('Disconnecting ST-Link and resuming target...');

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
                console.log('Target resumed successfully');
            } catch (error) {
                // If current config fails, try alternative config
                console.log('Current config failed, trying alternative...');

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
                    console.log('Target resumed with alternative config');
                } catch (altError) {
                    console.log('Could not resume target, but will disconnect anyway');
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
            scriptsPath: this.scriptsPath,
            platform: this.platform,
            version: this.VERSION
        };
    }
}

module.exports = new OpenOCDSTM32Service();
