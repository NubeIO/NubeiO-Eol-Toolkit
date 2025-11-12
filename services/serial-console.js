/**
 * Serial Console Service
 * Provides serial port communication for ESP32 debugging
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class SerialConsole {
  constructor() {
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.portPath = '';
    this.baudRate = 115200;
    this.messages = [];
    this.maxMessages = 1000;
    this.onMessageCallback = null;
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
   * Connect to serial port
   */
  async connect(portPath, baudRate = 115200) {
    if (this.isConnected) {
      throw new Error('Already connected to a serial port');
    }

    try {
      this.portPath = portPath;
      this.baudRate = baudRate;

      console.log(`Connecting to serial port: ${portPath} @ ${baudRate} baud`);

      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        autoOpen: false
      });

      // Create parser for line-based reading
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

      // Set up event handlers
      this.parser.on('data', (data) => {
        const message = {
          timestamp: new Date().toISOString(),
          data: data.toString().trim()
        };

        this.messages.push(message);

        // Keep only last N messages
        if (this.messages.length > this.maxMessages) {
          this.messages.shift();
        }

        // Notify callback if set
        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      });

      this.port.on('error', (err) => {
        console.error('Serial port error:', err);
        if (this.onMessageCallback) {
          this.onMessageCallback({
            timestamp: new Date().toISOString(),
            data: `[ERROR] ${err.message}`,
            isError: true
          });
        }
      });

      this.port.on('close', () => {
        console.log('Serial port closed');
        this.isConnected = false;
        if (this.onMessageCallback) {
          this.onMessageCallback({
            timestamp: new Date().toISOString(),
            data: '[INFO] Serial port disconnected',
            isSystem: true
          });
        }
      });

      // Open the port
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) {
            reject(new Error(`Failed to open port: ${err.message}`));
          } else {
            this.isConnected = true;
            resolve();
          }
        });
      });

      console.log('Serial port connected successfully');
      return { success: true, port: portPath, baudRate: baudRate };
    } catch (error) {
      console.error('Failed to connect to serial port:', error);
      this.cleanup();
      throw error;
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
      console.log('Serial port disconnected');
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting serial port:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Send data to serial port
   */
  async send(data) {
    if (!this.isConnected || !this.port) {
      throw new Error('Not connected to a serial port');
    }

    try {
      // Add newline if not present
      const dataToSend = data.endsWith('\n') ? data : data + '\n';

      await new Promise((resolve, reject) => {
        this.port.write(dataToSend, (err) => {
          if (err) {
            reject(new Error(`Failed to send data: ${err.message}`));
          } else {
            this.port.drain((drainErr) => {
              if (drainErr) {
                reject(new Error(`Failed to drain: ${drainErr.message}`));
              } else {
                resolve();
              }
            });
          }
        });
      });

      // Add sent message to log
      const sentMessage = {
        timestamp: new Date().toISOString(),
        data: `> ${data}`,
        isSent: true
      };
      this.messages.push(sentMessage);

      if (this.onMessageCallback) {
        this.onMessageCallback(sentMessage);
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending data:', error);
      throw error;
    }
  }

  /**
   * Get current messages
   */
  getMessages() {
    return this.messages;
  }

  /**
   * Clear messages
   */
  clearMessages() {
    this.messages = [];
    return { success: true };
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      port: this.portPath,
      baudRate: this.baudRate,
      messageCount: this.messages.length
    };
  }

  /**
   * Set message callback
   */
  setMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isConnected = false;
    this.port = null;
    this.parser = null;
  }
}

module.exports = SerialConsole;

