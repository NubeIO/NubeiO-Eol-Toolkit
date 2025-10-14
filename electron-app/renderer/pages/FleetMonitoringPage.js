// Fleet Monitoring Page - Monitor MQTT-connected devices from FGA-Gen2-Fw
class FleetMonitoringPage {
  constructor(app) {
    this.app = app;
    this.config = {
      broker: '113.160.225.31',
      port: 1884,
      baseTopic: 'nube-io/hvac/logs/#' // Subscribe to all device logs
    };
    this.isConnected = false;
    this.devices = new Map(); // Map of device_id -> device info
    this.messages = []; // Recent messages from all devices
    this.maxMessages = 500;
    this.selectedDevice = null;
    this.filterLevel = 'all'; // all, ERROR, WARN, INFO, DEBUG
    this.refreshInterval = null; // Auto-refresh timer
  }

  async init() {
    console.log('Initializing Fleet Monitoring Page...');
    await this.loadConfig();
    await this.loadStatus();
    console.log('Fleet Monitoring Page initialized');
  }

  async loadConfig() {
    try {
      const config = await window.fleetMonitoringAPI.getConfig();
      if (config) {
        this.config = config;
      }
    } catch (error) {
      console.error('Failed to load fleet monitoring config:', error);
    }
  }

  async loadStatus() {
    try {
      const status = await window.fleetMonitoringAPI.getStatus();
      this.isConnected = status.isConnected;
      this.devices = new Map(Object.entries(status.devices || {}));
      this.messages = status.messages || [];
    } catch (error) {
      console.error('Failed to load fleet monitoring status:', error);
    }
  }

  async connect() {
    try {
      await window.fleetMonitoringAPI.connect(
        this.config.broker,
        this.config.port,
        this.config.baseTopic
      );
      await this.loadStatus();
      this.startAutoRefresh();
      this.app.render();
    } catch (error) {
      console.error('Failed to connect fleet monitoring:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      await window.fleetMonitoringAPI.disconnect();
      this.stopAutoRefresh();
      await this.loadStatus();
      this.app.render();
    } catch (error) {
      console.error('Failed to disconnect fleet monitoring:', error);
    }
  }

  startAutoRefresh() {
    // Stop any existing refresh timer
    this.stopAutoRefresh();
    
    // Refresh every 2 seconds
    this.refreshInterval = setInterval(async () => {
      if (this.isConnected) {
        await this.loadStatus();
        this.app.render();
      }
    }, 2000);
    console.log('Fleet Monitoring: Auto-refresh started (2s interval)');
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('Fleet Monitoring: Auto-refresh stopped');
    }
  }

