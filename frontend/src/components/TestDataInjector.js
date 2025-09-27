import React, { useState, useEffect } from 'react';
import { Settings, Thermometer, Activity, Zap } from 'lucide-react';
import { SetRoomTemperature } from '../wailsjs/go/main/App';

const TestDataInjector = ({ acState, isConnected, capabilities, onTestDataChange, theme = 'light' }) => {
  const [testData, setTestData] = useState({
    roomTemperature: 24,
    outsideTemperature: 28,
    humidity: 55,
    errorCode: 0,
    connectionLatency: 0,
    signalStrength: 85,
    powerConsumption: 1200,
    operatingHours: 1250
  });

  // Notify parent component when test data changes
  useEffect(() => {
    if (onTestDataChange) {
      onTestDataChange(testData);
    }
  }, [testData, onTestDataChange]);

  const handleInputChange = async (field, value) => {
    const numValue = parseFloat(value) || 0;
    
    setTestData(prev => ({
      ...prev,
      [field]: numValue
    }));

    // Call backend method when room temperature is changed
    if (field === 'roomTemperature') {
      try {
        await SetRoomTemperature(numValue);
        console.log(`Room temperature updated to ${numValue}°C`);
      } catch (error) {
        console.error('Failed to update room temperature:', error);
      }
    }
  };

  const setQuickScenario = async (updates) => {
    setTestData(prev => ({ ...prev, ...updates }));
    
    // If room temperature is being updated, call the backend
    if (updates.roomTemperature !== undefined) {
      try {
        await SetRoomTemperature(updates.roomTemperature);
        console.log(`Room temperature updated to ${updates.roomTemperature}°C via quick scenario`);
      } catch (error) {
        console.error('Failed to update room temperature:', error);
      }
    }
  };

  const getThemeStyles = () => {
    return theme === 'dark' ? {
      card: 'bg-gray-800 border-gray-700 text-gray-100',
      input: 'bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500',
      label: 'text-gray-300',
      readonly: 'bg-gray-900 border-gray-600 text-gray-400 cursor-not-allowed',
      text: 'text-gray-100',
      muted: 'text-gray-400',
      section: 'border-gray-600'
    } : {
      card: 'bg-white border-gray-200 text-gray-800',
      input: 'bg-white border-gray-300 text-gray-800 focus:border-blue-500',
      label: 'text-gray-700',
      readonly: 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed',
      text: 'text-gray-800',
      muted: 'text-gray-600',
      section: 'border-gray-200'
    };
  };

  const styles = getThemeStyles();

  const resetToDefaults = () => {
    setTestData({
      roomTemperature: 24,
      outsideTemperature: 28,
      humidity: 55,
      errorCode: 0,
      connectionLatency: 0,
      signalStrength: 85,
      powerConsumption: 1200,
      operatingHours: 1250
    });
  };

  return (
    <div className={`${styles.card} border rounded-xl shadow-lg p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${styles.text} flex items-center gap-2`}>
          <Settings className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
          Test Data Injector
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className={`text-xs px-3 py-1 rounded ${
              theme === 'dark' 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors`}
          >
            Reset
          </button>
          <span className={`text-xs px-2 py-1 rounded-full ${
            isConnected 
              ? theme === 'dark' ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
              : theme === 'dark' ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
          }`}>
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Read-Only System Status */}
      <div className={`border-t pt-3 ${styles.section}`}>
        <h4 className={`text-sm font-medium ${styles.text} mb-3 flex items-center gap-2`}>
          <Activity className="w-4 h-4" />
          System Status (Read-Only)
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Model</label>
            <input
              type="text"
              value={capabilities?.modelName || 'Office Model'}
              readOnly
              className={`w-full px-2 py-1 text-xs rounded border ${styles.readonly}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>System Type</label>
            <input
              type="text"
              value={`0x${(capabilities?.systemType || 0).toString(16).padStart(4,'0')}`}
              readOnly
              className={`w-full px-2 py-1 text-xs rounded border font-mono ${styles.readonly}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Power</label>
            <input
              type="text"
              value={acState.power ? 'On' : 'Off'}
              readOnly
              className={`w-full px-2 py-1 text-xs rounded border ${styles.readonly}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Mode</label>
            <input
              type="text"
              value={acState.mode}
              readOnly
              className={`w-full px-2 py-1 text-xs rounded border ${styles.readonly}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Target Temp</label>
            <input
              type="text"
              value={`${acState.temperature}°C`}
              readOnly
              className={`w-full px-2 py-1 text-xs rounded border ${styles.readonly}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Fan Speed</label>
            <input
              type="text"
              value={acState.fanSpeed}
              readOnly
              className={`w-full px-2 py-1 text-xs rounded border ${styles.readonly}`}
            />
          </div>
        </div>
      </div>

      {/* Editable Test Data */}
      <div className={`border-t pt-3 ${styles.section}`}>
        <h4 className={`text-sm font-medium ${styles.text} mb-3 flex items-center gap-2`}>
          <Thermometer className="w-4 h-4" />
          Environmental Data (Editable)
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Room Temperature (°C)</label>
            <input
              type="number"
              min="5"
              max="50"
              step="0.5"
              value={testData.roomTemperature}
              onChange={(e) => handleInputChange('roomTemperature', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Outside Temperature (°C)</label>
            <input
              type="number"
              min="-20"
              max="60"
              step="0.5"
              value={testData.outsideTemperature}
              onChange={(e) => handleInputChange('outsideTemperature', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Humidity (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={testData.humidity}
              onChange={(e) => handleInputChange('humidity', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Error Code</label>
            <input
              type="number"
              min="0"
              max="999"
              step="1"
              value={testData.errorCode}
              onChange={(e) => handleInputChange('errorCode', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono ${styles.input}`}
            />
          </div>
        </div>
      </div>

      {/* System Performance Data */}
      <div className={`border-t pt-3 ${styles.section}`}>
        <h4 className={`text-sm font-medium ${styles.text} mb-3 flex items-center gap-2`}>
          <Zap className="w-4 h-4" />
          Performance Data (Editable)
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Connection Latency (ms)</label>
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value={testData.connectionLatency}
              onChange={(e) => handleInputChange('connectionLatency', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Signal Strength (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={testData.signalStrength}
              onChange={(e) => handleInputChange('signalStrength', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Power Consumption (W)</label>
            <input
              type="number"
              min="0"
              max="5000"
              step="10"
              value={testData.powerConsumption}
              onChange={(e) => handleInputChange('powerConsumption', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
          <div>
            <label className={`block text-xs ${styles.label} mb-1`}>Operating Hours</label>
            <input
              type="number"
              min="0"
              max="99999"
              step="1"
              value={testData.operatingHours}
              onChange={(e) => handleInputChange('operatingHours', e.target.value)}
              className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${styles.input}`}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`border-t pt-3 ${styles.section}`}>
        <h4 className={`text-sm font-medium ${styles.text} mb-3`}>Quick Test Scenarios</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setQuickScenario({ roomTemperature: 16, humidity: 30 })}
            className={`px-3 py-2 text-xs rounded transition-colors ${
              theme === 'dark' 
                ? 'bg-blue-900 text-blue-300 hover:bg-blue-800' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Cold & Dry
          </button>
          <button
            onClick={() => setQuickScenario({ roomTemperature: 30, humidity: 80 })}
            className={`px-3 py-2 text-xs rounded transition-colors ${
              theme === 'dark' 
                ? 'bg-red-900 text-red-300 hover:bg-red-800' 
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            Hot & Humid
          </button>
          <button
            onClick={() => setTestData(prev => ({ ...prev, errorCode: 101, signalStrength: 15 }))}
            className={`px-3 py-2 text-xs rounded transition-colors ${
              theme === 'dark' 
                ? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800' 
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            Error State
          </button>
          <button
            onClick={() => setTestData(prev => ({ ...prev, powerConsumption: 3500, operatingHours: 8760 }))}
            className={`px-3 py-2 text-xs rounded transition-colors ${
              theme === 'dark' 
                ? 'bg-green-900 text-green-300 hover:bg-green-800' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            High Usage
          </button>
        </div>
      </div>

      {/* Current Test Values Summary */}
      <div className={`border-t pt-3 ${styles.section}`}>
        <div className={`text-xs ${styles.muted}`}>
          <strong>Current Test Values:</strong> Room: {testData.roomTemperature}°C, 
          Outside: {testData.outsideTemperature}°C, Humidity: {testData.humidity}%, 
          Error: {testData.errorCode}, Power: {testData.powerConsumption}W
        </div>
      </div>
    </div>
  );
};

export default TestDataInjector;
