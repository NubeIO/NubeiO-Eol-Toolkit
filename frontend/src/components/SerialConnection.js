import React, { useState, useEffect } from 'react';
import { Usb, Wifi, WifiOff, Settings } from 'lucide-react';
import { GetAvailablePorts, ConnectSerial, DisconnectSerial } from '../wailsjs/go/main/App/App';

const SerialConnection = ({ isConnected, onConnectionChange }) => {
  const [availablePorts, setAvailablePorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [serialConfig, setSerialConfig] = useState({
    port: '',
    baudRate: 9600,
    dataBits: 8,
    parity: 'None',
    stopBits: 1
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadAvailablePorts();
  }, []);

  const loadAvailablePorts = async () => {
    try {
      const ports = await GetAvailablePorts();
      setAvailablePorts(ports);
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0]);
        setSerialConfig(prev => ({ ...prev, port: ports[0] }));
      }
    } catch (error) {
      console.error('Failed to load available ports:', error);
    }
  };

  const handleConnect = async () => {
    if (!selectedPort) {
      alert('Please select a serial port');
      return;
    }

    setIsConnecting(true);
    try {
      const config = {
        ...serialConfig,
        port: selectedPort
      };
      
      await ConnectSerial(config);
      onConnectionChange(true);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert(`Failed to connect to ${selectedPort}: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await DisconnectSerial();
      onConnectionChange(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handlePortChange = (port) => {
    setSelectedPort(port);
    setSerialConfig(prev => ({ ...prev, port }));
  };

  const baudRates = [9600, 19200, 38400, 57600, 115200];
  const dataBitsOptions = [7, 8];
  const parityOptions = ['None', 'Even', 'Odd'];
  const stopBitsOptions = [1, 2];

  return (
    <div className="status-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Usb className="w-6 h-6" />
          Serial Connection
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Advanced Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={loadAvailablePorts}
            className="btn-secondary text-sm"
            disabled={isConnected}
          >
            Refresh
          </button>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors font-medium"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Port Selection - only show when not connected or when settings is open */}
      {(!isConnected || showAdvanced) && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Serial Port
          </label>
          <select
            value={selectedPort}
            onChange={(e) => handlePortChange(e.target.value)}
            disabled={isConnected}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select a port...</option>
            {availablePorts.map((port) => (
              <option key={port} value={port}>
                {port}
              </option>
            ))}
          </select>
          {availablePorts.length === 0 && (
            <p className="text-sm text-red-600 mt-1">
              No serial ports found. Make sure your device is connected.
            </p>
          )}
        </div>
      )}

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Baud Rate
            </label>
            <select
              value={serialConfig.baudRate}
              onChange={(e) => setSerialConfig(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
              disabled={isConnected}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
            >
              {baudRates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Bits
            </label>
            <select
              value={serialConfig.dataBits}
              onChange={(e) => setSerialConfig(prev => ({ ...prev, dataBits: parseInt(e.target.value) }))}
              disabled={isConnected}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
            >
              {dataBitsOptions.map((bits) => (
                <option key={bits} value={bits}>
                  {bits}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parity
            </label>
            <select
              value={serialConfig.parity}
              onChange={(e) => setSerialConfig(prev => ({ ...prev, parity: e.target.value }))}
              disabled={isConnected}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
            >
              {parityOptions.map((parity) => (
                <option key={parity} value={parity}>
                  {parity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stop Bits
            </label>
            <select
              value={serialConfig.stopBits}
              onChange={(e) => setSerialConfig(prev => ({ ...prev, stopBits: parseInt(e.target.value) }))}
              disabled={isConnected}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
            >
              {stopBitsOptions.map((bits) => (
                <option key={bits} value={bits}>
                  {bits}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Connection Button - only show Connect button when disconnected */}
      {!isConnected && (
        <div className="flex justify-center">
          <button
            onClick={handleConnect}
            disabled={!selectedPort || isConnecting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      )}

    </div>
  );
};

export default SerialConnection;
