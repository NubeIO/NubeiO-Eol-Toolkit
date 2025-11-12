/**
 * Serial Console Module
 * Provides UI for serial port communication
 */

class SerialConsoleModule {
  constructor(app) {
    this.app = app;
    this.messages = [];
    this.serialPorts = [];
    this.selectedPort = '';
    this.baudRate = 115200;
    this.isConnected = false;
    this.messageCount = 0;
  }

  async init() {
    console.log('Initializing Serial Console Module...');
    
    // Setup serial message listener
    if (window.electronAPI && window.electronAPI.onSerialMessage) {
      window.electronAPI.onSerialMessage((message) => {
        this.messages.push(message);
        
        // Keep only last 1000 messages
        if (this.messages.length > 1000) {
          this.messages.shift();
        }
        
        this.messageCount = this.messages.length;
        
        // Update UI if on serial console page
        if (this.app.currentPage === 'serial-console') {
          this.updateMessagesOnly();
        }
      });
    }

    // Load initial status
    await this.loadStatus();
    await this.loadSerialPorts();
    
    console.log('Serial Console Module initialized');
  }

  async loadSerialPorts() {
    try {
      // Get serial ports - returns array of port objects or simple strings
      const ports = await window.electronAPI.getSerialPorts();
      
      // Convert to consistent format
      if (ports && ports.length > 0) {
        // Check if it's already in object format or just strings
        if (typeof ports[0] === 'string') {
          // Convert string array to object array
          this.serialPorts = ports.map(path => ({
            path: path,
            manufacturer: 'Unknown'
          }));
        } else {
          // Already in object format
          this.serialPorts = ports;
        }
        
        // Auto-select first port if none selected
        if (this.serialPorts.length > 0 && !this.selectedPort) {
          this.selectedPort = this.serialPorts[0].path;
        }
      } else {
        this.serialPorts = [];
      }
      
      console.log('Serial ports loaded:', this.serialPorts);
    } catch (error) {
      console.error('Failed to load serial ports:', error);
      this.serialPorts = [];
    }
  }

  async loadStatus() {
    try {
      const status = await window.electronAPI.getSerialConsoleStatus();
      this.isConnected = status.isConnected;
      this.selectedPort = status.port || this.selectedPort;
      this.baudRate = status.baudRate || this.baudRate;
      this.messageCount = status.messageCount || 0;
    } catch (error) {
      console.error('Failed to load serial console status:', error);
    }
  }

  async loadMessages() {
    try {
      this.messages = await window.electronAPI.getSerialConsoleMessages();
      this.messageCount = this.messages.length;
    } catch (error) {
      console.error('Failed to load serial messages:', error);
    }
  }

