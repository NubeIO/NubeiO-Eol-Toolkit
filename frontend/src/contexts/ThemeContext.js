import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('fga-theme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    localStorage.setItem('fga-theme', theme);

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const getThemeClasses = () => ({
    // App background
    app: theme === 'dark'
      ? 'min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
      : 'min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',

    // Card backgrounds
    card: theme === 'dark'
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-300',

    // Text colors
    text: {
      primary: theme === 'dark' ? 'text-gray-100' : 'text-gray-800',
      secondary: theme === 'dark' ? 'text-gray-300' : 'text-gray-600',
      muted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
    },

    // Control elements
    controls: theme === 'dark'
      ? 'bg-gray-800 border-gray-700 text-gray-100'
      : 'bg-white border-gray-300 text-gray-700',

    // Panel backgrounds
    panel: theme === 'dark'
      ? 'bg-gray-800 border-gray-600'
      : 'bg-white border-gray-200',

    // LCD display (for wall controller)
    lcd: theme === 'dark'
      ? 'bg-gray-900 border-gray-600'
      : 'bg-gray-800 border-gray-600',

    // AC unit display
    acUnit: theme === 'dark'
      ? 'bg-gradient-to-b from-gray-800 to-gray-900'
      : 'bg-gradient-to-b from-gray-50 to-gray-100',

    // Temperature display
    tempDisplay: theme === 'dark'
      ? 'bg-gradient-to-r from-gray-700 to-gray-800'
      : 'bg-gradient-to-r from-blue-50 to-indigo-50',

    // Status panels
    status: theme === 'dark'
      ? 'bg-gray-700'
      : 'bg-gray-50'
  });

  const value = {
    theme,
    setTheme,
    toggleTheme,
    getThemeClasses,
    isDark: theme === 'dark'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};