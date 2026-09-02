/**
 * 第 16 套：满仓静默丢失 · 运行时防线
 *
 * 防线背景（本项目第二大 bug 家族，已手修 7 处，此前没有任何防线）：
 * 「先扣代价、后入袋」的写法在储物袋满时，会让玩家白付灵石 / 贡献 / 材料 / 灵草
 * 却一无所获，而返回值往往还是 ok:true、日志还写着「兑换成功」——绿灯掩盖白亏。
 * 已修位置：收获灵草、灵草杂交、百艺制作、拍卖落槌、秘境、宗门兑换、坊市购买。
 *
 * 本套不逐个重放那 7 处，而是钉死一条**不变量**：
 *   在满仓状态下运行任何「付代价换产出」的玩家动作，
 *   玩家的净资产（灵石 + 宗门贡献 + 行囊存量 + 灵草园）**一分都不能少**。
 * 以后谁再写出「先扣代价后入袋」，这套会立刻报红，哪怕单元测试依旧全绿。
 *
 * 与第 15 套（分层货币静态扫描）互补：那套扫源码口径，这套验运行期结果。
 * 两套都遵守同一条纪律——**防线必须自证有效**（元断言 + 毒丸验证）。
 */
import * as S from '../public/js/systems.js';
import {
  ensureLifeState, inventoryUsed, storeItem, craftRecipe, ART_RECIPES,
  harvestHerb, crossbreedHerbs,
} from '../public/js/life.js';
import { canTameBeast } from '../public/js/codex.js';

let pass = 0, fail = 0;
let capture = null;
const ok = (c, n) => {
  if (capture) { capture.push({ c: !!c, n }); return; }
  if (c) pass++;
  else { fail++; console.error('FAIL:', n); }
};

/** 抓取一段断言的结果用于元断言，不计入总分（否则「故意违规」的样例会污染通过数） */
function captureRun(fn) {
  const prev = capture;
  const buf = [];
  capture = buf;
  try { fn(); } finally { capture = prev; }
  return buf;
}

const setStones = (st, n) => { st.currencies = {}; S.addStones(st, n); };
const stones = (st) => S.totalStones(st);

function freshGame(name) {
  const st = S.createNewGame({
    name, gender: '男', raceId: 'human', ageId: 'young',
    regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
  });
  ensureLifeState(st);
  setStones(st, 200000);
  return st;
}

/** 构造满仓：容量 = 当前已用。注意不能用 capacity = 0（内部 `|| 100` 会归一成 100 格）。 */
function fillBag(st) {
  ensureLifeState(st);
  st.inventory.used = inventoryUsed(st);
  st.inventory.capacity = st.inventory.used;
  st.inventory.ringBonus = 0; // 戒指加成是额外空间，清零才是真满仓
  return st;
}

/** 玩家净资产快照：灵石 / 宗门贡献 / 行囊每种物品的数量 / 灵草园株数 */
function snapshot(st) {
  const qty = {};
  for (const it of st.items || []) qty[it.名称] = (qty[it.名称] || 0) + (Number(it.数量) || 1);
  return {
    stones: stones(st),
    contrib: Number(st.sect?.contribution || 0),
    qty,
    garden: (st.cave?.garden || []).length,
    beasts: (st.beasts?.slots || []).filter(Boolean).length,
  };
}

/** 不变量：满仓状态下，玩家净资产只许增长、不许减少。减少即白亏。 */
function assertNoWhiteLoss(label, st, before) {
  const after = snapshot(st);
  ok(after.stones >= before.stones, `${label}：满仓未扣灵石（${before.stones} → ${after.stones}）`);
  ok(after.contrib >= before.contrib, `${label}：满仓未扣宗门贡献（${before.contrib} → ${after.contrib}）`);
  for (const [name, q] of Object.entries(before.qty)) {
    ok((after.qty[name] || 0) >= q, `${label}：满仓未消耗「${name}」（${q} → ${after.qty[name] || 0}）`);
  }
  ok(after.garden >= before.garden, `${label}：满仓未销毁灵草（${before.garden} → ${after.garden}）`);
  ok(after.beasts >= before.beasts, `${label}：满仓未丢失灵兽`);
}

