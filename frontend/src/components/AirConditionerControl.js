import React from 'react';
import { 
  SetPower, 
  SetMode, 
  SetTemperature, 
  SetFanSpeed, 
  SetSwing,
  SetRoomTemperature 
} from '../wailsjs/go/main/App';

const AirConditionerControl = ({ acState, onStateChange, isConnected }) => {
  const handlePowerToggle = async () => {
    if (!isConnected) return;
    try {
      const newState = await SetPower(!acState.power);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  };

  const handleModeChange = async (mode) => {
    if (!isConnected) return;
    try {
      const newState = await SetMode(mode);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to change mode:', error);
    }
  };

  const handleTemperatureChange = async (temp) => {
    if (!isConnected) return;
    try {
      const newState = await SetTemperature(temp);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to change temperature:', error);
    }
  };

  const handleFanSpeedChange = async (speed) => {
    if (!isConnected) return;
    try {
      const newState = await SetFanSpeed(speed);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to change fan speed:', error);
    }
  };

  const handleSwingToggle = async () => {
    if (!isConnected) return;
    try {
      const newState = await SetSwing(!acState.swing);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to toggle swing:', error);
    }
  };

  const handleRoomTempChange = async (temp) => {
    if (!isConnected) return;
    try {
      const newState = await SetRoomTemperature(temp);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to change room temperature:', error);
    }
  };

  const modes = [
    { id: 'Auto', label: 'Auto', icon: '🔄' },
    { id: 'Cool', label: 'Cool', icon: '❄️' },
    { id: 'Dry', label: 'Dry', icon: '💧' },
    { id: 'Fan', label: 'Fan', icon: '💨' },
    { id: 'Heat', label: 'Heat', icon: '🔥' }
  ];

  const fanSpeeds = [
    { id: 'Auto', label: 'Auto' },
    { id: 'Quiet', label: 'Quiet' },
    { id: 'Low', label: 'Low' },
    { id: 'Medium', label: 'Medium' },
    { id: 'High', label: 'High' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
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

      {/* Fan Speed */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Fan Speed
        </label>
        <div className="grid grid-cols-5 gap-2">
          {fanSpeeds.map((speed) => (
            <button
              key={speed.id}
              onClick={() => handleFanSpeedChange(speed.id)}
              disabled={!isConnected || !acState.power}
              className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                acState.fanSpeed === speed.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              } ${!isConnected || !acState.power ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {speed.label}
            </button>
          ))}
        </div>
      </div>

      {/* Swing Control */}
      <div className="mb-6">
        <button
          onClick={handleSwingToggle}
          disabled={!isConnected || !acState.power}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            acState.swing
              ? 'bg-purple-500 hover:bg-purple-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          } ${!isConnected || !acState.power ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Swing {acState.swing ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Room Temperature Injector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Room Temperature: {acState.currentTemp}°C
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleRoomTempChange(acState.currentTemp - 1)}
            disabled={!isConnected}
            className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>
          <div className="flex-1">
            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={acState.currentTemp}
              onChange={(e) => handleRoomTempChange(parseInt(e.target.value))}
              disabled={!isConnected}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          <button
            onClick={() => handleRoomTempChange(acState.currentTemp + 1)}
            disabled={!isConnected}
            className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-gray-600 dark:text-gray-400">
          {isConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
        </span>
      </div>
    </div>
  );
};

export default AirConditionerControl;
