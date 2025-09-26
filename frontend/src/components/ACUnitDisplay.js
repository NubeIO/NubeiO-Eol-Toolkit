import React, { useState, useEffect } from 'react';
import { Thermometer, Zap, Wind, Droplets, Snowflake, Sun, Fan } from 'lucide-react';

const ACUnitDisplay = ({ acState, isConnected, capabilities }) => {
  const [tempChanged, setTempChanged] = useState(false);

  // Watch for temperature changes to trigger animation
  useEffect(() => {
    setTempChanged(true);
    const timer = setTimeout(() => setTempChanged(false), 1000);
    return () => clearTimeout(timer);
  }, [acState.temperature]);
  const getModeIcon = (mode) => {
    switch (mode) {
      case 'Cool': return <Snowflake className="w-6 h-6 text-blue-400" />;
      case 'Heat': return <Sun className="w-6 h-6 text-red-400" />;
      case 'Dry': return <Droplets className="w-6 h-6 text-yellow-400" />;
      case 'Fan': return <Fan className="w-6 h-6 text-gray-400" />;
      default: return <Wind className="w-6 h-6 text-green-400" />;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'Cool': return 'from-blue-500 to-cyan-400';
      case 'Heat': return 'from-red-500 to-orange-400';
      case 'Dry': return 'from-yellow-500 to-amber-400';
      case 'Fan': return 'from-gray-500 to-slate-400';
      default: return 'from-green-500 to-emerald-400';
    }
  };

  const getFanSpeedAnimation = (speed) => {
    if (!acState.power) return '';
    switch (speed) {
      case 'High': return 'animate-spin duration-300';
      case 'Medium': return 'animate-spin duration-500';
      case 'Low': return 'animate-spin duration-1000';
      case 'Quiet': return 'animate-spin duration-2000';
      default: return 'animate-spin duration-700';
    }
  };

  const getAirFlowIntensity = () => {
    if (!acState.power) return 0;
    switch (acState.fanSpeed) {
      case 'High': return 4;
      case 'Medium': return 3;
      case 'Low': return 2;
      case 'Quiet': return 1;
      default: return 2;
    }
  };

  const AirFlowParticle = ({ delay, intensity }) => (
    <div
      className={`absolute w-2 h-2 bg-blue-200 rounded-full opacity-60 animate-bounce`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${2000 - intensity * 200}ms`,
        left: `${Math.random() * 80 + 10}%`,
      }}
    />
  );

  return (
    <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl shadow-2xl p-6">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">AC Indoor Unit</h2>
        <div className="text-sm text-gray-600">Physical Unit Status</div>
      </div>

      {/* AC Unit Visualization */}
      <div className="relative bg-white rounded-xl shadow-lg p-6 mb-6">
        {/* Unit Body */}
        <div className={`relative bg-gradient-to-r ${acState.power ? getModeColor(acState.mode) : 'from-gray-300 to-gray-400'} rounded-lg h-32 mb-4 transition-all duration-500`}>
          {/* Power LED */}
          <div className="absolute top-2 right-2">
            <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
              acState.power ? 'bg-green-400 shadow-green-400/50 shadow-lg animate-pulse' : 'bg-gray-500'
            }`}></div>
          </div>

          {/* Status LEDs */}
          <div className="absolute top-2 left-2 flex space-x-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-400' : 'bg-red-500'}`}></div>
            <div className={`w-2 h-2 rounded-full ${acState.power ? 'bg-yellow-400' : 'bg-gray-500'}`}></div>
          </div>

          {/* Mode Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
              {getModeIcon(acState.mode)}
            </div>
          </div>

          {/* Fan Animation */}
          {acState.power && (
            <div className="absolute bottom-2 right-2">
              <Wind className={`w-6 h-6 text-white/80 ${getFanSpeedAnimation(acState.fanSpeed)}`} />
            </div>
          )}
        </div>

        {/* Air Louvers */}
        <div className="relative h-8 bg-gray-200 rounded mb-4 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center space-x-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`w-8 h-1 bg-gray-400 rounded transition-transform duration-1000 ${
                  acState.swing ? 'animate-pulse' : ''
                }`}
                style={{
                  transform: acState.swing ? `rotateX(${Math.sin(Date.now() / 1000 + i) * 15}deg)` : 'rotateX(0deg)'
                }}
              />
            ))}
          </div>
        </div>

        {/* Air Flow Visualization */}
        {acState.power && (
          <div className="relative h-16 overflow-hidden">
            <div className="text-xs text-gray-500 mb-2">Air Flow</div>
            {[...Array(getAirFlowIntensity() * 3)].map((_, i) => (
              <AirFlowParticle key={i} delay={i * 200} intensity={getAirFlowIntensity()} />
            ))}
          </div>
        )}
      </div>

      {/* Temperature Display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <Thermometer className="w-6 h-6 text-blue-600" />
          <span className="text-lg font-semibold text-blue-800">Temperature Control</span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Target Temperature */}
          <div className="text-center">
            <div className={`text-3xl font-bold text-blue-900 mb-1 transition-all duration-300 ${
              tempChanged ? 'scale-110 text-blue-600' : 'scale-100'
            }`}>
              {acState.temperature}°C
            </div>
            <div className="text-sm text-blue-700 font-medium">Target Set</div>
            <div className="text-xs text-blue-600 mt-1">
              {acState.power ? `${acState.mode} Mode Active` : 'Standby'}
            </div>
            {tempChanged && (
              <div className="text-xs text-blue-500 font-medium animate-pulse">
                ✓ Temperature Updated
              </div>
            )}
          </div>

          {/* Current Room Temperature */}
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-900 mb-1">{acState.currentTemp}°C</div>
            <div className="text-sm text-indigo-700 font-medium">Room Sensor</div>
            <div className="text-xs text-indigo-600 mt-1">
              {acState.currentTemp > acState.temperature ? '↑ Above target' :
               acState.currentTemp < acState.temperature ? '↓ Below target' :
               '✓ At target'}
            </div>
          </div>
        </div>

        {/* Temperature Progress Bar */}
        {acState.power && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>16°C</span>
              <span>Target: {acState.temperature}°C</span>
              <span>30°C</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((acState.temperature - 16) / (30 - 16)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Power Status */}
      <div className="bg-green-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <Zap className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">Unit Status</span>
        </div>
        <div className="text-2xl font-bold text-green-900">
          {acState.power ? 'OPERATING' : 'STANDBY'}
        </div>
        <div className="text-xs text-green-700">
          {acState.power ? `${acState.mode} Mode - Fan: ${acState.fanSpeed}` : 'Ready to operate'}
        </div>
      </div>

      {/* Detailed Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Unit Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Mode:</span>
              <span className="font-medium">{acState.mode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Target Temp:</span>
              <span className="font-medium">{acState.temperature}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fan Speed:</span>
              <span className="font-medium">{acState.fanSpeed}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Swing:</span>
              <span className={`font-medium ${acState.swing ? 'text-blue-600' : 'text-gray-500'}`}>
                {acState.swing ? 'Active' : 'Off'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Connection:</span>
              <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Model:</span>
              <span className="font-medium">
                {capabilities ? capabilities.modelName : (acState.model === 1 ? 'Office' : acState.model === 2 ? 'Horizontal' : 'VRF')}
              </span>
            </div>
            {capabilities && (
              <div className="flex justify-between">
                <span className="text-gray-600">Vanes:</span>
                <span className="font-medium">V{capabilities.verticalVaneCount} / H{capabilities.horizontalVaneCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Updates Indicator */}
      {isConnected && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2 text-xs text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live data from serial connection</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ACUnitDisplay;