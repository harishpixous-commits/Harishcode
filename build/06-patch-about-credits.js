const fs = require('fs');
const path = require('path');

const PROFILE = 'https://github.com/harishpixous-commits';
const REPO = 'https://github.com/harishpixous-commits/Harishcode';
const REPO_SHORT = 'github.com/harishpixous-commits/Harishcode';
const REPO_GIT = 'harishpixous-commits/Harishcode.git';

/* ---------------- 1. About page component ---------------- */
const shellFile = 'tmp/hc-src/out/renderer/assets/shell-DHlrMvRb.js';
let shell = fs.readFileSync(shellFile, 'utf8');
let changed = 0;

function mustReplace(src, from, to, label) {
  if (src.indexOf(from) < 0) {
    console.log('  MISS  ' + label);
    return src;
  }
  changed++;
  console.log('  ok    ' + label);
  return src.split(from).join(to);
}

// contributor / illustrator lists -> Harish only
shell = mustReplace(
  shell,
  'vo=[`thdxr`,`adamdotdev`,`rekram1-node`,`kitlangton`,`iamdavidhill`,`jayair`,`fwang`,`brendonovich`,`nexxeln`,`hona`,`kommander`,`jlongster`,`vimtor`,`r44vcorp`,`simonklee`,`arvsrn`]',
  'vo=[`harishpixous-commits`]',
  'contributor list -> harish only'
);

shell = mustReplace(
  shell,
  'yo=[`usrnk1`,`ludvigrask_`,`arvsrn`,`iamdavidhill`]',
  'yo=[`harishpixous-commits`]',
  'illustrator list -> harish only'
);

// drop the "and N others" chip that points at the upstream contributors page
shell = mustReplace(
  shell,
  ',L(Xt,{href:`https://github.com/anomalyco/opencode/graphs/contributors`,get children(){return t.plural(`settings.about.otherContributor`,i.latest,{count:i.latest})}})',
  '',
  'remove "and N others" link'
);

// website link target
shell = mustReplace(
  shell,
  'L(Xt,{href:`https://opencode.ai`,get children(){var e=go();',
  'L(Xt,{href:`' + REPO + '`,get children(){var e=go();',
  'website link -> harish repo'
);

fs.writeFileSync(shellFile, shell, 'utf8');
console.log('component edits applied:', changed);

/* ---------------- 2. Locale strings across every chunk ---------------- */
const VALUE_MAP = [
  ['settings.about.trademark', 'Harish Code — a project by @Harish Innovations'],
  ['settings.about.copyright', '© Harish Innovations'],
  ['settings.about.website', REPO_SHORT],
  ['settings.about.firstPublished', 'github.com/harishpixous-commits'],
  ['settings.about.firstIllustrated', REPO_GIT],
];

const files = [];
function walk(d) {
  for (const k of fs.readdirSync(d)) {
    const p = path.join(d, k);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.js$/.test(k)) files.push(p);
  }
}
walk('tmp/hc-src/out');

let touched = 0;
let replaced = 0;

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.indexOf('settings.about.') < 0) continue;
  const before = s;

  for (const [key, value] of VALUE_MAP) {
    const re = new RegExp('("' + key.replace(/\./g, '\\.') + '":`)' + '([^`]*)`', 'g');
    s = s.replace(re, (m, pre) => {
      replaced++;
      return pre + value + '`';
    });
  }

  if (s !== before) {
    fs.writeFileSync(f, s, 'utf8');
    touched++;
  }
}
console.log(`locale values rewritten: ${replaced} across ${touched} files`);

/* ---------------- 3. stage the "written by" wording (English chunk only) ---------------- */
const mainFile = 'tmp/hc-src/out/renderer/assets/main-Cs-Uxtxi.js';
let main = fs.readFileSync(mainFile, 'utf8');
main = mustReplace(
  main,
  '"settings.about.writtenByNames":`Written by {{names}}`',
  '"settings.about.writtenByNames":`All written by {{names}}`',
  'english "written by" wording'
);
fs.writeFileSync(mainFile, main, 'utf8');

/* ---------------- 4. replace the Anomaly brush artwork ---------------- */
const brush = 'tmp/hc-src/out/renderer/assets/anomaly-brush-BIROXXOT.svg';
if (fs.existsSync(brush)) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="110" height="42.464" fill="none" overflow="visible" ' +
    'preserveAspectRatio="none" style="display:block" viewBox="0 0 110 42.464">' +
    '<g fill="gray" opacity=".2">' +
    '<text x="55" y="28" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif" ' +
    'font-size="10.5" font-weight="700" letter-spacing="0.5">HARISH CODE</text></g></svg>';
  fs.writeFileSync(brush, svg, 'utf8');
  console.log('anomaly brush -> HARISH CODE wordmark');
}

console.log('done');
