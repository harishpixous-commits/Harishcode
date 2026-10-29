const fs = require('fs');

/* ---------- 1. Extract the branded 234x42 lockup already embedded in the renderer ---------- */
const mainFile = 'tmp/hc-src/out/renderer/assets/main-Cs-Uxtxi.js';
const main = fs.readFileSync(mainFile, 'utf8');

let lockupB64 = null;
const reImg = /data:image\/png;base64,([A-Za-z0-9+/=]+)/g;
let m;
while ((m = reImg.exec(main))) {
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 30) continue;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w === 936 && h === 168) {
    lockupB64 = m[1];
    console.log('found lockup:', w + 'x' + h, buf.length + 'b');
    break;
  }
}
if (!lockupB64) {
  // fall back to the standalone asset
  const b = fs.readFileSync('tmp/hc-logo/brand-lockup.png');
  lockupB64 = b.toString('base64');
  console.log('fallback to brand-lockup.png', b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));
}

/* ---------- 2. Patch the watermark component ---------- */
const routeFile = 'tmp/hc-src/out/renderer/assets/route-B3Ytpg1y.js';
let route = fs.readFileSync(routeFile, 'utf8');

// 2a. Empty the 8 letter path definitions so only our artwork shows
const arStart = route.indexOf('[{cx:12,weak:');
if (arStart < 0) throw new Error('letter array not found');
const arEnd = route.indexOf('],or=234', arStart);
if (arEnd < 0) throw new Error('letter array end not found');
const arSlice = route.slice(arStart, arEnd + 1);
const arNew = arSlice
  .replace(/weak:`[^`]*`/g, 'weak:`M0 0Z`')
  .replace(/stem:`[^`]*`/g, 'stem:`M0 0Z`');
route = route.slice(0, arStart) + arNew + route.slice(arEnd + 1);
console.log('letters blanked:', arNew.indexOf('weak:`M0 0Z`') >= 0, '| length', arSlice.length, '->', arNew.length);

// 2b. Inject the artwork into the empty flat wordmark svg
const emptySvg = '<svg viewBox="0 0 234 42"fill=none class="block size-full overflow-visible"></svg>';
const injected = '<svg viewBox="0 0 234 42"fill=none class="block size-full overflow-visible">' +
  '<image href="data:image/png;base64,' + lockupB64 + '" x="0" y="0" width="234" height="42" preserveAspectRatio="xMidYMid meet"/></svg>';

if (route.indexOf(emptySvg) < 0) throw new Error('empty wordmark svg not found');
route = route.replace(emptySvg, injected);
console.log('artwork injected: OK');

fs.writeFileSync(routeFile, route, 'utf8');

/* ---------- 3. Add display-name normalizer to index.html ---------- */
const htmlFile = 'tmp/hc-src/out/renderer/index.html';
let html = fs.readFileSync(htmlFile, 'utf8');

const marker = '<!-- harish-code-brand-guard -->';
if (html.indexOf(marker) >= 0) {
  console.log('brand guard already present');
} else {
  const guard = `
    ${marker}
    <script>
      ;(function () {
        var MAP = { "OpenCode": "Harish Code", "opencode": "Harish Code" }
        var BLOCK = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1 }

        function fixNode(node) {
          var parent = node.parentNode
          if (!parent || BLOCK[parent.nodeName]) return
          var v = node.nodeValue
          if (!v) return
          var t = MAP[v.trim()]
          if (!t) return
          node.nodeValue = v.replace(v.trim(), t)
        }

        function walk(root) {
          if (!root) return
          if (root.nodeType === 3) { fixNode(root); return }
          if (BLOCK[root.nodeName]) return
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
          var n, batch = []
          while ((n = walker.nextNode())) batch.push(n)
          for (var i = 0; i < batch.length; i++) fixNode(batch[i])
        }

        function start() {
          walk(document.body)
          new MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
              var r = records[i]
              if (r.type === "characterData") { fixNode(r.target); continue }
              for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j])
            }
          }).observe(document.body, { childList: true, subtree: true, characterData: true })
        }

        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start)
        else start()
      })()
    </script>
`;
  html = html.replace('    <script type="module" crossorigin src="./assets/main-Cs-Uxtxi.js"></script>',
    guard + '    <script type="module" crossorigin src="./assets/main-Cs-Uxtxi.js"></script>');
  fs.writeFileSync(htmlFile, html, 'utf8');
  console.log('brand guard added to index.html');
}
