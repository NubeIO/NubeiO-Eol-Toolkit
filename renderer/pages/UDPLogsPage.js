// UDP Logs Page - FGA AC Simulator
class UDPLogsPage {
  constructor(app) {
    this.app = app;
    this.udpPort = 56789; // Default port
    this.loadConfig();
  }

  loadConfig() {
    const config = localStorage.getItem('udpLoggerConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        this.udpPort = parsed.port || 56789;
      } catch (e) {
        console.error('Failed to parse UDP config:', e);
      }
    }
  }

  saveConfig() {
    localStorage.setItem('udpLoggerConfig', JSON.stringify({
      port: this.udpPort
    }));
  }

  async startUDPLogger() {
    const portInput = document.getElementById('udp-port-input');
    if (portInput) {
      this.udpPort = parseInt(portInput.value) || 56789;
      this.saveConfig();
    }
    await window.electronAPI.startUDPLogger(this.udpPort);
    await this.app.loadUDPStatus();
    this.app.render();
  }

  async stopUDPLogger() {
    await window.electronAPI.stopUDPLogger();
    await this.app.loadUDPStatus();
    this.app.render();
  }

  render() {
    return `
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transition-colors">
        <div class="mb-4">
          <!-- Port Configuration (shown when stopped) -->
          ${!this.app.udpStatus.isRunning ? `
          <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-700">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4 flex-1">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">UDP Port:</label>
                <input 
                  type="number" 
                  id="udp-port-input" 
                  value="${this.udpPort}" 
                  oninput="window.udpLogsPage.udpPort = parseInt(this.value)"
                  class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm w-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="56789"
                  min="1024"
                  max="65535"
                />
                <span class="text-xs text-gray-500 dark:text-gray-400">Port range: 1024-65535</span>
              </div>
              <button 
                onclick="window.udpLogsPage.startUDPLogger()" 
                class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
                ▶️ Start UDP Logger
              </button>
            </div>
          </div>
          ` : ''}

          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-4">
              <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">UDP Logger</h2>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full ${this.app.udpStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}"></div>
                <span class="text-sm text-gray-600 dark:text-gray-300">${this.app.udpStatus.isRunning ? `Port ${this.app.udpStatus.port}` : 'Stopped'}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">| <span id="udp-log-count">${this.app.udpStatus.logCount}</span> logs</span>
              </div>
            </div>
            <div class="flex gap-2">
              ${this.app.udpStatus.isRunning ? `
                <button 
                  onclick="window.udpLogsPage.stopUDPLogger()" 
                  class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                  ⏹️ Stop Logger
                </button>
              ` : ''}
              <button onclick="app.saveUDPLogs(false)" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2" ${this.app.udpStatus.logCount === 0 ? 'disabled' : ''}>
                💾 Save Logs
              </button>
              <button onclick="app.saveUDPLogs(true)" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2" ${this.app.udpStatus.logCount === 0 ? 'disabled' : ''}>
                ➕ Append Logs
              </button>
              <button onclick="app.clearUDPLogs()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                🗑️ Clear Logs
              </button>
            </div>
          </div>
          
          <!-- Auto-Save Section -->
          <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full ${this.app.udpStatus.autoSaveEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Real-Time Auto-Save</span>
                </div>
                ${this.app.udpStatus.autoSaveEnabled ? `
                  <span class="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 px-2 py-1 rounded">
                    📁 ${this.app.udpStatus.autoSaveFilePath ? this.app.udpStatus.autoSaveFilePath.split('/').pop() : 'Unknown'} (${this.app.udpStatus.autoSaveFormat.toUpperCase()})
                  </span>
                ` : ''}
              </div>
              <div class="flex gap-2">
                ${!this.app.udpStatus.autoSaveEnabled ? `
                  <button onclick="app.toggleAutoSave()" class="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors">
                    🚀 Start Auto-Save
                  </button>
                ` : `
                  <button onclick="app.toggleAutoSave()" class="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-medium transition-colors">
                    ⏸️ Stop Auto-Save
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
        
        <div id="udp-log-container" class="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 overflow-y-auto text-gray-900 dark:text-gray-100" style="
          height: calc(100vh - 280px);
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
        ">
          ${this.app.udpLogs.length === 0 ? `
            <div class="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No UDP messages received yet</p>
              <p class="text-xs mt-2">${this.app.udpStatus.isRunning ? `Listening on UDP port ${this.app.udpStatus.port}` : 'Start UDP logger to receive messages'}</p>
            </div>
          ` : `
            ${[...this.app.udpLogs].reverse().map((log, index) => `
              <div class="mb-0.5 py-0.5">
                <span class="text-gray-500 dark:text-gray-400 mr-2">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="text-blue-600 dark:text-blue-400 mr-2">${log.from}</span>
                <span class="text-green-600 dark:text-green-400">${this.app.escapeHtml(this.app.stripAnsiCodes(log.message))}</span>
              </div>
            `).join('')}
          `}
        </div>
      </div>
    `;
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UDPLogsPage;
} else {
  window.UDPLogsPage = UDPLogsPage;
}
