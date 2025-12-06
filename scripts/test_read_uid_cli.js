const svc = require('../services/openocd-stm32');

(async () => {
  try {
    svc.currentDeviceType = 'MICRO_EDGE';
    const r = await svc.readUID();
    console.log('readUID result:', r);
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
  }
})();
