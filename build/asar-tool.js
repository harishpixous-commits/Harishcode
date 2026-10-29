const fs = require('fs');
const path = require('path');

function readHeader(archivePath) {
  const fd = fs.openSync(archivePath, 'r');
  const pre = Buffer.alloc(16);
  fs.readSync(fd, pre, 0, 16, 0);
  const headerPickleSize = pre.readUInt32LE(4); // includes its own 4-byte size field
  const jsonLen = pre.readUInt32LE(12);
  const jsonBuf = Buffer.alloc(jsonLen);
  fs.readSync(fd, jsonBuf, 0, jsonLen, 16);
  fs.closeSync(fd);
  const header = JSON.parse(jsonBuf.toString('utf8'));
  const dataStart = 8 + headerPickleSize;
  return { header, dataStart };
}

function walk(header, prefix, out) {
  const node = prefix ? header : header;
  if (node.files) {
    for (const name of Object.keys(node.files)) {
      const child = node.files[name];
      const p = prefix ? prefix + '/' + name : name;
      if (child.files) walk(child, p, out);
      else out.push({ path: p, node: child });
    }
  }
  return out;
}

function findFileAt(archivePath, offset) {
  const { header, dataStart } = readHeader(archivePath);
  const files = walk(header, '', []);
  const rel = offset - dataStart;
  for (const f of files) {
    if (f.node.offset === undefined) continue;
    const start = parseInt(f.node.offset, 10);
    const size = f.node.size || 0;
    if (rel >= start && rel < start + size) return { ...f, start, size, dataStart, header, jsonEnd: dataStart };
  }
  return { dataStart, header };
}

function extractFile(archivePath, entryPath, outPath) {
  const { header, dataStart } = readHeader(archivePath);
  const files = walk(header, '', []);
  const hit = files.find((f) => f.path === entryPath);
  if (!hit) throw new Error('not found: ' + entryPath);
  if (hit.node.unpacked) {
    const src = path.join(path.dirname(archivePath), 'app.asar.unpacked', entryPath);
    fs.copyFileSync(src, outPath);
    return hit;
  }
  const fd = fs.openSync(archivePath, 'r');
  const buf = Buffer.alloc(hit.node.size);
  fs.readSync(fd, buf, 0, hit.node.size, dataStart + parseInt(hit.node.offset, 10));
  fs.closeSync(fd);
  fs.writeFileSync(outPath, buf);
  return hit;
}

function extractAll(archivePath, outDir) {
  const { header, dataStart } = readHeader(archivePath);
  const files = walk(header, '', []);
  const fd = fs.openSync(archivePath, 'r');
  const resDir = path.dirname(archivePath);
  let count = 0;
  for (const f of files) {
    const dest = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (f.node.unpacked) {
      const src = path.join(resDir, 'app.asar.unpacked', f.path);
      try { fs.copyFileSync(src, dest); count++; } catch (e) { console.error('SKIP unpacked ' + f.path); }
      continue;
    }
    const buf = Buffer.alloc(f.node.size);
    fs.readSync(fd, buf, 0, f.node.size, dataStart + parseInt(f.node.offset, 10));
    fs.writeFileSync(dest, buf);
    count++;
  }
  fs.closeSync(fd);
  console.log('extracted ' + count + ' files');
}

// Repack: preserve original header flags/order, read content from sourceDir
function pack(archivePath, sourceDir, outPath) {
  const { header } = readHeader(archivePath);
  const files = walk(header, '', []);
  const chunks = [];
  let offset = 0;
  const newHeader = JSON.parse(JSON.stringify(header));
  const newFiles = walk(newHeader, '', []);
  for (const f of newFiles) {
    const src = path.join(sourceDir, f.path);
    if (f.node.unpacked) continue; // lives outside the archive
    if (f.node.link) continue;
    let buf;
    try {
      buf = fs.readFileSync(src);
    } catch (e) {
      // preserve original bytes if the file is missing from the source tree
      const orig = Buffer.alloc(f.node.size);
      const { dataStart } = readHeader(archivePath);
      const fd = fs.openSync(archivePath, 'r');
      fs.readSync(fd, orig, 0, f.node.size, dataStart + parseInt(f.node.offset, 10));
      fs.closeSync(fd);
      buf = orig;
    }
    f.node.offset = offset.toString(10);
    f.node.size = buf.length;
    delete f.node.integrity;
    chunks.push(buf);
    offset += buf.length;
  }
  let json = JSON.stringify(newHeader);
  // Electron's reader takes field[3] as the EXACT json length, so the json must
  // be a multiple of 4 with no null padding (nulls break JSON.parse). Pad with
  // spaces, which JSON.parse tolerates as trailing whitespace.
  while (json.length % 4) json += ' ';
  const jsonBuf = Buffer.from(json, 'utf8');
  const jsonLen = jsonBuf.length;
  const head = Buffer.alloc(16);
  head.writeUInt32LE(4, 0);            // fixed marker
  head.writeUInt32LE(jsonLen + 8, 4);  // pickle size
  head.writeUInt32LE(jsonLen + 4, 8);  // json region incl. size field
  head.writeUInt32LE(jsonLen, 12);     // exact json length
  const out = fs.createWriteStream(outPath);
  out.write(head);
  out.write(jsonBuf);
  for (const c of chunks) out.write(c);
  out.end();
  return new Promise((res) => out.on('finish', res));
}

const [cmd, ...args] = process.argv.slice(2);
module.exports = { readHeader, walk, extractFile, extractAll, pack };
if (require.main === module) (async () => {
  if (cmd === 'header') {
    const { header, dataStart } = readHeader(args[0]);
    console.log('dataStart', dataStart);
    console.log(JSON.stringify(header).slice(0, 500));
  } else if (cmd === 'find') {
    const r = findFileAt(args[0], parseInt(args[1], 10));
    console.log(JSON.stringify({ path: r.path, size: r.size, offset: r.start, dataStart: r.dataStart }, null, 2));
  } else if (cmd === 'extract') {
    extractFile(args[0], args[1], args[2]);
    console.log('ok');
  } else if (cmd === 'extract-all') {
    extractAll(args[0], args[1]);
  } else if (cmd === 'list') {
    const { header } = readHeader(args[0]);
    console.log(walk(header, '', []).map((f) => f.path + '\t' + (f.node.size || 0)).join('\n'));
  } else if (cmd === 'pack') {
    await pack(args[0], args[1], args[2]);
    console.log('packed -> ' + args[2]);
  } else {
    console.log('commands: header|find|extract|extract-all|list|pack');
  }
})();