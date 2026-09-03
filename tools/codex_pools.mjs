/**
 * 图鉴「承诺兑现」判定：单一真源
 * ------------------------------------------------------------
 * 图鉴每条都有 source 字段，告诉玩家「这东西从哪来」——这是对玩家的**承诺**，
 * 玩家照着去刷就该刷得到。但 source 是手写中文自由文本，真实产出路径却散在
 * 各张数据表里，两者必然漂移。历史上真实发生过的：
 *   · 延寿丹写「炼丹（金丹期以上）、秘境」——丹方表里根本没有这一炉；
 *   · 仙缘·太初之气写「上古遗府/秘境深处」——实际出自海外游历的仙岛奇遇；
 *   · 六只灵兽按等级硬编码「东荒妖域 / 中州秘境 / 上古遗府、终局」——
 *     真实收服入口只有罗盘「灵兽栖息地」一个，幼凰被写成「终局」更是离谱。
 * 玩家照图鉴白跑一趟，比缺功能更招骂。
 *
 * 本模块把「哪些途径可查、去哪张表查」收敛到一处，供两个消费方共用：
 *   · tools/audit_codex_promises.mjs —— 只读摸底，打印可疑清单给人看
 *   · tests/test-codex-promise.mjs   —— 断言「非抽象分类零落空承诺」
 * 【为何必须共用】若两边各写一份产出池，加了新玩法只改一处，另一边就会
 * 退化成永远绿的假绿灯 —— 这正是本项目反复踩过的坑。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const JS = join(ROOT, 'public/js');
const load = (f) => import(pathToFileURL(join(JS, f)).href);

/** 按产出池标签 → 物品名清单，构建全库产出索引 */
export async function buildPools() {
  const { CODEX_ITEMS, AUCTION_ITEMS_POOL, MYSTIC_REALMS, SECT_EXCHANGE, BEAST_TEMPLATES } = await load('codex.js');
  const { PILL_RECIPES, HERB_HYBRIDS, START_PACKS, BEASTS, MATERIAL_TYPES } = await load('data.js');
  const { ART_RECIPES, REGION_MARKET } = await load('life.js');

  const POOLS = {};
  const addPool = (label, names) => {
    for (const n of names) {
      if (!n) continue;
      (POOLS[n] = POOLS[n] || []).push(label);
    }
  };
  /** 百艺配方：output.name / output.名称 / 配方名 三种写法都要兜住 */
  const artOutputs = (art) => (ART_RECIPES[art] || []).flatMap((r) => [r.output?.name, r.output?.名称, r.name, r.id]);

  addPool('丹方', Object.keys(PILL_RECIPES).concat(Object.values(PILL_RECIPES).map((r) => r.output?.name)));
  addPool('丹方', artOutputs('炼丹'));
  addPool('杂交', HERB_HYBRIDS.map((h) => h.out?.名称 || h.out?.name));
  addPool('拍卖', AUCTION_ITEMS_POOL.map((i) => i.name));
  // 秘境只产灵石 / 材料 / 法宝 / 隐藏奇遇（见 systems.js exploreMysticRealm）。
  // 隐藏奇遇 SPECIAL_EVENTS 只改状态不发物品，所以秘境池 = 各秘境的 materials。
  addPool('秘境', MYSTIC_REALMS.flatMap((r) => r.rewards?.materials || []));
  // 坊市货架是 shopStock 动态拼出来的（聚气丹/凝血丹/渡劫丹/各瓶颈丹/扩容契
  // 都硬编码在函数体里），只看静态 REGION_MARKET 会把半个丹药房误报成买不到。
  const systemsSrc = readFileSync(join(JS, 'systems.js'), 'utf8');
  const shopStart = systemsSrc.indexOf('export function shopStock');
  const shopBody = shopStart < 0 ? '' : systemsSrc.slice(shopStart, systemsSrc.indexOf('\nexport function buyItem', shopStart));
  addPool('坊市', [...shopBody.matchAll(/名称:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  addPool('坊市', Object.values(REGION_MARKET).flat().map((i) => i.name));
  // START_PACKS.items 是字符串数组（不是对象），按对象取 .name 会拿到 undefined。
  addPool('开局', START_PACKS.flatMap((p) => (p.items || []).map((i) => (typeof i === 'string' ? i : (i.name || i.名称)))));
  // 妖兽掉落由 generateBeastDrops 运行时拼名：必掉「<兽名>内丹」，通用兽材加「妖兽」前缀，
  // 矿石与仙缘按裸名掉（systems.js:3183）。不还原这套命名规则会把全部兽材误报成查无实据。
  const beastDrops = BEASTS.flatMap((b) => [b.name, `${b.name}内丹`]);
  const commonDrops = MATERIAL_TYPES.filter((m) => ['lingcao', 'shougu', 'pimao'].includes(m.id)).map((m) => `妖兽${m.name}`)
    .concat(MATERIAL_TYPES.filter((m) => ['kuangshi', 'xianyuan', 'yaodan'].includes(m.id)).map((m) => m.name));
  addPool('妖兽', beastDrops.concat(commonDrops));
  // 可收服灵兽是 BEAST_TEMPLATES（图鉴/收服界面共用），与 data.js BEASTS（战斗遭遇的野生妖兽）
  // 是两张不同的表。只收 BEASTS 会把雷翅隼/玄水龟/幼凰误报成「收不到」。
  addPool('妖兽', BEAST_TEMPLATES.map((b) => b.name));
  addPool('宗门', SECT_EXCHANGE.map((e) => e.item).filter(Boolean));

  return { POOLS, CODEX_ITEMS };
}

/** source 里的途径关键词 → 要求命中的产出池标签。
 *  只收「有唯一权威数据表可查」的途径。两条不收的理由：
 *   ① 「天命 / 传承 / 终局 / 机缘 / 道缘」由运行时随机池决定，无静态清单可查；
 *   ② 「百艺X」（制符/阵法/灵植/御兽）在图鉴语境里指**相关玩法**，不是该百艺配方的
 *      直接产出 —— 例如低阶符箓写「符师道友敬赠、百艺制符」，制符配方只出护身符，
 *      它实际来自道友敬赠。强行按配方表断言会造出一批假红，得不偿失。 */
export const CLAIMS = [
  { re: /丹炉|炼丹/, label: '丹方' },
  { re: /杂交/, label: '杂交' },
  { re: /拍卖/, label: '拍卖' },
  { re: /秘境/, label: '秘境' },
  { re: /坊市/, label: '坊市' },
  { re: /开局/, label: '开局' },
  { re: /妖兽|战利品/, label: '妖兽' },
];

/** 装备 / 法宝 / 功法多为「品级抽象条目」（图鉴写「凡器武器」，
 *  真实掉落名带随机前缀如「青锋剑」），名称对不上是设计而非缺陷，静态比对不适用。 */
export const ABSTRACT_CATEGORIES = ['装备', '法宝', '功法'];

/** 剔除括号内的补充说明后再匹配途径。
 *  【为何必须剔除】「丹炉炼制（需凝火奇实·灵草杂交）」的意思是「用杂交产物做材料」，
 *  不是「杂交能产出这颗丹」；「道友深谈（灵植师）」里的「灵植」是道友职业名，
 *  也不是产出途径。不剔除会把材料来源错判成产出承诺，第一轮摸底就虚报了 180 条。 */
export const stripParens = (s) => String(s || '').replace(/[（(][^）)]*[）)]/g, ' ');

/** 条目名在某产出池里是否有实据。双向包含：图鉴写「灵兽契约」池里也是「灵兽契约」；
 *  但图鉴写「妖丹」而池里是「青风狼内丹」这类带前缀的具体物，需用包含关系兜住。 */
export function inPool(POOLS, label, name) {
  const pool = POOLS[name];
  if (pool && pool.includes(label)) return true;
  for (const k of Object.keys(POOLS)) {
    if (!POOLS[k].includes(label)) continue;
    if (k.includes(name) || name.includes(k)) return true;
  }
  return false;
}

/** 找出「承诺了但在对应数据表里查无实据」的条目。
 *  @param {object} POOLS buildPools() 返回的产出索引
 *  @param {Array}  items 图鉴条目（默认全库）
 *  @param {object} opts  { skipCategories } 要跳过的分类
 */
export function findBrokenPromises(POOLS, items, opts = {}) {
  const skip = opts.skipCategories || [];
  const out = [];
  for (const it of items) {
    if (!it?.name || !it?.source) continue;
    if (skip.includes(it.category)) continue;
    const src = stripParens(it.source);
    for (const c of CLAIMS) {
      if (!c.re.test(src)) continue;
      if (inPool(POOLS, c.label, it.name)) continue;
      out.push({ name: it.name, id: it.id, category: it.category, claim: c.label, source: it.source });
    }
  }
  return out;
}
