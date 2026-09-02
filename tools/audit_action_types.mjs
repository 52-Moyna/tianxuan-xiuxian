/**
 * 决策罗盘动作类型审计：找出「点了没反应」的死按钮。
 * 罗盘 opts 里生成的 action.type，若 performAction 没有对应分支 = 玩家点击后静默无反应。
 * 同时反向列出 performAction 已实现但罗盘不再产出的类型（可能是死内容）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const files = ['public/js/systems.js', 'public/js/life.js', 'public/js/ui.js', 'public/js/main.js'];
const src = new Map(files.map((f) => [f, read(f)]));

// 1) 所有被产出的 action.type（形如 action: { type: 'xxx' } / type: "xxx"）
const produced = new Map(); // type -> [file, ...]
for (const [f, txt] of src) {
  for (const m of txt.matchAll(/action:\s*\{\s*type:\s*['"]([A-Za-z0-9_]+)['"]/g)) {
    if (!produced.has(m[1])) produced.set(m[1], []);
    produced.get(m[1]).push(f);
  }
  // 变体：先声明对象再赋 type
  for (const m of txt.matchAll(/\btype:\s*['"]([A-Za-z0-9_]+)['"]/g)) {
    // 只在含 action 上下文的行内采信
    const lineStart = txt.lastIndexOf('\n', m.index) + 1;
    const line = txt.slice(lineStart, m.index + 120);
    if (/action/.test(line)) {
      if (!produced.has(m[1])) produced.set(m[1], []);
      if (!produced.get(m[1]).includes(f)) produced.get(m[1]).push(f);
    }
  }
}

// 2) performAction 中已处理的分支
const pa = src.get('public/js/systems.js');
const handled = new Set();
for (const m of pa.matchAll(/case\s+['"]([A-Za-z0-9_]+)['"]\s*:/g)) handled.add(m[1]);
for (const m of pa.matchAll(/\[?['"]([A-Za-z0-9_]+)['"]\]?\s*=>/g)) handled.add(m[1]);
// 兜底：任何 if (a.type === 'xxx') / type === "xxx"
for (const m of pa.matchAll(/type\s*===\s*['"]([A-Za-z0-9_]+)['"]/g)) handled.add(m[1]);
for (const txt of src.values()) {
  for (const m of txt.matchAll(/type\s*===\s*['"]([A-Za-z0-9_]+)['"]/g)) handled.add(m[1]);
}

// 已知交由别处统一处理的类型（非 performAction 分发）
const EXTERNAL = new Set([
  'noop', 'close', 'cancel', 'confirm', 'goto', 'tab', 'open', 'custom',
]);

const unhandled = [...produced.keys()]
  .filter((t) => !handled.has(t) && !EXTERNAL.has(t))
  .sort();

const orphanHandler = [...handled]
  .filter((t) => !produced.has(t))
  .sort();

console.log('=== 决策罗盘动作审计 ===');
console.log(`罗盘产出类型 ${produced.size} 个；performAction 及条件分支命中 ${handled.size} 个`);
console.log('\n--- 产出但无处理分支（点击可能无反应）---');
if (!unhandled.length) console.log('（无）');
for (const t of unhandled) console.log(`${t}\t${produced.get(t).join(', ')}`);
console.log('\n--- 有处理分支但罗盘不再产出（潜在死内容）---');
if (!orphanHandler.length) console.log('（无）');
for (const t of orphanHandler) console.log(t);
