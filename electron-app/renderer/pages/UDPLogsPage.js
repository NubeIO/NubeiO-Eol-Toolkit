// UDP Logs Page - FGA AC Simulator
class UDPLogsPage {
  constructor(app) {
    this.app = app;
  }

  render() {
    return `
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <div class="mb-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-4">
              <h2 class="text-xl font-bold text-gray-800">UDP Logger</h2>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full ${this.app.udpStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}"></div>
                <span class="text-sm text-gray-600">Port ${this.app.udpStatus.port}</span>
                <span class="text-sm text-gray-500">| <span id="udp-log-count">${this.app.udpStatus.logCount}</span> logs</span>
              </div>
            </div>
            <div class="flex gap-2">
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
          <div class="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full ${this.app.udpStatus.autoSaveEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></div>
                  <span class="text-sm font-medium text-gray-700">Real-Time Auto-Save</span>
                </div>
                ${this.app.udpStatus.autoSaveEnabled ? `
                  <span class="text-xs text-gray-600 bg-white px-2 py-1 rounded">
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
        
        <div id="udp-log-container" style="
          height: calc(100vh - 280px);
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          overflow-y: auto;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: #1f2937;
        ">
          ${this.app.udpLogs.length === 0 ? `
            <div style="text-align: center; padding: 48px 0; color: #6b7280;">
              <p>No UDP messages received yet</p>
              <p style="font-size: 11px; margin-top: 8px;">Listening on UDP port ${this.app.udpStatus.port}</p>
            </div>
          ` : `
            ${[...this.app.udpLogs].reverse().map((log, index) => `
              <div style="margin-bottom: 2px; padding: 2px 0; color: #1f2937;">
                <span style="color: #6b7280; margin-right: 8px;">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span style="color: #2563eb; margin-right: 8px;">${log.from}</span>
                <span style="color: #059669;">${this.app.escapeHtml(this.app.stripAnsiCodes(log.message))}</span>
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
