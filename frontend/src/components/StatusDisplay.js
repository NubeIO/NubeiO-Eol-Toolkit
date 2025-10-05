import React from 'react';

const StatusDisplay = ({ acState, capabilities, isConnected }) => {
  const getModeIcon = (mode) => {
    switch (mode) {
      case 'Auto': return '🔄';
      case 'Cool': return '❄️';
      case 'Dry': return '💧';
      case 'Fan': return '💨';
      case 'Heat': return '🔥';
      default: return '❓';
    }
  };

  const getFanSpeedIcon = (speed) => {
    switch (speed) {
      case 'Auto': return '🔄';
      case 'Quiet': return '🔇';
      case 'Low': return '🌬️';
      case 'Medium': return '💨';
      case 'High': return '🌪️';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Device Status
      </h3>

      {/* Power Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Power</span>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            acState.power 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {acState.power ? 'ON' : 'OFF'}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              acState.power ? 'bg-green-500' : 'bg-gray-400'
            }`}
            style={{ width: acState.power ? '100%' : '0%' }}
          ></div>
        </div>
      </div>

      {/* Current Mode */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mode</span>
          <span className="text-lg">{getModeIcon(acState.mode)}</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {acState.mode}
        </div>
      </div>

      {/* Temperature Display */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Set Temperature
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {acState.temperature}°C
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Room Temperature
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {acState.currentTemp}°C
            </div>
          </div>
        </div>
      </div>

      {/* Fan Speed */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fan Speed</span>
          <span className="text-lg">{getFanSpeedIcon(acState.fanSpeed)}</span>
        </div>
        <div className="text-xl font-semibold text-gray-900 dark:text-white">
          {acState.fanSpeed}
        </div>
      </div>

      {/* Swing Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Swing</span>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            acState.swing 
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {acState.swing ? 'ON' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Device Model */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {acState.model === 1 ? 'Office' : acState.model === 2 ? 'Horizontal' : 'VRF'}
          </span>
        </div>
      </div>

      {/* Capabilities */}
      {capabilities && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Capabilities
          </h4>
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Vertical Vanes:</span>
              <span>{capabilities.verticalVaneCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Horizontal Vanes:</span>
              <span>{capabilities.horizontalVaneCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Vertical Swing:</span>
              <span>{capabilities.verticalSwing ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span>Horizontal Swing:</span>
              <span>{capabilities.horizontalSwing ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}

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

export default StatusDisplay;
