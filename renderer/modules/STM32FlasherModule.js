/**
 * STM32 Droplet Flasher Module
 * UI for flashing STM32WLE5 Droplet devices
 */

class STM32FlasherModule {
  constructor() {
    this.firmwarePath = '';
    this.isFlashing = false;
    this.isDetecting = false;
    this.isContinuousDetecting = false;
    this.continuousDetectionInterval = null;
    this.flashProgress = '';
    this.flashResult = null;
    this.version = 192; // Droplet version for LoRa ID calculation (default)
    this.stlinkDetected = false;
    this.mcuInfo = null;

    // Device type management
    this.deviceTypes = {};
    this.currentDeviceType = 'DROPLET';

    // Mismatch detection
    this.mcuMismatch = false;
    this.detectedType = null;
    this.selectedType = null;
    this.backendStatus = null;
    this._detectionTimerId = null;

    // Flash protection
    this.flashProtected = false;
    this.protectionInfo = null;
    this.powerCycleRequired = false;
    this.isUnlocking = false;

    // Connection monitoring
    this._connectionCheckInterval = null;
    this._connectionCheckIntervalMs = 15000; // Check every 15 seconds (reduced frequency to avoid too many OpenOCD calls)
    this._connectionLostWarningShown = false;
    this._connectionFailCount = 0; // Track consecutive failures
    this._maxConnectionFailures = 3; // Allow 3 consecutive failures before disconnecting
  }

  async init() {
    // Load device types
    try {
      this.deviceTypes = await electronAPI.getSTM32DeviceTypes();
      const currentType = await electronAPI.getCurrentSTM32DeviceType();
      this.currentDeviceType = currentType.deviceType;
    } catch (error) {
      // console.error('Failed to load device types:', error);
      // Fallback defaults
      this.deviceTypes = {
        DROPLET: { name: 'Droplet', mcu: 'STM32WLE5', supportsLoRaID: true },
        ZONE_CONTROLLER: { name: 'Zone Controller', mcu: 'STM32F030C8T6', supportsLoRaID: false },
        MICRO_EDGE: { name: 'Micro Edge', mcu: 'STM32L432KBU6', supportsLoRaID: true }
      };
    }

    // Listen for flash progress events
    electronAPI.onMenuEvent('stm32:flash-progress', (data) => {
      this.flashProgress = data.message;
      this.updateProgressDisplay();
    });

    electronAPI.onMenuEvent('stm32:flash-complete', (data) => {
      this.isFlashing = false;
      this.flashResult = data;
      this.render();
    });

    electronAPI.onMenuEvent('stm32:flash-error', (data) => {
      this.isFlashing = false;
      this.flashProgress = `Error: ${data.error}`;
      this.render();
    });

    // Get backend status (OpenOCD or CubeProg CLI availability)
    try {
      this.backendStatus = await electronAPI.getSTM32Status();
    } catch (e) {
      this.backendStatus = null;
    }
  }

