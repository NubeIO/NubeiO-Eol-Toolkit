// Temporary script to flash Micro Edge firmware via service (uses STM32CubeProgrammer CLI)
// WARNING: This will perform a real flash to any connected device. Run only if you confirmed.

// Minimal electron.app mock
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
    svc.currentDeviceType = 'MICRO_EDGE';

    const firmware = 'C:\\Users\\nhthinh\\Desktop\\Nube-iO\\rubix-micro-edge\\BUILD\\NUBEIO_MICROEDGE\\GCC_ARM-CUSTOM_RELEASE_PROFILE\\rubix-micro-edge_v1.3.6.bin';

    console.log('Flashing firmware:', firmware);

    const res = await svc.flashFirmware(firmware, (progress) => {
      try { console.log('PROGRESS:', JSON.stringify(progress)); } catch (e) { console.log('PROGRESS:', progress); }
    });

    console.log('FLASH RESULT:', res);
  } catch (e) {
    console.error('FLASH ERROR:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
    process.exitCode = 2;
  }
})();
