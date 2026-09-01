/**
 * 图鉴「幽灵条目」回归测试
 * ------------------------------------------------------------
 * 背景：CODEX_ITEMS 是玩家能在图鉴里看到的全物品清单。若某条目在丹方 /
 * 坊市 / 掉落 / 秘境 / 拍卖 / 任务 / 杂交 / 奖励中根本没有任何产出路径，
 * 玩家就会盯着一个「一辈子拿不到」的死条目 —— 承诺了却不兑现。
 * （历史上曾一次性查出解毒丹 / 神识丹 / 破境丹 / 法力丹四个幽灵条目。）
 *
 * 本测试把这条规则固化：今后新增图鉴条目，必须同步给出获取途径，
 * 否则测试直接失败。
 *
 * 用法：node tests/test-codex-paths.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL:', m); } };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const JS = join(ROOT, 'public/js');

const { CODEX_ITEMS } = await import(pathToFileURL(join(JS, 'codex.js')).href);

// 图鉴本身只是「说明书」，不算产出路径；其余源码里出现该名称才算有出处。
const SOURCE_FILES = ['data.js', 'life.js', 'systems.js', 'extensions.js', 'state.js', 'save.js', 'main.js'];
const haystack = SOURCE_FILES.map((f) => {
  try { return readFileSync(join(JS, f), 'utf8'); } catch { return ''; }
}).join('\n');

// codex.js 里 CODEX_ITEMS 定义区之外的内容（例如坊市清单、兑换所）也算路径。
const codexSrc = readFileSync(join(JS, 'codex.js'), 'utf8');
const start = codexSrc.indexOf('export const CODEX_ITEMS');
const end = codexSrc.indexOf('\n];', start);
const codexOther = (start < 0 || end < 0) ? codexSrc : codexSrc.slice(0, start) + codexSrc.slice(end);

ok(Array.isArray(CODEX_ITEMS) && CODEX_ITEMS.length > 0, '图鉴条目非空');
ok(start >= 0 && end > start, 'codex.js 中定位到 CODEX_ITEMS 定义区');

const ghosts = CODEX_ITEMS
  .filter((it) => it && it.name)
  .filter((it) => !haystack.includes(it.name) && !codexOther.includes(it.name))
  .map((it) => `${it.name}(${it.id || '无id'})`);

ok(ghosts.length === 0, `图鉴 ${CODEX_ITEMS.length} 条中 ${ghosts.length} 条无任何产出路径：${ghosts.join('、')}`);
ok(new Set(CODEX_ITEMS.map((i) => i.id)).size === CODEX_ITEMS.length, '图鉴条目 id 不重复');

console.log(`\n===== 图鉴产出路径测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
