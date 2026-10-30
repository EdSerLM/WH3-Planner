import { readSync, openSync, closeSync } from 'node:fs';
import { decompress as zstdDecompress } from 'fzstd';

function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  let got = 0;
  while (got < len) {
    const n = readSync(fd, b, got, len - got, pos + got);
    if (n <= 0) break;
    got += n;
  }
  return b;
}
function openPack(path) {
  const fd = openSync(path, 'r');
  const head = readAt(fd, 0, 28);
  const type = head.readUInt32LE(4);
  const depsSize = head.readUInt32LE(12);
  const fileCount = head.readUInt32LE(16);
  const indexSize = head.readUInt32LE(20);
  const hasTimestamps = (type & 0x40) !== 0;
  const extended = (type & 0x100) !== 0 ? 20 : 0;
  const indexStart = 28 + extended + depsSize;
  const idx = readAt(fd, indexStart, indexSize);
  const entries = [];
  let off = 0;
  let dataPos = indexStart + indexSize;
  for (let i = 0; i < fileCount; i++) {
    const size = idx.readUInt32LE(off); off += 4;
    if (hasTimestamps) off += 4;
    const compressed = idx[off] === 1; off += 1;
    const end = idx.indexOf(0, off);
    const name = idx.toString('utf8', off, end).split('\\').join('/');
    off = end + 1;
    entries.push({ name, offset: dataPos, size, compressed });
    dataPos += size;
  }
  return { path, fd, entries };
}
function readEntry(p, e) {
  const raw = readAt(p.fd, e.offset, e.size);
  if (!e.compressed) return raw;
  const body = raw.subarray(4);
  if (body.readUInt32LE(0) === 0xfd2fb528) return Buffer.from(zstdDecompress(body));
  throw new Error('unsupported compression');
}
function readLoc(b) {
  let off = 2 + 4 + 4;
  const count = b.readUInt32LE(off); off += 4;
  const out = new Map();
  const str = () => { const n = b.readUInt16LE(off); off += 2; const t = b.toString('utf16le', off, off + n * 2); off += n * 2; return t; };
  for (let i = 0; i < count; i++) { const k = str(); const t = str(); off += 1; out.set(k, t); }
  return out;
}

const dataDir = process.argv[2];
const p = openPack(dataDir + '/local_sp.pack');
const locEntry = p.entries.find((e) => e.name.endsWith('.loc'));
const raw = readLoc(readEntry(p, locEntry));
closeSync(p.fd);

console.log('--- value contains Consejo AND key relates to wef/asrai ---');
for (const [k, v] of raw) {
  if (/consejo/i.test(v) && /wef|asrai/i.test(k)) {
    console.log(k, '=>', v);
  }
}
console.log('--- key names containing council/elder/convoc ---');
for (const [k, v] of raw) {
  if (/wef/i.test(k) && /council|elder|convoc/i.test(k)) {
    console.log(k, '=>', v);
  }
}
console.log('--- any value mentioning Consejo + Ariel/Coeddil ---');
for (const [k, v] of raw) {
  if (/consejo/i.test(v) && /ariel|coeddil|asrai|silvano/i.test(v)) {
    console.log(k, '=>', v);
  }
}
