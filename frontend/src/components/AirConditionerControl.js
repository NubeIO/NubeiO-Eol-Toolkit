import React from 'react';
import { Power, Thermometer, Wind, RotateCw } from 'lucide-react';
import { SetPower, SetMode, SetTemperature, SetFanSpeed, SetSwing } from '../wailsjs/go/main/App/App';

const AirConditionerControl = ({ acState, onStateChange, isConnected }) => {
  const modes = ['Auto', 'Cool', 'Dry', 'Fan', 'Heat'];
  const fanSpeeds = ['Auto', 'Quiet', 'Low', 'Medium', 'High'];

  const handlePowerToggle = async () => {
    try {
      const newState = await SetPower(!acState.power);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  };

  const handleModeChange = async (mode) => {
    try {
      const newState = await SetMode(mode);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to change mode:', error);
    }
  };

  const handleTemperatureChange = async (delta) => {
    const newTemp = acState.temperature + delta;
    if (newTemp >= 16 && newTemp <= 30) {
      try {
        const newState = await SetTemperature(newTemp);
        onStateChange(newState);
      } catch (error) {
        console.error('Failed to change temperature:', error);
      }
    }
  };

  const handleFanSpeedChange = async (speed) => {
    try {
      const newState = await SetFanSpeed(speed);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to change fan speed:', error);
    }
  };

  const handleSwingToggle = async () => {
    try {
      const newState = await SetSwing(!acState.swing);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to toggle swing:', error);
    }
  };

  const getModeColor = (mode) => {
    const colors = {
      Auto: 'bg-green-500',
      Cool: 'bg-blue-500',
      Dry: 'bg-yellow-500',
      Fan: 'bg-gray-500',
      Heat: 'bg-red-500'
    };
    return colors[mode] || 'bg-gray-500';
  };

  return (
    <div className="status-card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Wind className="w-6 h-6" />
        Air Conditioner Controls
      </h2>

      {/* Power Button */}
      <div className="mb-8">
        <button
          onClick={handlePowerToggle}
          disabled={!isConnected}
          className={`w-full py-4 rounded-xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 ${
            acState.power
              ? 'bg-green-500 text-white shadow-green-500/25 hover:bg-green-600'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} shadow-lg`}
        >
          <Power className="w-6 h-6" />
          {acState.power ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Mode Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Mode</h3>
        <div className="grid grid-cols-3 gap-3">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              disabled={!isConnected || !acState.power}
              className={`control-button ${
                acState.mode === mode ? 'active' : 'inactive'
              } ${(!isConnected || !acState.power) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-3 h-3 rounded-full ${getModeColor(mode)} mx-auto mb-1`}></div>
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature Control */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Thermometer className="w-5 h-5" />
          Target Temperature
        </h3>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleTemperatureChange(-1)}
            disabled={!isConnected || !acState.power || acState.temperature <= 16}
            className="w-12 h-12 rounded-full bg-blue-500 text-white font-bold text-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            -
          </button>
          
          <div className="text-center">
            <div className="temperature-display">
              {acState.temperature}°
            </div>
            <div className="text-sm text-gray-500">16° - 30°C</div>
          </div>
          
          <button
            onClick={() => handleTemperatureChange(1)}
            disabled={!isConnected || !acState.power || acState.temperature >= 30}
            className="w-12 h-12 rounded-full bg-red-500 text-white font-bold text-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      {/* Fan Speed */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Fan Speed</h3>
        <div className="grid grid-cols-3 gap-2">
          {fanSpeeds.map((speed) => (
            <button
              key={speed}
              onClick={() => handleFanSpeedChange(speed)}
              disabled={!isConnected || !acState.power}
              className={`control-button text-sm ${
                acState.fanSpeed === speed ? 'active' : 'inactive'
              } ${(!isConnected || !acState.power) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {speed}
            </button>
          ))}
        </div>
      </div>

      {/* Swing Control */}
      <div>
        <button
          onClick={handleSwingToggle}
          disabled={!isConnected || !acState.power}
          className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            acState.swing
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } ${(!isConnected || !acState.power) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} shadow-lg`}
        >
          <RotateCw className={`w-5 h-5 ${acState.swing ? 'animate-spin' : ''}`} />
          Swing {acState.swing ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};

export default AirConditionerControl;
