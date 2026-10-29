const fs = require('fs');
const path = require('path');

const SRC = 'tmp/hc-src';
const URIS = JSON.parse(fs.readFileSync('tmp/hc-logo/uris.json', 'utf8'));

let stats = { files: 0, names: 0, logos: 0 };

// ---------------------------------------------------------------------------
// 1. the three in-app brand marks -> embedded Harish Code art
// ---------------------------------------------------------------------------
function replaceTemplate(c, varName, newSvg) {
  // these are declared either as `var X=F(`...`)` or inside a comma list `,X=F(`...`)`
  const head = varName + '=F(`';
  const start = c.indexOf(head);
  if (start < 0) throw new Error('template var not found: ' + varName);
  const before = c[start - 1];
  if (before !== ' ' && before !== ',') throw new Error('unexpected declaration context for ' + varName + ': ' + JSON.stringify(before));
  const bodyStart = start + head.length;
  const bodyEnd = c.indexOf('`)', bodyStart);
  if (bodyEnd < 0) throw new Error('template end not found: ' + varName);
  return { out: c.slice(0, bodyStart) + newSvg + c.slice(bodyEnd), replaced: c.slice(bodyStart, bodyEnd) };
}

const SVG_MARK =
  '<svg data-component=logo-mark viewBox="0 0 16 20" fill=none xmlns=http://www.w3.org/2000/svg>' +
  '<image href="' + URIS.mark + '" x="0" y="2" width="16" height="16" preserveAspectRatio="xMidYMid meet"/></svg>';

const SVG_SPLASH =
  '<svg data-component=logo-splash viewBox="0 0 80 100" fill=none xmlns=http://www.w3.org/2000/svg>' +
  '<image href="' + URIS.splash + '" x="0" y="16.8" width="80" height="66.2" preserveAspectRatio="xMidYMid meet"/></svg>';

const SVG_WORD =
  '<svg xmlns=http://www.w3.org/2000/svg viewBox="0 0 234 42" fill=none>' +
  '<image href="' + URIS.wordmark + '" x="0" y="0.9" width="234" height="40.2" preserveAspectRatio="xMidYMid meet"/></svg>';

const MAIN_BUNDLE = path.join(SRC, 'out/renderer/assets/main-Cs-Uxtxi.js');
{
  let c = fs.readFileSync(MAIN_BUNDLE, 'utf8');
  for (const [v, svg] of [['GPt', SVG_MARK], ['KPt', SVG_SPLASH], ['qPt', SVG_WORD]]) {
    const r = replaceTemplate(c, v, svg);
    console.log('logo ' + v + ': replaced ' + r.replaced.length + ' chars');
    c = r.out;
    stats.logos++;
  }
  fs.writeFileSync(MAIN_BUNDLE, c);
  console.log('wrote main bundle (' + c.length + ' chars)');
}

// ---------------------------------------------------------------------------
// 2. display-name rewrite across every text file
// ---------------------------------------------------------------------------
// Never touch: identifier fragments, member access, or the RPC namespace export
// `OpenCode:()=>...` which is a live code reference.
const NAME_RE = /(?<![A-Za-z0-9_$.])(?:OpenCode|PixCode|PawWork)(?![A-Za-z0-9_$]|:\(\)=>)/g;

const TEXT = /\.(js|mjs|json|html|css|desktop|xml|metainfo)$/i;

function walk(d, out) {
  out = out || [];
  let l;
  try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of l) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT.test(e.name)) out.push(p);
  }
  return out;
}

const targets = walk(path.join(SRC, 'out')).concat([
  path.join(SRC, 'package.json'),
  path.join(SRC, 'resources/linux/opencode-desktop.desktop'),
]);

// files that must keep their literal references intact
const SKIP = /node_modules/;

for (const f of targets) {
  if (SKIP.test(f)) continue;
  let c;
  try { c = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (c.indexOf('OpenCode') < 0 && c.indexOf('PixCode') < 0 && c.indexOf('PawWork') < 0) continue;
  const before = c;
  const n = (c.match(NAME_RE) || []).length;
  if (!n) continue;
  c = c.replace(NAME_RE, 'Harish Code');
  if (c !== before) {
    fs.writeFileSync(f, c);
    stats.files++;
    stats.names += n;
  }
}
console.log('renamed ' + stats.names + ' occurrences across ' + stats.files + ' files');

// ---------------------------------------------------------------------------
// 3. main-process product identity
// ---------------------------------------------------------------------------
{
  const f = path.join(SRC, 'out/main/index.js');
  let c = fs.readFileSync(f, 'utf8');
  const orig = c;

  // product name map
  c = c.replace(/N=\{dev:`[^`]*`,beta:`[^`]*`,prod:`[^`]*`\}/,
    'N={dev:`Harish Code Dev`,beta:`Harish Code Beta`,prod:`Harish Code`}');
  // app id map (keep the stable id so existing data/secrets still resolve)
  c = c.replace(/ae=\{dev:`[^`]*`,beta:`[^`]*`,prod:`[^`]*`\}/,
    'ae={dev:`ai.pawwork.desktop.dev`,beta:`ai.pawwork.desktop.beta`,prod:`ai.pawwork.desktop`}');
  // packaged-fallback strings
  c = c.replace(/f\.isPackaged\?N\[j\]:`[^`]*`/, 'f.isPackaged?N[j]:`Harish Code Dev`');

  fs.writeFileSync(f, c);
  console.log('main identity patched:', c !== orig);
}

// ---------------------------------------------------------------------------
// 4. renderer shell title
// ---------------------------------------------------------------------------
{
  const f = path.join(SRC, 'out/renderer/index.html');
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/<title data-sm>OpenCode<\/title>/, '<title data-sm>Harish Code</title>');
  fs.writeFileSync(f, c);
  console.log('index.html title:', /<title data-sm>Harish Code<\/title>/.test(c));
}

// ---------------------------------------------------------------------------
// 5. package identity
// ---------------------------------------------------------------------------
{
  const f = path.join(SRC, 'package.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.author = { name: 'Harish Code', email: j.author && j.author.email ? j.author.email : 'hello@harishcode.dev' };
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  console.log('package.json author ->', j.author.name);
}

console.log('\nDONE: logos=' + stats.logos + ' names=' + stats.names + ' files=' + stats.files);
