class TCPConsoleModule {
  constructor() {
    this.messages = [];
    this.status = { isConnected: false, host: 'localhost', port: 56789 };
    this.autoScroll = true;
    this.messageInput = '';
    this.showConsole = false;
    this.autoReconnect = false;
    
    // Connection settings
    this.host = 'localhost';
    this.port = 56789;
    
    // Cache last rendered HTML to prevent re-render when inputs have focus
    this.lastRenderedHtml = '';
    
    // Throttle message updates to prevent flickering
    this.updatePending = false;
  }

  async init() {
    // Load initial status
    try {
      this.status = await electronAPI.getTCPStatus();
      this.messages = await electronAPI.getTCPMessages();
      this.host = this.status.host || 'localhost';
      this.port = this.status.port || 56789;
    } catch (error) {
      console.error('Failed to load TCP Console status:', error);
    }

    // Listen for TCP events via menu
    electronAPI.onMenuEvent('menu:clear-tcp-console', async () => {
      await this.clearMessages();
    });

    electronAPI.onMenuEvent('tcp:message', (messageData) => {
      this.messages.unshift(messageData);
      if (this.messages.length > 1000) {
        this.messages.pop();
      }
      if (this.showConsole && !this.updatePending) {
        this.updatePending = true;
        requestAnimationFrame(() => {
          this.updateMessagesOnly();
          this.updatePending = false;
        });
      }
    });

    electronAPI.onMenuEvent('tcp:status-change', (statusData) => {
      this.status = { ...this.status, ...statusData };
      if (this.showConsole) {
        // Only update status display, not full render to preserve input focus
        this.updateStatusOnly();
      }
    });

    electronAPI.onMenuEvent('tcp:messages-cleared', () => {
      this.messages = [];
      if (this.showConsole) {
        this.render();
      }
    });
  }

  async clearMessages() {
    try {
      await electronAPI.clearTCPMessages();
      this.messages = [];
      this.render();
    } catch (error) {
      console.error('Failed to clear TCP messages:', error);
    }
  }

  async sendMessage() {
    if (!this.messageInput.trim()) return;
    
    try {
      const success = await electronAPI.sendTCP(this.messageInput);
      if (success) {
        this.messageInput = '';
        // Input field will be cleared on next render
        const inputEl = document.getElementById('tcp-message-input');
        if (inputEl) {
          inputEl.value = '';
        }
      }
    } catch (error) {
      console.error('Failed to send TCP message:', error);
    }
  }

  async connect() {
    try {
      await electronAPI.connectTCP(this.host, this.port);
      await this.updateStatus();
    } catch (error) {
      console.error('Failed to connect TCP:', error);
    }
  }

  async disconnect() {
    try {
      await electronAPI.disconnectTCP();
      await this.updateStatus();
    } catch (error) {
      console.error('Failed to disconnect TCP:', error);
    }
  }

  async toggleAutoReconnect() {
    this.autoReconnect = !this.autoReconnect;
    try {
      await electronAPI.setTCPAutoReconnect(this.autoReconnect);
      this.render();
    } catch (error) {
      console.error('Failed to toggle auto-reconnect:', error);
    }
  }

  async updateStatus() {
    try {
      this.status = await electronAPI.getTCPStatus();
      this.render();
    } catch (error) {
      console.error('Failed to update TCP status:', error);
    }
  }

  hide() {
    this.showConsole = false;
  }

  handleHostInput(value) {
    this.host = value;
  }

  handlePortInput(value) {
    this.port = parseInt(value) || 56789;
  }

  updateStatusOnly() {
    // Check if connection state changed - if so, need full render
    const wasConnected = document.getElementById('tcp-disconnect-btn') !== null;
    const isConnected = this.status.isConnected;
    
    if (wasConnected !== isConnected) {
      // Connection state changed, need full render to update buttons/inputs
      this.render();
      return;
    }
    
    // Update only the status indicator without full re-render
    const statusDot = document.querySelector('.tcp-status-dot');
    const statusText = document.querySelector('.tcp-status-text');
    
    if (statusDot && statusText) {
      const statusColor = this.status.isConnected ? '#16a34a' : '#dc2626';
      const statusTextValue = this.status.isConnected ? 'Connected' : 'Disconnected';
      
      statusDot.style.backgroundColor = statusColor;
      statusText.textContent = statusTextValue;
    }
    
    // Update status message if present
    const statusMessage = document.getElementById('tcp-status-message');
    if (statusMessage) {
      if (this.status.message) {
        statusMessage.textContent = this.status.message;
        statusMessage.className = `mt-3 text-sm ${this.status.error ? 'text-red-600' : 'text-gray-600'}`;
        statusMessage.style.display = 'block';
      } else {
        statusMessage.style.display = 'none';
      }
    }
  }

