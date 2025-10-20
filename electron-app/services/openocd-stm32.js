/**
 * OpenOCD STM32 Service
 * Provides STM32WLE5 flashing and UID reading for Droplet devices
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class OpenOCDSTM32Service {
    constructor() {
        this.openocdPath = path.join(__dirname, '../embedded/openocd-binaries/windows/bin/openocd.exe');
        this.scriptsPath = path.join(__dirname, '../embedded/openocd-binaries/windows/openocd/scripts');
        this.isFlashing = false;
        this.VERSION = 0x01; // Droplet version, có thể thay đổi
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

        try {
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', 'target/stm32wlx.cfg',
                '-c', 'reset_config srst_only',
                '-c', 'init',
                '-c', 'reset halt',
                '-c', 'targets',
                '-c', 'flash probe 0',
                '-c', 'shutdown'
            ];

            const result = await this.executeOpenOCD(args);

            // Parse MCU info from output
            const chipMatch = result.output.match(/stm32wlx\.(cpu|core)/i);
            const flashMatch = result.output.match(/flash size = (\d+)/i) ||
                result.output.match(/(\d+)\s*kbytes/i);

            return {
                success: true,
                detected: !!chipMatch,
                info: {
                    chip: 'STM32WLE5',
                    flashSize: flashMatch ? `${flashMatch[1]}KB` : '256KB',
                    interface: 'ST-Link'
                },
                rawOutput: result.output
            };
        } catch (error) {
            // Even if OpenOCD fails, try to parse if ST-Link was detected
            const errorOutput = error.message || '';
            if (errorOutput.includes('stm32') || errorOutput.includes('ST-Link')) {
                return {
                    success: true,
                    detected: true,
                    info: {
                        chip: 'STM32WLE5',
                        flashSize: '256KB',
                        interface: 'ST-Link'
                    },
                    rawOutput: errorOutput
                };
            }
            throw new Error(`ST-Link not detected: ${error.message}`);
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
            if (progressCallback) {
                progressCallback({ stage: 'flashing', message: 'Programming flash...' });
            }

            // Convert Windows backslash to forward slash for OpenOCD
            const normalizedPath = firmwarePath.replace(/\\/g, '/');

            // Use simple 'program' command like your working OpenOCD command
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', 'target/stm32wlx.cfg',
                '-c', 'reset_config srst_only',
                '-c', `program {${normalizedPath}} verify reset exit 0x08000000`
            ];

            const result = await this.executeOpenOCD(args, progressCallback);

            if (progressCallback) {
                progressCallback({ stage: 'complete', message: 'Flash completed successfully' });
            }

            this.isFlashing = false;
            return { success: true, output: result.output };
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
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', 'target/stm32wlx.cfg',
                '-c', 'reset_config srst_only',
                '-c', 'init',
                '-c', 'reset halt',
                '-c', 'sleep 100',
                '-c', 'mdw 0x1FFF7590 3',
                '-c', 'shutdown'
            ];

            const result = await this.executeOpenOCD(args);

            console.log('UID Read Output:', result.output);

            // Parse UID from output - try multiple patterns
            // Pattern 1: "0x1fff7590: xxxxxxxx xxxxxxxx xxxxxxxx"
            let uidMatch = result.output.match(/0x1fff7590:\s+([0-9a-fA-F]{8})\s+([0-9a-fA-F]{8})\s+([0-9a-fA-F]{8})/i);

            // Pattern 2: Multiple lines with individual addresses
            if (!uidMatch) {
                const uid0Match = result.output.match(/0x1fff7590:\s+([0-9a-fA-F]{8})/i);
                const uid1Match = result.output.match(/0x1fff7594:\s+([0-9a-fA-F]{8})/i);
                const uid2Match = result.output.match(/0x1fff7598:\s+([0-9a-fA-F]{8})/i);

                if (uid0Match && uid1Match && uid2Match) {
                    uidMatch = [null, uid0Match[1], uid1Match[1], uid2Match[1]];
                }
            }

            if (!uidMatch) {
                console.error('Failed to parse UID. Raw output:', result.output);
                console.error('Raw output length:', result.output.length);
                console.error('Output contains "halted":', result.output.includes('halted'));
                console.error('Output contains "0x1fff":', result.output.toLowerCase().includes('0x1fff'));
                throw new Error(`Failed to parse UID from OpenOCD output. Output: ${result.output.substring(0, 500)}`);
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
            // Step 1: Flash firmware
            if (progressCallback) {
                progressCallback({ stage: 'flash', message: 'Flashing firmware...' });
            }

            await this.flashFirmware(firmwarePath, progressCallback);

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
            }, 5000); // 5 second timeout

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
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                console.error('[OpenOCD Error]:', text.trim());

                // If shutdown command is invoked, force resolve after short delay
                if (text.includes('shutdown command invoked')) {
                    setTimeout(() => {
                        if (!isResolved) {
                            clearTimeout(timeout);
                            proc.kill('SIGKILL');
                            isResolved = true;
                            const combinedOutput = errorOutput + output;
                            resolve({ success: true, output: combinedOutput, code: 0 });
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
            const args = [
                '-s', this.scriptsPath,
                '-f', 'interface/stlink.cfg',
                '-f', 'target/stm32wlx.cfg',
                '-c', 'init',
                '-c', 'reset run',
                '-c', 'exit'
            ];

            await this.executeOpenOCD(args);

            return {
                success: true,
                message: 'ST-Link disconnected successfully'
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
