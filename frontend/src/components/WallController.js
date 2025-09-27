import React from 'react';
import { Power, ChevronUp, ChevronDown, Wind, RotateCw, Snowflake, Sun, Droplets, Fan, Menu } from 'lucide-react';
import { SetPower, SetMode, SetTemperature, SetFanSpeed, SetSwing } from '../wailsjs/go/main/App/App';

const WallController = ({ acState, onStateChange, isConnected, theme = 'light' }) => {
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
    const iconClass = "w-5 h-5";
    switch (mode) {
      case 'Cool': return <Snowflake className={iconClass} />;
      case 'Heat': return <Sun className={iconClass} />;
      case 'Dry': return <Droplets className={iconClass} />;
      case 'Fan': return <Fan className={iconClass} />;
      default: return <Wind className={iconClass} />;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'Cool': return 'text-blue-500';
      case 'Heat': return 'text-red-500';
      case 'Dry': return 'text-yellow-500';
      case 'Fan': return 'text-gray-500';
      default: return 'text-green-500';
    }
  };

  const getThemeStyles = () => {
    return theme === 'dark' ? {
      container: 'bg-gray-800 border-gray-600 text-gray-100',
      lcd: 'bg-gray-900 border-gray-600 text-gray-100',
      button: 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600',
      text: 'text-gray-100',
      muted: 'text-gray-400'
    } : {
      container: 'bg-gray-50 border-gray-300 text-gray-800',
      lcd: 'bg-green-100 border-gray-400 text-gray-900',
      button: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300',
      text: 'text-gray-800',
      muted: 'text-gray-600'
    };
  };

  const styles = getThemeStyles();

  return (
    <div className={`w-80 mx-auto ${styles.container} border-2 rounded-2xl shadow-2xl overflow-hidden`}>
      {/* Main Body - Mimicking the Fujitsu Controller */}
      <div className="relative">
        {/* Top Brand Section */}
        <div className="text-center py-3 border-b border-gray-300">
          <div className={`text-sm font-bold ${styles.text} tracking-wider`}>FUJITSU</div>
        </div>

        {/* LCD Display Area */}
        <div className={`${styles.lcd} m-4 rounded-lg border-2 shadow-inner p-4`}>
          {/* Top Row - Office 01, Time */}
          <div className="flex justify-between items-center mb-3">
            <div className={`text-xs ${styles.muted}`}>Office 01</div>
            <div className={`text-xs ${styles.muted}`}>Fri 10:30AM</div>
          </div>

          {/* Main Display Row */}
          <div className="grid grid-cols-3 gap-4 items-center mb-4">
            {/* Mode Section */}
            <div className="text-center">
              <div className={`text-xs ${styles.muted} mb-1`}>Mode</div>
              <div className={`flex flex-col items-center p-2 rounded ${styles.button}`}>
                <div className={getModeColor(acState.mode)}>
                  {getModeIcon(acState.mode)}
                </div>
                <span className={`text-xs font-bold ${styles.text} mt-1`}>
                  {acState.mode}
                </span>
              </div>
            </div>

            {/* Temperature Display */}
            <div className="text-center">
              <div className={`text-xs ${styles.muted} mb-1`}>Set Temp.</div>
              <div className={`text-4xl font-bold ${styles.text} font-mono`}>
                {acState.temperature}.0
              </div>
              <div className={`text-xs ${styles.muted}`}>°C</div>
            </div>

            {/* Fan Section */}
            <div className="text-center">
              <div className={`text-xs ${styles.muted} mb-1`}>Fan</div>
              <div className={`flex flex-col items-center p-2 rounded ${styles.button}`}>
                <Wind className={`w-4 h-4 ${styles.text} ${acState.power && acState.fanSpeed !== 'Auto' ? 'animate-pulse' : ''}`} />
                <span className={`text-xs font-bold ${styles.text} mt-1`}>
                  {acState.fanSpeed}
                </span>
              </div>
            </div>
          </div>

          {/* Room Temperature */}
          <div className="text-center mb-3">
            <span className={`text-sm ${styles.muted}`}>Room Temp. </span>
            <span className={`text-lg font-bold ${styles.text}`}>{acState.currentTemp}.0°C</span>
          </div>

          {/* Status Icons Row */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              {/* Power Status */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                acState.power ? 'bg-green-500 text-white' : 'bg-gray-400 text-gray-200'
              }`}>
                <Power className="w-3 h-3" />
              </div>
              
              {/* Swing Status */}
              <div className={`text-xs px-2 py-1 rounded ${
                acState.swing 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-300 text-gray-600'
              }`}>
                <RotateCw className={`w-3 h-3 ${acState.swing ? 'animate-spin' : ''}`} />
              </div>
            </div>

            <div className="flex space-x-2">
              {/* Status and Menu placeholders */}
              <div className={`px-2 py-1 text-xs rounded ${styles.button}`}>Status</div>
              <div className={`px-2 py-1 text-xs rounded ${styles.button} flex items-center`}>
                <Menu className="w-3 h-3 mr-1" />
                Menu
              </div>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="p-4 space-y-3">
          {/* Power Button */}
          <button
            onClick={handlePowerToggle}
            disabled={!isConnected}
            className={`w-full py-3 rounded-lg border-2 font-bold transition-all duration-200 ${
              acState.power
                ? 'bg-red-500 border-red-600 text-white hover:bg-red-600 shadow-lg shadow-red-500/25'
                : `${styles.button} hover:shadow-lg`
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Power className="w-5 h-5" />
              <span>ON/OFF</span>
            </div>
          </button>

          {/* Temperature Controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTemperatureChange(0.5)}
              disabled={!isConnected || !acState.power || acState.temperature >= 30}
              className={`py-3 rounded-lg border-2 transition-all duration-200 ${styles.button} 
                disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex flex-col items-center">
                <ChevronUp className="w-5 h-5" />
                <span className="text-xs">TEMP+</span>
              </div>
            </button>
            <button
              onClick={() => handleTemperatureChange(-0.5)}
              disabled={!isConnected || !acState.power || acState.temperature <= 16}
              className={`py-3 rounded-lg border-2 transition-all duration-200 ${styles.button}
                disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex flex-col items-center">
                <ChevronDown className="w-5 h-5" />
                <span className="text-xs">TEMP-</span>
              </div>
            </button>
          </div>

          {/* Mode and Fan Controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleModeChange}
              disabled={!isConnected || !acState.power}
              className={`py-3 rounded-lg border-2 transition-all duration-200 ${styles.button}
                disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex flex-col items-center">
                {getModeIcon(acState.mode)}
                <span className="text-xs">MODE</span>
              </div>
            </button>
            <button
              onClick={handleFanSpeedChange}
              disabled={!isConnected || !acState.power}
              className={`py-3 rounded-lg border-2 transition-all duration-200 ${styles.button}
                disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg`}
            >
              <div className="flex flex-col items-center">
                <Wind className="w-5 h-5" />
                <span className="text-xs">FAN</span>
              </div>
            </button>
          </div>

          {/* Swing Control */}
          <button
            onClick={handleSwingToggle}
            disabled={!isConnected || !acState.power}
            className={`w-full py-3 rounded-lg border-2 transition-all duration-200 ${
              acState.swing 
                ? 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                : `${styles.button} hover:shadow-lg`
            } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-center space-x-2">
              <RotateCw className={`w-5 h-5 ${acState.swing ? 'animate-spin' : ''}`} />
              <span>SWING</span>
            </div>
          </button>
        </div>

        {/* Connection Status Indicator */}
        <div className="absolute top-2 right-2">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-400 shadow-green-400/50 shadow-lg animate-pulse' : 'bg-red-500'
          }`}></div>
        </div>
      </div>
    </div>
  );
};

export default WallController;