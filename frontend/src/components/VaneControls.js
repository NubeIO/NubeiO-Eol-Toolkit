import React, { useState } from 'react';
import { SetVerticalVanePosition, SetVerticalVaneSwing, SetHorizontalVanePosition, SetHorizontalVaneSwing } from '../wailsjs/go/main/App/App';
import { useTheme } from '../contexts/ThemeContext';

const VaneControls = ({ capabilities, isConnected, onUpdate }) => {
  const { getThemeClasses, isDark } = useTheme();
  const themeClasses = getThemeClasses();
  const [busy, setBusy] = useState(false);
  if (!capabilities) return null;

  const vertSupported = capabilities.verticalVaneSupported || [];
  const horizSupported = capabilities.horizontalVaneSupported || [];

  const handleSet = async (type, index, action) => {
    if (!isConnected) return;
    setBusy(true);
    try {
      let updated;
      switch (type) {
        case 'vPos':
          updated = await SetVerticalVanePosition(index, action);
          break;
        case 'vSwing':
          updated = await SetVerticalVaneSwing(index, action);
          break;
        case 'hPos':
          updated = await SetHorizontalVanePosition(index, action);
          break;
        case 'hSwing':
          updated = await SetHorizontalVaneSwing(index, action);
          break;
        default:
          break;
      }
      if (updated && onUpdate) onUpdate(updated);
    } catch (e) {
      console.error('Vane control failed', e);
    } finally {
      setBusy(false);
    }
  };

  const renderVaneRow = (label, supportedArray, typePrefix, steps, swingSupport) => {
    return (
      <div className="space-y-2">
        <div className={`text-sm font-semibold ${themeClasses.text.secondary}`}>{label}</div>
        {supportedArray.map((supported, idx) => (
          <div key={idx} className={`flex items-center gap-2 text-xs p-2 rounded border ${isDark ? 'bg-gray-800/60 border-gray-600' : 'bg-white/60 border-gray-200'}`}>
            <div className={`w-14 font-medium ${themeClasses.text.primary}`}>#{idx+1}</div>
            {!supported && <div className={`${themeClasses.text.muted} italic`}>N/A</div>}
            {supported && (
              <>
                <select
                  disabled={busy || !isConnected}
                  onChange={(e)=>handleSet(typePrefix+'Pos', idx, parseInt(e.target.value,10))}
                  className={`border rounded px-1 py-0.5 text-xs ${themeClasses.controls}`}
                  defaultValue={1}
                >
                  {Array.from({length: Math.min(steps||4, 15)}, (_,i)=>i+1).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                {swingSupport && (
                  <button
                    disabled={busy || !isConnected}
                    onClick={()=>handleSet(typePrefix+'Swing', idx, true)}
                    className="px-2 py-0.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors"
                  >Swing</button>
                )}
                {swingSupport && (
                  <button
                    disabled={busy || !isConnected}
                    onClick={()=>handleSet(typePrefix+'Swing', idx, false)}
                    className="px-2 py-0.5 bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors"
                  >Stop</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`${themeClasses.panel} backdrop-blur rounded-lg p-4 shadow-lg relative border`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold ${themeClasses.text.primary}`}>Vane Controls</h3>
        {busy && <span className={`text-xs ${themeClasses.text.muted} animate-pulse`}>Updating...</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderVaneRow('Vertical', vertSupported, 'v', capabilities.verticalSteps, capabilities.verticalSwing)}
        {renderVaneRow('Horizontal', horizSupported, 'h', capabilities.horizontalSteps, capabilities.horizontalSwing)}
      </div>
      {!isConnected && <div className="mt-3 text-center text-xs text-red-500">Connect to enable controls</div>}
    </div>
  );
};

export default VaneControls;
