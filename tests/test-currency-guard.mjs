/**
 * 第 15 套：分层货币口径防线（静态扫描型测试）
 *
 * 防线背景（2026-09-02 真实事故）：货币分 5 档、1:100 递进，收入侧会 redistribute
 * 重新分档，于是「下品灵石」单档账面恒 < 100。而储物袋扩容、跨域旅行、灵兽升星、
 * 引泉升级、灵草播种/浇灌/杂交全都只检查并扣减「下品灵石」这一档 —— 玩家身家百万
 * 却处处判定「灵石不足」，这些玩法实质从未可用过。事故已修，但**修过不等于不会复发**：
 * 只要有新人（或任何一次顺手改）写出 `currencies['下品灵石'] -= cost`，玩法立刻全线瘫痪，
 * 而且单元测试很可能依旧全绿（测试若也用错口径，就会一起错）。
 *
 * 所以这套不测业务，只做全库静态扫描，把三条铁律钉死：
 *   ① 禁止对单档做写操作（+= / -= / =）——必须走 addStones / spendStones 这类分层函数；
 *   ② 禁止硬编码 1:100 进制（Math.pow(100, i)）——必须引用 data.js 的 CURRENCY_RATE；
 *   ③ 开局资产的灵石数必须小于一档进制，否则开局账面就不合规。
 * 外加一条元断言：验证扫描正则本身仍然有效（防止防线悄悄失效、永远绿）。
 *
 * 与 test-currency.mjs 的分工：那套测运行时行为（扣款额度、UI 与结算同口径），
 * 这套测源码写法（不允许出现违规模式）。两者互补。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { CURRENCY_RATE, CURRENCIES, START_PACKS } from '../public/js/data.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? pass++ : (fail++, console.error('FAIL:', n)));

const DIR = new URL('../public/js/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ f, code: readFileSync(new URL(f, DIR), 'utf-8') }));

/* ---------- ① 禁止对单档做写操作 ---------- */
// 档名从 CURRENCIES 生成，避免将来加档位时这里漏掉
const TIER = `(?:${CURRENCIES.join('|')})`;
// 命中形如 currencies['下品灵石'] -= cost / c['下品灵石'] = x / c['下品灵石'] += n
// 只读（c['下品灵石'] || 0）与动态索引（CURRENCIES[i]）都不会命中
const WRITE_RE = new RegExp(`\\[\\s*['"]${TIER}['"]\\s*\\]\\s*(?:=[^=>]|[+\\-*/]=)`, 'g');

{
  const bad = [];
  for (const { f, code } of files) {
    code.split('\n').forEach((line, i) => {
      // 跳过纯注释行：注释里引用反例历史是允许的（本文件与源码注释都靠这个豁免）
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
      if (WRITE_RE.test(line)) bad.push(`${f}:${i + 1} ${trimmed.slice(0, 80)}`);
      WRITE_RE.lastIndex = 0;
    });
  }
  ok(bad.length === 0, `源码中不存在对货币单档的写操作${bad.length ? `（违规 ${bad.length} 处）` : ''}`);
  for (const b of bad) console.error('   违规:', b);
}

/* ---------- ② 禁止硬编码 1:100 进制 ---------- */
{
  const bad = [];
  for (const { f, code } of files) {
    code.split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
      // Math.pow(100, i) 是历史写法；任何 100 进制都必须走 CURRENCY_RATE
      if (/Math\.pow\(\s*100\s*,/.test(line)) bad.push(`${f}:${i + 1} ${trimmed.slice(0, 80)}`);
    });
  }
  ok(bad.length === 0, `档位换算一律使用 CURRENCY_RATE，无硬编码 Math.pow(100, i)${bad.length ? `（违规 ${bad.length} 处）` : ''}`);
  for (const b of bad) console.error('   违规:', b);
}

/* ---------- ③ CURRENCY_RATE 必须真的被各实现引用（防脱钩成死常量） ---------- */
{
  for (const f of ['systems.js', 'life.js', 'codex.js']) {
    const hit = files.find((x) => x.f === f);
    ok(!!hit && hit.code.includes('CURRENCY_RATE'), `${f} 引用 CURRENCY_RATE（不得与进制常量脱钩）`);
  }
  ok(CURRENCY_RATE === 100, 'CURRENCY_RATE 为 100（若改进制，本套断言需同步复核）');
}

/* ---------- ④ 开局资产的灵石数必须小于一档进制 ---------- */
{
  const bad = START_PACKS.filter((p) => (p.stones || 0) >= CURRENCY_RATE);
  ok(bad.length === 0, `开局包裹灵石均小于一档进制（${CURRENCY_RATE}），开局账面即合规${bad.length ? `（违规：${bad.map((b) => b.name).join('、')}）` : ''}`);
}

/* ---------- ⑤ 元断言：扫描正则本身必须仍然有效（防线不能悄悄失效） ---------- */
{
  const samples = [
    "state.currencies['下品灵石'] -= cost;",
    "state.currencies['中品灵石'] += amount;",
    "const c = state.currencies; c['灵晶'] = 5;",
    "st.currencies?.['下品灵石'] = 0;",
  ];
  const missed = samples.filter((s) => {
    WRITE_RE.lastIndex = 0;
    return !WRITE_RE.test(s);
  });
  ok(missed.length === 0, `写操作扫描正则仍能命中全部违规样本${missed.length ? `（漏检：${missed.join(' | ')}）` : ''}`);

  // 反例：只读与动态索引不得被误伤（否则防线会天天误报，最后被人删掉）
  const safe = [
    "const v = st.currencies['下品灵石'] || 0;",
    "state.currencies[CURRENCIES[i]] = c;",
    "sum + (state.currencies?.[c] || 0) * Math.pow(CURRENCY_RATE, i)",
  ];
  const falseHit = safe.filter((s) => {
    WRITE_RE.lastIndex = 0;
    return WRITE_RE.test(s);
  });
  ok(falseHit.length === 0, `只读与动态索引不被误判为违规${falseHit.length ? `（误伤：${falseHit.join(' | ')}）` : ''}`);
}

console.log(`\n灵石分层口径防线：${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
