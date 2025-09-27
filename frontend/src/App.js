import React, { useState, useEffect } from 'react';
import WallController from './components/WallController';
import ACUnitDisplay from './components/ACUnitDisplay';
import SerialConnection from './components/SerialConnection';
import StatusDisplay from './components/StatusDisplay';
import VaneControls from './components/VaneControls';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { GetAirConditionerState, GetCapabilities, SetModel } from './wailsjs/go/main/App/App';

const AppContent = () => {
  const { getThemeClasses } = useTheme();
  const [acState, setAcState] = useState({
    power: false,
    mode: 'Auto',
    temperature: 22,
    fanSpeed: 'Auto',
    swing: false,
    currentTemp: 24
  });

  const [isConnected, setIsConnected] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [modelChanging, setModelChanging] = useState(false);

  useEffect(() => {
  // Load initial state & capabilities
  loadAll();
    
    // Refresh state every 2 seconds when connected
    const interval = setInterval(() => {
      if (isConnected) {
        loadAll();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const loadAcState = async () => {
    try {
      const state = await GetAirConditionerState();
      setAcState(state);
    } catch (error) {
      console.error('Failed to load AC state:', error);
    }
  };

  const loadCapabilities = async () => {
    try {
      const caps = await GetCapabilities();
      setCapabilities(caps);
    } catch (e) {
      console.error('Failed to load capabilities', e);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadAcState(), loadCapabilities()]);
  };

  const handleModelChange = async (e) => {
    const model = parseInt(e.target.value, 10);
    if (isNaN(model)) return;
    setModelChanging(true);
    try {
      await SetModel(model);
      await loadAll();
    } finally {
      setModelChanging(false);
    }
  };

  const updateAcState = (newState) => {
    setAcState(newState);
  };

  const themeClasses = getThemeClasses();

  return (
    <div className={themeClasses.app}>
      <div className="container mx-auto px-4 py-8">
        {/* Theme Toggle & Serial Connection */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold ${themeClasses.text.primary}`}>
              FGA Simulator
            </h1>
            <ThemeToggle variant="button" size="default" />
          </div>
          <SerialConnection
            isConnected={isConnected}
            onConnectionChange={setIsConnected}
          />
          <div className="mt-4 flex items-center gap-4">
            <label className={`text-sm font-medium ${themeClasses.text.secondary}`}>Model</label>
            <select
              onChange={handleModelChange}
              value={acState.model || ''}
              className={`border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500 shadow-sm ${themeClasses.controls}`}
            >
              <option value={1}>Office</option>
              <option value={2}>Horizontal</option>
              <option value={3}>VRF</option>
            </select>
            {modelChanging && <span className={`text-xs ${themeClasses.text.muted}`}>Updating...</span>}
            {/* Removed inline vane counts per user request; details now only in StatusDisplay */}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="space-y-8">
            <WallController
              acState={acState}
              onStateChange={updateAcState}
              isConnected={isConnected}
            />
            <VaneControls
              capabilities={capabilities}
              isConnected={isConnected}
              onUpdate={(caps)=>setCapabilities(caps)}
            />
          </div>
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <ACUnitDisplay
              acState={acState}
              isConnected={isConnected}
              capabilities={capabilities}
            />
            <StatusDisplay
              acState={acState}
              isConnected={isConnected}
              capabilities={capabilities}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center mt-12 ${themeClasses.text.muted}`}>
          <p>© 2025 Nube IO - FGA Simulator v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
