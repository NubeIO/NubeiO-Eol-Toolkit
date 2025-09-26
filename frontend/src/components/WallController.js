import React from 'react';
import { Power, ChevronUp, ChevronDown, Wind, RotateCw, Snowflake, Sun, Droplets, Fan } from 'lucide-react';
import { SetPower, SetMode, SetTemperature, SetFanSpeed, SetSwing } from '../wailsjs/go/main/App/App';

const WallController = ({ acState, onStateChange, isConnected }) => {
  const modes = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
  const fanSpeeds = ['Auto', 'Quiet', 'Low', 'Medium', 'High'];

  const handlePowerToggle = async () => {
    try {
      const newState = await SetPower(!acState.power);
      onStateChange(newState);
    } catch (error) {
      console.error('Failed to toggle power:', error);
    }
  };

  const handleModeChange = async () => {
    try {
      const currentIndex = modes.indexOf(acState.mode);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex];
      const newState = await SetMode(nextMode);
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

  const handleFanSpeedChange = async () => {
    try {
      const currentIndex = fanSpeeds.indexOf(acState.fanSpeed);
      const nextIndex = (currentIndex + 1) % fanSpeeds.length;
      const nextSpeed = fanSpeeds[nextIndex];
      const newState = await SetFanSpeed(nextSpeed);
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

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'Cool': return <Snowflake className="w-4 h-4" />;
      case 'Heat': return <Sun className="w-4 h-4" />;
      case 'Dry': return <Droplets className="w-4 h-4" />;
      case 'Fan': return <Fan className="w-4 h-4" />;
      default: return <Wind className="w-4 h-4" />;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'Cool': return 'text-blue-400';
      case 'Heat': return 'text-red-400';
      case 'Dry': return 'text-yellow-400';
      case 'Fan': return 'text-gray-400';
      default: return 'text-green-400';
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-2xl p-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-white text-lg font-bold">FUJITSU</h2>
        <div className="text-xs text-gray-400">Wall Controller</div>
      </div>

      {/* LCD Display Area */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-600">
        <div className="grid grid-cols-3 items-center mb-2">
          {/* Power Status LED */}
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              acState.power ? 'bg-green-400 shadow-green-400/50 shadow-lg' : 'bg-gray-600'
            }`}></div>
            <span className="text-xs text-gray-400">PWR</span>
          </div>

          {/* Mode Display */}
          <div className="text-center">
            <div className={`flex items-center justify-center ${getModeColor(acState.mode)}`}>
              {getModeIcon(acState.mode)}
              <span className="ml-1 text-xs font-medium">{acState.mode.toUpperCase()}</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="text-right">
            <div className={`w-3 h-3 rounded-full ml-auto ${
              isConnected ? 'bg-blue-400 shadow-blue-400/50 shadow-lg' : 'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-400">COM</span>
          </div>
        </div>

        {/* Temperature Display */}
        <div className="text-center">
          <div className="text-4xl font-mono text-white mb-1">
            {acState.temperature}°
          </div>
          <div className="text-xs text-gray-400">
            Target: {acState.temperature}°C | Room: {acState.currentTemp}°C
          </div>
        </div>

        {/* Fan Speed & Swing Status */}
        <div className="flex justify-between mt-3 text-xs">
          <div className="text-gray-400">
            Fan: <span className="text-white">{acState.fanSpeed}</span>
          </div>
          <div className="text-gray-400">
            Swing: <span className={acState.swing ? 'text-blue-400' : 'text-gray-500'}>
              {acState.swing ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-4">
        {/* Power Button */}
        <button
          onClick={handlePowerToggle}
          disabled={!isConnected}
          className={`w-full h-12 rounded-lg font-bold text-lg transition-all duration-200 ${
            acState.power
              ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/25'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} shadow-lg`}
        >
          <Power className="w-5 h-5 mx-auto" />
        </button>

        {/* Temperature Controls */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleTemperatureChange(1)}
            disabled={!isConnected || !acState.power || acState.temperature >= 30}
            className="wall-controller-btn bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-5 h-5" />
            <span className="text-xs">TEMP</span>
          </button>
          <button
            onClick={() => handleTemperatureChange(-1)}
            disabled={!isConnected || !acState.power || acState.temperature <= 16}
            className="wall-controller-btn bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-5 h-5" />
            <span className="text-xs">TEMP</span>
          </button>
        </div>

        {/* Mode and Fan Controls */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleModeChange}
            disabled={!isConnected || !acState.power}
            className="wall-controller-btn bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {getModeIcon(acState.mode)}
            <span className="text-xs">MODE</span>
          </button>
          <button
            onClick={handleFanSpeedChange}
            disabled={!isConnected || !acState.power}
            className="wall-controller-btn bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wind className="w-5 h-5" />
            <span className="text-xs">FAN</span>
          </button>
        </div>

        {/* Swing Control */}
        <button
          onClick={handleSwingToggle}
          disabled={!isConnected || !acState.power}
          className={`w-full wall-controller-btn ${
            acState.swing
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-gray-600 hover:bg-gray-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <RotateCw className={`w-5 h-5 ${acState.swing ? 'animate-spin' : ''}`} />
          <span className="text-xs">SWING</span>
        </button>
      </div>

      {/* Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        Model: {acState.model === 1 ? 'Office' : acState.model === 2 ? 'Horizontal' : 'VRF'}
      </div>
    </div>
  );
};

export default WallController;