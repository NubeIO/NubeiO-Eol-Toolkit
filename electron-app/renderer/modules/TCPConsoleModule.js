class TCPConsoleModule {
  constructor() {
    this.messages = [];
    this.status = { isRunning: false, port: 56789, clientCount: 0 };
    this.autoScroll = true;
    this.messageInput = '';
    this.showConsole = false;
  }

  async init() {
    // Load initial status
    try {
      this.status = await electronAPI.getTCPStatus();
      this.messages = await electronAPI.getTCPMessages();
    } catch (error) {
      console.error('Failed to load TCP Console status:', error);
    }

    // Listen for TCP events via menu
    electronAPI.onMenuEvent('menu:show-tcp-console', () => {
      this.showConsole = true;
      this.render();
    });

    electronAPI.onMenuEvent('menu:clear-tcp-console', async () => {
      await this.clearMessages();
    });

    electronAPI.onMenuEvent('tcp:message', (messageData) => {
      this.messages.unshift(messageData);
      if (this.messages.length > 1000) {
        this.messages.pop();
      }
      if (this.showConsole) {
        this.updateMessagesOnly();
      }
    });

    electronAPI.onMenuEvent('tcp:status-change', (statusData) => {
      this.status = statusData;
      if (this.showConsole) {
        this.render();
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
      await electronAPI.broadcastTCP(this.messageInput);
      this.messageInput = '';
      this.render();
    } catch (error) {
      console.error('Failed to send TCP message:', error);
    }
  }

  async toggleServer() {
    try {
      if (this.status.isRunning) {
        await electronAPI.stopTCP();
      } else {
        await electronAPI.startTCP(this.status.port);
      }
      this.status = await electronAPI.getTCPStatus();
      this.render();
    } catch (error) {
      console.error('Failed to toggle TCP server:', error);
    }
  }

  hide() {
    this.showConsole = false;
  }

  updateMessagesOnly() {
    const container = document.getElementById('tcp-messages-container');
    if (!container) return;

    // Check if user is near bottom before adding new messages
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    // Only add the newest messages (that aren't already rendered)
    const currentMessageCount = container.children.length;
    const newMessagesCount = this.messages.length - currentMessageCount;

    if (newMessagesCount > 0) {
      for (let i = newMessagesCount - 1; i >= 0; i--) {
        const msg = this.messages[i];
        const messageEl = this.createMessageElement(msg);
        container.appendChild(messageEl);
      }

      // Auto-scroll if user was near bottom
      if (this.autoScroll && isNearBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }

  createMessageElement(msg) {
    const messageEl = document.createElement('div');
    messageEl.style.fontFamily = 'Consolas, "Courier New", monospace';
    messageEl.style.fontSize = '13px';
    messageEl.style.padding = '2px 8px';
    messageEl.style.borderBottom = '1px solid #e5e7eb';

    const time = new Date(msg.timestamp).toLocaleTimeString();
    const typeColor = msg.type === 'broadcast' ? '#0066cc' : '#16a34a';
    const typeLabel = msg.type === 'broadcast' ? 'SERVER' : msg.from;

    messageEl.innerHTML = `
      <span style="color: #6b7280">${time}</span>
      <span style="color: ${typeColor}; margin-left: 12px; font-weight: 500">[${typeLabel}]</span>
      <span style="color: #1f2937; margin-left: 12px">${this.escapeHtml(msg.message)}</span>
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

    const statusColor = this.status.isRunning ? '#16a34a' : '#dc2626';
    const statusText = this.status.isRunning ? 'Running' : 'Stopped';
    const buttonText = this.status.isRunning ? 'Stop Server' : 'Start Server';
    const buttonColor = this.status.isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600';

    return `
      <div class="p-6 space-y-4">
        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">TCP Console</h2>
            <p class="text-sm text-gray-600 mt-1">Remote console server on port ${this.status.port}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background-color: ${statusColor}"></div>
                <span class="font-semibold text-gray-700">${statusText}</span>
              </div>
              <div class="text-sm text-gray-600 mt-1">
                ${this.status.isRunning ? `${this.status.clientCount} client(s) connected` : 'Server offline'}
              </div>
            </div>
            <button onclick="tcpConsole.toggleServer()" class="${buttonColor} text-white px-4 py-2 rounded-lg transition-colors">
              ${buttonText}
            </button>
          </div>
        </div>

        <!-- Connection Info -->
        ${this.status.isRunning ? `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="font-semibold text-blue-900 mb-2">How to Connect:</h3>
            <code class="text-sm text-blue-800">telnet &lt;server-ip&gt; ${this.status.port}</code>
            <span class="text-sm text-blue-700 ml-4">or</span>
            <code class="text-sm text-blue-800 ml-2">nc &lt;server-ip&gt; ${this.status.port}</code>
          </div>
        ` : ''}

        <!-- Broadcast Message -->
        ${this.status.isRunning ? `
          <div class="bg-white border border-gray-300 rounded-lg p-4">
            <label class="block text-sm font-semibold text-gray-700 mb-2">Broadcast Message to All Clients:</label>
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
            <h3 class="font-semibold text-gray-700">Console Messages (${this.messages.length})</h3>
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
          <h3 class="font-semibold text-gray-800 mb-2">Available Commands (in client):</h3>
          <div class="grid grid-cols-2 gap-2 text-sm text-gray-700">
            <div><code class="bg-gray-200 px-2 py-1 rounded">help</code> - Show available commands</div>
            <div><code class="bg-gray-200 px-2 py-1 rounded">status</code> - Show system status</div>
            <div><code class="bg-gray-200 px-2 py-1 rounded">devices</code> - List discovered devices</div>
            <div><code class="bg-gray-200 px-2 py-1 rounded">clear</code> - Clear screen</div>
            <div><code class="bg-gray-200 px-2 py-1 rounded">quit/exit</code> - Disconnect</div>
          </div>
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
            <p class="text-sm mt-1">Messages will appear here when clients connect</p>
          </div>
        </div>
      `;
    }

    // Reverse messages to show oldest at top, newest at bottom
    const reversedMessages = [...this.messages].reverse();
    return reversedMessages.map(msg => this.createMessageElement(msg).outerHTML).join('');
  }

  render() {
    // This will be called by the main app render
    return this.renderConsole();
  }
}

// Create global instance
const tcpConsole = new TCPConsoleModule();

