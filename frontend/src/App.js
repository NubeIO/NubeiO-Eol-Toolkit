import React, { useState, useEffect } from 'react';
import AirConditionerControl from './components/AirConditionerControl';
import SerialConnection from './components/SerialConnection';
import StatusDisplay from './components/StatusDisplay';
import { GetAirConditionerState } from './wailsjs/go/main/App/App';

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

  useEffect(() => {
    // Load initial state
    loadAcState();
    
    // Refresh state every 2 seconds when connected
    const interval = setInterval(() => {
      if (isConnected) {
        loadAcState();
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

  const updateAcState = (newState) => {
    setAcState(newState);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Fujitsu Air Conditioner Simulator
          </h1>
          <p className="text-gray-600">
            UART 9600 Baudrate Frame Simulator
          </p>
        </div>

        {/* Serial Connection */}
        <div className="mb-8">
          <SerialConnection 
            isConnected={isConnected} 
            onConnectionChange={setIsConnected}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Status Display */}
          <div>
            <StatusDisplay acState={acState} isConnected={isConnected} />
          </div>

          {/* Air Conditioner Controls */}
          <div>
            <AirConditionerControl 
              acState={acState} 
              onStateChange={updateAcState}
              isConnected={isConnected}
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
