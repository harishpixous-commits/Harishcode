// Fix remaining inflected display strings (OpenCoden/OpenCodea/OpenCodes) in locale chunks.
// Only OpenCode with capital O+C is display text in locale files; lowercase "opencode"
// and i18n keys are left untouched.
const fs = require('fs');
const path = require('path');

const ROOTS = ['out/main', 'out/renderer/assets'];
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9_]+)?-[A-Za-z0-9_-]+\.js$/;

let changed = 0;
let total = 0;

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const name of fs.readdirSync(root)) {
    if (!LOCALE_RE.test(name)) continue;
    const file = path.join(root, name);
    if (!fs.statSync(file).isFile()) continue;
    let s = fs.readFileSync(file, 'utf8');
    if (s.indexOf('OpenCode') < 0) continue;

    const before = s;
    // display text only: OpenCode followed by a letter (inflection) or non-code char
    const hits = (s.match(/OpenCode/g) || []).length;
    s = s.replace(/OpenCode/g, 'Harish Code');
    if (s !== before) {
      fs.writeFileSync(file, s, 'utf8');
      changed++;
      total += hits;
      console.log('PATCHED', file, hits);
    }
  }
}
console.log(`\n=== ${total} strings in ${changed} locale files ===`);
