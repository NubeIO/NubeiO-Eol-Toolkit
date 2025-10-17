// Devices Page - FGA AC Simulator
class DevicesPage {
  constructor(app) {
    this.app = app;
  }

  render() {
    return `
      <!-- Devices Page Controls -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">AC Devices</h2>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${this.app.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
              <span class="text-sm text-gray-600 dark:text-gray-300">
                ${this.app.isConnected ? `Connected (${this.app.discoveredDevices.length} device${this.app.discoveredDevices.length !== 1 ? 's' : ''})` : 'Disconnected'}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button 
              onclick="app.toggleConfig()" 
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              ⚙️ Config
            </button>
            <button 
              onclick="app.${this.app.isConnected ? 'handleDisconnectMQTT' : 'handleConnectMQTT'}()" 
              class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                this.app.isConnected 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }"
            >
              ${this.app.isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </div>

      <!-- Device Grid -->
      ${this.app.discoveredDevices.length === 0 ? `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg font-medium">${this.app.isConnected ? 'Waiting for devices to connect...' : 'Please connect to MQTT broker first'}</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          ${this.app.discoveredDevices.map(device => this.renderDevicePanel(device)).join('')}
        </div>
      `}
    `;
  }

  renderDevicePanel(device) {
    const acState = device.state || {
      power: false,
      mode: 'Auto',
      temperature: 22.0,
      fanSpeed: 'Auto',
      swing: false,
      currentTemp: 24,
      model: 1
    };

    return `
      <div class="bg-white rounded-3xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="relative bg-white px-6 py-4 flex items-center justify-between border-b">
          <h1 class="text-xl font-bold text-gray-700 tracking-wide">FUJITSU</h1>
          <div class="w-3 h-3 rounded-full ${acState.power ? 'bg-green-500' : 'bg-red-500'}"></div>
        </div>

        <!-- Main Content -->
        <div class="${acState.power ? 'bg-gradient-to-br from-green-100 to-green-200' : 'bg-gradient-to-br from-gray-100 to-gray-200'} rounded-2xl p-6 mb-6 shadow-md mx-6 mt-6">
          <!-- Title and Time -->
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-gray-700 font-semibold text-sm">
              ${device.deviceId.replace('AC_SIM_', '')}
            </h2>
            <span class="text-gray-500 text-sm">${this.app.formatTime()}</span>
          </div>

          <!-- Mode, Temp, Fan Display -->
          <div class="grid grid-cols-3 gap-3 mb-6">
            <!-- Mode -->
            <div class="text-center">
              <div class="text-xs text-gray-500 mb-2">Mode</div>
              <div class="bg-white rounded-xl p-3 shadow-sm">
                <div class="text-2xl mb-1">${this.app.getModeIcon(acState.mode)}</div>
                <div class="text-sm font-medium text-gray-700">${acState.mode}</div>
              </div>
            </div>

            <!-- Set Temperature -->
            <div class="text-center">
              <div class="text-xs text-gray-500 mb-2">Set Temp.</div>
              <div class="bg-white rounded-xl p-3 shadow-sm">
                <div class="text-4xl font-bold text-gray-800">
                  ${acState.temperature.toFixed(1)}
                </div>
                <div class="text-xs text-gray-500">°C</div>
              </div>
            </div>

            <!-- Fan -->
            <div class="text-center">
              <div class="text-xs text-gray-500 mb-2">Fan</div>
              <div class="bg-white rounded-xl p-3 shadow-sm">
                <div class="text-2xl mb-1">≈</div>
                <div class="text-sm font-medium text-gray-700">${acState.fanSpeed}</div>
              </div>
            </div>
          </div>

          <!-- Room Temperature with Controls -->
          <div class="mb-4">
            <div class="text-center mb-2">
              <span class="text-gray-600 text-xs">Room Temp. </span>
              <span class="text-gray-800 text-lg font-bold">
                ${typeof acState.currentTemp === 'number' ? acState.currentTemp.toFixed(1) : '0.0'}°C
              </span>
            </div>
            <div class="flex gap-2 justify-center">
              <button
                onclick="app.handleRoomTempChange('${device.deviceId}', -0.5)"
                ${!this.app.isConnected ? 'disabled' : ''}
                class="w-12 h-8 bg-blue-100 hover:bg-blue-200 rounded text-gray-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <button
                onclick="app.handleRoomTempChange('${device.deviceId}', 0.5)"
                ${!this.app.isConnected ? 'disabled' : ''}
                class="w-12 h-8 bg-blue-100 hover:bg-blue-200 rounded text-gray-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <!-- Bottom Icons and Buttons -->
          <div class="flex justify-between items-center">
            <div class="flex gap-3">
              <button 
                onclick="app.handleDevicePower('${device.deviceId}')"
                ${!this.app.isConnected ? 'disabled' : ''}
                class="w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  acState.power 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                } ${!this.app.isConnected ? 'opacity-50' : ''}"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                </svg>
              </button>
              <button class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div class="flex gap-2">
              <button class="px-4 py-2 bg-white rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                Status
              </button>
              <button class="px-4 py-2 bg-white rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                ☰ Menu
              </button>
            </div>
          </div>
        </div>

        <!-- Main ON/OFF Button -->
        <div class="px-6">
          <button
            onclick="app.handleDevicePower('${device.deviceId}')"
            ${!this.app.isConnected ? 'disabled' : ''}
            class="w-full h-16 rounded-2xl font-bold text-lg shadow-md transition-all mb-4 ${
              acState.power
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-600'
            } ${!this.app.isConnected ? 'opacity-50 cursor-not-allowed' : ''}"
          >
            <div class="flex items-center justify-center gap-2">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
              </svg>
              ON/OFF
            </div>
          </button>

          <!-- Temperature Controls -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <button
              onclick="app.handleDeviceTemp('${device.deviceId}', 0.5)"
              ${!this.app.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
              TEMP+
            </button>
            <button
              onclick="app.handleDeviceTemp('${device.deviceId}', -0.5)"
              ${!this.app.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              TEMP-
            </button>
          </div>

          <!-- Mode and Fan Controls -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <button
              onclick="app.handleDeviceMode('${device.deviceId}')"
              ${!this.app.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              MODE
            </button>
            <button
              onclick="app.handleDeviceFan('${device.deviceId}')"
              ${!this.app.isConnected || !acState.power ? 'disabled' : ''}
              class="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              FAN
            </button>
          </div>

          <!-- Swing Control -->
          <button
            onclick="app.handleDeviceSwing('${device.deviceId}')"
            ${!this.app.isConnected || !acState.power ? 'disabled' : ''}
            class="w-full h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            SWING
          </button>
        </div>
      </div>
    `;
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DevicesPage;
} else {
  window.DevicesPage = DevicesPage;
}
