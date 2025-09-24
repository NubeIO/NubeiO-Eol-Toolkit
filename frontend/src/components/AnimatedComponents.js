import React from 'react';

// Animated Fan Component
export const AnimatedFan = ({ fanSpeed, isOn }) => {
  const getAnimationSpeed = () => {
    if (!isOn) return 'animate-none';
    switch (fanSpeed) {
      case 'High':
        return 'animate-spin duration-300'; // Very fast
      case 'Medium':
        return 'animate-spin duration-500'; // Fast
      case 'Low':
        return 'animate-spin duration-1000'; // Slow
      case 'Quiet':
        return 'animate-spin duration-2000'; // Very slow
      case 'Auto':
        return 'animate-spin duration-700'; // Medium-fast
      default:
        return 'animate-none';
    }
  };

  return (
    <div className="relative w-16 h-16">
      {/* Fan Housing */}
      <div className="absolute inset-0 border-2 border-gray-300 rounded-full bg-gray-50"></div>
      
      {/* Fan Blades */}
      <div className={`absolute inset-2 ${getAnimationSpeed()}`}>
        <svg viewBox="0 0 48 48" className="w-full h-full">
          {/* Fan blades */}
          <path d="M24 8 L32 16 L24 24 L16 16 Z" fill={isOn ? "#6366f1" : "#9ca3af"} className="opacity-80"/>
          <path d="M40 24 L32 32 L24 24 L32 16 Z" fill={isOn ? "#8b5cf6" : "#9ca3af"} className="opacity-80"/>
          <path d="M24 40 L16 32 L24 24 L32 32 Z" fill={isOn ? "#6366f1" : "#9ca3af"} className="opacity-80"/>
          <path d="M8 24 L16 16 L24 24 L16 32 Z" fill={isOn ? "#8b5cf6" : "#9ca3af"} className="opacity-80"/>
          
          {/* Center hub */}
          <circle cx="24" cy="24" r="4" fill={isOn ? "#4f46e5" : "#6b7280"}/>
        </svg>
      </div>
    </div>
  );
};

// Animated Vertical Louver Component
export const AnimatedVerticalLouver = ({ swing, position = 0 }) => {
  const getLouverRotation = () => {
    if (swing) {
      return 'animate-pulse'; // Simple pulsing animation for swing
    }
    // Static position based on position value (0-100)
    const rotation = (position - 50) * 0.6; // -30 to +30 degrees
    return `transform: rotate(${rotation}deg)`;
  };

  return (
    <div className="relative w-12 h-20 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden">
      <div className="absolute inset-1">
        {/* Vertical slats */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`absolute w-full h-1.5 bg-gray-400 rounded-sm transition-all duration-1000 ${
              swing ? 'animate-bounce' : ''
            }`}
            style={{
              top: `${i * 18 + 10}%`,
              ...(swing ? {} : { transform: `rotate(${(position - 50) * 0.3}deg)` }),
              transformOrigin: 'center'
            }}
          />
        ))}
      </div>
      
      {/* Swing indicator */}
      {swing && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

// Animated Horizontal Louver Component
export const AnimatedHorizontalLouver = ({ swing, position = 0 }) => {
  return (
    <div className="relative w-20 h-12 bg-gray-100 rounded-lg border border-gray-300 overflow-hidden">
      <div className="absolute inset-1">
        {/* Horizontal slats */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`absolute h-full w-1.5 bg-gray-400 rounded-sm transition-all duration-1000 ${
              swing ? 'animate-pulse' : ''
            }`}
            style={{
              left: `${i * 18 + 10}%`,
              ...(swing ? {} : { transform: `rotate(${(position - 50) * 0.3}deg)` }),
              transformOrigin: 'center'
            }}
          />
        ))}
      </div>
      
      {/* Swing indicator */}
      {swing && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

// AC Unit Visual Representation
export const ACUnitVisual = ({ acState }) => {
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Main AC Unit Body */}
      <div className={`relative bg-white rounded-lg shadow-lg border-2 transition-all duration-300 ${
        acState.power ? 'border-blue-300 shadow-blue-100' : 'border-gray-300'
      }`}>
        {/* Display Panel */}
        <div className={`h-8 rounded-t-lg flex items-center justify-center text-sm font-mono ${
          acState.power ? 'bg-blue-600 text-white' : 'bg-gray-400 text-gray-200'
        }`}>
          {acState.power ? `${acState.temperature}°C ${acState.mode}` : 'OFF'}
        </div>
        
        {/* Main Body */}
        <div className="p-6 space-y-4">
          {/* Fan Section */}
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2">
                <AnimatedFan fanSpeed={acState.fanSpeed} isOn={acState.power} />
              </div>
              <span className="text-xs text-gray-600">{acState.fanSpeed}</span>
            </div>
          </div>
          
          {/* Louver Section */}
          <div className="flex items-center justify-center gap-6">
            {/* Vertical Louvers */}
            <div className="text-center">
              <AnimatedVerticalLouver 
                swing={acState.swing} 
                position={50} // You can make this dynamic based on actual louver position
              />
              <span className="text-xs text-gray-600 mt-1 block">Vertical</span>
            </div>
            
            {/* Horizontal Louvers */}
            <div className="text-center">
              <AnimatedHorizontalLouver 
                swing={acState.swing} 
                position={50} // You can make this dynamic based on actual louver position
              />
              <span className="text-xs text-gray-600 mt-1 block">Horizontal</span>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {/* Power LED */}
            <div className={`w-2 h-2 rounded-full ${
              acState.power ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`}></div>
            
            {/* Mode LED */}
            <div className={`w-2 h-2 rounded-full ${
              acState.power ? 'bg-blue-500' : 'bg-gray-300'
            }`}></div>
            
            {/* Swing LED */}
            <div className={`w-2 h-2 rounded-full ${
              acState.swing && acState.power ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'
            }`}></div>
          </div>
        </div>
        
        {/* Air Flow Animation */}
        {acState.power && (
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute w-1 h-6 bg-blue-200 rounded-full animate-bounce opacity-60"
                style={{
                  left: `${i * 8 - 8}px`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default { AnimatedFan, AnimatedVerticalLouver, AnimatedHorizontalLouver, ACUnitVisual };
