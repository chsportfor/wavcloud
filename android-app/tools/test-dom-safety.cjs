const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const helper = fs.readFileSync('android-app/web-src/scripts/dom-safety.js', 'utf8');
const runtime = fs.readFileSync('android-app/web-src/scripts/runtime.js', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(helper, context);

const attack = '<img src=x onerror="globalThis.compromised=true"> & \'quoted\'';
const escaped = context.uiEscapeHtml(attack);
assert.equal(escaped, '&lt;img src=x onerror=&quot;globalThis.compromised=true&quot;&gt; &amp; &#39;quoted&#39;');
assert.doesNotMatch(escaped, /<img/i);

for (const unsafe of [
  '>${t.name}</div>',
  '>${r.title}</div>',
  '>${r.artist||"Unknown Artist"}</div>',
  '>${u.name}</span>',
  '>${n.title}</div>',
  '>${n.artist||"Unknown Artist"}</div>',
  '<option value="${n}">${n}</option>'
]) {
  assert.equal(runtime.includes(unsafe), false, `unsafe dynamic HTML remains: ${unsafe}`);
}
assert.match(runtime, /uiEscapeHtml\(t\.name\)/);
assert.match(runtime, /uiEscapeHtml\(r\.title\)/);
assert.match(runtime, /uiEscapeHtml\(n\.title\)/);
assert.match(runtime, /uiEscapeHtml\(u\.name\)/);
console.log('PASS: external metadata is escaped before dynamic HTML insertion');
