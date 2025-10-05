import React, { useState, useEffect } from 'react';

// Compact Device Card Component
const DeviceCard = ({ device, isConnected }) => {
  const [acState, setAcState] = useState(device);

  useEffect(() => {
    setAcState(device);
  }, [device]);

  const handlePowerToggle = async () => {
    if (!isConnected) return;
    try {
      // Send command to specific device
      await window.go.main.App.SetDevicePower(device.deviceId, !acState.power);
      // Don't update optimistically - wait for state update from backend
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  };

  const handleModeChange = async (mode) => {
    if (!isConnected || !acState.power) return;
    try {
      // Send command to specific device
      await window.go.main.App.SetDeviceMode(device.deviceId, mode);
      // Don't update optimistically - wait for state update from backend
    } catch (error) {
      console.error('Failed to change mode:', error);
    }
  };

  const handleFanSpeedChange = async (speed) => {
    if (!isConnected || !acState.power) return;
    try {
      // Send command to specific device
      await window.go.main.App.SetDeviceFanSpeed(device.deviceId, speed);
      // Don't update optimistically - wait for state update from backend
    } catch (error) {
      console.error('Failed to change fan speed:', error);
    }
  };

  const handleTemperatureChange = async (delta) => {
    if (!isConnected || !acState.power) return;
    const newTemp = acState.temperature + delta;
    if (newTemp < 16 || newTemp > 30) return;
    try {
      // Send command to specific device
      await window.go.main.App.SetDeviceTemperature(device.deviceId, newTemp);
      // Don't update optimistically - wait for state update from backend
    } catch (error) {
      console.error('Failed to change temperature:', error);
    }
  };

  const modes = [
    { id: 'Auto', icon: '🔄' },
    { id: 'Cool', icon: '❄️' },
    { id: 'Dry', icon: '💧' },
    { id: 'Fan', icon: '💨' },
    { id: 'Heat', icon: '🔥' }
  ];

  const fanSpeeds = ['Auto', 'Low', 'Med', 'Hi'];

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 border-2 ${acState.power ? 'border-green-400' : 'border-gray-300'}`}>
      {/* Device Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${acState.power ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className="font-semibold text-xs text-gray-900 truncate">
            {device.deviceId.replace('AC_SIM_', '')}
          </span>
        </div>
        <button
          onClick={handlePowerToggle}
          disabled={!isConnected}
          className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
            acState.power
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
          } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {acState.power ? 'OFF' : 'ON'}
        </button>
      </div>

      {/* Temperature Display */}
      <div className="mb-3 text-center">
        <div className="text-3xl font-bold text-blue-600">{acState.temperature}°C</div>
        <div className="text-xs text-gray-500">Room: {acState.currentTemp}°C</div>
      </div>

      {/* Temperature Controls */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => handleTemperatureChange(-0.5)}
          disabled={!isConnected || !acState.power}
          className="flex-1 bg-gray-200 hover:bg-gray-300 rounded py-2 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          −
        </button>
        <button
          onClick={() => handleTemperatureChange(0.5)}
          disabled={!isConnected || !acState.power}
          className="flex-1 bg-gray-200 hover:bg-gray-300 rounded py-2 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {/* Mode Selection */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 mb-1">Mode</div>
        <div className="grid grid-cols-5 gap-1">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              disabled={!isConnected || !acState.power}
              className={`p-2 rounded text-lg ${
                acState.mode === mode.id
                  ? 'bg-blue-500'
                  : 'bg-gray-200 hover:bg-gray-300'
              } ${!isConnected || !acState.power ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={mode.id}
            >
              {mode.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Fan Speed Selection */}
      <div>
        <div className="text-xs text-gray-600 mb-1">Fan</div>
        <div className="grid grid-cols-4 gap-1">
          {fanSpeeds.map((speed) => (
            <button
              key={speed}
              onClick={() => handleFanSpeedChange(speed === 'Med' ? 'Medium' : speed === 'Hi' ? 'High' : speed)}
              disabled={!isConnected || !acState.power}
              className={`p-1 rounded text-xs font-medium ${
                (acState.fanSpeed === speed || 
                 (speed === 'Med' && acState.fanSpeed === 'Medium') ||
                 (speed === 'Hi' && acState.fanSpeed === 'High'))
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } ${!isConnected || !acState.power ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {speed}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [devices, setDevices] = useState([]);
  const [deviceOrder, setDeviceOrder] = useState([]); // Custom order for drag & drop
  const [mqttConfig, setMqttConfig] = useState({
    broker: 'localhost',
    port: 1883,
    deviceId: 'AC_SIM_01073C'
  });
  const [isConnected, setIsConnected] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    loadMqttConfig();
    loadMqttStatus();
    loadDeviceState();
    
    const interval = setInterval(() => {
      if (isConnected) {
        loadDeviceState();
      }
    }, 2000);
    return () => clearInterval(interval);
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

  const loadDeviceState = async () => {
    try {
      // Get discovered ESP32 devices
      const discoveredDevices = await window.go.main.App.GetDiscoveredDevices();
      
      if (discoveredDevices && discoveredDevices.length > 0) {
        // Use each device's own state
        const devicesWithState = discoveredDevices.map(device => ({
          ...(device.state || {
            power: false,
            mode: 'Auto',
            temperature: 22,
            fanSpeed: 'Auto',
            swing: false,
            currentTemp: 24,
            model: 1
          }),
          deviceId: device.deviceId,
          ipAddress: device.ipAddress,
          firmwareVersion: device.firmwareVer
        }));
        
        // Sort devices by ID for consistent order
        devicesWithState.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
        
        // Initialize device order if empty
        if (deviceOrder.length === 0) {
          setDeviceOrder(devicesWithState.map(d => d.deviceId));
        }
        
        // Apply custom order if exists
        if (deviceOrder.length > 0) {
          const orderedDevices = [];
          deviceOrder.forEach(id => {
            const device = devicesWithState.find(d => d.deviceId === id);
            if (device) orderedDevices.push(device);
          });
          // Add any new devices not in order
          devicesWithState.forEach(device => {
            if (!deviceOrder.includes(device.deviceId)) {
              orderedDevices.push(device);
              setDeviceOrder([...deviceOrder, device.deviceId]);
            }
          });
          setDevices(orderedDevices);
        } else {
          setDevices(devicesWithState);
        }
      } else {
        // No devices discovered yet
        setDevices([]);
      }
    } catch (error) {
      console.error('Failed to load device state:', error);
    }
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newDevices = [...devices];
    const draggedDevice = newDevices[draggedIndex];
    newDevices.splice(draggedIndex, 1);
    newDevices.splice(index, 0, draggedDevice);
    
    setDevices(newDevices);
    setDraggedIndex(index);
    setDeviceOrder(newDevices.map(d => d.deviceId));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleConnectMQTT = async () => {
    try {
      await window.go.main.App.ConnectMQTT();
      loadMqttStatus();
      loadDeviceState();
    } catch (error) {
      console.error('Failed to connect to MQTT:', error);
    }
  };

  const handleDisconnectMQTT = async () => {
    try {
      await window.go.main.App.DisconnectMQTT();
      loadMqttStatus();
    } catch (error) {
      console.error('Failed to disconnect from MQTT:', error);
    }
  };

  const handleUpdateConfig = async (newConfig) => {
    try {
      await window.go.main.App.UpdateMQTTConfig(newConfig);
      setMqttConfig(newConfig);
      setShowConfig(false);
    } catch (error) {
      console.error('Failed to update MQTT config:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Compact Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">FGA Simulator</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
              >
                ⚙️ Config
              </button>
              <button
                onClick={isConnected ? handleDisconnectMQTT : handleConnectMQTT}
                className={`px-4 py-1 rounded text-xs font-medium text-white ${
                  isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>

          {/* Config Panel */}
          {showConfig && (
            <div className="mt-3 p-3 bg-gray-50 rounded">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Broker</label>
                  <input
                    type="text"
                    value={mqttConfig.broker}
                    onChange={(e) => setMqttConfig({...mqttConfig, broker: e.target.value})}
                    className="w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Port</label>
                  <input
                    type="number"
                    value={mqttConfig.port}
                    onChange={(e) => setMqttConfig({...mqttConfig, port: parseInt(e.target.value)})}
                    className="w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Device ID</label>
                  <input
                    type="text"
                    value={mqttConfig.deviceId}
                    onChange={(e) => setMqttConfig({...mqttConfig, deviceId: e.target.value})}
                    className="w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
              </div>
              <button
                onClick={() => handleUpdateConfig(mqttConfig)}
                className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Save Config
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Device Grid */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
          {devices.map((device, index) => (
            <div
              key={device.deviceId || index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`cursor-move transition-opacity ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
            >
              <DeviceCard device={device} isConnected={isConnected} />
            </div>
          ))}
          {devices.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <p>No devices connected</p>
              <p className="text-sm mt-2">Connect to MQTT to see devices</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;