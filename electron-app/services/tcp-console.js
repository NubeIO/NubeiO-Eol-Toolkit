const net = require('net');
const EventEmitter = require('events');

class TCPConsole extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.clients = [];
    this.messages = [];
    this.isRunning = false;
    this.port = 56789;
    this.maxMessages = 1000;
  }

  start(port = 56789) {
    if (this.isRunning) {
      console.log('TCP Console is already running');
      return;
    }

    this.port = port;
    this.server = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`TCP Console: Client connected - ${clientId}`);
      
      this.clients.push(socket);
      
      // Send welcome message
      socket.write(`Connected to FGA Simulator TCP Console\r\n`);
      socket.write(`Type 'help' for available commands\r\n\r\n`);
      
      // Handle data from client
      socket.on('data', (data) => {
        const message = data.toString().trim();
        const timestamp = Date.now();
        
        const logEntry = {
          timestamp,
          from: clientId,
          message: message,
          type: 'received'
        };
        
        this.messages.unshift(logEntry);
        if (this.messages.length > this.maxMessages) {
          this.messages.pop();
        }
        
        console.log(`TCP Console [${clientId}]: ${message}`);
        this.emit('message', logEntry);
        
        // Process commands
        this.processCommand(socket, message);
      });
      
      socket.on('end', () => {
        console.log(`TCP Console: Client disconnected - ${clientId}`);
        this.clients = this.clients.filter(c => c !== socket);
      });
      
      socket.on('error', (err) => {
        console.error(`TCP Console: Socket error - ${clientId}:`, err.message);
        this.clients = this.clients.filter(c => c !== socket);
      });
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`TCP Console server listening on port ${this.port}`);
      this.isRunning = true;
      this.emit('status-change', { isRunning: true, port: this.port });
    });

    this.server.on('error', (err) => {
      console.error('TCP Console server error:', err);
      this.isRunning = false;
      this.emit('status-change', { isRunning: false, port: this.port, error: err.message });
    });
  }

  stop() {
    if (!this.isRunning) {
      console.log('TCP Console is not running');
      return;
    }

    // Close all client connections
    this.clients.forEach(socket => {
      socket.write('Server shutting down...\r\n');
      socket.end();
    });
    this.clients = [];

    // Close server
    if (this.server) {
      this.server.close(() => {
        console.log('TCP Console server stopped');
        this.isRunning = false;
        this.emit('status-change', { isRunning: false, port: this.port });
      });
    }
  }

  processCommand(socket, command) {
    const cmd = command.toLowerCase();
    
    if (cmd === 'help') {
      socket.write('\r\nAvailable Commands:\r\n');
      socket.write('  help          - Show this help message\r\n');
      socket.write('  status        - Show MQTT connection status\r\n');
      socket.write('  devices       - List discovered devices\r\n');
      socket.write('  clear         - Clear screen\r\n');
      socket.write('  quit/exit     - Disconnect from console\r\n');
      socket.write('\r\n');
    } else if (cmd === 'status') {
      socket.write('\r\nSystem Status:\r\n');
      socket.write(`  TCP Console: Running on port ${this.port}\r\n`);
      socket.write(`  Connected clients: ${this.clients.length}\r\n`);
      socket.write(`  Messages logged: ${this.messages.length}\r\n`);
      socket.write('\r\n');
    } else if (cmd === 'devices') {
      socket.write('\r\nDiscovered Devices:\r\n');
      socket.write('  (Device list will be implemented with MQTT service integration)\r\n');
      socket.write('\r\n');
    } else if (cmd === 'clear') {
      socket.write('\x1b[2J\x1b[H'); // ANSI clear screen
    } else if (cmd === 'quit' || cmd === 'exit') {
      socket.write('Goodbye!\r\n');
      socket.end();
    } else if (command) {
      socket.write(`Unknown command: ${command}\r\n`);
      socket.write(`Type 'help' for available commands\r\n\r\n`);
    }
  }

  broadcast(message) {
    const msg = `${message}\r\n`;
    this.clients.forEach(socket => {
      try {
        socket.write(msg);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    });
    
    // Log broadcast message
    const logEntry = {
      timestamp: Date.now(),
      from: 'SERVER',
      message: message,
      type: 'broadcast'
    };
    
    this.messages.unshift(logEntry);
    if (this.messages.length > this.maxMessages) {
      this.messages.pop();
    }
    
    this.emit('message', logEntry);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      clientCount: this.clients.length,
      messageCount: this.messages.length
    };
  }

  getMessages() {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
    this.emit('messages-cleared');
  }
}

module.exports = TCPConsole;