  async detectSTLink() {
    if (this.isDetecting) {
      return;
    }

    try {
      this.isDetecting = true;
      // clear any previous connect token
      this._connectToken = null;

      // All devices (Droplet, Zone Controller, Micro Edge) now use the same detection mechanism
      this.flashProgress = 'Detecting ST-Link and MCU...';

      // Stop any existing connection monitoring
      this.stopConnectionMonitoring();

      // Reset ALL detection state before new detection
      this.stlinkDetected = false;
      this.mcuInfo = null;
      this.mcuMismatch = false;
      this.detectedType = null;
      this.selectedType = null;
      this.flashProtected = false;
      this.protectionInfo = null;
      this.powerCycleRequired = false;
      this._connectionLostWarningShown = false;
      this.flashResult = null; // Clear previous flash result (e.g., "Flash Successful")

      this.render();

      // console.log('=== FRONTEND: Starting fresh detection ===');
      // console.log('Current device type:', this.currentDeviceType);

      const result = await electronAPI.detectSTM32();

      // console.log('=== FRONTEND: Detection result ===');
      // console.log('Raw result:', JSON.stringify(result, null, 2));
      // console.log('Success:', result.success);
      // console.log('Detected flag:', result.detected);
      // console.log('Mismatch:', result.mismatch);
      // console.log('Detected type:', result.detectedType);
      // console.log('Selected type:', result.selectedType);

      this.isDetecting = false;

      if (result.success && result.detected) {
        // Only update state if device was actually detected
        this.stlinkDetected = true;
        this.mcuInfo = result.info;
        this.mcuMismatch = result.mismatch === true; // Strict check
        this.detectedType = result.detectedType;
        this.selectedType = result.selectedType;

        // console.log('=== FRONTEND: Processing detection ===');
        // console.log('mcuMismatch:', this.mcuMismatch);
        // console.log('detectedType:', this.detectedType);
        // console.log('selectedType:', this.selectedType);

        if (this.mcuMismatch === true && this.detectedType && this.selectedType) {
          // Device mismatch detected - auto disconnect and force reselection
          const detectedDevice = this.deviceTypes[this.detectedType];
          const selectedDevice = this.deviceTypes[this.selectedType];

          // Stop connection monitoring if running
          this.stopConnectionMonitoring();

          this.flashProgress = `⚠️ DEVICE TYPE MISMATCH!\n\n` +
            `Detected device: ${detectedDevice.name} (${detectedDevice.mcu})\n` +
            `Selected device: ${selectedDevice.name} (${selectedDevice.mcu})\n\n` +
            `Auto disconnecting...`;

          this.render();

          // Auto disconnect
          try {
            await electronAPI.disconnectSTM32();
          } catch (disconnectError) {
            console.log('Disconnect error (ignored):', disconnectError);
          }

          // Reset state
          this.stlinkDetected = false;
          this.mcuInfo = null;
          this.mcuMismatch = false;
          this.detectedType = null;
          this.selectedType = null;
          this.flashProtected = false;
          this.protectionInfo = null;
          this._connectionLostWarningShown = false;
          this.flashResult = null; // Clear previous flash result

          // Show alert and force reselection
          setTimeout(() => {
            alert(
              `⚠️ WRONG DEVICE TYPE DETECTED!\n\n` +
              `The connected device does not match the selected device type.\n\n` +
              `Detected device: ${detectedDevice.name} (${detectedDevice.mcu})\n` +
              `Selected device: ${selectedDevice.name} (${selectedDevice.mcu})\n\n` +
              `The device has been disconnected.\n\n` +
              `Please:\n` +
              `1. Select "${detectedDevice.name}" from the device type dropdown\n` +
              `2. Click "Detect ST-Link" again`
            );

            this.flashProgress = `⚠️ Please select "${detectedDevice.name}" from the dropdown and click "Detect ST-Link" again.`;
            this.render();
          }, 500);
        } else {
          // Device detected and matches selected type
          this.flashProgress = 'ST-Link detected successfully! Device type matches.';

          // Start continuous connection monitoring
          this._connectionFailCount = 0; // Reset failure counter on successful detection
          this.startConnectionMonitoring();

          // Check flash protection status
          console.log('[UI] Protection result:', result.protection);
          if (result.protection) {
            this.protectionInfo = result.protection;

            // Check if there's a mismatch (OPTR=0xAA but flash probe still shows RDP level 1)
            // This indicates power cycle is required
            if (result.protection.note && result.protection.note.includes('power cycle')) {
              // OPTR shows 0xAA but flash probe still shows RDP level 1
              this.powerCycleRequired = true;
              this.flashProtected = true; // Keep protected until power cycle
              this.flashProgress = '⚠️ POWER CYCLE REQUIRED\n\n' +
                'OPTR has been unlocked (0xAA) but flash controller still shows RDP Level 1.\n\n' +
                'Please:\n' +
                '1. Power off STM32 (unplug USB or disconnect power)\n' +
                '2. Wait 2-3 seconds\n' +
                '3. Power on again\n' +
                '4. Click "Detect ST-Link" again to verify';
            } else {
              // Normal protection check
              this.flashProtected = result.protection.isProtected === true;
              this.powerCycleRequired = false;

              console.log('[UI] Flash protected:', this.flashProtected);
              console.log('[UI] RDP Level:', result.protection.rdpLevel);

              if (this.flashProtected) {
                const rdpLevel = result.protection.rdpLevel || 0;
                if (rdpLevel === 1) {
                  this.flashProgress += '\n\n⚠️ Flash is PROTECTED (RDP Level 1). You need to unlock before flashing.';
                } else if (rdpLevel === 2) {
                  this.flashProgress += '\n\n❌ Flash is PERMANENTLY PROTECTED (RDP Level 2). Cannot unlock.';
                } else {
                  this.flashProgress += '\n\n⚠️ Flash is PROTECTED. You need to unlock before flashing.';
                }
              } else {
                console.log('[UI] Flash is not protected (RDP Level 0)');
              }
            }
          } else {
            console.log('[UI] No protection info in result');
          }
        }
      } else if (result.success && !result.detected) {
        // ST-Link found but chip not responding
        this.flashProgress = 'ST-Link found but unable to connect to chip. Please check:\n' +
          '• Chip is properly powered\n' +
          '• SWD connections are correct\n' +
          '• Try unplugging and replugging ST-Link';
      } else {
        // No ST-Link found
        this.flashProgress = 'ST-Link not detected. Please check connection.';
      }

      this.render();
    } catch (error) {
      this.isDetecting = false;
      this.flashResult = null; // Clear previous flash result on error
      this.flashProgress = `Detection failed: ${error.message}`;
      this.render();
      // console.error('Detection error:', error);
    }
  }

  async handleDeviceTypeChange(deviceType) {
    try {
      const result = await electronAPI.setSTM32DeviceType(deviceType);
      if (result.success) {
        this.currentDeviceType = deviceType;

        // Reset all detection state when changing device type
        this._connectToken = null;
        this.stlinkDetected = false;
        this.mcuInfo = null;
        this.flashResult = null;
        this.mcuMismatch = false;
        this.detectedType = null;
        this.selectedType = null;
        this.flashProtected = false;
        this.protectionInfo = null;

        this.flashProgress = `Switched to ${result.deviceType.name} (${result.deviceType.mcu}). Please detect again.`;
        this.render();
      }
    } catch (error) {
      this.flashProgress = `Failed to change device type: ${error.message}`;
      this.render();
      // console.error('Device type change error:', error);
    }
  }

