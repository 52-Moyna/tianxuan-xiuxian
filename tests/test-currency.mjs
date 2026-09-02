/**
 * 第 13 套：灵石分层消费口径
 *
 * 防线背景（2026-09-02 真实事故）：货币分 5 档、1:100 递进，收入侧会重新分档，
 * 于是「下品灵石」单档账面恒 < 100。而储物袋扩容（300+）、跨域旅行路费（80~180）、
 * 灵兽升星（200~3200）、引泉升级、玉髓芝/月华露藤播种（120/240）全都只检查并扣减
 * 「下品灵石」这一档 —— 玩家身家百万却处处判定「灵石不足」，这些玩法实质从未可用。
 *
 * 本套断言两件事：
 *   ① 所有消费入口必须按「总资产」判定并分层扣款（不看单档账面）；
 *   ② UI 的按钮可用性与结算口径必须一致（否则按钮灰着但点得动，或反之）。
 */
import * as S from '../public/js/systems.js';
import {
  ensureLifeState, upgradeBag, startTravel, travelCost, upgradeHerbSpring,
  plantHerb, crossbreedHerbs, lifeCanAfford, lifeSpendStones, lifeTotalStones,
  HERB_SPRING_COST_BASE, REGION_TRAVEL,
} from '../public/js/life.js';
import { CURRENCY_RATE, CURRENCIES, HERB_HYBRID_COST } from '../public/js/data.js';
import { claimAchievement, ensureAchievements, ACHIEVEMENTS } from '../public/js/codex.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? pass++ : (fail++, console.error('FAIL:', n)));

/** 构造「有钱但下品档很少」的典型中期玩家：10 万下品单位，自动分档到高位档。
 *  注意开局自带少量灵石，故总资产以 st.__base 为准做相对断言。 */
function richState() {
  const st = S.createNewGame({
    name: '分层测试', gender: '男', raceId: 'human', ageId: 'young',
    regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
  });
  ensureLifeState(st);
  S.addStones(st, 100000);
  st.__base = S.totalStones(st);
  return st;
}

/* ---------- 前提：分档后下品档必然很小（这正是事故温床） ---------- */
{
  const st = richState();
  ok(S.totalStones(st) >= 100000, '总资产达 10 万（下品单位）');
  ok((st.currencies['下品灵石'] || 0) < CURRENCY_RATE, '分档后下品档恒小于一档进制（事故前提成立）');
  ok((st.currencies['上品灵石'] || 0) >= 10, '资产主要体现在上品档');
}

/* ---------- ① 储物袋扩容 ---------- */
{
  const st = richState();
  const before = S.totalStones(st);
  const cap0 = st.inventory.capacity;
  const r = upgradeBag(st, 'storage');
  ok(r.ok === true, '持有中品灵石时储物袋扩容不再被「灵石不足」挡下');
  ok(st.inventory.capacity === cap0 + 20, '扩容后容量 +20');
  // 精确断言：扣款额 = 扩容前 (BASE + upgrades*STEP)
  ok(S.totalStones(st) === before - (300 + (st.inventory.upgrades - 1) * 250), '扣款额与扩容费公式一致');
  ok(Object.values(st.currencies).every((v) => v >= 0), '分档扣款后无负数档');
}

/* ---------- ② 跨域旅行路费 ---------- */
{
  const st = richState();
  const target = 'nanming';
  const quote = travelCost(st, target);
  const before = S.totalStones(st);
  const r = startTravel(st, target);
  ok(r.ok === true, '路费 80~180 也能从中品档支付（此前几乎必然失败）');
  ok(S.totalStones(st) === before - quote.cost, '路费扣款额与预览报价一致');
  ok(st.world.travel && st.world.travel.destination === target, '旅行状态已写入');
}

/* ---------- ③ 灵兽升星 ---------- */
{
  const st = richState();
  st.beasts = st.beasts || { slots: [], activeIdx: -1, maxSlots: 1 };
  st.beasts.slots = [{ name: '青风狼', element: '风', power: 100, star: 1, skill: '疾风' }];
  const before = S.totalStones(st);
  const r = S.upgradeBeast(st, 0);
  ok(r.ok === true, '灵兽升星（200 起）不再因单档账面不足而失败');
  ok(st.beasts.slots[0].star === 2, '星级已提升');
  ok(S.totalStones(st) === before - 200, '升星扣款 200 下品单位');
  ok(Object.values(st.currencies).every((v) => v >= 0), '升星后无负数档');
}

