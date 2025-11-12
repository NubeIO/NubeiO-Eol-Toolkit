// About Page - FGA AC Simulator
class AboutPage {
  constructor(app) {
    this.app = app;
  }

  render() {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    return `
      <div class="bg-white rounded-2xl shadow-lg p-8">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span class="text-3xl">🏠</span>
          </div>
          <h1 class="text-3xl font-bold text-gray-800 mb-2">Nube iO Toolkit</h1>
          <p class="text-lg text-gray-600">Complete Development Tool: Flash, Monitor, Control & Simulate</p>
          <div class="mt-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium inline-block">
            Version 1.0.0
          </div>
        </div>

        <!-- App Information -->
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
                  <span class="font-medium text-gray-800">${process.versions.node}</span>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-gray-100">
                  <span class="text-gray-600">Chrome:</span>
                  <span class="font-medium text-gray-800">${process.versions.chrome}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Features & Capabilities -->
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
    `;
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AboutPage;
} else {
  window.AboutPage = AboutPage;
}