/* ============================================================
 * 一、元断言：先证明这套防线真的能抓到违规，再拿它去扫真实动作
 * ============================================================ */
{
  // 违规样本：历史上真实存在过的写法 —— 先扣灵石，后入袋
  const bad = freshGame('违规样本');
  fillBag(bad);
  const before = snapshot(bad);
  S.spendStones(bad, 50);
  storeItem(bad, { 名称: '测试物', 类型: '材料', 数量: 1, 描述: '' });
  const r = captureRun(() => assertNoWhiteLoss('违规样本', bad, before));
  ok(r.length > 0 && r.some((x) => !x.c), '元断言：探针能抓出「先扣代价、后入袋」的违规实现');
  ok(r.some((x) => !x.c && /未扣灵石/.test(x.n)), '元断言：违规定位到「扣灵石」这一条');

  // 合规样本：先 canStore 校验、校验不过就不扣任何代价
  const good = freshGame('合规样本');
  fillBag(good);
  const before2 = snapshot(good);
  storeItem(good, { 名称: '测试物', 类型: '材料', 数量: 1, 描述: '' });
  const r2 = captureRun(() => assertNoWhiteLoss('合规样本', good, before2));
  ok(r2.every((x) => x.c), '元断言：合规实现不被误伤（探针不产生假红）');

  // 满仓判定的自我校验：满仓时 storeItem 必须失败，否则后面的断言全是空转
  const f = freshGame('满仓判定');
  fillBag(f);
  ok(storeItem(f, { 名称: '测试物', 类型: '材料', 数量: 1, 描述: '' }) === false, '元断言：满仓时 storeItem 返回 false');
  f.inventory.capacity += 5;
  ok(storeItem(f, { 名称: '测试物', 类型: '材料', 数量: 1, 描述: '' }) === true, '元断言：腾出空间后可正常入袋');
}

/* ============================================================
 * 二、逐个玩家动作：满仓 = 零代价
 * ============================================================ */

/* ---- 坊市购买材料（付灵石换物品） ---- */
{
  const st = freshGame('坊市满仓');
  storeItem(st, { 名称: '赤铜精', 类型: '材料', 数量: 1, 描述: '', 价值: 40 });
  fillBag(st);
  const before = snapshot(st);
  const goods = { 名称: '赤铜精', 类型: '材料', 数量: 1, 描述: '', 价值: 40, 价格: 120 };
  const res = S.buyItem(st, goods);
  ok(typeof res === 'string' && /空间不足/.test(res), '坊市满仓：明确返回「空间不足，交易未成」');
  assertNoWhiteLoss('坊市购买', st, before);
}

/* ---- 百艺炼器（付材料换装备） ---- */
{
  const st = freshGame('百艺满仓');
  storeItem(st, { 名称: '赤铜精', 类型: '材料', 数量: 1, 描述: '', 价值: 40 });
  storeItem(st, { 名称: '星砂', 类型: '材料', 数量: 1, 描述: '', 价值: 60 });
  fillBag(st);
  const before = snapshot(st);
  const recipe = ART_RECIPES.炼器.find((r) => r.id === '星纹剑');
  ok(!!recipe, '百艺满仓：取到炼器配方「星纹剑」');
  const res = craftRecipe(st, recipe);
  ok(res && res.ok === false, '百艺满仓：拒绝开工');
  ok((res.logs || []).some((l) => /空间不足/.test(l)), '百艺满仓：日志明示空间不足');
  assertNoWhiteLoss('百艺制作', st, before);
}