  async disconnectSTLink() {
    try {
      // Stop connection monitoring
      this.stopConnectionMonitoring();

      this.flashProgress = 'Disconnecting ST-Link...';
      this.render();

      const result = await electronAPI.disconnectSTM32();

      if (result.success) {
        // Reset all detection state
        this._connectToken = null;
        this.stlinkDetected = false;
        this.mcuInfo = null;
        this.flashResult = null;
        this.mcuMismatch = false;
        this.detectedType = null;
        this.selectedType = null;
        this.flashProtected = false;
        this.protectionInfo = null;
        this._connectionLostWarningShown = false;

        this.flashProgress = 'ST-Link disconnected. Please select device type and detect again.';
      } else {
        this.flashProgress = 'Failed to disconnect ST-Link';
      }
      this.render();
    } catch (error) {
      this.flashResult = null; // Clear previous flash result on error
      this.flashProgress = `Disconnect error: ${error.message}`;
      this.render();
      // console.error('Disconnect error:', error);
    }
  }

  async forceRelease() {
    try {
      // Cancel any ongoing continuous detection
      if (this.isContinuousDetecting) {
        this.stopContinuousDetection();
      }
      // Immediately clear frontend detection state so UI stops showing Connecting...
      this._connectToken = null;
      this.stlinkDetected = false;
      this.mcuInfo = null;
      this.isDetecting = false;
      this.isContinuousDetecting = false;
      this.flashProgress = 'Attempting immediate abort of backend processes...';
      this.render();

      // First attempt an immediate abort (best-effort kill of OpenOCD and CubeCLI)
      let abortRes = null;
      try {
        abortRes = await electronAPI.abortSTM32();
      } catch (err) {
        abortRes = { success: false, error: err && err.message ? err.message : String(err) };
      }

      // If abort succeeded, clear frontend state and inform the operator
      if (abortRes && abortRes.success) {
        this._connectToken = null;
        this.stlinkDetected = false;
        this.mcuInfo = null;
        this.flashResult = null;
        // Clear detection UI state immediately so operator can attempt fresh detect
        this._connectToken = null;
        this.isDetecting = false;
        this.isContinuousDetecting = false;
        if (this._detectionTimerId) { clearTimeout(this._detectionTimerId); this._detectionTimerId = null; }

        this.flashProgress = 'Backend abort executed. ST-Link processes should be terminated.' + (abortRes ? '\n' + JSON.stringify(abortRes, null, 2) : '');
        if (abortRes && abortRes.logTailCube) {
          this.flashProgress += '\n\n--- Last CubeCLI log ---\n' + abortRes.logTailCube.substring(Math.max(0, abortRes.logTailCube.length - 8000));
        }
        if (abortRes && abortRes.logTailOpenOCD) {
          this.flashProgress += '\n\n--- Last OpenOCD log ---\n' + abortRes.logTailOpenOCD.substring(Math.max(0, abortRes.logTailOpenOCD.length - 8000));
        }
        this.render();
      } else {
        // If abort didn't succeed, fall back to graceful disconnect then force kill
        this.flashProgress = 'Abort did not fully succeed, attempting graceful disconnect then force release...';
        this.render();

        try {
          const disc = await electronAPI.disconnectSTM32();
          if (disc && (disc.openocd || disc.cubecli)) {
            this.flashProgress = 'Graceful disconnect attempted. Proceeding to force release if still stuck.';
            this.render();
          }
        } catch (e) {
          // ignore and continue to force kill
        }

        const res = await electronAPI.forceReleaseSTM32();
        if (res && res.success) {
          this._connectToken = null;
          this.isDetecting = false;
          this.isContinuousDetecting = false;
          this.stlinkDetected = false;
          this.mcuInfo = null;
          this.flashResult = null;
          this.flashProgress = 'Force release attempted.' + (res && res.logTailCube ? '\n\n--- Last CubeCLI log ---\n' + res.logTailCube.substring(Math.max(0, res.logTailCube.length - 8000)) : '');
          if (res && res.logTailOpenOCD) this.flashProgress += '\n\n--- Last OpenOCD log ---\n' + res.logTailOpenOCD.substring(Math.max(0, res.logTailOpenOCD.length - 8000));
        } else {
          this.flashProgress = `Force release failed: ${res && res.error ? res.error : 'unknown'}`;
        }
        this.render();
      }
    } catch (e) {
      this.flashProgress = `Force release error: ${e.message}`;
      this.render();
    }
  }

  stopContinuousDetection() {
    this.isContinuousDetecting = false;
    this.isDetecting = false;
    if (this._detectionTimerId) {
      clearTimeout(this._detectionTimerId);
      this._detectionTimerId = null;
    }
    this.flashProgress = 'Detection cancelled by user.';
    this.render();

  }

