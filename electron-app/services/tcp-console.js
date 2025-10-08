const net = require('net');
const EventEmitter = require('events');

class TCPConsoleClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.messages = [];
    this.isConnected = false;
    this.host = '192.168.15.10';
    this.port = 56789;
    this.maxMessages = 1000;
    this.reconnectTimer = null;
    this.autoReconnect = false;
  }

  connect(host = '192.168.15.10', port = 56789) {
    if (this.isConnected) {
      console.log('TCP Console Client: Already connected');
      return;
    }

    this.host = host;
    this.port = port;

    console.log(`TCP Console Client: Connecting to ${host}:${port}...`);
    
    this.client = new net.Socket();
    
    this.client.connect(port, host, () => {
      console.log(`TCP Console Client: Connected to ${host}:${port}`);
      this.isConnected = true;
      this.emit('status-change', { 
        isConnected: true, 
        host: this.host, 
        port: this.port,
        message: 'Connected successfully'
      });
      
      // Don't add system message to display, just emit status change
      // this.addMessage('SYSTEM', `Connected to ${host}:${port}`, 'system');
    });

    this.client.on('data', (data) => {
      const message = data.toString();
      console.log(`TCP Console Client: Received: ${message}`);
      
      // Split by lines and add each line as a message (including empty lines)
      const lines = message.split(/\r?\n/);
      lines.forEach((line, index) => {
        // Skip the last empty line from split (if message ends with \n)
        if (index === lines.length - 1 && line === '') {
          return;
        }
        this.addMessage('SERVER', line, 'received');
      });
      
      this.emit('data', message);
    });

    this.client.on('close', () => {
      console.log('TCP Console Client: Connection closed');
      this.isConnected = false;
      this.emit('status-change', { 
        isConnected: false, 
        host: this.host, 
        port: this.port,
        message: 'Connection closed'
      });
      
      // Don't add system message to display, just emit status change
      // this.addMessage('SYSTEM', 'Connection closed', 'system');
      
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.client.on('error', (err) => {
      console.error(`TCP Console Client: Error - ${err.message}`);
      this.isConnected = false;
      this.emit('status-change', { 
        isConnected: false, 
        host: this.host, 
        port: this.port,
        error: err.message,
        message: `Error: ${err.message}`
      });
      
      // Don't add error message to display, status message shown in UI already
      // this.addMessage('SYSTEM', `Error: ${err.message}`, 'error');
    });
  }

  disconnect() {
    if (!this.isConnected && !this.client) {
      console.log('TCP Console Client: Not connected');
      return;
    }

    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    
    this.isConnected = false;
    // Don't add system message to display
    // this.addMessage('SYSTEM', 'Disconnected', 'system');
    this.emit('status-change', { 
      isConnected: false, 
      host: this.host, 
      port: this.port,
      message: 'Disconnected'
    });
  }

  send(message) {
    if (!this.isConnected || !this.client) {
      console.error('TCP Console Client: Not connected');
      // Don't add error to display, status is shown in UI
      // this.addMessage('SYSTEM', 'Cannot send: Not connected', 'error');
      return false;
    }

    try {
      this.client.write(message + '\r\n');
      this.addMessage('CLIENT', message, 'sent');
      console.log(`TCP Console Client: Sent: ${message}`);
      return true;
    } catch (err) {
      console.error(`TCP Console Client: Send error - ${err.message}`);
      // Don't add error to display
      // this.addMessage('SYSTEM', `Send error: ${err.message}`, 'error');
      return false;
    }
  }

  addMessage(from, message, type) {
    const logEntry = {
      timestamp: Date.now(),
      from: from,
      message: message,
      type: type
    };
    
    this.messages.unshift(logEntry);
    if (this.messages.length > this.maxMessages) {
      this.messages.pop();
    }
    
    this.emit('message', logEntry);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      console.log('TCP Console Client: Attempting to reconnect...');
      this.connect(this.host, this.port);
    }, 5000);
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      host: this.host,
      port: this.port,
      messageCount: this.messages.length,
      autoReconnect: this.autoReconnect
    };
  }

  getMessages() {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
    this.emit('messages-cleared');
  }

  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

module.exports = TCPConsoleClient;