  async clearMessages() {
    try {
      await window.fleetMonitoringAPI.clearMessages();
      this.messages = [];
      this.app.render();
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
  }

  selectDevice(deviceId) {
    this.selectedDevice = deviceId === this.selectedDevice ? null : deviceId;
    this.app.render();
  }

  getDeviceStatus(device) {
    if (!device.lastSeen) return 'offline';
    const timeSinceLastSeen = Date.now() - new Date(device.lastSeen).getTime();
    if (timeSinceLastSeen < 30000) return 'online'; // Online if seen in last 30s
    if (timeSinceLastSeen < 300000) return 'away'; // Away if seen in last 5 min
    return 'offline';
  }

  getStatusColor(status) {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  getLevelColor(level) {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'text-red-600';
      case 'WARN': return 'text-yellow-600';
      case 'INFO': return 'text-blue-600';
      case 'DEBUG': return 'text-gray-600';
      default: return 'text-gray-800';
    }
  }

  getFilteredMessages() {
    let filtered = this.messages;

    // Filter by selected device
    if (this.selectedDevice) {
      filtered = filtered.filter(msg => msg.clientId === this.selectedDevice);
    }

    // Filter by log level
    if (this.filterLevel !== 'all') {
      filtered = filtered.filter(msg => msg.level === this.filterLevel);
    }

    return filtered;
  }

  render() {
    const devices = Array.from(this.devices.values());
    const filteredMessages = this.getFilteredMessages();

    return `
      <div class="fleet-monitoring-container p-6 max-w-7xl mx-auto">
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-2xl font-bold text-gray-800 mb-4">🌐 Fleet Monitoring</h2>
          
          <!-- Connection Config -->
          ${!this.isConnected ? `
            <div class="mb-6 p-4 bg-gray-50 rounded-lg">
              <div class="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">MQTT Broker</label>
                  <input type="text" id="fleet-broker" value="${this.config.broker}" 
                    oninput="window.fleetMonitoringPage.config.broker = this.value"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="localhost" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Port</label>
                  <input type="number" id="fleet-port" value="${this.config.port}"
                    oninput="window.fleetMonitoringPage.config.port = parseInt(this.value)" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="1883" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Topic Filter</label>
                  <input type="text" id="fleet-topic" value="${this.config.baseTopic}"
                    oninput="window.fleetMonitoringPage.config.baseTopic = this.value" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="nube-io/hvac/logs/#" />
                </div>
              </div>
              <button onclick="window.fleetMonitoringPage.connect()" 
                class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors">
                🔌 Connect to Fleet
              </button>
            </div>
          ` : `
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <span class="text-sm font-medium text-gray-700">Connected to ${this.config.broker}:${this.config.port}</span>
                </div>
                <div class="text-sm text-gray-600">
                  ${devices.length} device${devices.length !== 1 ? 's' : ''} | ${this.messages.length} messages
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="window.fleetMonitoringPage.clearMessages()" 
                  class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm transition-colors">
                  🗑️ Clear
                </button>
                <button onclick="window.fleetMonitoringPage.disconnect()" 
                  class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition-colors">
                  🔌 Disconnect
                </button>
              </div>
            </div>
          `}

          ${this.isConnected ? `
            <!-- Fleet Overview -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Device List -->
              <div class="lg:col-span-1">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Connected Devices</h3>
                <div class="space-y-2 max-h-96 overflow-y-auto">
                  ${devices.length === 0 ? `
                    <div class="text-center py-8 text-gray-500">
                      <p>No devices detected yet</p>
                      <p class="text-xs mt-2">Waiting for MQTT messages...</p>
                    </div>
                  ` : devices.map(device => {
                    const status = this.getDeviceStatus(device);
                    const statusColor = this.getStatusColor(status);
                    const isSelected = this.selectedDevice === device.clientId;
                    
                    return `
                      <div onclick="window.fleetMonitoringPage.selectDevice('${device.clientId}')" 
                        class="p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }">
                        <div class="flex items-center justify-between mb-2">
                          <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full ${statusColor}"></div>
                            <span class="font-medium text-sm">${device.clientId}</span>
                          </div>
                          <span class="text-xs text-gray-500">${device.messageCount || 0} msgs</span>
                        </div>
                        <div class="text-xs text-gray-600">
                          <div>Env: <span class="font-medium">${device.environment || 'unknown'}</span></div>
                          <div>Last seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'Never'}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Message Feed -->
              <div class="lg:col-span-2">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-semibold text-gray-800">
                    ${this.selectedDevice ? `Messages from ${this.selectedDevice}` : 'All Messages'}
                  </h3>
                  
                  <!-- Log Level Filter -->
                  <select onchange="window.fleetMonitoringPage.filterLevel = this.value; window.fleetMonitoringPage.app.render();" 
                    class="px-3 py-1 border border-gray-300 rounded-md text-sm">
                    <option value="all" ${this.filterLevel === 'all' ? 'selected' : ''}>All Levels</option>
                    <option value="ERROR" ${this.filterLevel === 'ERROR' ? 'selected' : ''}>ERROR</option>
                    <option value="WARN" ${this.filterLevel === 'WARN' ? 'selected' : ''}>WARN</option>
                    <option value="INFO" ${this.filterLevel === 'INFO' ? 'selected' : ''}>INFO</option>
                    <option value="DEBUG" ${this.filterLevel === 'DEBUG' ? 'selected' : ''}>DEBUG</option>
                  </select>
                </div>

                <div id="fleet-messages-container" class="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto font-mono text-sm">
                  ${filteredMessages.length === 0 ? `
                    <div class="text-center py-8 text-gray-500">
                      <p>No messages ${this.selectedDevice ? `from ${this.selectedDevice}` : 'yet'}</p>
                    </div>
                  ` : filteredMessages.map(msg => `
                    <div class="mb-2 pb-2 border-b border-gray-200 last:border-0">
                      <div class="flex items-start gap-2">
                        <span class="text-gray-500 text-xs whitespace-nowrap">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                        <span class="text-gray-600 text-xs whitespace-nowrap">[${msg.clientId}]</span>
                        <span class="${this.getLevelColor(msg.level)} text-xs font-bold whitespace-nowrap">${msg.level}</span>
                        <span class="text-gray-700 text-xs">${msg.tag || ''}</span>
                      </div>
                      <div class="ml-8 mt-1 text-gray-800 text-xs break-words">${msg.message || ''}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Help Section -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-gray-700">
            <strong>Fleet Monitoring</strong> - Monitors all FGA-Gen2-Fw devices connected to the MQTT broker.
            <br/>Topic pattern: <code class="bg-white px-1 rounded">nube-io/hvac/logs/{client_id}/{env}/{level}</code>
          </p>
        </div>
      </div>
    `;
  }
}

// Make it globally accessible
if (typeof window !== 'undefined') {
  window.FleetMonitoringPage = FleetMonitoringPage;
}