/* ---- 宗门兑换丹药（付贡献换丹药） ---- */
{
  const st = freshGame('兑换满仓');
  S.joinSect(st, '满仓宗');
  st.sect.contribution = 1000;
  fillBag(st);
  const before = snapshot(st);
  const res = S.sectExchange(st, 'ex_ningshen');
  ok(res && res.ok === false, '宗门兑换满仓：拒绝兑换');
  ok(typeof S.sectExchangeBlockReason(st, 'ex_ningshen') === 'string', '宗门兑换满仓：UI 与结算共用的阻塞原因非空');
  assertNoWhiteLoss('宗门兑换', st, before);
}

/* ---- 灵草杂交（付灵石 + 两份灵草产物换奇珍灵材） ---- */
{
  const st = freshGame('杂交满仓');
  storeItem(st, { 名称: '凝露草', 类型: '材料', 数量: 1, 描述: '', 价值: 40 });
  storeItem(st, { 名称: '火精枣', 类型: '材料', 数量: 1, 描述: '', 价值: 50 });
  fillBag(st);
  const before = snapshot(st);
  const res = crossbreedHerbs(st, '凝露草', '火精枣');
  ok(res && res.ok === false, '灵草杂交满仓：拒绝杂交');
  assertNoWhiteLoss('灵草杂交', st, before);
}

/* ---- 灵草收获（付出数月生长换产物） ---- */
{
  const st = freshGame('收获满仓');
  st.cave = st.cave || {};
  st.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 3, grow: 3, planted: 'x' }];
  fillBag(st);
  const before = snapshot(st);
  const res = harvestHerb(st, 0);
  ok(res && res.ok === false, '灵草收获满仓：拒绝收获');
  ok(st.cave.garden.length === 1, '灵草收获满仓：灵草仍留在灵田，未被销毁');
  assertNoWhiteLoss('灵草收获', st, before);
}

/* ---- 拍卖一口价（付灵石换拍品） ---- */
{
  const st = freshGame('拍卖满仓');
  S.openAuction(st);
  ok(Array.isArray(st.auction?.items) && st.auction.items.length > 0, '拍卖满仓：拍品已生成');
  // 装备/法宝/功法不占行囊格位，必须挑一件会占格的拍品，否则断言空转
  let idx = st.auction.items.findIndex((it) => !['装备', '法宝', '功法'].includes(it.type));
  if (idx < 0) {
    st.auction.items.push({ name: '测试拍品', type: '材料', basePrice: 100, currentBid: 100, bidder: '起拍价', buyout: 500, rivalBudget: 10, desc: '' });
    idx = st.auction.items.length - 1;
  }
  fillBag(st);
  const before = snapshot(st);
  const res = S.buyoutAuction(st, idx);
  ok(res && res.ok === false, '拍卖满仓：拒绝落槌');
  ok((res.logs || []).some((l) => /空间不足/.test(l)), '拍卖满仓：日志明示空间不足');
  assertNoWhiteLoss('拍卖一口价', st, before);
}

/* ---- 灵兽收服（付驭兽香 / 驯兽口粮换灵兽，栏满时不得消耗道具） ---- */
{
  const st = freshGame('收服满栏');
  storeItem(st, { 名称: '驭兽香', 类型: '道具', 数量: 1, 描述: '', 价值: 30 });
  storeItem(st, { 名称: '驯兽口粮', 类型: '材料', 数量: 1, 描述: '', 价值: 30 });
  ensureLifeState(st);
  // 灵兽栏填满（默认 1 格）
  st.beasts.slots = [{ name: '占位灵兽', power: 1, level: 1, tamed: true }];
  st.beasts.activeIdx = 0;
  ok(canTameBeast(st) === false, '收服满栏：满栏判定为不可再收服');
  const before = snapshot(st);
  const res = S.tameBeast(st, { name: '新灵兽', power: 5, minLevel: 1, desc: '测试' }, true);
  ok(res && res.ok === false, '收服满栏：拒绝收服');
  assertNoWhiteLoss('灵兽收服', st, before);
}

console.log(`\n===== 满仓静默丢失防线：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
