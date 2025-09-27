import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ variant = 'default', size = 'default' }) => {
  const { toggleTheme, isDark } = useTheme();

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-8 h-8 text-sm';
      case 'large':
        return 'w-12 h-12 text-lg';
      default:
        return 'w-10 h-10 text-base';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'floating':
        return `fixed top-4 right-4 z-50 ${getSizeClasses()} rounded-full shadow-lg transition-all duration-300 ${
          isDark
            ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700 border border-gray-600'
            : 'bg-white text-blue-600 hover:bg-gray-50 border border-gray-200'
        }`;

      case 'minimal':
        return `${getSizeClasses()} rounded-lg transition-all duration-200 ${
          isDark
            ? 'text-gray-300 hover:text-yellow-400 hover:bg-gray-800/50'
            : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100/50'
        }`;

      case 'button':
        return `${getSizeClasses()} rounded-lg font-medium transition-all duration-200 border ${
          isDark
            ? 'bg-gray-700 text-yellow-400 border-gray-600 hover:bg-gray-600'
            : 'bg-white text-blue-600 border-gray-300 hover:bg-gray-50'
        }`;

      default:
        return `${getSizeClasses()} rounded-lg transition-all duration-200 ${
          isDark
            ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700 border border-gray-600'
            : 'bg-white text-blue-600 hover:bg-gray-50 border border-gray-200'
        }`;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 'w-4 h-4';
      case 'large':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center justify-center ${getVariantClasses()} transform hover:scale-105 active:scale-95`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div className="relative">
        {isDark ? (
          <Sun className={`${getIconSize()} transition-transform duration-300 rotate-0`} />
        ) : (
          <Moon className={`${getIconSize()} transition-transform duration-300 rotate-0`} />
        )}

        {/* Subtle glow effect */}
        <div
          className={`absolute inset-0 ${getIconSize()} rounded-full blur-sm opacity-50 ${
            isDark ? 'bg-yellow-400' : 'bg-blue-400'
          } animate-pulse`}
        />
      </div>
    </button>
  );
};

export default ThemeToggle;