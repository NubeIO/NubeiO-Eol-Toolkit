import React, { useState } from 'react';
import { Thermometer, RefreshCw } from 'lucide-react';
import { SetRoomTemperature } from '../wailsjs/go/main/App';
import { useTheme } from '../contexts/ThemeContext';

// Simple panel to inject (override) the simulated room temperature; other values remain read-only elsewhere.
const RoomTempInjector = ({ acState, isConnected, onInject }) => {
  const { getThemeClasses, isDark } = useTheme();
  const themeClasses = getThemeClasses();
  const [inputValue, setInputValue] = useState(acState.currentTemp || 24);
  const [busy, setBusy] = useState(false);
  const [lastHex, setLastHex] = useState(null);

  const applyInjection = async () => {
    if (!isConnected) return; // only allow when connected so state returns
    setBusy(true);
    try {
      const val = parseFloat(inputValue);
      if (isNaN(val)) return;
      await SetRoomTemperature(val);
      // Compute protocol hex ( (temp+50)*100 ) & clamp for display only
      const proto = Math.round((val + 50) * 100);
      const hex = '0x' + proto.toString(16).padStart(4, '0');
      setLastHex(hex);
      if (onInject) onInject();
    } catch (e) {
      console.error('Failed to inject room temperature', e);
    } finally {
      setBusy(false);
    }
  };

  const disabled = !isConnected || busy;

  return (
    <div className={`${themeClasses.card} border rounded-xl shadow-lg p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${themeClasses.text.primary}`}>
          <Thermometer className={isDark ? 'text-blue-400' : 'text-blue-600'} />
          Room Temp Injector
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? (isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700') : (isDark ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700')}`}>{isConnected ? 'Connected' : 'Offline'}</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className={`block text-xs mb-1 ${themeClasses.text.secondary}`}>Current Sensor Value</label>
          <div className={`text-2xl font-bold ${themeClasses.text.primary}`}>{acState.currentTemp}°C</div>
        </div>
        <div>
          <label className={`block text-xs mb-1 ${themeClasses.text.secondary}`}>Inject New Room Temperature (°C)</label>
          <input
            type="number"
            step="0.5"
            min="-10"
            max="50"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring focus:border-blue-500 ${themeClasses.controls}`}
            disabled={!isConnected || busy}
          />
          <p className={`mt-1 text-[11px] ${themeClasses.text.muted}`}>Range -10°C to 50°C (simulated). Stored as (temp+50)*100 in protocol object 0x1033.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={applyInjection}
            disabled={disabled}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            {busy ? 'Applying...' : 'Apply'}
          </button>
          <button
            onClick={() => { setInputValue(acState.currentTemp); }}
            disabled={disabled}
            className={`p-2 rounded border text-xs flex items-center gap-1 disabled:opacity-40 ${themeClasses.controls}`}
          >
            <RefreshCw className="w-4 h-4" /> Sync
          </button>
          {lastHex && (
            <span className={`text-xs font-mono ${themeClasses.text.muted}`}>Last proto: {lastHex}</span>
          )}
        </div>
        <div className={`mt-2 text-[11px] ${themeClasses.text.muted}`}>
          Object 0x1033 will now report the injected value. Other panels treat it as read-only sensor data.
        </div>
      </div>
    </div>
  );
};

export default RoomTempInjector;
