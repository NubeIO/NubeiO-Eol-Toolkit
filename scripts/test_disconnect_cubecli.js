// Test disconnectCubeCLI in a Node environment by mocking electron.app
// This ensures the service uses the same initialization path as in Electron
const fs = require('fs');

// Minimal electron mock
require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: {
    app: {
      isPackaged: false,
      getAppPath: () => __dirname
    }
  }
};

const svc = require('../services/openocd-stm32');

(async () => {
  try {
    console.log('Calling disconnectCubeCLI()...');
    const res = await svc.disconnectCubeCLI();
    console.log('disconnectCubeCLI result:', res);
  } catch (e) {
    console.error('disconnectCubeCLI threw:', e && e.message ? e.message : e);
  }

  // Print last 200 lines of cubecli log if present
  try {
    const logPath = require('path').join(__dirname, '..', 'cubecli-diagnostics.log');
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-200).join('\n');
      console.log('--- cubecli-diagnostics.log tail ---');
      console.log(content);
    } else {
      console.log('No cubecli-diagnostics.log found');
    }
  } catch (e) {
    console.error('Failed to read cubecli log:', e.message || e);
  }
})();
