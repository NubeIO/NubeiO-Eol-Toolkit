const net = require('net');
const EventEmitter = require('events');

class TCPConsoleClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.messages = [];
    this.isConnected = false;
    this.host = 'localhost';
    this.port = 56789;
    this.maxMessages = 1000;
    this.reconnectTimer = null;
    this.autoReconnect = false;
  }

  connect(host = 'localhost', port = 56789) {
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
      
      this.addMessage('SYSTEM', `Connected to ${host}:${port}`, 'system');
    });

    this.client.on('data', (data) => {
      const message = data.toString();
      console.log(`TCP Console Client: Received: ${message}`);
      
      // Split by lines and add each line as a message
      const lines = message.split(/\r?\n/);
      lines.forEach(line => {
        if (line.trim()) {
          this.addMessage('SERVER', line, 'received');
        }
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
      
      this.addMessage('SYSTEM', 'Connection closed', 'system');
      
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
      
      this.addMessage('SYSTEM', `Error: ${err.message}`, 'error');
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
    this.addMessage('SYSTEM', 'Disconnected', 'system');
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
      this.addMessage('SYSTEM', 'Cannot send: Not connected', 'error');
      return false;
    }

    try {
      this.client.write(message + '\r\n');
      this.addMessage('CLIENT', message, 'sent');
      console.log(`TCP Console Client: Sent: ${message}`);
      return true;
    } catch (err) {
      console.error(`TCP Console Client: Send error - ${err.message}`);
      this.addMessage('SYSTEM', `Send error: ${err.message}`, 'error');
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

