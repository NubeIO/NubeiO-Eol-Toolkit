const OpenOCDService = require('../services/openocd-stm32');

(async () => {
  try {
    const svc = new OpenOCDService();
    svc.openocdPath = 'c:\\Users\\nhthinh\\Desktop\\Nube-iO\\NubeiO-Eol-Toolkit\\embedded\\openocd-binaries\\windows\\bin\\openocd.exe';
    svc.scriptsPath = 'c:\\Users\\nhthinh\\Desktop\\Nube-iO\\NubeiO-Eol-Toolkit\\embedded\\openocd-binaries\\windows\\openocd\\scripts';

    console.log('Invoking detectSTLinkOnce...');
    const r = await svc.detectSTLinkOnce(4000);
    console.log('Result:', r && r.output ? r.output : r);
  } catch (e) {
    console.error(e);
  }
})();