  async selectFirmware() {
    try {
      const result = await electronAPI.selectFile({
        title: 'Select STM32 Firmware',
        filters: [
          { name: 'Binary Files', extensions: ['bin'] },
          { name: 'Hex Files', extensions: ['hex'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        this.firmwarePath = result.filePaths[0];
        this.render();
      }
    } catch (error) {
      // console.error('Failed to select firmware:', error);
      alert('Failed to select firmware file');
    }
  }

  async flashFirmware() {
    if (!this.firmwarePath) {
      alert('Please select a firmware file first');
      return;
    }

    if (this.isFlashing) {
      return;
    }

    // Check if flash is protected
    if (this.flashProtected) {
      if (this.protectionInfo && this.protectionInfo.rdpLevel === 2) {
        alert('❌ Flash is PERMANENTLY PROTECTED (RDP Level 2). Cannot unlock. Please use ST-Link Utility.');
        return;
      } else {
        const confirmed = confirm(
          '⚠️ Flash is PROTECTED!\n\n' +
          'You need to unlock the flash before flashing firmware.\n\n' +
          'Unlocking will ERASE ALL flash content.\n\n' +
          'Do you want to unlock now?'
        );

        if (confirmed) {
          await this.unlockFlash();
          // After unlock, check if still protected
          if (this.flashProtected) {
            alert('Unlock failed. Please try again or use ST-Link Utility.');
            return;
          }
        } else {
          return; // User cancelled
        }
      }
    }

    try {
      this.isFlashing = true;
      this.flashProgress = 'Starting flash operation...';
      this.flashResult = null;
      this.render();

      // All devices (Droplet, Zone Controller, Micro Edge) use the same flash mechanism
      const result = await electronAPI.flashSTM32Droplet(this.firmwarePath, this.version);
      // console.log('[STM32Flasher] Flash result:', result);

      this.isFlashing = false;
      this.flashResult = result;

      // Check device type to show appropriate message
      const deviceConfig = this.deviceTypes[this.currentDeviceType] || {};
      if (deviceConfig.supportsLoRaID && result.loraID) {
        this.flashProgress = 'Flash completed successfully! LoRa ID generated.';
      } else {
        this.flashProgress = 'Flash completed successfully!';
      }

      this.render();
      // console.log('[STM32Flasher] Render complete, UI should be responsive now');
    } catch (error) {
      this.isFlashing = false;
      this.flashProgress = `Flash failed: ${error.message}`;
      this.render();
      // console.error('Flash error:', error);
    }
  }

  async readDeviceInfo() {
    try {
      this.flashProgress = 'Reading device info...';
      this.render();

      const result = await electronAPI.readSTM32UID();

      this.flashResult = result;
      this.flashProgress = 'Device info read successfully!';
      this.render();
    } catch (error) {
      this.flashProgress = `Failed to read device info: ${error.message}`;
      this.render();
      // console.error('Read UID error:', error);
    }
  }

  async unlockFlash() {
    if (this.isUnlocking) {
      return;
    }

    if (!this.flashProtected) {
      alert('Flash is not protected. No need to unlock.');
      return;
    }

    if (this.protectionInfo && this.protectionInfo.rdpLevel === 2) {
      alert('Flash is permanently protected (RDP Level 2). Cannot unlock.');
      return;
    }

    // No need to verify connection before unlock - device is already detected
    // verifyConnection() calls detectSTM32Once() which executes mdw commands
    // This can cause disconnect and is unnecessary since device was already detected

    // Confirm with user
    const confirmed = confirm(
      '⚠️ WARNING: Unlocking flash protection will ERASE ALL FLASH CONTENT!\n\n' +
      'This includes:\n' +
      '• All firmware\n' +
      '• All user data\n' +
      '• Everything stored in flash memory\n\n' +
      'Are you sure you want to continue?'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.isUnlocking = true;
      this.powerCycleRequired = false;
      this.flashProgress = 'Unlocking flash protection (this will erase all flash)...';
      this.render();

      const result = await electronAPI.unlockSTM32Flash();

      if (result.success) {
        // Wait for device to stabilize after unlock before verifying
        // Unlock process may reset device, so we need to wait before checking protection
        this.flashProgress = 'Waiting for device to stabilize after unlock...';
        this.render();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

        // Verify unlock by checking both OPTR and flash probe with retry logic
        this.flashProgress = 'Verifying unlock status (checking OPTR and flash controller)...';
        this.render();

        let protectionCheck = null;
        let checkAttempts = 0;
        const maxCheckAttempts = 3;

        while (checkAttempts < maxCheckAttempts && !protectionCheck) {
          try {
            protectionCheck = await electronAPI.checkSTM32FlashProtection();
            break; // Success, exit retry loop
          } catch (checkError) {
            checkAttempts++;
            if (checkAttempts < maxCheckAttempts) {
              console.log(`[Unlock] Protection check attempt ${checkAttempts} failed, retrying in 1 second...`);
              this.flashProgress = `Verifying unlock status (attempt ${checkAttempts + 1}/${maxCheckAttempts})...`;
              this.render();
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            } else {
              // All attempts failed, handle error
              throw checkError;
            }
          }
        }

        if (protectionCheck) {
          this.protectionInfo = protectionCheck;

          // Priority 1: Check if there's a mismatch (OPTR=0xAA but flash probe still shows RDP level 1)
          // This means flash controller hasn't reloaded OPTR - needs power cycle
          const hasPowerCycleNote = protectionCheck.note && protectionCheck.note.includes('power cycle');
          const isMismatchAfterUnlock = protectionCheck.isProtected === true &&
            protectionCheck.rdpLevel === 1 &&
            !hasPowerCycleNote;

          if (hasPowerCycleNote || isMismatchAfterUnlock) {
            // OPTR = 0xAA but flash probe still shows RDP level 1
            this.powerCycleRequired = true;
            this.flashProtected = true; // Keep protected until power cycle
            this.flashProgress = '⚠️ POWER CYCLE REQUIRED\n\n' +
              'OPTR has been unlocked (0xAA) but flash controller still shows RDP Level 1.\n\n' +
              'Please:\n' +
              '1. Power off STM32 (unplug USB or disconnect power)\n' +
              '2. Wait 2-3 seconds\n' +
              '3. Power on again\n' +
              '4. Click "Detect ST-Link" again to verify';
          } else if (protectionCheck.isProtected === false) {
            // Both OPTR and flash probe confirm unlocked
            this.flashProtected = false;
            this.powerCycleRequired = false;
            this.flashProgress = '✅ Flash protection unlocked successfully! Flash has been erased. You can now flash new firmware.';
          } else {
            // Still protected (but not due to power cycle mismatch)
            this.flashProtected = true;
            this.powerCycleRequired = false;
            this.flashProgress = `⚠️ Flash is still protected. RDP Level: ${protectionCheck.rdpLevel || 'unknown'}\n\n` +
              'Please try unlocking again or use ST-Link Utility.';
          }
        }
      } else {
        this.flashProgress = `❌ Failed to unlock flash: ${result.error || 'Unknown error'}`;
      }

      this.render();
    } catch (error) {
      // Check if error message indicates power cycle requirement
      if (error.message && error.message.includes('POWER CYCLE')) {
        this.powerCycleRequired = true;
        this.flashProtected = true;
        this.flashProgress = '⚠️ POWER CYCLE REQUIRED\n\n' +
          'OPTR has been unlocked (0xAA) but flash controller still shows RDP Level 1.\n\n' +
          'Please:\n' +
          '1. Power off STM32 (unplug USB or disconnect power)\n' +
          '2. Wait 2-3 seconds\n' +
          '3. Power on again\n' +
          '4. Click "Detect ST-Link" again to verify';
      } else {
        // Don't assume connection lost - unlock may have succeeded even if verification failed
        this.flashProgress = `⚠️ Unlock completed but verification failed: ${error.message}\n\n` +
          'Please click "Detect ST-Link" to verify unlock status.';
      }
      this.render();
    } finally {
      this.isUnlocking = false;
    }
  }

  /**
   * Verify ST-Link connection is still active
   * @returns {Promise<boolean>} true if connected, false if disconnected
   */
  async verifyConnection() {
    try {
      // Quick check using detectSTM32Once (faster than full detect)
      const result = await electronAPI.detectSTM32Once(480);

      if (result && result.success && result.detected) {
        return true;
      }

      // If detect fails, connection is likely lost
      // Don't call protection check here as it's expensive and not needed for connection verification
      // Protection check should only be called explicitly (e.g., after unlock, before flash)
      return false;
    } catch (error) {
      console.log('[Connection Check] Connection lost:', error.message);
      return false;
    }
  }

  /**
   * Start continuous connection monitoring (polling)
   */
  startConnectionMonitoring() {
    // Stop any existing monitoring first
    this.stopConnectionMonitoring();

    // Only monitor if device is detected
    if (!this.stlinkDetected) {
      return;
    }

    // Connection monitoring disabled - verifyConnection() was causing false disconnects
    // Users can manually detect ST-Link when needed by clicking "Detect ST-Link" button
    console.log('[Connection Monitor] Connection monitoring disabled - verifyConnection() was causing disconnects');
    console.log('[Connection Monitor] Users can manually click "Detect ST-Link" to check connection');
    this._connectionLostWarningShown = false;

    // Keep the interval structure but don't actually check connection
    // This allows us to stop monitoring later if needed
    this._connectionCheckInterval = setInterval(() => {
      // Connection monitoring disabled - verifyConnection() was causing false disconnects
      // Do nothing - users will need to manually detect ST-Link when needed
    }, this._connectionCheckIntervalMs);
  }

  /**
   * Stop continuous connection monitoring
   */
  stopConnectionMonitoring() {
    if (this._connectionCheckInterval) {
      clearInterval(this._connectionCheckInterval);
      this._connectionCheckInterval = null;
      console.log('[Connection Monitor] Stopped connection monitoring');
    }
  }

  updateProgressDisplay() {
    const progressEl = document.getElementById('stm32-flash-progress');
    if (progressEl) {
      progressEl.textContent = this.flashProgress;
    }
  }

  handleVersionChange(value) {
    this.version = parseInt(value) || 1;
    // Update version via API
    electronAPI.setSTM32Version(this.version);
    // Only update hex display without full re-render
    this.updateVersionHexDisplay();
  }

  updateVersionHexDisplay() {
    const hexDisplay = document.getElementById('version-hex-display');
    if (hexDisplay) {
      hexDisplay.textContent = `0x${this.version.toString(16).padStart(2, '0').toUpperCase()}`;
    }
  }

  render() {
    const container = document.getElementById('stm32-flasher-container');
    if (!container) return;

    const deviceConfig = this.deviceTypes[this.currentDeviceType] || { name: 'Unknown', mcu: 'Unknown', supportsLoRaID: false };

    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold mb-6 text-gray-800">
          <i class="fas fa-microchip mr-2"></i>STM32 Flasher
        </h2>

        <!-- Device Type Selector -->
        <div class="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <i class="fas fa-cog mr-2"></i>Device Type Selection
          </h3>
          <div class="flex items-center gap-4">
            <label class="text-sm font-medium text-gray-700">Select Device:</label>
            <select 
              onchange="window.stm32Flasher.handleDeviceTypeChange(this.value)"
              class="flex-1 px-4 py-2 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              ${this.isFlashing ? 'disabled' : ''}
            >
              ${Object.keys(this.deviceTypes).map(key => `
                <option value="${key}" ${key === this.currentDeviceType ? 'selected' : ''}>
                  ${this.deviceTypes[key].name} (${this.deviceTypes[key].mcu})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="mt-2 text-sm text-gray-600">
            <i class="fas fa-info-circle mr-1"></i>
            Current: <b>${deviceConfig.name}</b> - <b>${deviceConfig.mcu}</b>
            ${deviceConfig.supportsLoRaID ? ' - Supports LoRa ID' : ''}
            ${this.currentDeviceType === 'MICRO_EDGE' && this.backendStatus ? `
              <div class="mt-1 text-xs text-gray-500">Backend: <b>${this.backendStatus.cubeCliAvailable ? 'STM32CubeProgrammer CLI' : (this.backendStatus.openocdAvailable ? 'OpenOCD' : 'None')}</b></div>
            ` : ''}
          </div>
        </div>

        <!-- Step 1: Detect ST-Link -->
        <div class="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full mr-2">1</span>
            Detect ST-Link & MCU
          </h3>
          <div class="flex gap-2">
            <button 
              onclick="window.stm32Flasher.detectSTLink()"
              class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              ${this.isDetecting || this.isFlashing ? 'disabled' : ''}
            >
              <i class="fas ${this.isDetecting ? 'fa-spinner fa-spin' : 'fa-search'} mr-2"></i>
              ${this.isDetecting ? 'Connecting...' : 'Detect ST-Link'}
            </button>
            
            ${this.isContinuousDetecting ? `
              <button 
                onclick="window.stm32Flasher.stopContinuousDetection()"
                class="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
              >
                <i class="fas fa-stop mr-2"></i>Cancel
              </button>
            ` : ''}
            
            ${this.stlinkDetected && !this.isContinuousDetecting ? `
              <button 
                onclick="window.stm32Flasher.disconnectSTLink()"
                class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                ${this.isFlashing ? 'disabled' : ''}
              >
                <i class="fas fa-unlink mr-2"></i>Disconnect
              </button>
            ` : ''}

            <button
              onclick="window.stm32Flasher.forceRelease()"
              class="px-6 py-3 bg-red-900 text-white rounded-lg hover:bg-red-800 transition-colors font-semibold"
            >
              <i class="fas fa-bolt mr-2"></i>Force Release ST-Link
            </button>
          </div>

          ${this.stlinkDetected && this.mcuInfo ? `
            <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="flex items-center mb-2">
                <i class="fas fa-check-circle text-green-600 mr-2"></i>
                <span class="font-semibold text-green-800">ST-Link Detected!</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><span class="text-gray-600">Chip:</span> <code class="ml-1 text-blue-600">${this.mcuInfo.chip || 'STM32WLE5'}</code></div>
                <div><span class="text-gray-600">Flash Size:</span> <code class="ml-1 text-blue-600">${this.mcuInfo.flashSize || '256KB'}</code></div>
              </div>
              
              ${this.flashProtected ? `
                <div class="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center">
                      <i class="fas fa-lock text-red-600 mr-2 text-xl"></i>
                      <div>
                        <span class="font-bold text-red-800 text-lg">Flash is PROTECTED</span>
                        ${this.protectionInfo && this.protectionInfo.rdpLevel ? `
                          <div class="text-sm text-red-600 mt-1">RDP Level ${this.protectionInfo.rdpLevel}</div>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                  <div class="text-sm text-red-700 mb-3">
                    ${this.protectionInfo && this.protectionInfo.rdpLevel === 2 ? `
                      <p class="font-semibold">⚠️ PERMANENTLY PROTECTED (RDP Level 2)</p>
                      <p>This device cannot be unlocked. Please use ST-Link Utility or contact support.</p>
                    ` : `
                      <p class="font-semibold">⚠️ Flash protection is enabled (RDP Level ${this.protectionInfo?.rdpLevel || 1})</p>
                      <p>You must unlock the flash before flashing firmware. <strong>Unlocking will ERASE ALL flash content!</strong></p>
                    `}
                  </div>
                  ${this.protectionInfo && this.protectionInfo.rdpLevel !== 2 ? `
                    <button 
                      onclick="window.stm32Flasher.unlockFlash()"
                      class="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                      ${this.isUnlocking || this.isFlashing ? 'disabled' : ''}
                    >
                      <i class="fas ${this.isUnlocking ? 'fa-spinner fa-spin' : 'fa-unlock'} mr-2"></i>
                      ${this.isUnlocking ? 'Unlocking...' : 'Unlock Flash (Will Erase All Flash)'}
                    </button>
                  ` : ''}
                  ${this.powerCycleRequired ? `
                    <div class="mt-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                      <div class="flex items-start">
                        <i class="fas fa-exclamation-triangle text-yellow-600 mr-2 text-xl mt-1"></i>
                        <div>
                          <p class="font-bold text-yellow-800 mb-2">⚠️ POWER CYCLE REQUIRED</p>
                          <p class="text-sm text-yellow-700 mb-2">
                            OPTR has been unlocked (0xAA) but flash controller still shows RDP Level 1.
                          </p>
                          <p class="text-sm text-yellow-700 mb-2">
                            <strong>Please:</strong>
                          </p>
                          <ol class="list-decimal ml-4 text-sm text-yellow-700">
                            <li>Power off STM32 (unplug USB or disconnect power)</li>
                            <li>Wait 2-3 seconds</li>
                            <li>Power on again</li>
                            <li>Click "Detect ST-Link" again to verify</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        ${this.stlinkDetected && !this.mcuMismatch && !this.flashProtected ? `
        <!-- Step 2: Version Setting (Only for Droplet) -->
        ${this.currentDeviceType === 'DROPLET' ? `
        <div class="mb-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-purple-500 text-white rounded-full mr-2">2</span>
            Set Droplet Version
          </h3>
          <div class="flex items-center gap-4">
            <label class="text-sm font-medium text-gray-700">
              Version (for LoRa ID calculation):
            </label>
            <input 
              type="number" 
              value="${this.version}"
              min="0"
              max="255"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              oninput="window.stm32Flasher.handleVersionChange(this.value)"
            />
            <span class="text-sm text-gray-600">Hex: <code id="version-hex-display" class="text-purple-600 font-mono">0x${this.version.toString(16).padStart(2, '0').toUpperCase()}</code></span>
          </div>
        </div>
        ` : ''}

        <!-- Step ${this.currentDeviceType === 'DROPLET' ? '3' : '2'}: Firmware Selection -->
        <div class="mb-6 p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-orange-500 text-white rounded-full mr-2">${this.currentDeviceType === 'DROPLET' ? '3' : '2'}</span>
            Select Firmware
          </h3>
          <div class="flex gap-2">
            <input 
              type="text" 
              value="${this.firmwarePath || 'No file selected'}"
              readonly
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              placeholder="Click Browse to select firmware file..."
            />
            <button 
              onclick="window.stm32Flasher.selectFirmware()"
              class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              ${this.isFlashing ? 'disabled' : ''}
            >
              <i class="fas fa-folder-open mr-2"></i>Browse
            </button>
          </div>
          ${this.firmwarePath ? `
            <div class="mt-2 text-sm text-green-600">
              <i class="fas fa-check-circle mr-1"></i>
              File selected: ${this.firmwarePath.split(/[\\/]/).pop()}
            </div>
          ` : ''}
        </div>

        <!-- Step ${this.currentDeviceType === 'DROPLET' ? '4' : '3'}: Flash Action -->
        <div class="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
          <h3 class="text-lg font-semibold mb-3 text-gray-800">
            <span class="inline-flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full mr-2">${this.currentDeviceType === 'DROPLET' ? '4' : '3'}</span>
            Flash ${this.currentDeviceType === 'DROPLET' ? '& Read Info' : 'Firmware'}
          </h3>
            <div class="flex gap-4">
              <button 
                onclick="window.stm32Flasher.flashFirmware()"
                class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                ${this.isFlashing || !this.firmwarePath ? 'disabled' : ''}
              >
                <i class="fas ${this.isFlashing ? 'fa-spinner fa-spin' : 'fa-upload'} mr-2"></i>
                ${this.isFlashing ? 'Flashing...' : (this.currentDeviceType === 'DROPLET' ? 'Flash & Read Info' : 'Flash Firmware')}
              </button>

            ${this.currentDeviceType === 'DROPLET' ? `
            <button 
              onclick="window.stm32Flasher.readDeviceInfo()"
              class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              ${this.isFlashing ? 'disabled' : ''}
            >
              <i class="fas fa-info-circle mr-2"></i>Read Info Only
            </button>
            ` : ''}
          </div>
        </div>
        ` : `
        <div class="p-8 text-left text-gray-700 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h4 class="text-lg font-bold mb-3 text-red-700"><i class="fas fa-exclamation-circle mr-2"></i>ST-Link Detection Troubleshooting</h4>
          <ol class="list-decimal ml-6 space-y-2 text-base">
            <li>Press and hold the <b>RESET</b> button on your device.</li>
            <li>While holding <b>RESET</b>, click <b>Detect ST-Link</b> in the app.</li>
            <li>Release the <b>RESET</b> button immediately after clicking detect.</li>
            <li>If detection still fails:
              <ul class="list-disc ml-6">
                <li>Ensure your ST-Link is properly connected to the PC and the target device.</li>
                <li>Try unplugging and re-plugging the ST-Link USB cable.</li>
                <li>Verify that no other software (e.g. ST-Link Utility, CubeProgrammer) is using the ST-Link.</li>
              </ul>
            </li>
          </ol>
          <p class="mt-4 text-sm text-gray-500">If the problem persists, check your wiring and ST-Link drivers.</p>
        </div>
        `}

        <!-- Progress Display -->
        ${this.flashProgress ? `
          <div class="mb-6 p-4 ${this.flashProgress.includes('Error') || this.flashProgress.includes('failed') ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg">
            <div class="flex items-center">
              ${this.isFlashing || this.isDetecting ?
          '<i class="fas fa-spinner fa-spin mr-2 text-blue-600"></i>' :
          this.flashProgress.includes('Error') || this.flashProgress.includes('failed') ?
            '<i class="fas fa-times-circle mr-2 text-red-600"></i>' :
            '<i class="fas fa-check-circle mr-2 text-green-600"></i>'
        }
              <span id="stm32-flash-progress" class="text-sm ${this.flashProgress.includes('Error') || this.flashProgress.includes('failed') ? 'text-red-700' : 'text-gray-700'}">${this.flashProgress}</span>
            </div>
          </div>
        ` : ''}

        <!-- Device Info Display -->
        ${this.flashResult && this.flashResult.success ? `
          <div class="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-blue-200 rounded-lg p-6 shadow-inner">
            <h3 class="text-xl font-bold mb-4 text-gray-800 flex items-center">
              <i class="fas fa-check-circle text-green-600 mr-2"></i>
              Flash Successful
            </h3>
            
            ${this.flashResult.uid && this.flashResult.loraID ? `
            <!-- UID Information -->
            <div class="mb-6 bg-white rounded-lg p-4 shadow-sm">
              <h4 class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Unique ID (UID)</h4>
              <div class="grid grid-cols-1 gap-3">
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span class="text-gray-600 font-medium">UID0:</span>
                  <code class="text-blue-600 font-mono font-bold">0x${this.flashResult.uid.uid0Hex}</code>
                </div>
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span class="text-gray-600 font-medium">UID1:</span>
                  <code class="text-blue-600 font-mono font-bold">0x${this.flashResult.uid.uid1Hex}</code>
                </div>
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span class="text-gray-600 font-medium">UID2:</span>
                  <code class="text-blue-600 font-mono font-bold">0x${this.flashResult.uid.uid2Hex}</code>
                </div>
              </div>
            </div>

            <!-- LoRa Device Address Information -->
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5 shadow-md">
              <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <i class="fas fa-broadcast-tower text-green-600 mr-2"></i>
                LoRa Device Address
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Address Info -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                    <span class="text-gray-600 font-medium">Address (Hex):</span>
                    <code class="text-2xl font-mono font-bold text-green-600">0x${this.flashResult.loraID.addressHex}</code>
                  </div>
                  <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                    <span class="text-gray-600 font-medium">Formatted:</span>
                    <code class="text-xl font-mono font-bold text-blue-600">${this.flashResult.loraID.addressFormatted}</code>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-white rounded">
                    <span class="text-gray-600 text-sm">Decimal:</span>
                    <code class="font-mono text-gray-700">${this.flashResult.loraID.address}</code>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-white rounded">
                    <span class="text-gray-600 text-sm">Version:</span>
                    <code class="font-mono text-gray-700">0x${this.flashResult.loraID.version.toString(16).padStart(2, '0').toUpperCase()}</code>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-white rounded">
                    <span class="text-gray-600 text-sm">UID XOR:</span>
                    <code class="font-mono text-gray-700">0x${this.flashResult.loraID.uid_temp.toString(16).padStart(8, '0').toUpperCase()}</code>
                  </div>
                  
                  <!-- Copy Button -->
                  <button 
                    onclick="navigator.clipboard.writeText('0x${this.flashResult.loraID.addressHex}').then(() => alert('LoRa address copied to clipboard!'))"
                    class="w-full mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    <i class="fas fa-copy mr-2"></i>Copy Address
                  </button>
                </div>
                
                <!-- QR Code -->
                <div class="flex flex-col items-center justify-center bg-white rounded-lg shadow-sm p-4">
                  <h5 class="text-sm font-semibold text-gray-700 mb-3">QR Code</h5>
                  <img 
                    src="${this.flashResult.loraID.qrCode}" 
                    alt="LoRa Device Address QR Code"
                    class="w-48 h-48 border-4 border-gray-200 rounded-lg"
                  />
                  <p class="text-xs text-gray-500 mt-2 text-center">Scan to copy address</p>
                </div>
              </div>
            </div>
            ` : `
            <!-- Zone Controller Success Message -->
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6 shadow-md text-center">
              <i class="fas fa-check-circle text-green-600 text-6xl mb-4"></i>
              <h4 class="text-2xl font-bold text-gray-800 mb-2">${this.flashResult.deviceType || 'Device'} Flashed Successfully!</h4>
              <p class="text-gray-600">${this.flashResult.message || 'Firmware has been programmed to the device.'}</p>
            </div>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  hide() {
    const container = document.getElementById('stm32-flasher-container');
    if (container) {
      container.innerHTML = '';
    }
  }
}

// Initialize module
window.stm32Flasher = new STM32FlasherModule();
