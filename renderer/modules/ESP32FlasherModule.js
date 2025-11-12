/**
 * ESP32 Flasher Module (Native esptool binary)
 * Uses backend IPC to flash ESP32 devices with native esptool binaries
 */
class ESP32FlasherModule {
  constructor(app) {
    this.app = app;
    this.isFlashing = false;
    this.selectedFirmware = null;
    this.selectedFirmwarePath = '';
    this.progress = {
      stage: '',
      progress: 0,
      message: '',
      chipType: null
    };

    // Listen for progress updates from backend
    window.electronAPI.onFlasherProgress((progress) => {
      this.progress = { ...this.progress, ...progress };
      this.app.render();
    });
  }

  /**
   * Select firmware file using file dialog
   */
  async selectFirmwareFile() {
    try {
      const result = await window.electronAPI.showFirmwareDialog();

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        this.selectedFirmwarePath = result.filePaths[0];
        this.selectedFirmware = {
          name: this.selectedFirmwarePath.split(/[/\\]/).pop(),
          path: this.selectedFirmwarePath
        };

        return {
          success: true,
          file: this.selectedFirmware,
          name: this.selectedFirmware.name,
          path: this.selectedFirmwarePath
        };
      }

      return { success: false };
    } catch (error) {
      console.error('Error selecting firmware file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect chip type
   */
  async detectChip(port) {
    try {
      this.progress = {
        stage: 'detecting',
        progress: 5,
        message: 'Detecting chip type...',
        chipType: null
      };
      this.app.render();

      const result = await window.electronAPI.detectChip(port);

      if (result.success) {
        this.progress = {
          stage: 'detected',
          progress: 10,
          message: `Detected ${result.chipType}`,
          chipType: result.chipType
        };
      } else {
        this.progress = {
          stage: 'failed',
          progress: 0,
          message: result.error || 'Chip detection failed',
          chipType: null
        };
      }

      this.app.render();
      return result;
    } catch (error) {
      console.error('Error detecting chip:', error);
      this.progress = {
        stage: 'failed',
        progress: 0,
        message: error.message,
        chipType: null
      };
      this.app.render();
      return { success: false, error: error.message };
    }
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
      eraseFlash = true
    } = options;

    try {
      this.isFlashing = true;
      this.progress = {
        stage: 'starting',
        progress: 0,
        message: 'Starting flash operation...',
        chipType: null
      };
      this.app.render();

      const result = await window.electronAPI.flashFirmware({
        port,
        firmwarePath,
        baudRate,
        flashAddress,
        eraseFlash
      });

      this.isFlashing = false;

      if (result.success) {
        this.progress = {
          stage: 'complete',
          progress: 100,
          message: 'Flash completed successfully!',
          chipType: this.progress.chipType
        };
      } else {
        this.progress = {
          stage: 'failed',
          progress: 0,
          message: result.error || 'Flash failed',
          chipType: null
        };
      }

      this.app.render();
      return result;
    } catch (error) {
      console.error('Flash error:', error);
      this.isFlashing = false;
      this.progress = {
        stage: 'failed',
        progress: 0,
        message: error.message,
        chipType: null
      };
      this.app.render();
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel ongoing flash operation
   */
  async cancelFlash() {
    try {
      const result = await window.electronAPI.cancelFlash();
      this.isFlashing = false;
      this.progress = {
        stage: 'cancelled',
        progress: 0,
        message: 'Flash operation cancelled',
        chipType: null
      };
      this.app.render();
      return result;
    } catch (error) {
      console.error('Error cancelling flash:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isFlashing: this.isFlashing,
      stage: this.progress.stage,
      progress: this.progress.progress,
      chipType: this.progress.chipType,
      selectedFirmware: this.selectedFirmwarePath
    };
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.ESP32FlasherModule = ESP32FlasherModule;
}
