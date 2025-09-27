import React from 'react';
import { Activity } from 'lucide-react';

// Simplified single-panel status + capability summary
const StatusDisplay = ({ acState, isConnected, capabilities }) => {
  return (
    <div className="status-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          System / Capabilities
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isConnected ? 'Connected' : 'Offline'}</span>
      </div>
      <div className="grid grid-cols-2 gap-y-2 text-xs md:text-sm">
        <div className="text-gray-600">Model</div>
        <div className="font-medium">{capabilities?.modelName || '—'}</div>
        <div className="text-gray-600">System Type</div>
        <div className="font-mono">0x{(capabilities?.systemType || 0).toString(16).padStart(4,'0')}</div>
        <div className="text-gray-600">Power</div>
        <div className="font-medium">{acState.power ? 'On' : 'Off'}</div>
        <div className="text-gray-600">Mode</div>
        <div className="font-medium">{acState.mode}</div>
        <div className="text-gray-600">Target / Room</div>
        <div className="font-medium">{acState.temperature}°C / {acState.currentTemp}°C</div>
        <div className="text-gray-600">Fan / Swing</div>
        <div className="font-medium">{acState.fanSpeed} / {acState.swing ? 'On' : 'Off'}</div>
        <div className="col-span-2 mt-2 border-t pt-2 text-[11px] text-gray-500">Vanes</div>
        <div className="text-gray-600">Vertical</div>
        <div className="font-medium">{capabilities?.verticalVaneCount ?? 0} (steps {capabilities?.verticalSteps ?? 0})</div>
        <div className="text-gray-600">Horizontal</div>
        <div className="font-medium">{capabilities?.horizontalVaneCount ?? 0} (steps {capabilities?.horizontalSteps ?? 0})</div>
        <div className="text-gray-600">Swing Support</div>
        <div className="font-medium">V {capabilities?.verticalSwing ? 'Yes' : 'No'} / H {capabilities?.horizontalSwing ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
};

export default StatusDisplay;
