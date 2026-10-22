const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const targets = [
  'node_modules/@firebase/firestore/dist/index.esm.js',
  'node_modules/@firebase/firestore/dist/index.cjs.js',
  'node_modules/@firebase/firestore/dist/index.rn.js',
  'node_modules/@firebase/firestore/dist/index.node.cjs.js',
  'node_modules/@firebase/firestore/dist/index.node.mjs',
  'node_modules/@firebase/firestore/dist/lite/index.browser.esm.js',
  'node_modules/@firebase/firestore/dist/lite/index.cjs.js',
  'node_modules/@firebase/firestore/dist/lite/index.rn.esm.js',
  'node_modules/.vite/deps/firebase_firestore.js'
];

let totalPatched = 0;

for (const relPath of targets) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  // Pattern 1: Minified browser/esm/cjs/rn/vite builds with "3241" (0x0ca9 in decimal)
  const pattern1 = /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\(\s*this\.ve\s*>=\s*0\s*,\s*3241\s*,\s*\{\s*ve:\s*this\.ve\s*\}\s*\);?/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, 'if (this.ve <= 0) { this.ve = 0; return; } this.ve -= 1;');
    changed = true;
  }

  // Pattern 2: Node builds with 0x0ca9 and pendingResponses
  const pattern2 = /this\.pendingResponses\s*-=\s*1\s*;\s*hardAssert\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*0x0ca9\s*,\s*\{\s*pendingResponses:\s*this\.pendingResponses\s*\}\s*\);?/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, 'if (this.pendingResponses <= 0) { this.pendingResponses = 0; return; } this.pendingResponses -= 1;');
    changed = true;
  }

  // Pattern 3: AsyncQueue fail(47125) (0xb815) in browser/esm/cjs/rn/vite builds
  const pattern3a = /this\.nc\s*&&\s*fail\(\s*47125\s*,\s*\{\s*Pc:\s*__PRIVATE_getMessageOrStack\(this\.nc\)\s*\}\s*\);?/g;
  if (pattern3a.test(content)) {
    content = content.replace(pattern3a, 'if (this.nc) { this.nc = null; }');
    changed = true;
  }

  const pattern3b = /this\.Ct\s*&&\s*fail\(\s*47125\s*,\s*\{\s*Pc:\s*__PRIVATE_getMessageOrStack\(this\.Ct\)\s*\}\s*\);?/g;
  if (pattern3b.test(content)) {
    content = content.replace(pattern3b, 'if (this.Ct) { this.Ct = null; }');
    changed = true;
  }

  // Pattern 4: Node builds with 0xb815
  const pattern4 = /if\s*\(\s*this\.failure\s*\)\s*\{\s*fail\(\s*0xb815\s*,\s*\{\s*messageOrStack:\s*getMessageOrStack\(this\.failure\)\s*\}\s*\);\s*\}/g;
  if (pattern4.test(content)) {
    content = content.replace(pattern4, 'if (this.failure) { this.failure = null; }');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-firestore] Patched ${relPath} successfully.`);
    totalPatched++;
  } else {
    console.log(`[patch-firestore] ${relPath} checked (no unpatched patterns).`);
  }
}

console.log(`[patch-firestore] Total files updated: ${totalPatched}`);
