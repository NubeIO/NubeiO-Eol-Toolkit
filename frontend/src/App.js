import React, { useState, useEffect } from 'react';

const App = () => {
  const [acState, setAcState] = useState({
    power: false,
    mode: 'Auto',
    temperature: 22,
    fanSpeed: 'Auto',
    swing: false,
    currentTemp: 24,
    model: 1
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadAcState();
    const interval = setInterval(() => {
      if (isConnected) {
        loadAcState();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const loadAcState = async () => {
    try {
      const state = await window.go.main.App.GetAirConditionerState();
      setAcState(state);
    } catch (error) {
      console.error('Failed to load AC state:', error);
    }
  };

  const handlePowerToggle = async () => {
    if (!isConnected) return;
    try {
      const newState = await window.go.main.App.SetPower(!acState.power);
      setAcState(newState);
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  };

  const handleModeChange = async (mode) => {
    if (!isConnected) return;
    try {
      const newState = await window.go.main.App.SetMode(mode);
      setAcState(newState);
    } catch (error) {
      console.error('Failed to change mode:', error);
    }
  };

  const handleTemperatureChange = async (temp) => {
    if (!isConnected) return;
    try {
      const newState = await window.go.main.App.SetTemperature(temp);
      setAcState(newState);
    } catch (error) {
      console.error('Failed to change temperature:', error);
    }
  };

  const handleConnectMQTT = async () => {
    try {
      await window.go.main.App.ConnectMQTT();
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to MQTT:', error);
    }
  };

  const handleDisconnectMQTT = async () => {
    try {
      await window.go.main.App.DisconnectMQTT();
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to disconnect from MQTT:', error);
    }
  };

  const modes = [
    { id: 'Auto', label: 'Auto', icon: '🔄' },
    { id: 'Cool', label: 'Cool', icon: '❄️' },
    { id: 'Dry', label: 'Dry', icon: '💧' },
    { id: 'Fan', label: 'Fan', icon: '💨' },
    { id: 'Heat', label: 'Heat', icon: '🔥' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              FGA Simulator
            </h1>
            <div className="text-sm text-gray-600">
              Fujitsu Air Conditioner Simulator
            </div>
          </div>
        </div>

        {/* MQTT Connection */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            MQTT Connection
          </h3>
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button
              onClick={isConnected ? handleDisconnectMQTT : handleConnectMQTT}
              className={`px-4 py-2 rounded text-white ${
                isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Air Conditioner Control */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Air Conditioner Control
            </h3>

            {/* Power Button */}
            <div className="mb-6">
              <button
                onClick={handlePowerToggle}
                disabled={!isConnected}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  acState.power
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {acState.power ? 'POWER OFF' : 'POWER ON'}
              </button>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Mode
              </label>
              <div className="grid grid-cols-5 gap-2">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleModeChange(mode.id)}
                    disabled={!isConnected || !acState.power}
                    className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      acState.mode === mode.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    } ${!isConnected || !acState.power ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-lg mb-1">{mode.icon}</div>
                    <div>{mode.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature Control */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Temperature: {acState.temperature}°C
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleTemperatureChange(acState.temperature - 0.5)}
                  disabled={!isConnected || !acState.power}
                  className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min="16"
                    max="30"
                    step="0.5"
                    value={acState.temperature}
                    onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                    disabled={!isConnected || !acState.power}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => handleTemperatureChange(acState.temperature + 0.5)}
                  disabled={!isConnected || !acState.power}
                  className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-600">
                {isConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
              </span>
            </div>
          </div>

          {/* Status Display */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Device Status
            </h3>

            {/* Power Status */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Power</span>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  acState.power 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {acState.power ? 'ON' : 'OFF'}
                </div>
              </div>
            </div>

            {/* Current Mode */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Mode</span>
                <span className="text-lg">
                  {acState.mode === 'Auto' ? '🔄' : 
                   acState.mode === 'Cool' ? '❄️' : 
                   acState.mode === 'Dry' ? '💧' : 
                   acState.mode === 'Fan' ? '💨' : 
                   acState.mode === 'Heat' ? '🔥' : '❓'}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {acState.mode}
              </div>
            </div>

            {/* Temperature Display */}
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Set Temperature
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {acState.temperature}°C
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Room Temperature
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    {acState.currentTemp}°C
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p>© 2025 Nube IO - FGA Simulator v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default App;