  updateMessagesOnly() {
    const container = document.getElementById('tcp-messages-container');
    if (!container) return;

    // Only add the newest messages (that aren't already rendered)
    const currentMessageCount = container.children.length;
    const newMessagesCount = this.messages.length - currentMessageCount;

    if (newMessagesCount > 0) {
      // Create a document fragment to batch DOM operations
      const fragment = document.createDocumentFragment();
      
      for (let i = newMessagesCount - 1; i >= 0; i--) {
        const msg = this.messages[i];
        const messageEl = this.createMessageElement(msg);
        fragment.appendChild(messageEl);
      }
      
      // Add all messages at once (single DOM update)
      container.appendChild(fragment);

      // Auto-scroll to bottom if enabled
      if (this.autoScroll) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  createMessageElement(msg) {
    const messageEl = document.createElement('div');
    messageEl.style.fontFamily = 'Consolas, "Courier New", monospace';
    messageEl.style.fontSize = '13px';
    messageEl.style.padding = '2px 8px';
    messageEl.style.borderBottom = '1px solid #e5e7eb';
    messageEl.style.whiteSpace = 'pre-wrap'; // Preserve spaces and line breaks

    const time = new Date(msg.timestamp).toLocaleTimeString();
    
    let fromColor, fromLabel;
    if (msg.type === 'system') {
      fromColor = '#6b7280';
      fromLabel = 'SYSTEM';
    } else if (msg.type === 'sent') {
      fromColor = '#0066cc';
      fromLabel = 'CLIENT';
    } else if (msg.type === 'received') {
      fromColor = '#16a34a';
      fromLabel = 'SERVER';
    } else if (msg.type === 'error') {
      fromColor = '#dc2626';
      fromLabel = 'ERROR';
    } else {
      fromColor = '#6b7280';
      fromLabel = msg.from || 'UNKNOWN';
    }

    messageEl.innerHTML = `
      <span style="color: #6b7280">${time}</span>
      <span style="color: ${fromColor}; margin-left: 12px; font-weight: 500">[${fromLabel}]</span>
      <span style="color: #1f2937; margin-left: 12px; white-space: pre-wrap;">${this.escapeHtml(msg.message)}</span>
    `;

    return messageEl;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderConsole() {
    if (!this.showConsole) return '';

    const statusColor = this.status.isConnected ? '#16a34a' : '#dc2626';
    const statusText = this.status.isConnected ? 'Connected' : 'Disconnected';
    const buttonText = this.status.isConnected ? 'Disconnect' : 'Connect';
    const buttonColor = this.status.isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600';

    return `
      <div class="p-6 space-y-4">
        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">TCP Console Client</h2>
            <p class="text-sm text-gray-600 mt-1">Connect to remote TCP console server</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="tcp-status-dot w-3 h-3 rounded-full" style="background-color: ${statusColor}"></div>
            <span class="tcp-status-text font-semibold text-gray-700">${statusText}</span>
          </div>
        </div>

        <!-- Connection Settings -->
        <div class="bg-white border border-gray-300 rounded-lg p-4">
          <h3 class="font-semibold text-gray-700 mb-3">Connection Settings</h3>
          <div class="flex gap-3 items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Host</label>
              <input 
                type="text" 
                id="tcp-host-input"
                value="${this.escapeHtml(this.host)}"
                oninput="tcpConsole.handleHostInput(this.value)"
                placeholder="localhost or IP address"
                ${this.status.isConnected ? 'disabled' : ''}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${this.status.isConnected ? 'bg-gray-100' : ''}"
              />
            </div>
            <div class="w-32">
              <label class="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input 
                type="number" 
                id="tcp-port-input"
                value="${this.port}"
                oninput="tcpConsole.handlePortInput(this.value)"
                placeholder="56789"
                ${this.status.isConnected ? 'disabled' : ''}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${this.status.isConnected ? 'bg-gray-100' : ''}"
              />
            </div>
            <button 
              id="${this.status.isConnected ? 'tcp-disconnect-btn' : 'tcp-connect-btn'}"
              onclick="tcpConsole.${this.status.isConnected ? 'disconnect' : 'connect'}()"
              class="${buttonColor} text-white px-6 py-2 rounded-lg transition-colors"
            >
              ${buttonText}
            </button>
          </div>
          
          <div class="mt-3">
            <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input 
                type="checkbox" 
                ${this.autoReconnect ? 'checked' : ''}
                onchange="tcpConsole.toggleAutoReconnect()"
                class="rounded"
              />
              Auto-reconnect on connection loss
            </label>
          </div>
          
          ${this.status.message ? `
            <div id="tcp-status-message" class="mt-3 text-sm ${this.status.error ? 'text-red-600' : 'text-gray-600'}">
              ${this.escapeHtml(this.status.message)}
            </div>
          ` : '<div id="tcp-status-message" class="mt-3 text-sm text-gray-600" style="display: none;"></div>'}
        </div>

        <!-- Message Input -->
        ${this.status.isConnected ? `
          <div class="bg-white border border-gray-300 rounded-lg p-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">Send Message:</label>
            <div class="flex gap-2">
              <input 
                type="text" 
                id="tcp-message-input"
                value="${this.escapeHtml(this.messageInput)}"
                onkeypress="if(event.key === 'Enter') tcpConsole.sendMessage()"
                oninput="tcpConsole.messageInput = this.value"
                placeholder="Type message and press Enter..."
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                onclick="tcpConsole.sendMessage()"
                class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Messages Display -->
        <div class="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <div class="bg-gray-100 px-4 py-2 border-b border-gray-300 flex justify-between items-center">
            <h3 class="font-semibold text-gray-700">Console Output (${this.messages.length} messages)</h3>
            <div class="flex gap-2">
              <label class="flex items-center gap-2 text-sm text-gray-700">
                <input 
                  type="checkbox" 
                  ${this.autoScroll ? 'checked' : ''}
                  onchange="tcpConsole.autoScroll = this.checked"
                  class="rounded"
                />
                Auto-scroll
              </label>
              <button 
                onclick="tcpConsole.clearMessages()"
                class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div 
            id="tcp-messages-container"
            style="height: 500px; overflow-y: auto; background-color: white;"
          >
            ${this.renderMessages()}
          </div>
        </div>

        <!-- Usage Tips -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 class="font-semibold text-gray-800 mb-2">Usage:</h3>
          <ul class="text-sm text-gray-700 space-y-1">
            <li>• Enter the <strong>host</strong> and <strong>port</strong> of the TCP server you want to connect to</li>
            <li>• Click <strong>Connect</strong> to establish connection</li>
            <li>• Type messages in the input field and press <strong>Enter</strong> or click <strong>Send</strong></li>
            <li>• All messages sent and received will appear in the console output</li>
            <li>• Enable <strong>Auto-reconnect</strong> to automatically reconnect if connection is lost</li>
          </ul>
        </div>
      </div>
    `;
  }

  renderMessages() {
    if (this.messages.length === 0) {
      return `
        <div class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <svg class="w-16 h-16 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p>No messages yet</p>
            <p class="text-sm mt-1">Connect to a server to start communication</p>
          </div>
        </div>
      `;
    }

    // Reverse messages to show oldest at top, newest at bottom
    const reversedMessages = [...this.messages].reverse();
    return reversedMessages.map(msg => this.createMessageElement(msg).outerHTML).join('');
  }

  render() {
    // Skip re-render if user is currently typing in any TCP console input fields
    const activeElement = document.activeElement;
    if (activeElement && 
        (activeElement.id === 'tcp-host-input' || 
         activeElement.id === 'tcp-port-input' || 
         activeElement.id === 'tcp-message-input')) {
      return this.lastRenderedHtml || this.renderConsole();
    }
    
    // This will be called by the main app render
    this.lastRenderedHtml = this.renderConsole();
    return this.lastRenderedHtml;
  }
}

// Create global instance
const tcpConsole = new TCPConsoleModule();
