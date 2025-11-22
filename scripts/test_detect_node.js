const svc = require('../services/openocd-stm32');

(async () => {
  try {
    // Ensure paths point to bundled openocd
    svc.openocdPath = 'C:\\Users\\nhthinh\\Desktop\\Nube-iO\\NubeiO-Eol-Toolkit\\embedded\\openocd-binaries\\windows\\bin\\openocd.exe';
    svc.scriptsPath = 'C:\\Users\\nhthinh\\Desktop\\Nube-iO\\NubeiO-Eol-Toolkit\\embedded\\openocd-binaries\\windows\\openocd\\scripts';

    // Force Micro Edge type to exercise CLI fallback path
    svc.currentDeviceType = 'MICRO_EDGE';
    console.log('Calling detectSTLinkOnce (4000 kHz) for MICRO_EDGE...');
    const once = await svc.detectSTLinkOnce(4000);
    console.log('detectSTLinkOnce result:', once ? { success: once.success, timedOut: once.timedOut } : null);
    if (once) console.log(once.output);

    console.log('\nCalling full detectSTLink()...');
    const full = await svc.detectSTLink();
    console.log('detectSTLink result:', full && full.success);
    console.log(JSON.stringify(full || {}, null, 2));
  } catch (e) {
    console.error('Error during test:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
  }
})();