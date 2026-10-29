const fs = require('fs');

const file = 'tmp/hc-src/out/renderer/assets/shell-DHlrMvRb.js';
let s = fs.readFileSync(file, 'utf8');

/* --- 1. Empty the letter sequences --- */
const lettersRe = /co=\[`o`,`p`,`e`,`n`,`c`,`o`,`d`,`e`\],lo=\[`o`,`p`,`e`,`n`,`c`,`d`\]/;
const beforeLetters = lettersRe.test(s);
console.log('letter arrays found:', beforeLetters);
if (!beforeLetters) {
  // print what is actually there
  const i = s.indexOf('co=[');
  console.log('actual:', JSON.stringify(s.slice(i, i + 90)));
  process.exit(1);
}
s = s.replace(lettersRe, 'co=[],lo=[]');
console.log('letters emptied');

/* --- 2. Replace the symbol wordmark template --- */
const start = s.indexOf('oo=J(`');
const end = s.indexOf('so=J(`');
console.log('template span:', start, end);
if (start < 0 || end < 0 || end < start) {
  console.error('about wordmark template not found');
  process.exit(1);
}

const newTemplate =
  'oo=J(`<svg class=settings-about-wordmark viewBox="0 0 234 42" aria-hidden=true>' +
  '<text x="117" y="31" text-anchor="middle" fill="currentColor" font-size="30" ' +
  'font-weight="700" letter-spacing="1.4">HARISH CODE</text></svg>`),';

const oldLen = end - start;
s = s.slice(0, start) + newTemplate + s.slice(end);
console.log('template replaced: old', oldLen, '-> new', newTemplate.length);

fs.writeFileSync(file, s, 'utf8');
console.log('written');
