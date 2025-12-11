// Simple Modbus RTU log parser for lines like:
// 000-Tx:01 03 00 00 00 06 C5 C8
// 001-Rx:01 03 0C 00 04 00 13 53 16 4D 59 31 35 20 32 F8 AF

function hexStrToBytes(hexStr) {
  return hexStr
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((b) => parseInt(b, 16));
}

// Modbus RTU CRC16 (poly 0xA001, init 0xFFFF)
function modbusCrc16(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      const lsb = crc & 0x0001;
      crc >>= 1;
      if (lsb) crc ^= 0xA001;
    }
  }
  return crc & 0xffff;
}

function validateCrc(bytes) {
  if (bytes.length < 4) return { valid: false };
  const payload = bytes.slice(0, -2);
  const crcLo = bytes[bytes.length - 2];
  const crcHi = bytes[bytes.length - 1];
  const expected = (crcHi << 8) | crcLo;
  const computed = modbusCrc16(payload);
  return { valid: expected === computed, expected, computed };
}

function decodeAscii(bytes) {
  try {
    const s = bytes
      .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('');
    return s;
  } catch {
    return '';
  }
}

function parseFrame(bytes) {
  const res = { raw: bytes, crc: validateCrc(bytes) };
  if (bytes.length < 5) return res;
  const addr = bytes[0];
  const func = bytes[1];
  res.addr = addr;
  res.func = func;
  if (func === 3) {
    // Read Holding Registers
    if (bytes[2] <= 0x7f) {
      // Response: 01 03 <byteCount> ... CRC
      const byteCount = bytes[2];
      res.type = 'response';
      res.byteCount = byteCount;
      const dataStart = 3;
      const dataEnd = dataStart + byteCount;
      const data = bytes.slice(dataStart, dataEnd);
      res.data = data;
      res.ascii = decodeAscii(data);
    } else {
      // Request: 01 03 <hiAddr> <loAddr> <hiQty> <loQty> CRC
      res.type = 'request';
      const hiAddr = bytes[2];
      const loAddr = bytes[3];
      const hiQty = bytes[4];
      const loQty = bytes[5];
      res.startAddress = (hiAddr << 8) | loAddr;
      res.quantity = (hiQty << 8) | loQty;
    }
  }
  return res;
}

function formatResult(lineIdx, dir, frame) {
  const parts = [];
  parts.push(`${String(lineIdx).padStart(3, '0')}-${dir}`);
  parts.push(`addr=${frame.addr}`);
  parts.push(`func=${frame.func}`);
  if (frame.type === 'request') {
    parts.push(`start=${frame.startAddress}`);
    parts.push(`qty=${frame.quantity}`);
  }
  if (frame.type === 'response') {
    parts.push(`bytes=${frame.byteCount}`);
    if (frame.ascii && frame.ascii.replace(/\.+/g, '').trim().length) {
      parts.push(`ascii="${frame.ascii}"`);
    }
  }
  parts.push(
    `crc=${frame.crc.valid ? 'OK' : 'BAD'}(exp=0x${frame.crc.expected?.toString(16)},calc=0x${frame.crc.computed?.toString(16)})`
  );
  return parts.join(' ');
}

function parseLines(lines) {
  const results = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\-(Tx|Rx):(.+)$/i);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    const dir = m[2];
    const hex = m[3];
    const bytes = hexStrToBytes(hex);
    const frame = parseFrame(bytes);
    results.push(formatResult(idx, dir, frame));
  }
  return results;
}

function main() {
  const fs = require('fs');
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node tools/modbus-log-parser.js <logfile>');
    process.exit(1);
  }
  const content = fs.readFileSync(path, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = parseLines(lines);
  out.forEach((l) => console.log(l));
}

if (require.main === module) {
  main();
}

module.exports = { parseLines };
