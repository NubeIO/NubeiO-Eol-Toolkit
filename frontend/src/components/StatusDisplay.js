import React from 'react';
import { Power, Thermometer, Wind, Activity, Gauge } from 'lucide-react';

const StatusDisplay = ({ acState, isConnected }) => {
  const getModeIcon = (mode) => {
    const icons = {
      Auto: <Activity className="w-6 h-6" />,
      Cool: <Wind className="w-6 h-6 text-blue-500" />,
      Dry: <Wind className="w-6 h-6 text-yellow-500" />,
      Fan: <Wind className="w-6 h-6 text-gray-500" />,
      Heat: <Wind className="w-6 h-6 text-red-500" />
    };
    return icons[mode] || <Wind className="w-6 h-6" />;
  };

  const getModeColor = (mode) => {
    const colors = {
      Auto: 'text-green-500',
      Cool: 'text-blue-500',
      Dry: 'text-yellow-500',
      Fan: 'text-gray-500',
      Heat: 'text-red-500'
    };
    return colors[mode] || 'text-gray-500';
  };

  const getTemperatureDifference = () => {
    const diff = acState.currentTemp - acState.temperature;
    if (Math.abs(diff) < 1) return 'At target';
    if (diff > 0) return `${diff.toFixed(1)}° above`;
    return `${Math.abs(diff).toFixed(1)}° below`;
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="status-card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Connection Status</h2>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        {isConnected && (
          <div className="mt-2 text-sm text-gray-600">
            UART 9600 baudrate communication active
          </div>
        )}
      </div>

      {/* Power Status */}
      <div className="status-card">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${
            acState.power 
              ? 'bg-green-100 text-green-600' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            <Power className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Power Status
            </h3>
            <p className={`text-xl font-bold ${
              acState.power ? 'text-green-600' : 'text-gray-500'
            }`}>
              {acState.power ? 'ON' : 'OFF'}
            </p>
          </div>
        </div>
      </div>

      {/* Current Temperature */}
      <div className="status-card">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600">
            <Thermometer className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Current Temperature
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-blue-600">
                {acState.currentTemp}°C
              </span>
              <span className="text-sm text-gray-500">
                Target: {acState.temperature}°C
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {getTemperatureDifference()}
            </p>
          </div>
        </div>
      </div>

      {/* Mode Status */}
      <div className="status-card">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full bg-gray-100 ${getModeColor(acState.mode)}`}>
            {getModeIcon(acState.mode)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Operating Mode
            </h3>
            <p className={`text-xl font-bold ${getModeColor(acState.mode)}`}>
              {acState.mode}
            </p>
          </div>
        </div>
      </div>

      {/* Fan Speed */}
      <div className="status-card">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-purple-100 text-purple-600">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Fan Speed
            </h3>
            <p className="text-xl font-bold text-purple-600">
              {acState.fanSpeed}
            </p>
          </div>
        </div>
      </div>

      {/* Swing Status */}
      <div className="status-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${
              acState.swing 
                ? 'bg-orange-100 text-orange-600' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              <Wind className={`w-8 h-8 ${acState.swing ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Air Swing
              </h3>
              <p className={`text-xl font-bold ${
                acState.swing ? 'text-orange-600' : 'text-gray-500'
              }`}>
                {acState.swing ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
          {acState.swing && (
            <div className="text-orange-500 animate-pulse">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="status-card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Information
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Protocol:</span>
            <span className="font-medium">UART 9600 baud</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Frame Format:</span>
            <span className="font-medium">8 bytes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Checksum:</span>
            <span className="font-medium">XOR</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Manufacturer:</span>
            <span className="font-medium">Fujitsu</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDisplay;
