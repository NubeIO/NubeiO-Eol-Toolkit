const path = require('path');
const fs = require('fs');
const svc = require('../services/openocd-stm32');

async function main() {
    const firmware = process.argv[2];
    if (!firmware) {
        console.error('Usage: node scripts/flash_two_step.js <firmware.bin>');
        process.exit(2);
    }

    if (!fs.existsSync(firmware)) {
        console.error('Firmware not found:', firmware);
        process.exit(3);
    }

    console.log('Starting two-step flash helper');
    console.log('Looking for CubeCLI...');
    const cli = svc._findCubeCLI ? svc._findCubeCLI() : null;
    if (!cli) {
        console.error('STM32_Programmer_CLI not found on this system. Aborting.');
        process.exit(4);
    }

    console.log('CubeCLI:', cli);

    const probes = await svc.listCubeProbes().catch(() => null);
    let apIndex = null;
    if (probes && probes.raw) {
        const m = probes.raw.match(/Access Port Number\s*:\s*(\d+)/i);
        if (m) apIndex = parseInt(m[1], 10);
    }

    const variants = [];
    if (apIndex != null) {
        variants.push(`port=SWD index=${apIndex} mode=UR`);
        variants.push(`port=SWD index=${apIndex}`);
    }
    variants.push('port=SWD mode=UR');
    variants.push('port=SWD');

    console.log('Connect variants to try:', variants);

    let chosen = null;
    for (const v of variants) {
        console.log('\nTrying connect token:', v);
        try {
            const res = await svc.runCubeCLI(['--connect', v], 8000);
            const out = res ? res.output || '' : '';
            console.log('Connect output:\n', out);
            if (res && res.exit === 0 && /Device ID|Device name|Device\s*:|Device ID/i.test(out)) {
                chosen = v;
                break;
            }
            if (out && /Device ID|Device name/i.test(out)) {
                chosen = v;
                break;
            }
        } catch (e) {
            console.error('Connect failed:', e && e.message ? e.message : e);
        }
    }

    if (!chosen) {
        console.error('\nCould not connect with any token. Check wiring/RESET and try again.');
        process.exit(5);
    }

    console.log('\nConnected with token:', chosen);
    console.log('Now, if you are using a HOLD-RESET workflow, release RESET now and press Enter to continue.');

    // wait for user to press Enter
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
    });

    console.log('Proceeding to erase/download/verify...');

    const normalized = firmware.replace(/\\/g, '/');
    try {
        const args = ['--connect', chosen, '--erase', 'all', '--download', normalized, '0x08000000', '--verify'];
        const timeout = 3 * 60 * 1000;
        const r = await svc.runCubeCLI(args, timeout);
        const out = r ? r.output || '' : '';
        console.log('\nFlash result output:\n', out);
        if (r && r.exit === 0 && /Download verified successfully/i.test(out)) {
            console.log('\nFlash completed and verified successfully.');
            process.exit(0);
        }
        console.error('\nFlash failed. See output above.');
        process.exit(6);
    } catch (e) {
        console.error('\nFlash attempt threw error:', e && e.message ? e.message : e);
        process.exit(7);
    }
}

main();
