const dgram = require('dgram');

/**
 * UDP Logger Service
 * Listens for UDP packets and logs them to the UI
 */
class UDPLogger {
  constructor() {
    this.server = null;
    this.port = 56789;
    this.isRunning = false;
    this.onLogCallback = null;
  }

  /**
   * Start the UDP logger
   * @param {number} port - Port to listen on (default: 56789)
   * @param {function} onLog - Callback function for log messages
   */
  start(port = 56789, onLog) {
    if (this.isRunning) {
      console.log('UDP Logger already running');
      return;
    }

    this.port = port;
    this.onLogCallback = onLog;
    this.server = dgram.createSocket('udp4');

    this.server.on('error', (err) => {
      console.error('UDP Logger error:', err);
      this.stop();
    });

    this.server.on('message', (msg, rinfo) => {
      const logMessage = this.stripAnsiCodes(msg.toString());
      const logEntry = `UDP [${rinfo.address}:${rinfo.port}]: ${logMessage}`;
      
      console.log(logEntry);
      
      if (this.onLogCallback) {
        this.onLogCallback(logEntry);
      }
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`UDP Logger listening on ${address.address}:${address.port}`);
      this.isRunning = true;
    });

    this.server.bind(this.port, '0.0.0.0');
  }

  /**
   * Stop the UDP logger
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('UDP Logger stopped');
        this.isRunning = false;
        this.server = null;
      });
    }
  }

  /**
   * Strip ANSI color codes from log messages
   * @param {string} str - String with ANSI codes
   * @returns {string} - Clean string
   */
  stripAnsiCodes(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get the current status
   * @returns {object} - Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port
    };
  }
}

module.exports = UDPLogger;