  async connect() {
    if (!this.selectedPort) {
      alert('Please select a serial port');
      return;
    }

    try {
      await window.electronAPI.connectSerialConsole(this.selectedPort, this.baudRate);
      await this.loadStatus();
      await this.loadMessages();
      this.app.render();
    } catch (error) {
      console.error('Failed to connect:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      await window.electronAPI.disconnectSerialConsole();
      await this.loadStatus();
      this.app.render();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert(`Failed to disconnect: ${error.message}`);
    }
  }

  async sendMessage(message) {
    if (!this.isConnected) {
      alert('Not connected to serial port');
      return;
    }

    if (!message.trim()) {
      return;
    }

    try {
      await window.electronAPI.sendSerialConsoleMessage(message);
      // Message will be added to list via event listener
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(`Failed to send: ${error.message}`);
    }
  }

  async clearMessages() {
    try {
      await window.electronAPI.clearSerialConsoleMessages();
      this.messages = [];
      this.messageCount = 0;
      this.app.render();
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
  }

  updateMessagesOnly() {
    const container = document.getElementById('serial-messages-container');
    if (!container) return;

    // Check if user is scrolled to bottom
    const isScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

    // Update message count
    const countElement = document.getElementById('serial-message-count');
    if (countElement) {
      countElement.textContent = this.messageCount;
    }

    // Add only new messages
    const currentChildCount = container.children.length;
    const newMessagesCount = this.messages.length - currentChildCount;

    if (newMessagesCount > 0) {
      const fragment = document.createDocumentFragment();
      const newMessages = this.messages.slice(-newMessagesCount);

      newMessages.forEach(msg => {
        const messageDiv = this.createMessageElement(msg);
        fragment.appendChild(messageDiv);
      });

      container.appendChild(fragment);

      // Keep only last 1000 messages in DOM
      while (container.children.length > 1000) {
        container.removeChild(container.firstChild);
      }

      // Auto-scroll if user was at bottom
      if (isScrolledToBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }

  createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'margin-bottom: 2px; padding: 2px 0; font-family: "Consolas", "Courier New", monospace; font-size: 13px; line-height: 1.5;';

    const timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'color: #6b7280; margin-right: 8px;';
    timeSpan.textContent = new Date(msg.timestamp).toLocaleTimeString();

    const dataSpan = document.createElement('span');
    if (msg.isSent) {
      dataSpan.style.cssText = 'color: #2563eb; font-weight: 600;';
    } else if (msg.isError) {
      dataSpan.style.cssText = 'color: #dc2626;';
    } else if (msg.isSystem) {
      dataSpan.style.cssText = 'color: #059669; font-style: italic;';
    } else {
      dataSpan.style.cssText = 'color: #1f2937;';
    }
    dataSpan.textContent = msg.data;

    messageDiv.appendChild(timeSpan);
    messageDiv.appendChild(dataSpan);

    return messageDiv;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  render() {
    return `
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <div class="mb-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-4">
              <h2 class="text-xl font-bold text-gray-800">Serial Console</h2>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full ${this.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
                <span class="text-sm text-gray-600">
                  ${this.isConnected ? `Connected (${this.selectedPort})` : 'Disconnected'}
                </span>
                <span class="text-sm text-gray-500">| <span id="serial-message-count">${this.messageCount}</span> messages</span>
              </div>
            </div>
            <div class="flex gap-2">
              ${!this.isConnected ? `
                <button onclick="serialConsole.connect()" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  🔌 Connect
                </button>
              ` : `
                <button onclick="serialConsole.disconnect()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  🔌 Disconnect
                </button>
              `}
              <button onclick="serialConsole.clearMessages()" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                🗑️ Clear
              </button>
            </div>
          </div>

          <!-- Connection Settings -->
          ${!this.isConnected ? `
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm text-gray-600 mb-1">Serial Port</label>
                <div class="flex gap-2">
                  <select
                    id="serial-port-select"
                    onchange="serialConsole.selectedPort = this.value"
                    class="flex-1 px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select Port</option>
                    ${this.serialPorts.map(port => `
                      <option value="${port.path}" ${this.selectedPort === port.path ? 'selected' : ''}>
                        ${port.path} ${port.manufacturer !== 'Unknown' ? `(${port.manufacturer})` : ''}
                      </option>
                    `).join('')}
                  </select>
                  <button
                    onclick="serialConsole.loadSerialPorts().then(() => app.render())"
                    class="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
                  >
                    🔄
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">Baud Rate</label>
                <select
                  id="serial-baud-rate"
                  onchange="serialConsole.baudRate = parseInt(this.value)"
                  class="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="9600" ${this.baudRate === 9600 ? 'selected' : ''}>9600</option>
                  <option value="19200" ${this.baudRate === 19200 ? 'selected' : ''}>19200</option>
                  <option value="38400" ${this.baudRate === 38400 ? 'selected' : ''}>38400</option>
                  <option value="57600" ${this.baudRate === 57600 ? 'selected' : ''}>57600</option>
                  <option value="115200" ${this.baudRate === 115200 ? 'selected' : ''}>115200</option>
                  <option value="230400" ${this.baudRate === 230400 ? 'selected' : ''}>230400</option>
                  <option value="460800" ${this.baudRate === 460800 ? 'selected' : ''}>460800</option>
                  <option value="921600" ${this.baudRate === 921600 ? 'selected' : ''}>921600</option>
                </select>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Messages Container -->
        <div
          id="serial-messages-container"
          style="
            height: calc(100vh - ${this.isConnected ? '350px' : '450px'});
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            overflow-y: auto;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.5;
            color: #1f2937;
          "
        >
          ${this.messages.length === 0 ? `
            <div style="text-align: center; padding: 48px 0; color: #6b7280;">
              <p>No serial messages yet</p>
              <p style="font-size: 11px; margin-top: 8px;">Connect to a serial port to see messages</p>
            </div>
          ` : `
            ${this.messages.map(msg => {
              const escapedData = this.escapeHtml(msg.data);
              const color = msg.isSent ? '#2563eb' : msg.isError ? '#dc2626' : msg.isSystem ? '#059669' : '#1f2937';
              const fontWeight = msg.isSent ? '600' : 'normal';
              const fontStyle = msg.isSystem ? 'italic' : 'normal';
              
              return `
                <div style="margin-bottom: 2px; padding: 2px 0;">
                  <span style="color: #6b7280; margin-right: 8px;">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                  <span style="color: ${color}; font-weight: ${fontWeight}; font-style: ${fontStyle};">${escapedData}</span>
                </div>
              `;
            }).join('')}
          `}
        </div>

        <!-- Input Area -->
        ${this.isConnected ? `
          <form onsubmit="event.preventDefault(); serialConsole.sendMessage(document.getElementById('serial-message-input').value); document.getElementById('serial-message-input').value = '';" class="mt-4 flex gap-2">
            <input
              type="text"
              id="serial-message-input"
              placeholder="Type command and press Enter..."
              class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              autocomplete="off"
            />
            <button
              type="submit"
              class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>Send</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        ` : ''}

        <!-- Help Text -->
        <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p class="text-xs text-gray-700">
            <strong>Serial Console</strong> - Connect to ESP32 via serial port for debugging. Common ports: /dev/ttyUSB0 (Linux), COM3 (Windows)
          </p>
        </div>
      </div>
    `;
  }
}

// Make it globally accessible
if (typeof window !== 'undefined') {
  window.SerialConsoleModule = SerialConsoleModule;
}

