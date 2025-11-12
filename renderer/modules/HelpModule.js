// Help Module - FGA AC Simulator
class HelpModule {
  constructor(app) {
    this.app = app;
    this.showHelpMenu = false;
    this.showAboutDialog = false;
    this.showKeyboardShortcuts = false;
  }

  toggleHelpMenu() {
    this.showHelpMenu = !this.showHelpMenu;
    this.app.render();
  }

  showAbout() {
    this.showHelpMenu = false;
    this.showAboutDialog = true;
    this.app.render();
  }

  showKeyboardShortcuts() {
    this.showHelpMenu = false;
    this.showKeyboardShortcuts = true;
    this.app.render();
  }

  openDocumentation() {
    this.showHelpMenu = false;
    // Open external documentation link
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal('https://nube-io.com/docs/fga-simulator');
    } else {
      window.open('https://nube-io.com/docs/fga-simulator', '_blank');
    }
  }

  reportIssue() {
    this.showHelpMenu = false;
    // Open issue reporting link
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal('https://github.com/nube-io/fga-simulator/issues');
    } else {
      window.open('https://github.com/nube-io/fga-simulator/issues', '_blank');
    }
  }

  closeDialogs() {
    this.showAboutDialog = false;
    this.showKeyboardShortcuts = false;
    this.app.render();
  }

  renderHelpMenu() {
    if (!this.showHelpMenu) return '';
    
    return `
      <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
        <div class="py-1">
          <button onclick="app.helpModule.showAbout()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <span>ℹ️</span> About Nube iO Toolkit
          </button>
          <button onclick="app.helpModule.showKeyboardShortcuts()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <span>⌨️</span> Keyboard Shortcuts
          </button>
          <div class="border-t my-1"></div>
          <button onclick="app.helpModule.openDocumentation()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <span>📖</span> Documentation
          </button>
          <button onclick="app.helpModule.reportIssue()" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <span>🐛</span> Report Issue
          </button>
        </div>
      </div>
    `;
  }

  renderAboutDialog() {
    if (!this.showAboutDialog) return '';

    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    // Get system info from electronAPI
    const sysInfo = window.electronAPI ? window.electronAPI.getSystemInfo() : {
      node: 'N/A',
      chrome: 'N/A',
      electron: 'N/A',
      platform: 'N/A',
      arch: 'N/A'
    };
    
    return `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="app.helpModule.closeDialogs()">
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
          <!-- Header -->
          <div class="text-center p-8 border-b">
            <img src="assets/Logo.svg" alt="Nube iO Toolkit Logo" class="h-16 mx-auto mb-4" />
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Nube iO Toolkit</h1>
            <p class="text-lg text-gray-600">Complete Development Tool: Flash, Monitor, Control & Simulate</p>
            <div class="mt-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium inline-block">
              Version 1.0.0
            </div>
          </div>

          <!-- Content -->
          <div class="p-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <!-- Application Details -->
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span class="text-blue-500">📱</span> Application Details
                  </h3>
                  <div class="space-y-3">
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Product Name:</span>
                      <span class="font-medium text-gray-800">Nube_iO_Toolkit</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Version:</span>
                      <span class="font-medium text-gray-800">1.0.0</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Build Date:</span>
                      <span class="font-medium text-gray-800">${currentDate}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Runtime:</span>
                      <span class="font-medium text-gray-800">${currentTime}</span>
                    </div>
                  </div>
                </div>

                <!-- System Information -->
                <div>
                  <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span class="text-green-500">⚙️</span> System Information
                  </h3>
                  <div class="space-y-3">
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Platform:</span>
                      <span class="font-medium text-gray-800">Electron</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Architecture:</span>
                      <span class="font-medium text-gray-800">x64</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Node.js:</span>
                      <span class="font-medium text-gray-800">${sysInfo.node}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Chrome:</span>
                      <span class="font-medium text-gray-800">${sysInfo.chrome}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Electron:</span>
                      <span class="font-medium text-gray-800">${sysInfo.electron}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Features & Company -->
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span class="text-purple-500">🚀</span> Features
                  </h3>
                  <div class="space-y-2">
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-green-500">✅</span>
                      <span class="text-gray-700">MQTT Device Discovery & Control</span>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-green-500">✅</span>
                      <span class="text-gray-700">Real-time UDP Logging</span>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-green-500">✅</span>
                      <span class="text-gray-700">Multi-device Simulation</span>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-green-500">✅</span>
                      <span class="text-gray-700">Auto-save Logs</span>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-green-500">✅</span>
                      <span class="text-gray-700">VSCode Terminal Theme</span>
                    </div>
                    <div class="flex items-center gap-3 py-2">
                      <span class="text-green-500">✅</span>
                      <span class="text-gray-700">Cross-platform Support</span>
                    </div>
                  </div>
                </div>

                <!-- Company Information -->
                <div>
                  <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span class="text-orange-500">🏢</span> Company Information
                  </h3>
                  <div class="space-y-3">
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Developer:</span>
                      <span class="font-medium text-gray-800">Nube IO</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Email:</span>
                      <span class="font-medium text-gray-800">info@nube-io.com</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">Website:</span>
                      <a href="https://nube-io.com" class="font-medium text-blue-600 hover:text-blue-800">nube-io.com</a>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                      <span class="text-gray-600">License:</span>
                      <span class="font-medium text-gray-800">MIT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Technical Details -->
            <div class="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 mb-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span class="text-indigo-500">🔧</span> Technical Details
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600">${this.app.discoveredDevices.length}</div>
                  <div class="text-sm text-gray-600">Discovered Devices</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-600">${this.app.udpStatus.logCount}</div>
                  <div class="text-sm text-gray-600">UDP Logs</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-purple-600">${this.app.isConnected ? 'Online' : 'Offline'}</div>
                  <div class="text-sm text-gray-600">MQTT Status</div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="text-center text-gray-500 text-sm">
              <p>© 2024 Nube IO. All rights reserved.</p>
              <p class="mt-1">Built with ❤️ using Electron, Node.js, and modern web technologies.</p>
            </div>
          </div>

          <!-- Close Button -->
          <div class="flex justify-end p-4 border-t">
            <button onclick="app.helpModule.closeDialogs()" class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderKeyboardShortcuts() {
    if (!this.showKeyboardShortcuts) return '';

    return `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="app.helpModule.closeDialogs()">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4" onclick="event.stopPropagation()">
          <!-- Header -->
          <div class="p-6 border-b">
            <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>⌨️</span> Keyboard Shortcuts
            </h2>
          </div>

          <!-- Content -->
          <div class="p-6">
            <div class="space-y-4">
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Toggle Config</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + ,</kbd>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Connect/Disconnect MQTT</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + C</kbd>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Switch to Devices</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + 1</kbd>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Switch to UDP Logs</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + 2</kbd>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Show Help</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">F1</kbd>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Save UDP Logs</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + S</kbd>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-gray-700">Clear UDP Logs</span>
                <kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl + K</kbd>
              </div>
            </div>
          </div>

          <!-- Close Button -->
          <div class="flex justify-end p-4 border-t">
            <button onclick="app.helpModule.closeDialogs()" class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HelpModule;
} else {
  window.HelpModule = HelpModule;
}
