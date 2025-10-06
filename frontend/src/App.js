import React, { useState, useEffect } from 'react';

const App = () => {
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [mqttConfig, setMqttConfig] = useState({
    broker: 'localhost',
    port: 1883,
    deviceId: 'AC_SIM_01073C'
  });
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadMqttConfig();
    loadMqttStatus();
    loadDiscoveredDevices();
    
    const stateInterval = setInterval(() => {
      if (isConnected) {
        loadDiscoveredDevices();
      }
    }, 2000);

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(stateInterval);
      clearInterval(timeInterval);
    };
  }, [isConnected]);

  const loadMqttConfig = async () => {
    try {
      const config = await window.go.main.App.GetMQTTConfig();
      setMqttConfig(config);
    } catch (error) {
      console.error('Failed to load MQTT config:', error);
    }
  };

  const loadMqttStatus = async () => {
    try {
      const status = await window.go.main.App.GetMQTTStatus();
      setIsConnected(status);
    } catch (error) {
      console.error('Failed to load MQTT status:', error);
    }
  };

  const loadDiscoveredDevices = async () => {
    try {
      const devices = await window.go.main.App.GetDiscoveredDevices();
      if (devices && devices.length > 0) {
        // Sort devices by deviceId to maintain consistent order
        const sortedDevices = [...devices].sort((a, b) => 
          a.deviceId.localeCompare(b.deviceId)
        );
        setDiscoveredDevices(sortedDevices);
      }
    } catch (error) {
      console.error('Failed to load discovered devices:', error);
    }
  };

  const handleConnectMQTT = async () => {
    try {
      await window.go.main.App.ConnectMQTT();
      setTimeout(() => {
        loadMqttStatus();
        loadDiscoveredDevices();
      }, 500);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnectMQTT = async () => {
    try {
      await window.go.main.App.DisconnectMQTT();
      setTimeout(() => loadMqttStatus(), 500);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    try {
      await window.go.main.App.UpdateMQTTConfig(mqttConfig.broker, mqttConfig.port, mqttConfig.username || '', mqttConfig.password || '');
      setShowConfig(false);
      await handleConnectMQTT();
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const formatTime = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[currentTime.getDay()];
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${day} ${displayHours}:${minutes}${ampm}`;
  };

  // Device Control Panel Component
  const DevicePanel = ({ device }) => {
    const acState = device.state || {
      power: false,
      mode: 'Auto',
      temperature: 22.0,
      fanSpeed: 'Auto',
      swing: false,
      currentTemp: 18,
      model: 1
    };
    const deviceId = device.deviceId;

    const handlePowerToggle = async () => {
      if (!isConnected) return;
      try {
        await window.go.main.App.SetDevicePower(deviceId, !acState.power);
        setTimeout(() => loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to toggle power:', error);
      }
    };

    const handleModeClick = async () => {
      if (!isConnected || !acState.power) return;
      const modes = ['Auto', 'Cool', 'Dry', 'Fan', 'Heat'];
      const currentIndex = modes.indexOf(acState.mode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      try {
        await window.go.main.App.SetDeviceMode(deviceId, nextMode);
        setTimeout(() => loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change mode:', error);
      }
    };

    const handleFanClick = async () => {
      if (!isConnected || !acState.power) return;
      const fanSpeeds = ['Auto', 'Quiet', 'Low', 'Medium', 'High'];
      const currentIndex = fanSpeeds.indexOf(acState.fanSpeed);
      const nextFan = fanSpeeds[(currentIndex + 1) % fanSpeeds.length];
      try {
        await window.go.main.App.SetDeviceFanSpeed(deviceId, nextFan);
        setTimeout(() => loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change fan speed:', error);
      }
    };

    const handleTemperatureChange = async (delta) => {
      if (!isConnected || !acState.power) return;
      const newTemp = acState.temperature + delta;
      if (newTemp < 16 || newTemp > 30) return;
      try {
        await window.go.main.App.SetDeviceTemperature(deviceId, newTemp);
        setTimeout(() => loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change temperature:', error);
      }
    };

    const handleSwingToggle = async () => {
      if (!isConnected || !acState.power) return;
      try {
        // Swing control not implemented yet
        setTimeout(() => loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to toggle swing:', error);
      }
    };

    const handleRoomTempChange = async (delta) => {
      if (!isConnected) return;
      const newTemp = acState.currentTemp + delta;
      if (newTemp < -50 || newTemp > 100) return;
      try {
        await window.go.main.App.SetDeviceRoomTemperature(deviceId, newTemp);
        setTimeout(() => loadDiscoveredDevices(), 300);
      } catch (error) {
        console.error('Failed to change room temperature:', error);
      }
    };

    const getModeIcon = (mode) => {
      const icons = {
        'Auto': '≈',
        'Cool': '❄',
        'Dry': '💧',
        'Fan': '🌀',
        'Heat': '🔥'
      };
      return icons[mode] || '≈';
    };

    const getFanIcon = () => '≈';

    return (
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-white px-6 py-4 flex items-center justify-between border-b">
          <h1 className="text-xl font-bold text-gray-700 tracking-wide">FUJITSU</h1>
          <div className={`w-3 h-3 rounded-full ${acState.power ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>

        {/* Main Control Panel */}
        <div className="p-6">
          {/* Status Card */}
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-6 mb-6 shadow-md">
            {/* Title and Time */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-gray-700 font-semibold text-sm">
                {deviceId}
              </h2>
              <span className="text-gray-500 text-sm">{formatTime()}</span>
            </div>

            {/* Mode, Temp, Fan Display */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {/* Mode */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">Mode</div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-2xl mb-1">{getModeIcon(acState.mode)}</div>
                  <div className="text-sm font-medium text-gray-700">{acState.mode}</div>
                </div>
              </div>

              {/* Set Temperature */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">Set Temp.</div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-4xl font-bold text-gray-800">
                    {acState.temperature.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">°C</div>
                </div>
              </div>

              {/* Fan */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">Fan</div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-2xl mb-1">{getFanIcon()}</div>
                  <div className="text-sm font-medium text-gray-700">{acState.fanSpeed}</div>
                </div>
              </div>
            </div>

            {/* Room Temperature with Controls */}
            <div className="mb-4">
              <div className="text-center mb-2">
                <span className="text-gray-600 text-xs">Room Temp. </span>
                <span className="text-gray-800 text-lg font-bold">
                  {typeof acState.currentTemp === 'number' ? acState.currentTemp.toFixed(1) : '0.0'}°C
                </span>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handleRoomTempChange(-0.5)}
                  disabled={!isConnected}
                  className="w-12 h-8 bg-blue-100 hover:bg-blue-200 rounded text-gray-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>
                <button
                  onClick={() => handleRoomTempChange(0.5)}
                  disabled={!isConnected}
                  className="w-12 h-8 bg-blue-100 hover:bg-blue-200 rounded text-gray-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Bottom Icons and Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <button 
                  onClick={handlePowerToggle}
                  disabled={!isConnected}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    acState.power 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-400 text-white'
                  } ${!isConnected ? 'opacity-50' : 'hover:opacity-80'}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                  </svg>
                </button>
                <button className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-white rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                  Status
                </button>
                <button className="px-4 py-2 bg-white rounded-lg text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                  ☰ Menu
                </button>
              </div>
            </div>
          </div>

          {/* Main ON/OFF Button */}
          <button
            onClick={handlePowerToggle}
            disabled={!isConnected}
            className={`w-full h-16 rounded-2xl font-bold text-lg shadow-md transition-all mb-4 ${
              acState.power
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-600'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
              </svg>
              ON/OFF
            </div>
          </button>

          {/* Temperature Controls */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => handleTemperatureChange(0.5)}
              disabled={!isConnected || !acState.power}
              className="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              TEMP+
            </button>
            <button
              onClick={() => handleTemperatureChange(-0.5)}
              disabled={!isConnected || !acState.power}
              className="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              TEMP-
            </button>
          </div>

          {/* Mode and Fan Controls */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={handleModeClick}
              disabled={!isConnected || !acState.power}
              className="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              MODE
            </button>
            <button
              onClick={handleFanClick}
              disabled={!isConnected || !acState.power}
              className="h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              FAN
            </button>
          </div>

          {/* Swing Control */}
          <button
            onClick={handleSwingToggle}
            disabled={!isConnected || !acState.power}
            className="w-full h-14 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            SWING
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      {/* MQTT Connection Bar */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="font-semibold text-gray-700">
                  {isConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
                </span>
              </div>
              <div className="text-sm text-gray-500 border-l pl-3">
                {mqttConfig.broker}:{mqttConfig.port}
              </div>
              <div className="text-sm text-gray-600 border-l pl-3">
                {discoveredDevices.length} {discoveredDevices.length === 1 ? 'Device' : 'Devices'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                ⚙️ Config
              </button>
              <button
                onClick={isConnected ? handleDisconnectMQTT : handleConnectMQTT}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                  isConnected 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isConnected ? '🔌 Disconnect' : '🔌 Connect'}
              </button>
            </div>
          </div>

          {/* Configuration Panel */}
          {showConfig && (
            <form onSubmit={handleUpdateConfig} className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">MQTT Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Broker Address</label>
                  <input
                    type="text"
                    value={mqttConfig.broker}
                    onChange={(e) => setMqttConfig({...mqttConfig, broker: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Port</label>
                  <input
                    type="number"
                    value={mqttConfig.port}
                    onChange={(e) => setMqttConfig({...mqttConfig, port: parseInt(e.target.value) || 1883})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1883"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Username (optional)</label>
                  <input
                    type="text"
                    value={mqttConfig.username || ''}
                    onChange={(e) => setMqttConfig({...mqttConfig, username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Password (optional)</label>
                  <input
                    type="password"
                    value={mqttConfig.password || ''}
                    onChange={(e) => setMqttConfig({...mqttConfig, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="password"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  💾 Save & Connect
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Device Grid */}
      <div className="max-w-7xl mx-auto">
        {discoveredDevices.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📡</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">No Devices Found</h3>
            <p className="text-gray-500">
              {isConnected 
                ? 'Waiting for devices to connect...' 
                : 'Please connect to MQTT broker first'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {discoveredDevices.map((device) => (
              <DevicePanel key={device.deviceId} device={device} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;