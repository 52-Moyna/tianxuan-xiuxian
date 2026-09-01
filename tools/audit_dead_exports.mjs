/* 死内容审计：扫描 systems.js / life.js 导出的函数，找出「从未被任何模块调用」的死入口。
 * 用法：node tools/audit_dead_exports.mjs
 * 说明：仅做静态文本匹配（够用即可），ESM 动态引用（如 UI.xxx）单独处理。 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS_DIR = path.join(ROOT, 'public', 'js');
const files = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js'));
const src = {};
for (const f of files) src[f] = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
// 测试目录也纳入「是否被使用」的判定
const testsDir = path.join(ROOT, 'tests');
const testSrc = fs.readdirSync(testsDir)
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => fs.readFileSync(path.join(testsDir, f), 'utf8'))
  .join('\n');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

function exportsOf(text) {
  const out = [];
  const re = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  const re2 = /export\s+const\s+([A-Za-z0-9_$]+)/g;
  while ((m = re2.exec(text))) out.push(m[1]);
  return out;
}

const report = [];
for (const f of files) {
  const names = [...new Set(exportsOf(src[f]))];
  for (const n of names) {
    let uses = 0;
    for (const g of files) {
      if (g === f) continue;
      const body = src[g];
      if (new RegExp(`\\b${n}\\b`).test(body)) uses++;
    }
    if (new RegExp(`\\b${n}\\b`).test(htmlSrc)) uses++;
    const inTest = new RegExp(`\\b${n}\\b`).test(testSrc);
    // 自身文件内的引用次数（去掉声明行后再数），用于区分「内部在用」与「彻底没人用」
    const selfUses = (src[f].match(new RegExp(`\\b${n}\\b`, 'g')) || []).length - 1;
    if (uses === 0) report.push({ file: f, name: n, inTest, selfUses });
  }
}

console.log('=== 从未被其它模块引用的导出（潜在死内容） ===');
// selfUses=0 且无外部引用 = 彻底死内容（导出本身也多余）；仅列出这一类 + 外部无引用者
const dead = report.filter((r) => r.selfUses <= 0);
console.log('--- 彻底死内容（本文件内也无人调用） ---');
for (const r of dead) {
  console.log(`${r.file}\t${r.name}\t${r.inTest ? '测试在用' : '完全无引用'}`);
}
console.log(`\n合计：外部无引用 ${report.length} 项；其中彻底死内容 ${dead.length} 项。`);
