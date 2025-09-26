import React, { useState, useEffect } from 'react';
import WallController from './components/WallController';
import ACUnitDisplay from './components/ACUnitDisplay';
import SerialConnection from './components/SerialConnection';
import StatusDisplay from './components/StatusDisplay';
import VaneControls from './components/VaneControls';
import { GetAirConditionerState, GetCapabilities, SetModel } from './wailsjs/go/main/App/App';

function App() {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Serial Connection & Model Selector */}
        <div className="mb-8">
          <SerialConnection 
            isConnected={isConnected} 
            onConnectionChange={setIsConnected}
          />
          <div className="mt-4 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Model</label>
            <select
              onChange={handleModelChange}
              value={acState.model || ''}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500 bg-white shadow-sm"
            >
              <option value={1}>Office</option>
              <option value={2}>Horizontal</option>
              <option value={3}>VRF</option>
            </select>
            {modelChanging && <span className="text-xs text-gray-500">Updating...</span>}
            {capabilities && (
              <span className="text-xs text-gray-600">
                VertVanes: {capabilities.verticalVaneCount} | HorizVanes: {capabilities.horizontalVaneCount}
              </span>
            )}
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
        <div className="text-center mt-12 text-gray-500">
          <p>© 2025 Nube IO - FGA Simulator v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

export default App;
