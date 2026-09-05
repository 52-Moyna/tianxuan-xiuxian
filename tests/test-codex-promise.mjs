/**
 * 图鉴「承诺兑现」回归测试
 * ------------------------------------------------------------
 * 背景：图鉴 source 字段是对玩家的承诺 —— 照着去刷，就该刷得到。
 * 它是手写中文自由文本，真实产出路径却散在各张数据表里，两者会漂移。
 * 已真实发生过的落空承诺（都是玩家照图鉴白跑一趟）：
 *   · 延寿丹写「炼丹（金丹期以上）、秘境」，而丹方表里根本没有这一炉；
 *   · 仙缘·太初之气写「上古遗府/秘境深处」，实际出自海外游历的仙岛奇遇；
 *   · 破境丹 / 护身符 / 聚灵阵旗写「秘境」，而秘境只产灵石·材料·法宝·奇遇；
 *   · 小型 / 下品储物袋写「坊市」，坊市实际只卖扩容契与扩容储物袋；
 *   · 六只灵兽按等级硬编码「东荒妖域 / 中州秘境 / 上古遗府、终局」，
 *     而真实收服入口只有罗盘「灵兽栖息地」一个（幼凰被写成「终局」最离谱）。
 *
 * 判定规则（哪些途径可查、去哪张表查）集中在 tools/codex_pools.mjs，
 * 与 tools/audit_codex_promises.mjs 共用同一份 —— 若两边各写一份产出池，
 * 加了新玩法只改一处，另一边就会退化成永远绿的假绿灯。
 *
 * 用法：node tests/test-codex-promise.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPools, findBrokenPromises, findUnadvertisedPaths, ABSTRACT_CATEGORIES, CLAIMS, ADVERTISE_LABELS } from '../tools/codex_pools.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL:', m); } };

const { POOLS, CODEX_ITEMS } = await buildPools();

/* ---------- 1. 元断言：产出池本身得是活的，否则下面的「零命中」是假绿灯 ---------- */
ok(Object.keys(POOLS).length > 50, `产出池应有足够条目（实得 ${Object.keys(POOLS).length}）`);
for (const c of CLAIMS) {
  const hit = Object.keys(POOLS).filter((k) => POOLS[k].includes(c.label));
  ok(hit.length > 0, `产出池「${c.label}」不应为空（否则声称该途径的条目会被误判为落空）`);
}

/* ---------- 2. 主断言：非抽象分类不得有落空承诺 ---------- */
const broken = findBrokenPromises(POOLS, CODEX_ITEMS, { skipCategories: ABSTRACT_CATEGORIES });
const uniq = [...new Set(broken.map((b) => `${b.name}·${b.claim}`))];
ok(broken.length === 0,
  `${CODEX_ITEMS.length} 条图鉴中 ${uniq.length} 条承诺落空：\n    ` +
  broken.map((b) => `[${b.category}]${b.name} 声称「${b.claim}」但源表无此物（source：${b.source}）`).join('\n    '));

// 抽象分类（装备/法宝/功法）名称带随机前缀，静态比对不适用 —— 确认它们确实被跳过了
const abstractCount = CODEX_ITEMS.filter((i) => ABSTRACT_CATEGORIES.includes(i.category)).length;
ok(abstractCount > 0, `应存在被跳过的抽象条目（实得 ${abstractCount}）`);
ok(!broken.some((b) => ABSTRACT_CATEGORIES.includes(b.category)), '抽象分类不应出现在落空清单里');

/* ---------- 2b. 反向断言：拿得到、却没写进图鉴 ----------
 * 上一节只防「玩家照图鉴白跑一趟」。这一节防反过来 —— 明明有这条路，
 * 图鉴却只字不提，玩家压根不知道去哪刷。首轮摸底出 14 条真缺口：
 * 宗门兑换（聚气丹/凝血丹/凝神丹）、拍卖会（洗髓丹/星砂/遗府残图）、
 * 秘境（地火引/赤铜精/冰魄符纸/海灵珠/百越灵草/星砂）、坊市（破境丹/青风狼内丹）。 */
const unadvertised = findUnadvertisedPaths(POOLS, CODEX_ITEMS, { skipCategories: ABSTRACT_CATEGORIES });
ok(unadvertised.length === 0,
  `${CODEX_ITEMS.length} 条图鉴中有 ${unadvertised.length} 条漏写获取途径：\n    ` +
  unadvertised.map((b) => `[${b.category}]${b.name} 数据表里有「${b.missing.join('/')}」却没写（source：${b.source}）`).join('\n    '));
// 元断言：反向标签集本身得覆盖到真实条目，否则「零命中」又是假绿灯
for (const c of ADVERTISE_LABELS) {
  const covered = CODEX_ITEMS.filter((i) => !ABSTRACT_CATEGORIES.includes(i.category)
    && (POOLS[i.name]?.includes(c.label))).length;
  ok(covered > 0, `反向标签「${c.label}」应能匹配到真实图鉴条目（实得 ${covered}）`);
}
// 毒丸：把星砂的 source 改回只写坊市，反向检查必须报出「秘境 / 拍卖」
const poisonBack = CODEX_ITEMS.map((i) => (i.id === 'mat_star_sand' ? { ...i, source: '海外仙岛坊市' } : i));
const pbHits = findUnadvertisedPaths(POOLS, poisonBack, { skipCategories: ABSTRACT_CATEGORIES })
  .filter((b) => b.name === '星砂');