/* ---------- ④ 引泉升级 ---------- */
{
  const st = richState();
  st.cave = st.cave || {};
  st.cave.springLevel = 0;
  const before = S.totalStones(st);
  const r = upgradeHerbSpring(st);
  ok(r.ok === true, '引泉升级不再被单档账面挡下');
  ok(st.cave.springLevel === 1, '灵泉重数 +1');
  ok(S.totalStones(st) === before - HERB_SPRING_COST_BASE, '引泉扣款与公示成本一致');
}

/* ---------- ⑤ 高价灵草播种（玉髓芝 120 / 月华露藤 240） ---------- */
{
  const st = richState();
  st.cave = st.cave || {};
  const r1 = plantHerb(st, 'yushu');
  ok(r1.ok === true, '播种玉髓芝（120）成功 —— 此前单档判定必失败');
  const r2 = plantHerb(st, 'yuehua');
  ok(r2.ok === true, '播种月华露藤（240）成功');
}

/* ---------- ⑥ 灵草杂交 ---------- */
{
  const st = richState();
  st.items.push({ 名称: '凝露草', 类型: '材料', 数量: 2, 描述: '' });
  st.items.push({ 名称: '火精枣', 类型: '材料', 数量: 2, 描述: '' });
  const before = S.totalStones(st);
  const r = crossbreedHerbs(st, '凝露草', '火精枣');
  ok(r.ok === true, '灵草杂交扣款走分层口径');
  ok(S.totalStones(st) === before - HERB_HYBRID_COST, `杂交扣款 ${HERB_HYBRID_COST}`);
}

/* ---------- ⑦ 工具函数口径与 systems 完全一致 ---------- */
{
  const st = richState();
  ok(lifeTotalStones(st) === S.totalStones(st), 'life 折算与 systems.totalStones 同口径');
  ok(lifeCanAfford(st, 50000) === S.canAfford(st, 50000), 'lifeCanAfford 与 S.canAfford 判定一致');
  ok(lifeCanAfford(st, st.__base + 1) === false, '超出总资产仍判定不足');
  ok(lifeSpendStones(st, st.__base + 1) === false, '不足时拒绝扣款且不改账面');
  ok(S.totalStones(st) === st.__base, '拒绝扣款后总资产不变');
  lifeSpendStones(st, st.__base - 1);
  ok(S.totalStones(st) === 1, '大额扣款后剩余正确（跨档借位）');
  ok((st.currencies['下品灵石'] || 0) === 1, '借位后下品档正确');
  ok((st.currencies['中品灵石'] || 0) === 0, '借位后中品档清零');
}

/* ---------- ⑧ 收入侧同样分层（成就奖励发放后自动进位） ---------- */
{
  const st = richState();
  ensureAchievements(st);
  const big = ACHIEVEMENTS.find((a) => (a.reward?.stones || 0) >= CURRENCY_RATE);
  if (big) {
    st.achievements = [{ id: big.id, unlocked: true, claimed: false, ts: 0 }];
    const before = S.totalStones(st);
    claimAchievement(st, big.id);
    ok(S.totalStones(st) === before + big.reward.stones, '成就灵石奖励全额入账（分层发放不丢钱）');
    ok((st.currencies['下品灵石'] || 0) < CURRENCY_RATE, '奖励发放后账面自动进位（不出现巨额下品档）');
  } else {
    ok(true, '（无大额成就奖励，跳过发放进位断言）');
  }
}

/* ---------- ⑨ 结构防线：进制常量必须真实驱动折算（防止改成常量后实现仍硬编码） ---------- */
{
  ok(CURRENCY_RATE === 100, 'CURRENCY_RATE 为 100（1:100 进制）');
  ok(CURRENCIES.length >= 3, '货币至少三档');
  const st = richState();
  // 1 中品 应等于 CURRENCY_RATE 下品
  st.currencies = { 下品灵石: 0, 中品灵石: 1, 上品灵石: 0, 极品灵石: 0, 灵晶: 0 };
  ok(S.totalStones(st) === CURRENCY_RATE, '折算确实使用 CURRENCY_RATE 常量（改常量即改口径）');
}

console.log(`\n灵石分层消费：${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
