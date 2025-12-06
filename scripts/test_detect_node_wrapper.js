// Wrapper to mock electron.app when running service from plain Node
const Module = require('module');
// Provide a minimal electron.app mock
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

// Now require the actual test script
require('./test_detect_node.js');
// Also run the UID read test in the same mocked environment
require('./test_read_uid_cli.js');
