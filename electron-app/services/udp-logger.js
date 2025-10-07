const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

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
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs
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
      const log = {
        timestamp: new Date().toISOString(),
        message: msg.toString(),
        from: `${rinfo.address}:${rinfo.port}`,
        size: rinfo.size
      };
      
      // Add to logs array
      this.logs.unshift(log); // Add to beginning
      if (this.logs.length > this.maxLogs) {
        this.logs.pop(); // Remove oldest
      }
      
      const logEntry = `UDP [${log.from}]: ${log.message}`;
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
   * Get all stored logs
   * @returns {Array} - Array of log objects
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Clear all stored logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Save logs to a file
   * @param {string} filePath - Path to save the log file
   * @param {string} format - Format to save logs in ('txt', 'json', 'csv')
   * @param {boolean} append - Whether to append to existing file (default: false)
   * @returns {Promise<object>} - Result object with success status and message
   */
  async saveLogs(filePath, format = 'txt', append = false) {
    try {
      if (this.logs.length === 0) {
        return {
          success: false,
          message: 'No logs to save'
        };
      }

      let content = '';
      const fileExists = fs.existsSync(filePath);
      
      switch (format.toLowerCase()) {
        case 'json':
          if (append && fileExists) {
            // For JSON append, we need to merge arrays
            try {
              const existingContent = fs.readFileSync(filePath, 'utf8');
              const existingLogs = JSON.parse(existingContent);
              const mergedLogs = [...existingLogs, ...this.logs];
              content = JSON.stringify(mergedLogs, null, 2);
            } catch (e) {
              // If existing file is invalid JSON, overwrite it
              content = JSON.stringify(this.logs, null, 2);
            }
          } else {
            content = JSON.stringify(this.logs, null, 2);
          }
          break;
          
        case 'csv':
          // CSV header (only if not appending or file doesn't exist)
          if (!append || !fileExists) {
            content = 'Timestamp,Source,Size,Message\n';
          }
          // CSV rows
          this.logs.forEach(log => {
            const message = log.message.replace(/"/g, '""'); // Escape quotes
            content += `"${log.timestamp}","${log.from}",${log.size},"${message}"\n`;
          });
          break;
          
        case 'txt':
        default:
          // Plain text format
          this.logs.forEach(log => {
            content += `[${log.timestamp}] [${log.from}] ${log.message}\n`;
          });
          break;
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write or append file
      if (append && fileExists && format.toLowerCase() !== 'json') {
        fs.appendFileSync(filePath, content, 'utf8');
      } else {
        fs.writeFileSync(filePath, content, 'utf8');
      }

      return {
        success: true,
        message: append 
          ? `Logs appended successfully to ${filePath}` 
          : `Logs saved successfully to ${filePath}`,
        logCount: this.logs.length,
        filePath: filePath,
        mode: append ? 'append' : 'overwrite'
      };
    } catch (error) {
      console.error('Error saving logs:', error);
      return {
        success: false,
        message: `Failed to save logs: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Export logs as a formatted string
   * @param {string} format - Format to export ('txt', 'json', 'csv')
   * @returns {string} - Formatted log content
   */
  exportLogsAsString(format = 'txt') {
    if (this.logs.length === 0) {
      return '';
    }

    let content = '';
    
    switch (format.toLowerCase()) {
      case 'json':
        content = JSON.stringify(this.logs, null, 2);
        break;
        
      case 'csv':
        content = 'Timestamp,Source,Size,Message\n';
        this.logs.forEach(log => {
          const message = log.message.replace(/"/g, '""');
          content += `"${log.timestamp}","${log.from}",${log.size},"${message}"\n`;
        });
        break;
        
      case 'txt':
      default:
        this.logs.forEach(log => {
          content += `[${log.timestamp}] [${log.from}] ${log.message}\n`;
        });
        break;
    }

    return content;
  }

  /**
   * Get the current status
   * @returns {object} - Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      logCount: this.logs.length
    };
  }
}

module.exports = UDPLogger;
