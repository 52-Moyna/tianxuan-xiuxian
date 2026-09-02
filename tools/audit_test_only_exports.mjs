/**
 * 扫描「只有测试在引用」的导出函数 —— 比彻底死内容更危险的「假活代码」。
 *
 * 背景：本项目高发故障模式是「功能实现了、测试也是绿的，但玩家根本没有入口」。
 * 彻底死内容（外部零引用）反而容易发现；而「只有测试引用」的导出会伪装成
 * 已接线功能，让每轮回归测试长期亮绿灯却掩盖真实的缺失入口。
 *
 * 判定口径（2026-09-02 修正）：
 *   假活代码 = 外部源码无引用 **且** 本文件内也无调用 **且** 测试在用。
 *   只被测试引用、但本文件内部还在调用的（如 ui.renderAll 被同文件 15 处调用、
 *   life.lifeAddStones 被 settleRefine 调用）属于内部活代码，不是假活代码。
 *   旧版漏了「本文件内调用」这一层过滤，43 项里绝大多数是误报，差点被当成清理清单。
 *
 * 用法：node tools/audit_test_only_exports.mjs
 * 输出：按文件分组列出「仅测试引用」的导出名，供人工判断是否补 UI 入口或删除。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || '.';
const SRC_DIRS = ['public/js', 'tests', 'tools'];
const SRC_EXT = /\.(js|mjs)$/;

/** 递归收集文件 */
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (SRC_EXT.test(name)) out.push(p);
  }
  return out;
}

const files = SRC_DIRS.flatMap((d) => walk(join(ROOT, d)));
const srcFiles = files.filter((f) => !f.includes(`${'tests'}`));
const testFiles = files.filter((f) => f.includes(`${'tests'}`));

/** 收集 export 名 */
function exportsOf(code) {
  const names = new Set();
  const re = /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(code))) names.add(m[1]);
  // export { a, b as c }
  const re2 = /export\s*\{([^}]*)\}/g;
  while ((m = re2.exec(code))) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  return names;
}

/** 在 code 中是否出现该标识符（排除 export 定义行自身） */
function referenced(code, name, isSelf) {
  // 出现次数：定义 1 次 + 引用 N 次
  const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
  const hits = code.match(re) || [];
  if (isSelf) return hits.length > 1; // 本文件内还有别处用到
  return hits.length > 0;
}

const report = [];
for (const file of srcFiles) {
  const code = readFileSync(file, 'utf-8');
  const names = [...exportsOf(code)];
  if (!names.length) continue;
  const others = srcFiles.filter((f) => f !== file).map((f) => readFileSync(f, 'utf-8')).join('\n');
  const tests = testFiles.map((f) => readFileSync(f, 'utf-8')).join('\n');
  const only = [];
  for (const n of names) {
    const usedInSrc = referenced(others, n, false);
    const usedInTests = referenced(tests, n, false);
    // 本文件内还有调用 ⇒ 是内部活代码（渲染入口 / 被同文件其它导出调用），不是假活代码
    const usedSelf = referenced(code, n, true);
    if (!usedInSrc && usedInTests && !usedSelf) only.push({ n });
  }
  if (only.length) report.push({ file, only });
}

if (!report.length) {
  console.log('✅ 未发现「只有测试引用」的导出。');
} else {
  console.log('=== 假活代码：外部无引用 + 本文件内无调用 + 只有测试在用 ===');
  console.log('（每一项都应判断：补玩家入口，还是连函数带测试一起删）');
  for (const { file, only } of report) {
    console.log(`\n${file}`);
    for (const { n } of only) console.log(`  - ${n}`);
  }
  console.log('\n合计：', report.reduce((a, b) => a + b.only.length, 0), '项');
}