ok(pbHits.length === 1 && pbHits[0].missing.includes('秘境') && pbHits[0].missing.includes('拍卖'),
  `毒丸：星砂只写坊市时应报出漏写的秘境与拍卖（实得 ${JSON.stringify(pbHits.map((b) => b.missing))}）`);
// 反向毒丸：灵兽名不得被同名材料误判（inPool 的双向包含会把青风狼匹配到坊市卖的青风狼内丹）
const beasts = CODEX_ITEMS.filter((i) => i.category === '灵兽');
ok(findUnadvertisedPaths(POOLS, beasts, { skipCategories: ABSTRACT_CATEGORIES }).length === 0,
  '灵兽条目不应因同名材料（青风狼内丹）被误判为「坊市可买」');

/* ---------- 3. 元断言：检测器本身必须抓得住落空承诺（毒丸） ---------- */
const poison = [{ id: 'x', category: '丹药', name: '不存在的虚构丹', source: '丹炉炼制（炼气期）、秘境' }];
const poisonHits = findBrokenPromises(POOLS, poison, { skipCategories: ABSTRACT_CATEGORIES });
ok(poisonHits.length === 2, `毒丸条目应同时报出「丹方」与「秘境」两条落空（实得 ${poisonHits.length}）`);
// 反向毒丸：真实存在的丹不该被误报
const clean = [{ id: 'y', category: '丹药', name: '聚气丹', source: '坊市、炼丹' }];
ok(findBrokenPromises(POOLS, clean, { skipCategories: ABSTRACT_CATEGORIES }).length === 0,
  '真实存在的途径（坊市售、丹方可炼）不应被误报为落空');

/* ---------- 4. 历史缺口回归：别再漂回旧文案 ---------- */
const byId = Object.fromEntries(CODEX_ITEMS.map((i) => [i.id, i]));
const srcOf = (id) => byId[id]?.source || '';

// 延寿丹：图鉴承诺炼丹可得 → 丹方池里必须有它（此前 PILL_RECIPES 查无此炉）
ok(POOLS['延寿丹']?.includes('丹方'), '延寿丹必须有真实丹方（图鉴承诺了炼丹可得）');
// 太初之气：真实出处是海外游历的仙岛奇遇，与秘境/上古遗府无关
ok(!/秘境|上古遗府/.test(srcOf('mat_xianyuan_taichu')),
  `仙缘·太初之气的 source 不应再指向秘境/上古遗府（现为：${srcOf('mat_xianyuan_taichu')}）`);
ok(/海外/.test(srcOf('mat_xianyuan_taichu')), '仙缘·太初之气的 source 应指向海外游历');
// 灵兽：收服入口唯一（罗盘·灵兽栖息地），不得再写死地域/终局
const beastSrc = CODEX_ITEMS.filter((i) => i.category === '灵兽').map((i) => i.source);
ok(beastSrc.length > 0 && beastSrc.every((s) => /灵兽栖息地/.test(s)),
  `灵兽 source 应统一指向罗盘·灵兽栖息地（现为：${[...new Set(beastSrc)].join(' | ')}）`);
ok(!beastSrc.some((s) => /终局|上古遗府/.test(s)), '灵兽 source 不应出现「终局/上古遗府」这类误导门槛');

/* ---------- 5. 灵兽门槛三处同口径：图鉴文案 / 门槛函数 / 收服界面过滤 ---------- */
const { BEAST_TEMPLATES, beastGateLevel, beastCandidates } = await import('../public/js/codex.js');
ok(typeof beastGateLevel === 'function' && typeof beastCandidates === 'function',
  'codex.js 应导出 beastGateLevel / beastCandidates 供图鉴与收服界面共用');
for (const b of BEAST_TEMPLATES) {
  const entry = CODEX_ITEMS.find((i) => i.id === `beast_${b.id}`);
  const gate = beastGateLevel(b);
  // 图鉴写死的门槛数字必须来自门槛函数，否则改了函数图鉴就骗人
  ok(entry && new RegExp(`${gate} 级起可寻访`).test(entry.source),
    `${b.name} 的图鉴门槛应写 ${gate} 级（现为：${entry?.source || '条目缺失'}）`);
  // 门槛必须比推荐等级低 10 级且不低于 1 级
  ok(gate === Math.max(1, b.minLevel - 10), `${b.name} 的门槛应为 max(1, ${b.minLevel}-10)=${Math.max(1, b.minLevel - 10)}（实得 ${gate}）`);
}
// 收服界面若改回散装 `level >= minLevel - 10`，下面这条就会抓到分叉
for (const lv of [1, 5, 10, 20, 40, 50, 99]) {
  const viaFn = beastCandidates(lv).map((b) => b.id).join(',');
  const viaRaw = BEAST_TEMPLATES.filter((b) => lv >= b.minLevel - 10).map((b) => b.id).join(',');
  ok(viaFn === viaRaw, `${lv} 级时 beastCandidates 与收服界面的散装过滤应等价（${viaFn} vs ${viaRaw}）`);
}

console.log(`\n===== 图鉴承诺兑现测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
