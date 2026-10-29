const fs = require('fs');

const file = 'tmp/hc-src/out/renderer/assets/list-BBnDSIoo.js';
let s = fs.readFileSync(file, 'utf8');

const OLD =
  'E(`<svg data-component=opencode-logo aria-hidden=true viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg>' +
  '<g transform="translate(1.2 1.2) scale(0.85)">' +
  '<path opacity=0.2 d="M11.1999 12.8H4.79993V6.40002H11.1999V12.8Z"fill=currentColor></path>' +
  '<path d="M11.2 3.2H4.79998V12.8H11.2V3.2ZM14.4 16H1.59998V0H14.4V16Z"fill=currentColor>`)';

// HC mark: rounded-square outline + "HC" glyphs, both in currentColor so it
// adapts to light and dark themes. Font inherits from the app (Inter).
const NEW =
  'E(`<svg data-component=opencode-logo aria-hidden=true viewBox="0 0 16 16"fill=none xmlns=http://www.w3.org/2000/svg>' +
  '<rect x="1" y="1" width="14" height="14" rx="3.8" stroke="currentColor" stroke-width="1.4" fill="none"></rect>' +
  '<text x="8" y="11.4" text-anchor="middle" font-size="7.4" font-weight="800" letter-spacing="0.1" fill="currentColor">HC</text>' +
  '</svg>`)';

if (s.indexOf(OLD) < 0) {
  console.error('OLD template not found - aborting');
  process.exit(1);
}
s = s.replace(OLD, NEW);
fs.writeFileSync(file, s, 'utf8');
console.log('opencode-logo replaced with HC mark');
