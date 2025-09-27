import React, { useState, useEffect } from 'react';
import { Thermometer, Wind, Droplets, Snowflake, Sun, Fan } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ACUnitDisplay = ({ acState, isConnected, capabilities }) => {
  const { getThemeClasses, isDark } = useTheme();
  const themeClasses = getThemeClasses();
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
    <div className={`${themeClasses.acUnit} rounded-xl shadow-2xl p-6 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className={`text-2xl font-bold ${themeClasses.text.primary}`}>AC Indoor Unit</h2>
        {/* Removed subtitle 'Physical Unit Status' per minimal UI request */}
      </div>

      {/* AC Unit Visualization */}
      <div className={`relative ${themeClasses.panel} rounded-xl shadow-lg p-6 mb-6`}>
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
      <div className={`${themeClasses.tempDisplay} rounded-lg p-6 mb-6 border ${isDark ? 'border-gray-600' : 'border-blue-200'}`}>
        <div className="flex items-center mb-4 gap-2">
          <Thermometer className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          {/* Removed 'Temperature Control' heading per request */}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Target Temperature */}
          <div className="text-center">
            <div className={`text-3xl font-bold mb-1 transition-all duration-300 ${
              tempChanged ? 'scale-110' : 'scale-100'
            } ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
              {acState.temperature}°C
            </div>
            <div className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Target Set</div>
            <div className={`text-xs mt-1 ${isDark ? 'text-blue-500' : 'text-blue-600'}`}>
              {acState.power ? `${acState.mode} Mode Active` : 'Standby'}
            </div>
            {tempChanged && (
              <div className={`text-xs font-medium animate-pulse ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                ✓ Temperature Updated
              </div>
            )}
          </div>

          {/* Current Room Temperature */}
          <div className="text-center">
            <div className={`text-3xl font-bold mb-1 ${isDark ? 'text-indigo-300' : 'text-indigo-900'}`}>{acState.currentTemp}°C</div>
            <div className={`text-sm font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>Room Sensor</div>
            <div className={`text-xs mt-1 ${isDark ? 'text-indigo-500' : 'text-indigo-600'}`}>
              {acState.currentTemp > acState.temperature ? '↑ Above target' :
               acState.currentTemp < acState.temperature ? '↓ Below target' :
               '✓ At target'}
            </div>
          </div>
        </div>

        {/* Temperature Progress Bar */}
        {acState.power && (
          <div className="mt-4">
            <div className={`flex justify-between text-xs mb-1 ${themeClasses.text.secondary}`}>
              <span>16°C</span>
              <span>Target: {acState.temperature}°C</span>
              <span>30°C</span>
            </div>
            <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((acState.temperature - 16) / (30 - 16)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Removed Power Status panel; keeping Detailed Status as requested */}

      {/* Detailed Status */}
      <div className={`${themeClasses.status} rounded-lg p-4 border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
        <h3 className={`font-semibold mb-3 ${themeClasses.text.primary}`}>Unit Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={themeClasses.text.secondary}>Mode:</span>
              <span className={`font-medium ${themeClasses.text.primary}`}>{acState.mode}</span>
            </div>
            <div className="flex justify-between">
              <span className={themeClasses.text.secondary}>Target Temp:</span>
              <span className={`font-medium ${themeClasses.text.primary}`}>{acState.temperature}°C</span>
            </div>
            <div className="flex justify-between">
              <span className={themeClasses.text.secondary}>Fan Speed:</span>
              <span className={`font-medium ${themeClasses.text.primary}`}>{acState.fanSpeed}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={themeClasses.text.secondary}>Swing:</span>
              <span className={`font-medium ${acState.swing ? 'text-blue-600' : (isDark ? 'text-gray-400' : 'text-gray-500')}`}>
                {acState.swing ? 'Active' : 'Off'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={themeClasses.text.secondary}>Connection:</span>
              <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={themeClasses.text.secondary}>Model:</span>
              <span className={`font-medium ${themeClasses.text.primary}`}>
                {capabilities ? capabilities.modelName : (acState.model === 1 ? 'Office' : acState.model === 2 ? 'Horizontal' : 'VRF')}
              </span>
            </div>
            {capabilities && (
              <div className="flex justify-between">
                <span className={themeClasses.text.secondary}>Vanes:</span>
                <span className={`font-medium ${themeClasses.text.primary}`}>V{capabilities.verticalVaneCount} / H{capabilities.horizontalVaneCount}</span>
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