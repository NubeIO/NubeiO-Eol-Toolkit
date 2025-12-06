#!/usr/bin/env node
const { spawnSync } = require('child_process');
const os = require('os');

function runKill(command, args) {
  try {
    const res = spawnSync(command, args, { encoding: 'utf8' });
    return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log('Force release helper: attempting to kill OpenOCD and STM32_Programmer_CLI');
  const platform = os.platform();

  let openocdResult, cliResult;
  if (platform === 'win32') {
    openocdResult = runKill('taskkill', ['/F', '/IM', 'openocd.exe']);
    cliResult = runKill('taskkill', ['/F', '/IM', 'STM32_Programmer_CLI.exe']);
  } else {
    openocdResult = runKill('pkill', ['-f', 'openocd']);
    cliResult = runKill('pkill', ['-f', 'STM32_Programmer_CLI']);
  }

  console.log('\nOpenOCD kill result:');
  console.log(JSON.stringify(openocdResult, null, 2));

  console.log('\nSTM32_Programmer_CLI kill result:');
  console.log(JSON.stringify(cliResult, null, 2));

  console.log('\nDone. If processes were killed, ST-Link should be released.');
}

main().catch(e => {
  console.error('Error running force release helper:', e);
  process.exit(1);
});
