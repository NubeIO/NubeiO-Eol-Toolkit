import React from 'react';
import { Activity } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// Simplified single-panel status + capability summary
const StatusDisplay = ({ acState, isConnected, capabilities }) => {
  const { getThemeClasses, isDark } = useTheme();
  const themeClasses = getThemeClasses();
  return (
    <div className={`${themeClasses.card} border rounded-xl shadow-lg p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${themeClasses.text.primary} flex items-center gap-2`}>
          <Activity className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
          System / Capabilities
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? (isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700') : (isDark ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700')}`}>{isConnected ? 'Connected' : 'Offline'}</span>
      </div>
      <div className="grid grid-cols-2 gap-y-2 text-xs md:text-sm">
        <div className={themeClasses.text.secondary}>Model</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{capabilities?.modelName || '—'}</div>
        <div className={themeClasses.text.secondary}>System Type</div>
        <div className={`font-mono ${themeClasses.text.primary}`}>0x{(capabilities?.systemType || 0).toString(16).padStart(4,'0')}</div>
        <div className={themeClasses.text.secondary}>Power</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{acState.power ? 'On' : 'Off'}</div>
        <div className={themeClasses.text.secondary}>Mode</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{acState.mode}</div>
        <div className={themeClasses.text.secondary}>Target / Room</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{acState.temperature}°C / {acState.currentTemp}°C</div>
        <div className={themeClasses.text.secondary}>Fan / Swing</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{acState.fanSpeed} / {acState.swing ? 'On' : 'Off'}</div>
        <div className={`col-span-2 mt-2 border-t pt-2 text-[11px] ${themeClasses.text.muted} ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>Vanes</div>
        <div className={themeClasses.text.secondary}>Vertical</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{capabilities?.verticalVaneCount ?? 0} (steps {capabilities?.verticalSteps ?? 0})</div>
        <div className={themeClasses.text.secondary}>Horizontal</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>{capabilities?.horizontalVaneCount ?? 0} (steps {capabilities?.horizontalSteps ?? 0})</div>
        <div className={themeClasses.text.secondary}>Swing Support</div>
        <div className={`font-medium ${themeClasses.text.primary}`}>V {capabilities?.verticalSwing ? 'Yes' : 'No'} / H {capabilities?.horizontalSwing ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
};

export default StatusDisplay;
