import React, { useState, useEffect } from 'react';
import { 
  GetMQTTConfig, 
  UpdateMQTTConfig, 
  GetMQTTStatus, 
  ConnectMQTT, 
  DisconnectMQTT,
  PublishStatus,
  PublishDiscovery
} from '../wailsjs/go/main/App';

const MQTTConnection = ({ onConnectionChange }) => {
  const [config, setConfig] = useState({
    broker: 'localhost',
    port: 1883,
    username: '',
    password: '',
    clientId: '',
    deviceId: ''
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadConfig();
    checkConnection();
  }, []);

  const loadConfig = async () => {
    try {
      const currentConfig = await GetMQTTConfig();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load MQTT config:', error);
    }
  };

  const checkConnection = async () => {
    try {
      const connected = await GetMQTTStatus();
      setIsConnected(connected);
      onConnectionChange(connected);
    } catch (error) {
      console.error('Failed to check MQTT status:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');
    try {
      await UpdateMQTTConfig(config);
      await ConnectMQTT();
      await checkConnection();
    } catch (error) {
      setError(`Connection failed: ${error.message}`);
      console.error('MQTT connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await DisconnectMQTT();
      await checkConnection();
    } catch (error) {
      console.error('MQTT disconnect error:', error);
    }
  };

  const handlePublishStatus = async () => {
    try {
      await PublishStatus();
    } catch (error) {
      console.error('Failed to publish status:', error);
    }
  };

  const handlePublishDiscovery = async () => {
    try {
      await PublishDiscovery();
    } catch (error) {
      console.error('Failed to publish discovery:', error);
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          MQTT Connection
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={handleConnect}
            disabled={isConnecting || isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          
          <button
            onClick={handleDisconnect}
            disabled={!isConnected}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disconnect
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {showConfig ? 'Hide Config' : 'Show Config'}
          </button>
        </div>

        {isConnected && (
          <div className="flex gap-2">
            <button
              onClick={handlePublishStatus}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Publish Status
            </button>
            
            <button
              onClick={handlePublishDiscovery}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Publish Discovery
            </button>
          </div>
        )}

        {showConfig && (
          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Broker
              </label>
              <input
                type="text"
                value={config.broker}
                onChange={(e) => handleConfigChange('broker', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="localhost"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Port
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value) || 1883)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="1883"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={config.clientId}
                onChange={(e) => handleConfigChange('clientId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Auto-generated"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Device ID
              </label>
              <input
                type="text"
                value={config.deviceId}
                onChange={(e) => handleConfigChange('deviceId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Auto-generated"
              />
            </div>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            MQTT Topics:
          </h4>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <div><code>ac_sim/{config.deviceId || 'device'}/state</code> - Status updates</div>
            <div><code>ac_sim/{config.deviceId || 'device'}/control</code> - Control commands</div>
            <div><code>ac_sim/{config.deviceId || 'device'}/uart/rx</code> - UART RX traffic</div>
            <div><code>ac_sim/{config.deviceId || 'device'}/uart/tx</code> - UART TX traffic</div>
            <div><code>ac_sim/all/control</code> - Broadcast control</div>
            <div><code>ac_sim/discovery</code> - Device discovery</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MQTTConnection;
