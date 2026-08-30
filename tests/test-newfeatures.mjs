import * as S from '../public/js/systems.js';
import { ensureLifeState, gardenCapacity, herbQuality, plantHerb, harvestHerb, harvestAllHerbs, irrigateHerb, crossbreedHerbs, findHerbHybrid, HERB_IRRIGATE_COST, HERB_IRRIGATE_CAP_PER_MONTH, herbSpringBonus, HERB_SPRING_LEVEL, HERB_IRRIGATE_YIELD_CAP, growHerbs, omenActive, omenMul, omenAdd, refinePill, settleRefine, decayPillToxicity, isRecipeUnlocked, alchemySlots, refineRate, storeItem, REGION_TRAVEL, beastLevelRange, beastPowerOfLevel, startTravel, travelOptions, ART_RECIPES, upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE } from '../public/js/life.js';
import { DIVINATION, PILL_RECIPES, HERB_HYBRIDS, HERB_HYBRID_COST, DESTINY_LINES } from '../public/js/data.js';
import { achievementView, checkAchievements, codexEntries, ownedEquipPower, activeSetBonuses, beastPowerBonus, ensureBeastState, availableMysticRealms, SECT_EXCHANGE, AUCTION_ITEMS_POOL, ACHIEVEMENTS, ACH_MILESTONE_IDS, ACH_BASE_TOTAL, claimAllAchievements } from '../public/js/codex.js';
import { serialize, deserialize } from '../public/js/save.js';

let pass = 0, fail = 0;
const ok = (c, n) => c ? pass++ : (fail++, console.error('FAIL:', n));

const state = S.createNewGame({
  name: '新功能测试', gender: '男', raceId: 'human', ageId: 'young',
  regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
});
ensureLifeState(state);

/* ---------- 封号系统 ---------- */
ok(Array.isArray(state.player.titles) && state.player.activeTitle === '', '封号状态初始化');
// 战力达 1000 自动授予「初露锋芒」
state.player.power = 1200;
const newTitles = S.checkTitles(state);
ok(newTitles.some((t) => t.id === 'chuji_fengmang'), '战力达标自动授予封号');
ok(state.player.titles.includes('chuji_fengmang'), '封号已写入 player.titles');
// 主动切换佩戴
const r = S.setActiveTitle(state, 'chuji_fengmang');
ok(r.ok && state.player.activeTitle === 'chuji_fengmang', '可切换佩戴封号');
ok(!S.setActiveTitle(state, 'not_exist').ok, '未拥有封号不可佩戴');
// 天命封号授予
S.awardTitle(state, 'xinghui_zhanxian', []);
ok(state.player.titles.includes('xinghui_zhanxian'), 'awardTitle 授予天命封号');

/* ---------- 成就进度可视化 ---------- */
checkAchievements(state);
const view = achievementView(state);
ok(Array.isArray(view) && view.length > 20, '成就视图列表生成');
const p1k = view.find((a) => a.id === 'power1k');
ok(p1k && p1k.progress && p1k.progress.cur === 1200 && p1k.progress.ratio >= 1 && p1k.unlocked, 'power1k 进度与解锁一致');
const codexView = view.find((a) => a.id === 'codex100');
ok(codexView && codexView.progress && codexView.progress.max === 100, '图鉴百卷进度上限正确');

/* ---------- 秘境分层探索 ---------- */
state.player.level = 30; // 满足 qingxu 秘境 15 级门槛
// 用固定种子无法控制，但可验证 depth 形参与不崩溃、深度越大平均产出越高（多跑取期望）
let sum1 = 0, sum3 = 0, runs = 40;
for (let i = 0; i < runs; i++) {
  const s1 = JSON.parse(JSON.stringify(state)); s1.flags = {};
  S.exploreMysticRealm(s1, 'qingxu', 1);
  const s3 = JSON.parse(JSON.stringify(state)); s3.flags = {};
  S.exploreMysticRealm(s3, 'qingxu', 3);
  sum1 += S.totalStones(s1); sum3 += S.totalStones(s3);
}
ok(sum3 > sum1, '秘境深处灵石期望高于外围');
// 满层探索授予「古迹探寻」封号
const sDeep = JSON.parse(JSON.stringify(state)); sDeep.flags = {}; sDeep.player.level = 30;
for (let i = 0; i < 6; i++) { const ss = JSON.parse(JSON.stringify(sDeep)); ss.flags = { mysticDeepest: 0 }; S.exploreMysticRealm(ss, 'qingxu', 3); S.checkTitles(ss); }
// 直接校验 checkTitles 对 mysticDeepest 的判定
state.flags.mysticDeepest = 3;
S.checkTitles(state);
ok(state.player.titles.includes('guji_tanxun'), '满层探索授予古迹探寻封号');

/* ---------- 拍卖竞拍增强 ---------- */
state.currencies['下品灵石'] = 100000;
const items = S.openAuction(state);
ok(items.length >= 3 && items.every((it) => it.buyout > it.currentBid && it.rivalBudget > it.currentBid), '拍卖生成一口价与对手预算');
// 一口价必定落槌（在 placeBid 之前测，避免索引错位）
const initLen = state.auction.items.length;
const boRes = S.buyoutAuction(state, 0);
ok(boRes.ok && state.auction.items.length === initLen - 1, '一口价直接拿下并移除拍品');
// 再次开拍，测试竞价结构化返回与流拍
S.openAuction(state);
const first = state.auction.items[0];
const smallBid = first.currentBid + 10;
const bidRes = S.placeBid(state, 0, smallBid);
// 被反超（ok:false）或直接落槌（ok:true）——两种均合法，结构正确即可
ok(typeof bidRes.ok === 'boolean', '竞价返回结构化结果');
const before = state.auction.items.length;
const wRes = S.withdrawAuctionItem(state, 0);
ok(wRes.ok && state.auction.items.length === before - 1, '放弃拍品即流拍');

/* ---------- 奇遇事件扩充（新 effect 不崩溃） ---------- */
const newEffects = ['relic', 'vein', 'veinDao', 'flee', 'help', 'ignore', 'fox', 'foxLeave', 'leave'];
let evtErr = null;
try {
  for (const ef of newEffects) {
    const st = JSON.parse(JSON.stringify(state)); st.flags = {}; st.player.level = 40;
    st.currencies['下品灵石'] = 5000; st.items = [];
    const evt = { name: '测试事件', desc: 'x', options: [{ text: 'a', effect: ef }] };
    S.resolveSpecialEvent(st, evt, 0);
  }
} catch (e) { evtErr = e; }
ok(!evtErr, '新增奇遇事件 resolve 不抛错' + (evtErr ? '：' + evtErr.message : ''));

/* ---------- 存档往返：封号 + 秘境最深 ---------- */
state.flags.mysticDeepest = 3;
const files = serialize(state);
const restored = deserialize(files);
ok(Array.isArray(restored.player.titles) && restored.player.titles.includes('chuji_fengmang'), '封号存档往返');
ok(restored.player.activeTitle === 'chuji_fengmang', '佩戴封号存档往返');
ok(restored.flags.mysticDeepest === 3, '秘境最深标记存档往返');

/* ---------- 图鉴真实战力 ---------- */
state.items.push({ 名称: '测试剑·甲', 类型: '装备', 数量: 1, _equip: { 战力: 777 } });
ok(ownedEquipPower(state, '测试剑·甲') === 777, 'ownedEquipPower 读取持有装备真实战力');
const ceAll = codexEntries(state, '全部');
ok(Array.isArray(ceAll) && ceAll.every((e) => 'realPower' in e), 'codexEntries 每项含真实战力字段');
const ceEquip = codexEntries(state, '装备');
ok(ceEquip.every((e) => e.realPower === null || typeof e.realPower === 'number'), '装备类真实战力为数值或空');

/* ---------- 批量炼丹 ---------- */
state.items = state.items.filter((it) => !['百越灵草', '海灵珠', '聚气丹'].includes(it.名称));
state.items.push({ 名称: '百越灵草', 类型: '材料', 数量: 30, 描述: '', 价值: 60 });
state.items.push({ 名称: '海灵珠', 类型: '材料', 数量: 30, 描述: '', 价值: 150 });
const qiBefore = state.items.find((i) => i.名称 === '聚气丹')?.数量 || 0;
S.practiceArt(state, '炼丹', '聚气丹', undefined, 10);
const qiAfter = state.items.find((i) => i.名称 === '聚气丹')?.数量 || 0;
ok(qiAfter - qiBefore === 20, '批量×10 炼丹产出 20 枚聚气丹（基础 2×10）');
ok(state.items.find((i) => i.名称 === '百越灵草')?.数量 === 20 && state.items.find((i) => i.名称 === '海灵珠')?.数量 === 20, '批量炼丹按 10 倍消耗材料（30→20）');
// 材料不足时拒绝：把百越灵草降到不足 10
state.items = state.items.filter((i) => i.名称 !== '百越灵草');
state.items.push({ 名称: '百越灵草', 类型: '材料', 数量: 3, 描述: '', 价值: 60 });
const r2 = S.practiceArt(state, '炼丹', '聚气丹', undefined, 10);
ok(Array.isArray(r2) && r2.some((l) => l.includes('材料不足')), '材料不足时批量炼丹被拒绝');

/* ---------- 灵兽出战 ---------- */
state.beasts = { slots: [{ name: '青风狼', element: '风', power: 8, skill: '风刃突袭', desc: 'x', minLevel: 5, tamed: true }], maxSlots: 3, tamedCount: 1, activeIdx: -1 };
const sa = S.setActiveBeast(state, 0);
ok(sa.ok && state.beasts.activeIdx === 0, '可指定出战灵兽');
const enemy = { name: '试炼傀儡', power: 10, level: 1, beast: false };
const rep = S.resolveBattle(state, enemy, 'yaoshou', false);
ok(rep.logs.some((l) => l.includes('出战灵兽')), '出战灵兽在战斗中提供额外护主加成');
const sa2 = S.setActiveBeast(state, -1);
ok(sa2.ok && state.beasts.activeIdx === -1, '可收回出战灵兽');
// 出战索引存档往返
state.beasts.activeIdx = 0;
const bFiles = serialize(state);
const bRest = deserialize(bFiles);
ok(bRest.beasts.activeIdx === 0, '出战灵兽索引存档往返');

/* ---------- 套装误激活修复 ---------- */
state.equipment = state.equipment || {};
state.equipment.accessory = { 名称: '妖纹护腕', 类型: '装备', 战力: 5 };
state.equipment.weapon = { 名称: '赤手空拳', 类型: '装备', 战力: 0 };
state.equipment.stash = [];
state.items = [{ 名称: '青风狼内丹', 类型: '材料', 数量: 1 }];
ok(!activeSetBonuses(state).some((s) => s.name === '妖纹'), '材料不应误激活妖纹套装');
state.equipment.weapon = { 名称: '青风剑', 类型: '装备', 战力: 5 };
ok(activeSetBonuses(state).some((s) => s.name === '妖纹'), '集齐两件装备时正常激活妖纹套装');

/* ---------- 灵兽升星 ---------- */
ensureBeastState(state);
state.currencies = state.currencies || {};
state.currencies['下品灵石'] = 100000;
state.beasts.slots = [{ name: '测试灵兽', element: '火', power: 100, skill: '吐息', desc: '测试', star: 1, tamed: true }];
ok(beastPowerBonus(state) === 100, '升星前灵兽战力为100');
const up1 = S.upgradeBeast(state, 0);
ok(up1.ok && state.beasts.slots[0].star === 2 && state.beasts.slots[0].power === 120, '一星升二星：战力×1.2=120');
ok(beastPowerBonus(state) === 120, '升星后战力计入战力面板');
// 一路升到五星（共 4 次），验证封顶
for (let k = 0; k < 3; k++) S.upgradeBeast(state, 0);
ok(state.beasts.slots[0].star === 5, '连续升星封顶为五星');
const upMax = S.upgradeBeast(state, 0);
ok(!upMax.ok, '满星后不可再升');
// 灵石不足拒绝
state.beasts.slots.push({ name: '穷灵兽', element: '水', power: 50, skill: '水弹', desc: '测试', star: 1, tamed: true });
state.currencies['下品灵石'] = 0;
const upPoor = S.upgradeBeast(state, state.beasts.slots.length - 1);
ok(!upPoor.ok && state.beasts.slots[state.beasts.slots.length - 1].star === 1, '灵石不足时拒绝升星');

/* ---------- 宗门俸禄系统（修复 monthlyStipend 死字段） ---------- */
{
  const s2 = S.createNewGame({ name: '俸禄测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s2);
  ok(s2.sect.stipend === 0 && s2.sect.claimedYear === 0, '入宗前俸禄字段规范初始化');
  S.joinSect(s2, '测试宗门');
  ok(s2.sect.rank === 1 && s2.sect.name === '测试宗门', '加入宗门晋升外门弟子');
  const s3 = S.createNewGame({ name: '无宗', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s3);
  ok(!S.claimSectStipend(s3).ok, '未入宗不可领俸禄');
  for (let i = 0; i < 3; i++) S.nextMonth(s2);
  ok(s2.sect.stipend === 150, `每月累积俸禄 50×3=150（实际 ${s2.sect.stipend}）`);
  const before = s2.currencies['下品灵石'];
  const claim = S.claimSectStipend(s2);
  ok(claim.ok && s2.currencies['下品灵石'] === before + 150 && s2.sect.stipend === 0, '领取俸禄入账并清零');
  ok(!S.claimSectStipend(s2).ok, '无待领俸禄时拒绝重复领取');
  let guard = 0;
  while (s2.sect.rank < 2 && guard++ < 30) S.doSectTask(s2, 'escort');
  ok(s2.sect.rank >= 2, '贡献达标自动晋升职级');
  S.nextMonth(s2);
  ok(s2.sect.stipend === 120, `晋升后俸禄单价变为 120（实际 ${s2.sect.stipend}）`);
  const re = deserialize(serialize(s2));
  ok(re.sect.stipend === s2.sect.stipend && re.sect.rank === s2.sect.rank, '宗门俸禄存读档持久化');
}

/* ---------- 宗门兑换所（贡献主动消耗） ---------- */
{
  const s4 = S.createNewGame({ name: '兑换测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s4);
  ok(!S.sectExchange(s4, 'ex_stones').ok, '未入宗不可兑换');
  S.joinSect(s4, '兑换宗门');
  s4.sect.contribution = 1000;
  const stonesBefore = S.totalStones(s4);
  const cBefore = s4.sect.contribution;
  const r1 = S.sectExchange(s4, 'ex_stones');
  ok(r1.ok && S.totalStones(s4) === stonesBefore + 600 && s4.sect.contribution === cBefore - 100, '兑换灵石：扣贡献 100、入账 600 灵石');
  const r2 = S.sectExchange(s4, 'ex_ningshen');
  ok(r2.ok && s4.sect.contribution === cBefore - 100 - 240, '兑换凝神丹：扣贡献 240');
  ok(s4.items.some((i) => i.名称 === '凝神丹' && (i.数量 || 0) >= 1), '兑换凝神丹：丹药已入行囊');
  // 贡献不足时拒绝且不扣减
  const s5 = S.createNewGame({ name: '穷宗', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s5);
  S.joinSect(s5, '穷宗');
  s5.sect.contribution = 50;
  ok(!S.sectExchange(s5, 'ex_ningshen').ok && s5.sect.contribution === 50, '贡献不足时拒绝兑换且不扣减');
  // 服用兑换所得凝神丹：悟性经验 +120（确定性，无 RNG）
  const idx = s4.items.findIndex((i) => i.名称 === '凝神丹');
  const wuxBefore = s4.player.daoBase['悟性'].exp;
  const useLogs = S.useItem(s4, idx);
  ok(useLogs && (useLogs.some((l) => /悟性经验\+120/.test(l)) || s4.player.daoBase['悟性'].exp > wuxBefore), '服用兑换凝神丹：悟性经验增加');
  ok(SECT_EXCHANGE.some((e) => e.id === 'ex_ningshen'), 'SECT_EXCHANGE 含凝神丹条目');
}

/* ---------- 出战灵兽星级加成战斗胜率 ---------- */
{
  const bt = S.createNewGame({
    name: '战斗测试', gender: '男', raceId: 'human', ageId: 'young',
    regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
  });
  ensureLifeState(bt);
  const beasts = ensureBeastState(bt);
  beasts.slots = [
    { name: '幼麟', element: '火', star: 1, power: 10, skill: 'x', desc: 'x' },
    { name: '麒皇', element: '雷', star: 5, power: 10, skill: 'x', desc: 'x' },
  ];
  beasts.activeIdx = -1;
  ok(S.activeBeastBonus(bt) === 0, '未出战时加成 0');
  beasts.activeIdx = 0;
  ok(S.activeBeastBonus(bt) === 2, '1★出战加成 +2%');
  beasts.activeIdx = 1;
  ok(S.activeBeastBonus(bt) === 10, '5★出战加成 +10%');

  // 同阶同战力：基础胜率 95、不掷命运骰子；每次出战前重置属性，规避战后 refreshDerived 改动，稳定验证「出战加成」写入战报
  const enemy = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  const fire = (activeIdx) => { beasts.activeIdx = activeIdx; bt.player.level = 10; bt.player.power = 500; return S.resolveBattle(bt, enemy, 'shengci'); };
  const r0 = fire(-1);
  const r1 = fire(0);
  const r5 = fire(1);
  ok(r0.logs.every((l) => !l.includes('冲锋在前')), '无出战灵兽时不出现护主语录');
  ok(r1.logs.some((l) => l.includes('胜率 +2%')), '1★出战在战报中体现 +2%');
  ok(r5.logs.some((l) => l.includes('胜率 +10%')), '5★出战在战报中体现 +10%');
  ok(r5.finalRate <= 95, '胜率封顶 95%');
}

/* ---------- 战前胜率预估（previewBattle，不修改状态） ---------- */
{
  const bt = S.createNewGame({
    name: '预估测试', gender: '男', raceId: 'human', ageId: 'young',
    regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
  });
  ensureLifeState(bt);
  const beasts = ensureBeastState(bt);
  beasts.slots = [{ name: '幼麟', element: '火', star: 5, power: 10, skill: 'x', desc: 'x' }];
  beasts.activeIdx = 0;
  bt.player.level = 10; bt.player.power = 500;
  const enemy = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  const before = bt.player.power;
  const pv = S.previewBattle(bt, enemy, 'shengci');
  ok(bt.player.power === before, 'previewBattle 不修改玩家状态');
  ok(pv.finalRate >= 95, `预估胜率含出战 5★ 加成并封顶（实测 ${pv.finalRate}）`);
  const rep = S.resolveBattle(bt, enemy, 'shengci'); // 同阶同战力无命运骰子，预估应与实战一致
  ok(rep.finalRate === pv.finalRate, `预估与实战胜率一致（预估 ${pv.finalRate} / 实战 ${rep.finalRate}）`);
  beasts.activeIdx = -1;
  const pv2 = S.previewBattle(bt, enemy, 'shengci');
  ok(pv2.finalRate < pv.finalRate, '收回出战后预估胜率下降');
}

/* ---------- 战斗战术：强攻 / 稳守 ---------- */
{
  const mk = () => {
    const g = S.createNewGame({ name: '战术测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g); return g;
  };
  // 同阶略弱：基础胜率 35（previewBattle 不含命运骰子，可稳定验证 ±幅度）
  const g0 = mk(); g0.player.level = 10; g0.player.power = 480;
  const en = { name: '傀儡', realm: '练气', level: 10, power: 500 };
  const pvN = S.previewBattle(g0, en, 'shengci', 'normal').finalRate;
  const pvA = S.previewBattle(g0, en, 'shengci', 'aggro').finalRate;
  const pvD = S.previewBattle(g0, en, 'shengci', 'defend').finalRate;
  ok(pvN === 35, `同阶略弱基础胜率 35（实测 ${pvN}）`);
  ok(pvA === 43, `强攻 +8% → 43（实测 ${pvA}）`);
  ok(pvD === 30, `稳守 -5% → 30（实测 ${pvD}）`);
  // 败则惩罚缩放：以碾压级妖兽循环至落败，对比伤势（稳守轻伤）
  const runLoss = (tactic) => {
    for (let i = 0; i < 120; i++) {
      const g = mk(); g.player.level = 10; g.player.power = 10;
      const e = { name: '太古凶兽', realm: '化神', level: 60, power: 999999, beast: true };
      if (!S.resolveBattle(g, e, 'yaoshou', false, tactic).win) return g.flags.wounded;
    }
    return -1;
  };
  const wN = runLoss('normal'), wA = runLoss('aggro'), wD = runLoss('defend');
  ok(wN === 2 && wA === 2 && wD === 1, `稳守落败伤势更轻（寻常${wN}/强攻${wA}/稳守${wD}）`);
}

/* ---------- R6：天命加持（耗灵石换胜率） ---------- */
{
  const mk = () => {
    const g = S.createNewGame({ name: '天命测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.currencies = g.currencies || {};
    g.currencies['下品灵石'] = 500;
    g.player.level = 10; g.player.power = 500;
    return g;
  };
  const enemy = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  const pv0 = S.previewBattle(mk(), enemy, 'shengci', 'normal', false).finalRate;
  const pv1 = S.previewBattle(mk(), enemy, 'shengci', 'normal', true).finalRate;
  ok(pv1 === Math.min(95, pv0 + 10), `天命加持使预估胜率 +10%（${pv0}→${pv1}）`);
  const g1 = mk();
  const before = S.totalStones(g1);
  // 用 qiecuo（切磋）：胜败均不增减灵石，故唯一灵石变动即天命加持 -50，结论与掷骰无关
  const rep = S.resolveBattle(g1, enemy, 'qiecuo', false, 'normal', true);
  ok(S.totalStones(g1) === before - 50, '天命加持消耗 50 灵石（总量守恒，按阶重分）');
  ok(rep.logs.some((l) => l.includes('天命加持')), '战报含天命加持文案');
  // 灵石不足：刻意置总量为 10（清空各阶后仅留下品 10）
  const g2 = mk(); g2.currencies = { '下品灵石': 10, '中品灵石': 0, '上品灵石': 0 };
  const before2 = S.totalStones(g2);
  const rep2 = S.resolveBattle(g2, enemy, 'qiecuo', false, 'normal', true);
  ok(S.totalStones(g2) === before2, '灵石不足时天命加持不扣灵石');
  ok(rep2.logs.some((l) => l.includes('灵石不足')), '灵石不足提示正确');
}

/* ---------- R7：道友援护（心腹/道侣级临阵相助） ---------- */
{
  const mk = (pw) => {
    const g = S.createNewGame({ name: '援护测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.player.level = 10; g.player.power = pw;
    g.npcs = [{ name: '义兄', relation: 4, relationName: '心腹', favor: 90, met: true, gender: '男', race: '人', realm: '练气', job: '侠客', trait: '忠义', level: 10 }];
    return g;
  };
  const en = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  let aided = false;
  for (let i = 0; i < 50 && !aided; i++) {
    if (S.resolveBattle(mk(500), en, 'shengci', false, 'normal', false).logs.some((l) => l.includes('仗义援手'))) aided = true;
  }
  ok(aided, '心腹级道友有概率临阵援护（50次内触发）');
  const beast = { name: '太古凶兽', realm: '化神', level: 60, power: 999999, beast: true };
  let prot = false;
  for (let i = 0; i < 80 && !prot; i++) {
    const g = mk(100);
    const r = S.resolveBattle(g, beast, 'yaoshou', false, 'normal', false);
    if (r.logs.some((l) => l.includes('仗义援手')) && !r.win) prot = (g.flags.wounded <= 1);
  }
  ok(prot, '道友援护下败北仍获庇护（伤势≤1）');
}

/* ---------- R10：战前胜率明细（breakdown 准确 + 天命开关联动预估） ---------- */
{
  const g = S.createNewGame({ name: '明细测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.player.level = 10; g.player.power = 500;
  g.currencies = { '下品灵石': 500, '中品灵石': 0, '上品灵石': 0 };
  const en = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  const pv = S.previewBattle(g, en, 'shengci', 'normal', false);
  const bd = pv.breakdown;
  const sum = bd.base + bd.ally + bd.beasts + bd.activeBeast + bd.toxic + bd.wound + bd.tactic + bd.blessed;
  ok(sum === pv.finalRate, `胜率明细各项之和=预估胜率（${sum} vs ${pv.finalRate}）`);
  // 天命开关联动预估（修复：切换 blessed 时预估胜率应变化）
  const pvNo = S.previewBattle(g, en, 'shengci', 'normal', false).finalRate;
  const pvYes = S.previewBattle(g, en, 'shengci', 'normal', true).finalRate;
  ok(pvYes === Math.min(95, pvNo + 10), `天命加持开关联动预估胜率（${pvNo}→${pvYes}）`);
  // 战术联动预估
  const pvAggro = S.previewBattle(g, en, 'shengci', 'aggro', false).finalRate;
  ok(pvAggro === Math.min(95, pvNo + 8), `强攻战术联动预估胜率（${pvNo}→${pvAggro}）`);
  // 空 breakdown 防御
  const pvFlee = S.previewBattle(g, en, 'fled', 'normal', false);
  ok(pvFlee.breakdown && Object.keys(pvFlee.breakdown).length === 0, 'fled 返回空明细防御');
}


/* ---------- 道缘深度互动（深谈 · 职业专属支线） ---------- */
{
  const g = S.createNewGame({ name: '深谈测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  const npc = g.npcs[0];
  // 关系不足：深谈应被拦截且不影响好感
  npc.relation = 0; npc.relationName = '陌路'; npc.favor = 20;
  const blocked = S.interactNpc(g, npc, 'deep');
  ok(Array.isArray(blocked) && blocked.some((l) => l.includes('尚不够熟稔')), '关系不足时深谈被拦截');
  ok(npc.favor === 20, '关系不足时好感不变');
  // 关系达标：深谈触发专属支线 + 更高好感收益
  npc.relation = 3; npc.relationName = '道友'; npc.favor = 70;
  const before = npc.favor;
  const deep = S.interactNpc(g, npc, 'deep');
  ok(Array.isArray(deep), '深谈返回 logs（非战斗对象）');
  ok(npc.favor > before, `深谈提升好感（${before}→${npc.favor}）`);
  ok(deep.some((l) => l.includes('心事')), '深谈触发职业专属支线文案');
  ok(deep.some((l) => l.includes('秉烛夜话')), '深谈主文案出现');
}


/* ---------- 战力平衡复核（calcWinRate 单调性与区间） ---------- */
{
  const g = S.createNewGame({ name: '平衡测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  // 同级（diff<=5）：战力不低于敌方 → 95
  g.player.level = 10; g.player.power = 800;
  ok(S.calcWinRate(g, 800, 10).rate === 95, '同级且战力持平→胜率95');
  // 同级但战力低于敌方 → 50 + (差)*2，下限 35
  const low = S.calcWinRate(g, 900, 10).rate;
  ok(low >= 35 && low <= 50, `同级战力劣势胜率落于[35,50]（${low}）`);
  // 单调性：固定敌方战力，玩家战力越高胜率不降
  let prev = -1, mono = true;
  for (let pw = 600; pw <= 1200; pw += 100) {
    const rr = S.calcWinRate({ ...g, player: { ...g.player, power: pw } }, 800, 10).rate;
    if (rr < prev) mono = false; prev = rr;
  }
  ok(mono, '玩家战力提升→胜率单调不降');
  // 越级（diff>5）：下限不低于 5
  const cross = S.calcWinRate(g, 2000, 40).rate;
  ok(cross >= 5 && cross <= 95, `越级胜率落于[5,95]（${cross}）`);
}

/* ---------- 外出历练数值重铸（地域危险度 → 妖兽等级脱钩玩家战力） ---------- */
{
  // 1) 妖兽等级由地域危险度决定，且各 danger 组的下界最小值随 danger 严格递增（确定性）
  const ranges = {};
  for (const rid of Object.keys(REGION_TRAVEL)) ranges[rid] = beastLevelRange(rid, false);
  const byDanger = {};
  for (const [rid, r] of Object.entries(ranges)) {
    const d = REGION_TRAVEL[rid].danger;
    (byDanger[d] = byDanger[d] || []).push(r.min);
  }
  const dKeys = Object.keys(byDanger).map(Number).sort((a, b) => a - b);
  let inc = true;
  for (let i = 1; i < dKeys.length; i++) {
    if (Math.min(...byDanger[dKeys[i]]) <= Math.min(...byDanger[dKeys[i - 1]])) inc = false;
  }
  ok(inc, '妖兽等级下界随地域危险度严格递增');
  ok(ranges['haiwai'].min > ranges['zhongzhou'].max, '最高危区妖兽等级下界高于最低危区上界');

  // 2) 低境界玩家进入高危险度区域胜率 < 20%
  const weak = S.createNewGame({ name: '弱修', gender: '男', raceId: 'human', ageId: 'young', regionId: 'haiwai', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  weak.player.level = 5; weak.player.power = S.calcPower(weak);
  const pvWeak = S.previewBattle(weak, S.makeEnemy(weak, { beast: true }), 'yaoshou').finalRate;
  ok(pvWeak < 20, `低境界(level5)入高危区(haiwai)预估胜率<20%（${pvWeak}）`);

  // 3) 高境界玩家进入低危险度区域胜率 > 80%
  const strong = S.createNewGame({ name: '强修', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  strong.player.level = 85; strong.player.power = Math.max(S.calcPower(strong), 3000);
  const pvStrong = S.previewBattle(strong, S.makeEnemy(strong, { beast: true }), 'yaoshou').finalRate;
  ok(pvStrong > 80, `高境界(level85)入低危区(zhongzhou)预估胜率>80%（${pvStrong}）`);

  // 4) 妖兽等级落在地域区间内（多次生成）
  const mid = S.createNewGame({ name: '中修', gender: '男', raceId: 'human', ageId: 'young', regionId: 'donghuang', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  const rng = beastLevelRange('donghuang', false);
  let inRange = true;
  for (let i = 0; i < 30; i++) {
    const e = S.makeEnemy(mid, { beast: true });
    if (e.level < rng.min || e.level > rng.max) { inRange = false; break; }
  }
  ok(inRange, `妖兽等级落在地域区间[${rng.min},${rng.max}]内`);

  // 5) 危险区掉落更丰（同等级妖兽，内丹价值随 danger 递增，确定性）
  const loDrop = S.generateBeastDrops(weak, { name: '试', level: 10, danger: 2, beast: true });
  const hiDrop = S.generateBeastDrops(strong, { name: '试', level: 10, danger: 5, beast: true });
  const loNei = loDrop.find((d) => d.名称.endsWith('内丹'))?.价值 || 0;
  const hiNei = hiDrop.find((d) => d.名称.endsWith('内丹'))?.价值 || 0;
  ok(hiNei > loNei, `高危区妖兽内丹价值更高（d5=${hiNei} > d2=${loNei}）`);

  // 6) 危险区失败惩罚更重（纯函数，确定性）
  const p2 = S.beastDefeatPenalty(2, {});
  const p5 = S.beastDefeatPenalty(5, {});
  ok(p5.wounded > p2.wounded, `危险区失败伤势更重（d5=${p5.wounded} > d2=${p2.wounded}）`);
  ok(p5.loseStones > 0 && p2.loseStones === 0, '危险区(d>=4)失败额外被劫灵石');
}

/* ---------- 灵草园·灵泉浇灌 + 收获安全 ---------- */
{
  const g = S.createNewGame({ name: '灵草园测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.cave = g.cave || {};
  g.cave.garden = [];
  g.currencies = g.currencies || {};
  g.currencies['下品灵石'] = 1000;
  const plant = plantHerb(g, 'yushu');
  ok(plant.ok && g.cave.garden.length === 1, '播种灵草成功且占用一格');
  ok(g.cave.garden[0].progress === 0 && g.cave.garden[0].grow === 7, '灵草初始进度为0、生长周期7月');
  const before = g.currencies['下品灵石'];
  const ir = irrigateHerb(g, 0);
  ok(ir.ok && g.cave.garden[0].progress === 1, '灵泉浇灌使进度+1');
  ok(g.currencies['下品灵石'] === before - HERB_IRRIGATE_COST, '浇灌扣除对应灵石');
  g.cave.garden[0].progress = g.cave.garden[0].grow;
  ok(!irrigateHerb(g, 0).ok, '已成熟灵草拒绝浇灌');
  g.cave.garden[0].progress = 1;
  g.currencies['下品灵石'] = 0;
  ok(!irrigateHerb(g, 0).ok, '灵石不足拒绝浇灌且不抛错');
  g.cave.garden = [{ id: '不存在的草', name: '幻草', progress: 5, grow: 5, planted: 'x' }];
  const hr = harvestHerb(g, 0);
  ok(hr && typeof hr.ok === 'boolean', '收获未知灵种返回结构化结果不崩溃');
  g.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 3, grow: 3, planted: 'x' }];
  g.currencies['下品灵石'] = 1000;
  const hr2 = harvestHerb(g, 0);
  ok(hr2.ok && g.cave.garden.length === 0, '收获成熟灵草后成功移除');
  ok(g.items.some((it) => it.名称 === '凝露草'), '收获产物（凝露草）已入储物袋');
}

/* ---------- 灵田品质系统：洞府等级联动灵草园容量与收获产量 ---------- */
{
  const base = S.createNewGame({ name: '灵田品质', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(base);
  base.cave = base.cave || {};
  // 容量：基础 4，每级 +1，封顶 +4（上限 8）
  base.cave.level = 0; ok(gardenCapacity(base) === 4, 'Lv.0 灵草园容量=4');
  base.cave.level = 2; ok(gardenCapacity(base) === 6, 'Lv.2 灵草园容量=6');
  base.cave.level = 4; ok(gardenCapacity(base) === 8, 'Lv.4 灵草园容量=8');
  base.cave.level = 8; ok(gardenCapacity(base) === 8, 'Lv.8 灵草园容量封顶=8');
  // 品质：确定性分层
  base.cave.level = 0; ok(herbQuality(base).tier === '下品' && herbQuality(base).mul === 1.0, 'Lv.0 下品·倍率1.0');
  base.cave.level = 2; ok(herbQuality(base).tier === '中品' && herbQuality(base).mul === 1.25, 'Lv.2 中品·倍率1.25');
  base.cave.level = 4; ok(herbQuality(base).tier === '上品' && herbQuality(base).mul === 1.5, 'Lv.4 上品·倍率1.5');
  base.cave.level = 6; ok(herbQuality(base).tier === '极品' && herbQuality(base).mul === 2.0, 'Lv.6 极品·倍率2.0');
  base.cave.level = 8; ok(herbQuality(base).tier === '仙品' && herbQuality(base).mul === 2.5, 'Lv.8 仙品·倍率2.5');
  // 收获产量随品质提升（lingcao 基础产出 2）
  function harvestQtyAt(level) {
    const g = S.createNewGame({ name: 'hq', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g); g.cave.level = level; g.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 3, grow: 3, planted: 'x' }];
    g.currencies = g.currencies || {}; g.currencies['下品灵石'] = 1000;
    const before = g.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);
    harvestHerb(g, 0);
    const after = g.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);
    return after - before;
  }
  ok(harvestQtyAt(0) === 2, 'Lv.0 收获凝露草×2（下品）');
  ok(harvestQtyAt(2) === 3, 'Lv.2 收获凝露草×3（中品·+1）');
  ok(harvestQtyAt(4) === 3, 'Lv.4 收获凝露草×3（上品·2×1.5=3）');
  ok(harvestQtyAt(8) === 5, 'Lv.8 收获凝露草×5（仙品·2×2.5=5）');
  // 播种容量联动 gardenCapacity（Lv.0 满 4 拒第 5 株）
  const g0 = S.createNewGame({ name: 'cap0', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g0); g0.cave.level = 0; g0.cave.garden = []; g0.currencies = g0.currencies || {}; g0.currencies['下品灵石'] = 99999;
  let planted = 0; for (let i = 0; i < 5; i++) { if (plantHerb(g0, 'lingcao').ok) planted++; }
  ok(planted === 4 && g0.cave.garden.length === 4, 'Lv.0 最多播种 4 株，第 5 株被拒');
  // Lv.8 可播 8 株
  const g8 = S.createNewGame({ name: 'cap8', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g8); g8.cave.level = 8; g8.cave.garden = []; g8.currencies = g8.currencies || {}; g8.currencies['下品灵石'] = 99999;
  let p8 = 0; for (let i = 0; i < 9; i++) { if (plantHerb(g8, 'lingcao').ok) p8++; }
  ok(p8 === 8 && g8.cave.garden.length === 8, 'Lv.8 最多播种 8 株，第 9 株被拒');
}

/* ---------- 灵泉浇灌提升收获产量（加速 + 累计浸润增产，封顶） ---------- */
{
  ok(typeof HERB_IRRIGATE_YIELD_CAP === 'number' && HERB_IRRIGATE_YIELD_CAP === 3, '浇灌增产上限常量为 3');
  function yieldOf(level, irrigated) {
    const g = S.createNewGame({ name: 'irr', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g); g.cave.level = level; g.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 3, grow: 3, planted: 'x', irrigated: irrigated }];
    g.currencies = g.currencies || {}; g.currencies['下品灵石'] = 1000;
    const before = g.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);
    harvestHerb(g, 0);
    const after = g.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);
    return after - before;
  }
  ok(yieldOf(0, 0) === 2, '无浇灌 Lv.0 收获凝露草×2（与旧逻辑一致）');
  ok(yieldOf(0, 2) === 4, 'Lv.0 + 浸润2次 → 凝露草×4（2+2）');
  ok(yieldOf(0, 3) === 5, 'Lv.0 + 浸润3次 → 凝露草×5（2+3，达上限）');
  ok(yieldOf(0, 99) === 5, 'Lv.0 + 浸润99次 → 仍封顶 ×5（2+3）');
  ok(yieldOf(8, 2) === 7, 'Lv.8 仙品×5 + 浸润2 → ×7（品质与浸润叠加）');
  const g2 = S.createNewGame({ name: 'irr2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g2); g2.cave.level = 0; g2.cave.garden = []; g2.currencies = g2.currencies || {}; g2.currencies['下品灵石'] = 99999;
  const pr = plantHerb(g2, 'lingcao'); ok(pr.ok && g2.cave.garden[0].irrigated === 0, '播种后浸润计数初始化为 0');
  ok(irrigateHerb(g2, 0).ok && g2.cave.garden[0].irrigated === 1, '首次浇灌浸润计数=1');
  ok(irrigateHerb(g2, 0).ok && g2.cave.garden[0].irrigated === 2, '二次浇灌浸润计数=2（达月度上限）');
  ok(!irrigateHerb(g2, 0).ok, '同日第三次浇灌被月度上限拒绝');
  g2.cave.garden[0].progress = 3;
  const before2 = g2.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);
  const hr2 = harvestHerb(g2, 0);
  const after2 = g2.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);
  ok(hr2.ok && (after2 - before2) === 4, '浸润2次实际收获 +4（基础2+浸润2）');
}

/* ---------- 灵草图鉴解锁：播种解锁灵草条目、收获解锁产物材料、集齐得「百草通鉴」成就 ---------- */
{
  const g = S.createNewGame({ name: '灵草图鉴', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.cave = g.cave || {};
  g.cave.garden = [];
  g.currencies = g.currencies || {};
  g.currencies['下品灵石'] = 99999;
  for (const id of ['lingcao', 'huoqing', 'yushu', 'yuehua']) plantHerb(g, id);
  ok(g.cave.garden.length === 4, '四种灵草均可播种且各占一格');
  const herbKeys = ['灵草:凝露灵草', '灵草:火精枣树', '灵草:玉髓芝', '灵草:月华露藤'];
  ok(herbKeys.every((k) => g.codex.discovered.includes(k)), '播种后四种灵草图鉴均已解锁');
  // 直接催熟并收获全部 → 产物材料入图鉴
  for (let i = 0; i < g.cave.garden.length; i++) g.cave.garden[i].progress = g.cave.garden[i].grow;
  for (let i = g.cave.garden.length - 1; i >= 0; i--) harvestHerb(g, i);
  ok(g.items.some((it) => it.名称 === '凝露草') && g.items.some((it) => it.名称 === '火精枣'), '收获产物（凝露草/火精枣）已入储物袋');
  ok(['材料:凝露草', '材料:火精枣', '材料:玉髓芝', '材料:天材地宝·月华露'].every((k) => g.codex.discovered.includes(k)), '收获后灵草产物材料图鉴解锁');
  // 集齐灵草图鉴 → 成就解锁
  checkAchievements(g);
  ok(g.achievements.some((a) => a.id === 'herbCodex'), '集齐灵草图鉴解锁「百草通鉴」成就');
}

/* ---------- 灵草浇灌单株每月叠加上限 + 跨月重置 ---------- */
{
  const g = S.createNewGame({ name: '浇灌上限', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.cave = g.cave || {};
  g.cave.garden = [];
  g.currencies = g.currencies || {};
  g.currencies['下品灵石'] = 1000;
  plantHerb(g, 'yushu'); // grow=7，progress=0
  const cap = HERB_IRRIGATE_CAP_PER_MONTH;
  ok(cap >= 1, '浇灌上限常量存在且>=1');
  for (let k = 0; k < cap; k++) ok(irrigateHerb(g, 0).ok, `第 ${k + 1} 次浇灌成功`);
  ok(g.cave.garden[0].progress === cap && g.cave.garden[0].irrigatedThisMonth === cap, `达上限后进度与浇灌次数均为 ${cap}`);
  ok(!irrigateHerb(g, 0).ok, '达到单月上限后拒绝继续浇灌');
  const before = g.cave.garden[0].progress;
  growHerbs(g); // 跨月：自然 +1 且重置额度
  ok(g.cave.garden[0].irrigatedThisMonth === 0, '月度生长后浇灌额度已重置');
  ok(g.cave.garden[0].progress === Math.min(g.cave.garden[0].grow, before + 1), '月度自然生长 +1');
  ok(irrigateHerb(g, 0).ok, '重置后本月可再次浇灌');
}

/* ---------- 灵泉涌动（灵草被动加速，洞府 Lv.5+，确定性） ---------- */
{
  ok(HERB_SPRING_LEVEL === 5, '灵泉涌动阈值 HERB_SPRING_LEVEL=5');
  ok(typeof herbSpringBonus === 'function', 'herbSpringBonus 已导出为函数');
  // 低洞府等级无加成，高等级 +1 加成
  const low = S.createNewGame({ name: '灵泉低', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(low); low.cave.level = 0;
  ok(herbSpringBonus(low) === 0, '洞府 Lv.0 灵泉加成=0');
  const high = S.createNewGame({ name: '灵泉高', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(high); high.cave.level = 5;
  ok(herbSpringBonus(high) === 1, '洞府 Lv.5 灵泉加成=1');
  // growHerbs 自然生长受灵泉影响：低等级 +1，高等级 +2（确定性，无 omen）
  const g1 = S.createNewGame({ name: '灵泉生长低', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g1); g1.cave.level = 0; g1.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 0, grow: 5, planted: 'x', irrigatedThisMonth: 0 }];
  growHerbs(g1);
  ok(g1.cave.garden[0].progress === 1, '洞府 Lv.0 月度自然生长 +1');
  const g2 = S.createNewGame({ name: '灵泉生长高', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g2); g2.cave.level = 5; g2.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 0, grow: 5, planted: 'x', irrigatedThisMonth: 0 }];
  growHerbs(g2);
  ok(g2.cave.garden[0].progress === 2, '洞府 Lv.5 灵泉涌动，月度自然生长 +2');
  ok(g2.cave.garden[0].irrigatedThisMonth === 0, '灵泉下跨月浇灌额度重置正常');
}

/* ---------- 灵泉·引泉升级（可成长叠加，确定性） ---------- */
{
  ok(HERB_SPRING_MAX === 3, '灵泉引泉上限 HERB_SPRING_MAX=3');
  ok(HERB_SPRING_COST_BASE === 400, '引泉费用基数 HERB_SPRING_COST_BASE=400');
  // 加法式：洞府基础 + 引泉重数
  const lowS = S.createNewGame({ name: '引泉低', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(lowS); lowS.cave = lowS.cave || {}; lowS.cave.level = 0;
  ok(herbSpringBonus(lowS) === 0, '洞府 Lv.0 灵泉总加成=0（基础0+引泉0）');
  const highS = S.createNewGame({ name: '引泉高', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(highS); highS.cave = highS.cave || {}; highS.cave.level = 6; highS.cave.springLevel = 2;
  ok(herbSpringBonus(highS) === 3, '洞府 Lv.6 + 引泉2重 = 灵泉总加成 3');
  // 升级：费用递增、扣灵石、重数+1、封顶、不足拒绝
  const gS = S.createNewGame({ name: '引泉升级', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gS); gS.cave = gS.cave || {}; gS.currencies = gS.currencies || {}; gS.currencies['下品灵石'] = 5000;
  const beforeS = gS.currencies['下品灵石'];
  const rS1 = upgradeHerbSpring(gS);
  ok(rS1.ok && gS.cave.springLevel === 1 && beforeS - gS.currencies['下品灵石'] === HERB_SPRING_COST_BASE * 1, '首次引泉：重数1、扣费=400');
  const rS2 = upgradeHerbSpring(gS);
  ok(rS2.ok && gS.cave.springLevel === 2 && beforeS - gS.currencies['下品灵石'] === HERB_SPRING_COST_BASE * (1 + 2), '二次引泉：重数2、累计扣费=1200');
  const rS3 = upgradeHerbSpring(gS);
  ok(rS3.ok && gS.cave.springLevel === 3, '三次引泉达上限3');
  const rS4 = upgradeHerbSpring(gS);
  ok(!rS4.ok && gS.cave.springLevel === 3, '已达上限拒绝再引泉');
  const poorS = S.createNewGame({ name: '引泉贫', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(poorS); poorS.cave = poorS.cave || {}; poorS.currencies = poorS.currencies || {}; poorS.currencies['下品灵石'] = 100;
  const rS5 = upgradeHerbSpring(poorS);
  ok(!rS5.ok && (poorS.cave.springLevel || 0) === 0, '灵石不足引泉被拒且重数不变');
  // 引泉叠加后影响 growHerbs 自然生长（确定性）
  const gG = S.createNewGame({ name: '引泉生长', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gG); gG.cave = gG.cave || {}; gG.cave.garden = []; gG.cave.level = 6; gG.cave.springLevel = 2; gG.currencies = gG.currencies || {}; gG.currencies['下品灵石'] = 1000;
  const plantG = plantHerb(gG, 'yushu');
  ok(plantG.ok && gG.cave.garden.length === 1, '引泉生长：播种成功入列');
  const bp = gG.cave.garden[0].progress;
  growHerbs(gG);
  ok(gG.cave.garden[0].progress === bp + 1 + 3, '引泉叠加后月自然生长 +4（基础1+引泉3）');
}

/* ---------- 观星卜算（数据驱动罗盘选项，确定性收益） ---------- */
{
  const g = S.createNewGame({ name: '观星卜算', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {};
  g.currencies['下品灵石'] = 1000;
  const before = S.totalStones(g);
  const yunBefore = (g.player.daoYun?.exp || 0);
  const wuxingBefore = (g.player.daoBase?.悟性?.exp || 0);
  const r = S.performAction(g, { title: '观星卜算', action: { type: 'divination' } });
  ok(r && Array.isArray(r.logs) && r.logs.length > 0, '观星卜算返回结构化日志');
  ok(S.totalStones(g) === before - DIVINATION.cost, '观星卜算按固定灵石扣费');
  ok((g.player.daoYun?.exp || 0) === yunBefore + DIVINATION.daoYun, '道韵经验按固定值增加');
  ok((g.player.daoBase?.悟性?.exp || 0) === wuxingBefore + DIVINATION.wuxing, '悟性经验按固定值增加');
  // 灵石不足时拒绝且不崩溃
  for (const c of ['下品灵石', '中品灵石', '上品灵石', '极品灵石', '灵晶']) g.currencies[c] = 0;
  const r2 = S.performAction(g, { title: '观星卜算', action: { type: 'divination' } });
  ok(r2 && Array.isArray(r2.logs), '灵石不足时观星卜算不崩溃');
  // 天机运势：卜算后获得下月运势加成（确定性：到期月正确、数值为有效加成）
  ok(g.flags.omen && typeof g.flags.omen === 'object', '观星卜算赋予天机运势');
  ok(g.flags.omen && ['cultivate','garden','trade','insight'].includes(g.flags.omen.kind), '天机运势类型为有效项');
  ok(g.flags.omen && (g.flags.omen.mul > 1 || g.flags.omen.add > 0), '天机运势为有效正加成');
  const _ey = g.world.year, _em = g.world.month + 1;
  const _expEY = _em > 12 ? _ey + 1 : _ey, _expEM = _em > 12 ? 1 : _em;
  ok(g.flags.omen && g.flags.omen.expireYear === _expEY && g.flags.omen.expireMonth === _expEM, '天机运势生效至下月');
  ok(omenActive(g), '天机运势当前生效');
  S.nextMonth(g);
  ok(omenActive(g), '进入下月后天机运势仍生效');
  S.nextMonth(g);
  ok(!g.flags.omen, '跨过生效月后天机运势自动清除');
  // 天机运势加成实际生效（确定性，手动置 omen 避 RNG）
  const g2 = S.createNewGame({ name: '运势生效', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g2);
  plantHerb(g2, 'lingcao');
  const _base = g2.cave.garden[0].progress;
  g2.flags.omen = { kind: 'garden', icon: '🌿', label: '灵田润泽', desc: '测试', mul: 1, add: 1, expireYear: 9999, expireMonth: 12 };
  growHerbs(g2);
  ok(g2.cave.garden[0].progress === _base + 2, '灵田润泽运势使灵草额外 +1 月');
  const g3 = S.createNewGame({ name: '无运势', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g3);
  plantHerb(g3, 'lingcao');
  const _b3 = g3.cave.garden[0].progress;
  growHerbs(g3);
  ok(g3.cave.garden[0].progress === _b3 + 1, '无运势时灵草自然生长仅 +1 月');
  const g4 = S.createNewGame({ name: 'mul', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g4);
  ok(omenMul(g4, 'cultivate') === 1, '无运势时 omenMul 为 1');
  g4.flags.omen = { kind: 'cultivate', icon: '📿', label: '道韵加持', desc: '测试', mul: 1.18, add: 0, expireYear: 9999, expireMonth: 12 };
  ok(omenMul(g4, 'cultivate') === 1.18, '匹配 kind 时 omenMul 返回加成');
  ok(omenMul(g4, 'trade') === 1, '非匹配 kind 时 omenMul 为 1');
  // 状态感知星盘点评（确定性，无 RNG）
  ok(typeof S.divinationFortune === 'function', 'divinationFortune 已导出');
  const g5 = S.createNewGame({ name: '点评·丹毒', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g5);
  g5.flags.pillToxicity = 40;
  const f_tox = S.divinationFortune(g5);
  ok(typeof f_tox === 'string' && f_tox.length > 0, '星盘点评返回非空字符串');
  ok(f_tox.includes('丹毒'), '丹毒缠身时点评为解毒警示');
  const g6 = S.createNewGame({ name: '点评·采收', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g6);
  plantHerb(g6, 'lingcao');
  g6.cave.garden[0].progress = g6.cave.garden[0].grow;
  ok(S.divinationFortune(g6).includes('采收'), '灵草已熟时点评为采收指引');
  const g7 = S.createNewGame({ name: '点评·灵石', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g7);
  g7.currencies = { '下品灵石': 100 };
  ok(S.divinationFortune(g7).includes('历练'), '灵石匮乏时点评为历练/易货建议');
  const g8 = S.createNewGame({ name: '点评·默认', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g8);
  const fa = S.divinationFortune(g8), fb = S.divinationFortune(g8);
  ok(fa === fb, '星盘点评确定性（同状态同结果，无 RNG）');
  ok(fa.length > 0, '默认处境星盘点评非空');

}


/* ---------- 炼丹（丹炉）系统 ---------- */
{
  // 1) 解锁门槛：基础丹默认解锁；境界 / 宗门贡献逐级解锁
  const u = S.createNewGame({ name: '丹炉解锁', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(u);
  u.player.level = 1; u.arts = {}; u.sect = { rank: 0 };
  ok(isRecipeUnlocked(u, '聚气丹') && isRecipeUnlocked(u, '凝血丹'), '入门丹方默认解锁');
  ok(!isRecipeUnlocked(u, '聚灵丹'), '低境界未解锁聚灵丹');
  u.player.level = 11;
  ok(isRecipeUnlocked(u, '聚灵丹'), '达 11 级解锁聚灵丹');
  ok(!isRecipeUnlocked(u, '渡劫丹'), '低境界未解锁渡劫丹');
  u.player.level = 60;
  ok(isRecipeUnlocked(u, '渡劫丹'), '达 60 级解锁渡劫丹');
  const u2 = S.createNewGame({ name: '宗门解锁', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(u2); u2.player.level = 1; u2.sect = { rank: 1 };
  ok(isRecipeUnlocked(u2, '筑基丹'), '宗门 rank1 解锁筑基丹');
  ok(!isRecipeUnlocked(u2, '渡劫丹'), '宗门 rank1 仍不足解锁渡劫丹');

  // 2) 开炉炼制：材料 + 灵石扣减（走总灵石断言，规避分层货币口径差异）
  const a = S.createNewGame({ name: '丹炉炼制', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(a);
  a.currencies['下品灵石'] = 1000;
  storeItem(a, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(a, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  const stonesBefore = S.totalStones(a);
  const herbBefore = a.items.find((x) => x.名称 === '百越灵草').数量;
  const pearlBefore = a.items.find((x) => x.名称 === '海灵珠').数量;
  const rr = refinePill(a, '聚气丹');
  ok(rr.ok, '聚气丹开炉成功');
  ok(S.totalStones(a) === stonesBefore - PILL_RECIPES.聚气丹.stoneCost, '开炉按总灵石扣费（下品灵石 20）');
  ok(a.items.find((x) => x.名称 === '百越灵草').数量 === herbBefore - 2, '开炉扣减百越灵草×2');
  ok(a.items.find((x) => x.名称 === '海灵珠').数量 === pearlBefore - 1, '开炉扣减海灵珠×1');
  ok(a.cave.alchemy.length === 1, '丹炉队列写入 1 炉');
  // 丹炉容量上限（初始 1 炉）：第二炉被拒
  const rrSlot = refinePill(a, '聚气丹');
  ok(!rrSlot.ok && /丹炉已满/.test(rrSlot.logs[0]), '丹炉满时拒绝开炉');
  // 材料不足时拒绝
  const b = S.createNewGame({ name: '缺料', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(b); b.currencies['下品灵石'] = 1000;
  ok(!refinePill(b, '聚气丹').ok, '材料不足时开炉被拒');

  // 3) 跨月结算：success / fail 双路径（force 注入，确定性，消除 RNG flaky）
  const c = JSON.parse(JSON.stringify(a)); ensureLifeState(c);
  const settleS = settleRefine(c, [], 'success');
  ok((c.items.find((x) => x.名称 === '聚气丹')?.数量 || 0) >= 1, '强制成功结算得到聚气丹×1');
  ok(c.cave.alchemy.length === 0, '结算后丹炉清空');
  ok(c.flags.refinedPills === 1, '累计炼丹计数 +1');
  ok(c.codex.discovered.includes('丹药:聚气丹'), '炼成后解锁聚气丹图鉴');
  ok(settleS.some((l) => /开炉/.test(l)), '成丹日志含开炉提示');

  const d = JSON.parse(JSON.stringify(a)); ensureLifeState(d);
  const dHerbBefore = d.items.find((x) => x.名称 === '百越灵草').数量;
  const dPearlBefore = d.items.find((x) => x.名称 === '海灵珠').数量;
  settleRefine(d, [], 'fail');
  ok((d.items.find((x) => x.名称 === '聚气丹')?.数量 || 0) === 0, '强制失败无成丹');
  ok(d.items.find((x) => x.名称 === '百越灵草').数量 >= dHerbBefore - 1, '废丹退还部分百越灵草（可逆惩罚）');
  ok(d.items.find((x) => x.名称 === '海灵珠').数量 >= dPearlBefore - 1, '废丹退还部分海灵珠（可逆惩罚）');
  ok(d.cave.alchemy.length === 0, '失败结算后丹炉清空');
  ok((d.flags.pillToxicity || 0) === 0, '失败无丹毒');

  // 4) 丹毒月度衰减
  const e = JSON.parse(JSON.stringify(c)); ensureLifeState(e);
  e.flags.pillToxicity = 30;
  decayPillToxicity(e);
  ok(e.flags.pillToxicity === 22, '丹毒月度衰减 8');

  // 6) 炼丹催化：「年份灵草」「私藏丹方·残卷」自动消耗提升成丹率（消除死道具，确定性）
  const cat = S.createNewGame({ name: '炼丹催化', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cat);
  cat.currencies['下品灵石'] = 1000;
  storeItem(cat, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat, { 名称: '年份灵草', 类型: '材料', 数量: 2, 描述: '催化材料', 价值: 60 });
  const yearBefore = cat.items.find((x) => x.名称 === '年份灵草').数量;
  const rrYear = refinePill(cat, '聚气丹');
  ok(rrYear.ok && /催化/.test(rrYear.logs[0]), '持年份灵草开炉触发催化提示');
  ok((cat.items.find((x) => x.名称 === '年份灵草')?.数量 || 0) === yearBefore - 1, '开炉自动消耗 1 份年份灵草');
  ok(cat.cave.alchemy[0].catalystBonus === 8, '年份灵草催化加成 +8%');

  const cat2 = S.createNewGame({ name: '丹方催化', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cat2);
  cat2.currencies['下品灵石'] = 1000;
  storeItem(cat2, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat2, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat2, { 名称: '私藏丹方·残卷', 类型: '材料', 数量: 1, 描述: '催化材料', 价值: 120 });
  const rrDf = refinePill(cat2, '聚气丹');
  ok(rrDf.ok && cat2.cave.alchemy[0].catalystBonus === 15, '私藏丹方·残卷催化加成 +15%');
  ok(!cat2.items.some((x) => x.名称 === '私藏丹方·残卷'), '开炉自动消耗私藏丹方·残卷');

  // 无催化材料时不消耗、无加成（无回归）
  const cat3 = S.createNewGame({ name: '无催化', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cat3);
  cat3.currencies['下品灵石'] = 1000;
  storeItem(cat3, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat3, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  const rrNo = refinePill(cat3, '聚气丹');
  ok(rrNo.ok && (!cat3.cave.alchemy[0].catalystBonus || cat3.cave.alchemy[0].catalystBonus === 0), '无催化材料时加成 0（不误消耗）');

  // 5) useItem 新丹药效果 + 保留丹不可直接服用
  const pills = S.createNewGame({ name: '丹药效果', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(pills);
  // 聚灵丹：exp200 + cultivateBoostMonths2
  storeItem(pills, { 名称: '聚灵丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 6, effect: { exp: 200, cultivateBoostMonths: 2 }, breakthrough: false });
  const idxJ = pills.items.findIndex((x) => x.名称 === '聚灵丹');
  const expBefore = pills.player.exp;
  const useJ = S.useItem(pills, idxJ) || [];
  ok(useJ.some((l) => /修为\+200/.test(l)), '聚灵丹服用获得修为+200');
  ok((pills.flags.pillToxicity || 0) === 6, '聚灵丹服用后丹毒累加 6');
  ok((pills.flags.cultivateBoostMonths || 0) === 2, '聚灵丹写入修炼加成 2 月');
  ok((pills.items.find((x) => x.名称 === '聚灵丹')?.数量 || 0) === 0, '聚灵丹服用后数量-1');
  // 凝神丹：wuxing 120（悟性经验）
  storeItem(pills, { 名称: '凝神丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 10, effect: { wuxing: 120 }, breakthrough: false });
  const idxN = pills.items.findIndex((x) => x.名称 === '凝神丹');
  const useN = S.useItem(pills, idxN) || [];
  ok(useN.some((l) => /悟性经验\+120/.test(l)) || pills.player.daoBase['悟性'].exp >= 120 || pills.player.daoBase['悟性'].level > 1, '凝神丹服用增加悟性经验');
  // 洗髓丹：随机道基 +5~10
  const totalBefore = Object.values(pills.player.daoBase).reduce((s, v) => s + v.level, 0);
  storeItem(pills, { 名称: '洗髓丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 20, effect: { daoBase: { keys: ['根骨', '道心'], min: 5, max: 10 } }, breakthrough: false });
  const idxM = pills.items.findIndex((x) => x.名称 === '洗髓丹');
  S.useItem(pills, idxM);
  const totalAfter = Object.values(pills.player.daoBase).reduce((s, v) => s + v.level, 0);
  ok(totalAfter - totalBefore >= 5 && totalAfter - totalBefore <= 10, '洗髓丹随机提升一项道基 5~10 级');
  // 保留丹：筑基丹（breakthrough）/ 渡劫丹（tribulation）不可直接服用
  storeItem(pills, { 名称: '筑基丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 3, effect: { exp: 150 }, breakthrough: true });
  const idxB = pills.items.findIndex((x) => x.名称 === '筑基丹');
  const useB = S.useItem(pills, idxB) || [];
  ok(useB.some((l) => /不宜直接服用/.test(l)), '筑基丹（瓶颈专属）不可直接服用');
  ok((pills.items.find((x) => x.名称 === '筑基丹')?.数量 || 0) === 1, '筑基丹未被消耗（留待突破）');
  storeItem(pills, { 名称: '渡劫丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 5, effect: { tribulation: 15, exp: 60 }, breakthrough: false });
  const idxT = pills.items.findIndex((x) => x.名称 === '渡劫丹');
  const useT = S.useItem(pills, idxT) || [];
  ok(useT.some((l) => /不宜直接服用/.test(l)), '渡劫丹不可直接服用');
  ok((pills.items.find((x) => x.名称 === '渡劫丹')?.数量 || 0) === 1, '渡劫丹未被消耗（留待渡劫）');

  // 6) 聚灵丹修炼加成在 cultivate 实际生效（固定种子 PRNG：种子化但逐次变化，
  //    既避免 createNewGame 内 NPC 重名 do-while 死循环，又让两次 cultivate 抽相同随机序列以便确定性比较）
  const realRandom = Math.random;
  let _seed = 20260819;
  Math.random = () => {
    _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    const base = S.createNewGame({ name: '修炼加成', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(base);
    _seed = 20260819; const sNo = JSON.parse(JSON.stringify(base)); ensureLifeState(sNo);
    const gNo = S.cultivate(sNo).gain;
    _seed = 20260819; const sYes = JSON.parse(JSON.stringify(base)); ensureLifeState(sYes);
    sYes.flags.cultivateBoostMonths = 2;
    const gYes = S.cultivate(sYes).gain;
    ok(gYes > gNo, '聚灵丹修炼加成使 monthly 修炼收益提升');
  } finally { Math.random = realRandom; }
}

/* ---------- 灵草杂交：两种灵草产物→奇珍灵材（确定性、无 RNG） ---------- */
{
  const g = S.createNewGame({ name: '灵草杂交', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {};
  g.currencies['下品灵石'] = 99999;
  // 配方查找：顺序无关 + 无效组合
  ok(findHerbHybrid('凝露草', '火精枣') !== null && findHerbHybrid('火精枣', '凝露草') !== null, 'findHerbHybrid 顺序无关');
  ok(findHerbHybrid('凝露草', '凝露草') === null, '相同灵草无配方');
  ok(!crossbreedHerbs(g, '凝露草', '凝露草').ok, '相同灵草不可杂交');
  ok(!crossbreedHerbs(g, '凝露草', '不存在的材料').ok, '无效组合拒绝杂交');
  // 缺少材料拒绝
  ok(!crossbreedHerbs(g, '凝露草', '火精枣').ok, '灵草产物不足时拒绝杂交');
  // 准备材料（各 1）与配方（顺序颠倒也应成功）
  g.items.push({ 名称: '凝露草', 类型: '材料', 数量: 1, 描述: '', 价值: 40 });
  g.items.push({ 名称: '火精枣', 类型: '材料', 数量: 1, 描述: '', 价值: 50 });
  const before = g.currencies['下品灵石'];
  const rr = crossbreedHerbs(g, '火精枣', '凝露草');
  ok(rr.ok && g.items.some((it) => it.名称 === '凝火奇实'), '杂交成功并产出奇珍灵材（不分先后）');
  ok(g.currencies['下品灵石'] === before - HERB_HYBRID_COST, '杂交扣除对应灵石');
  ok(!g.items.some((it) => it.名称 === '凝露草') && !g.items.some((it) => it.名称 === '火精枣'), '杂交消耗两种灵草产物各 1 份');
  ok(g.codex.discovered.includes('材料:凝火奇实'), '杂交奇珍灵材解锁图鉴');
  // 全部 4 种杂交 → 解锁「灵植奇才」成就
  for (const hy of HERB_HYBRIDS) {
    if (g.codex.discovered.includes('材料:' + hy.out.名称)) continue;
    g.items.push({ 名称: hy.a, 类型: '材料', 数量: 1, 描述: '', 价值: 10 });
    g.items.push({ 名称: hy.b, 类型: '材料', 数量: 1, 描述: '', 价值: 10 });
    crossbreedHerbs(g, hy.a, hy.b);
  }
  checkAchievements(g);
  ok(g.achievements.some((a) => a.id === 'herbHybrid'), '集齐 4 种奇珍灵材解锁「灵植奇才」成就');
}


/* ---------- 灵草杂交产物 → 高阶丹方闭环（确定性、无 RNG） ---------- */
{
  // 1) 解锁门槛：奇珍灵材丹方与境界 / 百艺 / 宗门贡献挂钩
  const u = S.createNewGame({ name: '高阶丹方解锁', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(u); u.player.level = 1; u.arts = {}; u.sect = { rank: 0 };
  ok(!isRecipeUnlocked(u, '凝火丹'), '低境界未解锁凝火丹');
  u.player.level = 21;
  ok(isRecipeUnlocked(u, '凝火丹'), '达 21 级解锁凝火丹');
  ok(!isRecipeUnlocked(u, '玉华丹'), '低境界未解锁玉华丹');
  u.player.level = 40;
  ok(isRecipeUnlocked(u, '玉华丹'), '达 40 级解锁玉华丹');
  u.player.level = 60;
  ok(isRecipeUnlocked(u, '露华丹'), '达 60 级解锁露华丹');

  // 2) 闭环：杂交产出奇珍灵材 → 作为高阶丹方材料开炉
  const g = S.createNewGame({ name: '闭环炼丹', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {}; g.currencies['下品灵石'] = 999999;
  storeItem(g, { 名称: '凝露草', 类型: '材料', 数量: 5, 描述: '测试', 价值: 5 });
  storeItem(g, { 名称: '火精枣', 类型: '材料', 数量: 5, 描述: '测试', 价值: 5 });
  const cross = crossbreedHerbs(g, '凝露草', '火精枣');
  ok(cross.ok && g.items.some((it) => it.名称 === '凝火奇实'), '杂交得到凝火奇实（闭环起点）');
  g.player.level = 21; ensureLifeState(g);
  ok(isRecipeUnlocked(g, '凝火丹'), '已满足凝火丹解锁条件');
  const stonesBefore = S.totalStones(g);
  const refineR = refinePill(g, '凝火丹');
  ok(refineR.ok, '以凝火奇实开炉炼制凝火丹成功');
  ok(S.totalStones(g) === stonesBefore - PILL_RECIPES.凝火丹.stoneCost, '开炉按总灵石扣费');
  ok(!g.items.some((it) => it.名称 === '凝火奇实'), '开炉消耗奇珍灵材凝火奇实');
  ok(g.cave.alchemy.length === 1, '丹炉写入 1 炉');
  settleRefine(g, [], 'success');
  ok((g.items.find((x) => x.名称 === '凝火丹')?.数量 || 0) >= 1, '凝火丹炼成');
  ok(g.codex.discovered.includes('丹药:凝火丹'), '炼成后解锁凝火丹图鉴');

  // 3) 高阶丹药效果（露华丹：heal + wuxing；玉华丹：随机道基 5~10）
  const pills = S.createNewGame({ name: '高阶丹效', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(pills);
  pills.flags.wounded = 2;
  storeItem(pills, { 名称: '露华丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 8, effect: { heal: true, wuxing: 200 }, breakthrough: false });
  const idxL = pills.items.findIndex((x) => x.名称 === '露华丹');
  const wuxBefore = pills.player.daoBase['悟性'].exp;
  const useL = S.useItem(pills, idxL) || [];
  ok((pills.flags.wounded || 0) === 0, '露华丹服用清除伤势');
  ok(useL.some((l) => /悟性经验\+200/.test(l)) || (pills.player.daoBase['悟性'].exp - wuxBefore >= 200), '露华丹服用悟性经验 +200');
  ok(useL.some((l) => /伤势尽去/.test(l)), '露华丹服用日志含伤势尽去');

  const totalBefore = Object.values(pills.player.daoBase).reduce((s, v) => s + v.level, 0);
  storeItem(pills, { 名称: '玉华丹', 类型: '丹药', 数量: 1, 描述: '测试', toxicity: 18, effect: { daoBase: { keys: ['悟性', '气运'], min: 5, max: 10 } }, breakthrough: false });
  const idxY = pills.items.findIndex((x) => x.名称 === '玉华丹');
  const toxBefore = pills.flags.pillToxicity || 0;
  S.useItem(pills, idxY);
  const totalAfter = Object.values(pills.player.daoBase).reduce((s, v) => s + v.level, 0);
  ok(totalAfter - totalBefore >= 5 && totalAfter - totalBefore <= 10, '玉华丹随机提升一项道基 5~10 级');
  ok((pills.flags.pillToxicity || 0) - toxBefore === 18, '玉华丹丹毒累加 18（增量）');
}
/* ---------- 罗盘列出全部已解锁秘境 ---------- */
{
  const c = S.createNewGame({ name: '罗盘', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(c);
  c.world.month = 1; // 避开 9 月拍卖会干扰断言
  c.flags.auctionAvailable = false;
  c.player.level = 30; // 解锁 青虚(15) + 火焰谷(25)
  const m30 = S.extraCompassOptions(c).filter((o) => o.action.type === 'mystic');
  ok(m30.length === availableMysticRealms(c).length, '罗盘秘境数=已解锁数(30级)');
  ok(m30.length === 2, '30级恰好两处秘境可入');
  ok(new Set(m30.map((o) => o.action.realmId)).size === m30.length, '各秘境 realmId 不重复');
  ok(m30.some((o) => o.action.realmId === 'qingxu') && m30.some((o) => o.action.realmId === 'huoyan'), '30级含青虚与火焰谷');
  // 升至 55，应解锁 冰海遗迹(40) 与 海上遗府(50)，共 4 处
  c.player.level = 55;
  const m55 = S.extraCompassOptions(c).filter((o) => o.action.type === 'mystic');
  ok(m55.length === availableMysticRealms(c).length && m55.length === 4, '55级四秘境全部可选');
  const yifu = m55.find((o) => o.action.realmId === 'yifu');
  ok(yifu && /残图/.test(yifu.desc), '海上遗府选项提示需残图开启');
}

/* ---------- 残图死道具修复：游历产出海上遗府残图 + 罗盘进度提示 ---------- */
{
  // 1) 洞府游历事件稳定产出 海上遗府残图（不再是孤立、无法消耗的 秘境残图）
  const w = S.createNewGame({ name: '残图', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(w);
  const cave = S.WANDER_EVENTS.find((e) => e.id === 'cave');
  ok(!!cave, '游历事件池含洞府(cave)事件');
  const before = w.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0);
  cave.run(w);
  const after = w.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0);
  ok(after === before + 1, '洞府游历稳定产出 1 张海上遗府残图');
  ok(!w.items.some((i) => i.名称 === '秘境残图'), '不再产出孤立的 秘境残图');

  // 2) 罗盘海上遗府选项随持有残图数变化提示进度
  const c = S.createNewGame({ name: '罗盘残图', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(c);
  c.world.month = 1; c.flags.auctionAvailable = false; c.player.level = 55;
  const opt0 = S.extraCompassOptions(c).find((o) => o.action.realmId === 'yifu');
  ok(opt0 && /当前持有 0 张/.test(opt0.desc), '0 张残图时提示当前持有 0 张');
  storeItem(c, { 名称: '海上遗府残图', 类型: '线索', 数量: 3, 描述: '测试', 价值: 100 });
  const opt3 = S.extraCompassOptions(c).find((o) => o.action.realmId === 'yifu');
  ok(opt3 && /已集齐 3 张残图，可开启/.test(opt3.desc), '集齐 3 张时提示可开启');
}



/* ---------- 护符抵挡：失败损失抵消（确定性，强制败北） ---------- */
{
  const mkWard = () => {
    const g = S.createNewGame({ name: '护符测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.player.level = 30; g.player.power = 50;
    g.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0 };
    g.items.push({ 名称: '护身符', 类型: '消耗品', 数量: 2, effect: { ward: true }, 描述: '战斗失败时减轻损失。', 价值: 100 });
    return g;
  };
  const wardEnemy = { name: '强敌', realm: '金丹', level: 60, power: 5000, danger: 3 };
  // 先用真实随机建好对局，再覆盖为常量以强制败北（避免 makeNpc 重名死循环）
  const g = mkWard();
  const g0 = mkWard(); g0.items = g0.items.filter((i) => i.名称 !== '护身符');
  const realRandom = Math.random;
  Math.random = () => 0.999;
  try {
    const bLv = g.player.level, bSt = S.totalStones(g);
    const rep = S.resolveBattle(g, wardEnemy, 'shengci', false, 'normal', false);
    ok(!rep.win, '护符测试：强敌当前必败');
    ok(g.player.level === bLv, '护身符抵消修为倒退');
    ok(S.totalStones(g) === bSt, '护身符抵消灵石损失');
    ok((g.items.find((i) => i.名称 === '护身符')?.数量 || 0) === 1, '护身符消耗 1 张');
    ok(rep.logs.some((l) => l.includes('护符')), '战报含护符抵挡文案');
    const s0 = S.totalStones(g0);
    const rep0 = S.resolveBattle(g0, wardEnemy, 'shengci', false, 'normal', false);
    ok(!rep0.win && S.totalStones(g0) < s0, '对照：无护符时失败损失灵石');
  } finally { Math.random = realRandom; }
}

/* ---------- 护符抵挡：低阶护身符（仅抵灵石，修为仍倒退） ---------- */
{
  const mkLow = () => {
    const g = S.createNewGame({ name: '低阶护符', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.player.level = 30; g.player.power = 50;
    g.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0 };
    g.items.push({ 名称: '低阶护身符', 类型: '消耗品', 数量: 1, effect: { ward: true }, 描述: '战斗失败时减轻损失。', 价值: 110 });
    return g;
  };
  const lowEnemy = { name: '强敌', realm: '金丹', level: 60, power: 5000, danger: 3 };
  const g = mkLow();
  const realRandom2 = Math.random;
  Math.random = () => 0.999;
  try {
    const bLv = g.player.level, bSt = S.totalStones(g);
    const rep = S.resolveBattle(g, lowEnemy, 'shengci', false, 'normal', false);
    ok(!rep.win, '低阶护符测试：必败');
    ok(g.player.level < bLv, '低阶护身符不抵修为倒退');
    ok(S.totalStones(g) === bSt, '低阶护身符抵消灵石损失');
    ok(!g.items.some((i) => i.名称 === '低阶护身符'), '低阶护身符被消耗');
  } finally { Math.random = realRandom2; }
}

/* ---------- 聚灵阵旗：使用后为下月修炼加成（死道具修复） ---------- */
{
  const g = S.createNewGame({ name: '阵旗测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.items.push({ 名称: '聚灵阵旗', 类型: '消耗品', 数量: 1, effect: { cultivateBoostMonths: 1 }, 描述: '下次修炼效率提升。', 价值: 180 });
  const idx = g.items.length - 1;
  const logs = S.useItem(g, idx);
  ok((g.flags.cultivateBoostMonths || 0) >= 1, '聚灵阵旗使用后写入修炼加成月数');
  ok(logs.some((l) => l.includes('修炼效率')), '聚灵阵旗使用文案正确');
  ok(!g.items.some((i) => i.名称 === '聚灵阵旗'), '聚灵阵旗使用后消耗');
}



/* ---------- 死道具修复：旅行凭证 / 远航凭证（跨域旅行费用减半，单张消耗） ---------- */
const pickNeighbor = (st) => travelOptions(st)[0];
{
  // 无凭证：路费 = 全额
  const t1 = S.createNewGame({ name: '旅行测试1', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(t1);
  const nb1 = pickNeighbor(t1);
  t1.currencies['下品灵石'] = 100000;
  const b1 = t1.currencies['下品灵石'];
  const r1 = startTravel(t1, nb1.id);
  ok(r1.ok, '无凭证旅行可规划');
  ok(b1 - t1.currencies['下品灵石'] === nb1.cost, '无凭证路费=全额');
  ok(!r1.text.includes('减半'), '无凭证文案不含减半');

  // 持旅行凭证：路费减半且消耗一张
  const t2 = S.createNewGame({ name: '旅行测试2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(t2);
  const nb2 = pickNeighbor(t2);
  t2.currencies['下品灵石'] = 100000;
  t2.items.push({ 名称: '旅行凭证', 类型: '消耗品', 数量: 1, effect: { travel: 50 }, 描述: '跨域旅行费用减半。' });
  const b2 = t2.currencies['下品灵石'];
  const r2 = startTravel(t2, nb2.id);
  const exp2 = Math.max(0, Math.round(nb2.cost * 0.5));
  ok(r2.ok, '持旅行凭证旅行可规划');
  ok(b2 - t2.currencies['下品灵石'] === exp2, '持旅行凭证路费减半(实扣' + (b2 - t2.currencies['下品灵石']) + ',期望' + exp2 + ')');
  ok(!t2.items.some((i) => i.名称 === '旅行凭证'), '旅行凭证被消耗');
  ok(r2.text.includes('减半'), '持凭证文案提示减半');

  // 持远航凭证同样生效
  const t3 = S.createNewGame({ name: '旅行测试3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(t3);
  const nb3 = pickNeighbor(t3);
  t3.currencies['下品灵石'] = 100000;
  t3.items.push({ 名称: '远航凭证', 类型: '消耗品', 数量: 1, effect: { travel: 50 }, 描述: '跨域旅行费用减半。' });
  const b3 = t3.currencies['下品灵石'];
  const r3 = startTravel(t3, nb3.id);
  ok(r3.ok && b3 - t3.currencies['下品灵石'] === Math.max(0, Math.round(nb3.cost * 0.5)), '远航凭证同样减半并消耗');
}

/* ---------- 死道具修复：海岛通行令（海上遗府护阵灵石减费，持久生效） ---------- */
{
  const mkYifu = () => {
    const g = S.createNewGame({ name: '遗府测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.player.level = 55;
    g.currencies['下品灵石'] = 1000;
    for (let k = 0; k < 3; k++) g.items.push({ 名称: '海上遗府残图', 类型: '线索', 数量: 1, 描述: '残图' });
    return g;
  };
  // 灵石不足：提前返回且残图不消耗
  const a = mkYifu(); a.currencies['下品灵石'] = 0;
  const ra = S.exploreMysticRealm(a, 'yifu', 1);
  ok(ra.logs.some((l) => l.includes('灵石不足')), '遗府灵石不足时拒绝进入');
  ok(a.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0) === 3, '灵石不足时残图不被消耗');

  // 无通行令：全额护阵灵石 100
  const b = mkYifu();
  const rb = S.exploreMysticRealm(b, 'yifu', 1);
  ok(rb.logs.some((l) => l.includes('缴纳遗府护阵灵石 -100')), '无通行令缴全额100护阵灵石');
  ok(!rb.logs.some((l) => l.includes('海岛通行令减费')), '无通行令无减费提示');
  ok(b.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0) === 0, '遗府探索消耗3张残图');

  // 持海岛通行令：减费至 80，且通行令持久不消耗
  const c = mkYifu();
  c.items.push({ 名称: '海岛通行令', 类型: '消耗品', 数量: 1, effect: { relic: 20 }, 描述: '降低海外遗府探索费用。' });
  const rc = S.exploreMysticRealm(c, 'yifu', 1);
  ok(rc.logs.some((l) => l.includes('缴纳遗府护阵灵石 -80')), '持通行令缴80护阵灵石(减费20%)');
  ok(rc.logs.some((l) => l.includes('海岛通行令减费')), '持通行令有减费提示');
  ok(c.items.some((i) => i.名称 === '海岛通行令'), '海岛通行令持久不消耗');
}
/* ---------- 宗门秘境：核心弟子可入，确定性收益，无妖兽风险 ---------- */
{
  const mkSect = (rank, contrib = 0) => {
    const g = S.createNewGame({ name: '宗门秘境测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    S.joinSect(g, '测试仙宗');
    g.sect.rank = rank;
    g.sect.contribution = contrib;
    return g;
  };
  // 门禁：内外门(rank<3) 不能进入
  const gLow = mkSect(2);
  const rLow = S.exploreSectRealm(gLow, 1);
  ok(!rLow.ok && rLow.logs.some((l) => l.includes('需核心弟子')), 'rank<3 拒绝进入宗门秘境');
  ok(gLow.sect.contribution === 0, 'rank<3 进入失败不改动贡献');
  // 未入宗：拒绝
  const gNone = S.createNewGame({ name: '无宗', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gNone); gNone.sect = { name: '', rank: 0, contribution: 0 };
  const rNone = S.exploreSectRealm(gNone, 1);
  ok(!rNone.ok && rNone.logs.some((l) => l.includes('尚未加入')), '未入宗拒绝进入宗门秘境');
  // 核心弟子(rank3) depth1：确定性收益
  const g3 = mkSect(3, 0);
  const beforeStones = S.totalStones(g3);
  const r3 = S.exploreSectRealm(g3, 1);
  ok(r3.ok, 'rank3 可进入宗门秘境');
  ok(g3.sect.contribution === 30, `depth1 贡献+30（实际 ${g3.sect.contribution}）`);
  ok(S.totalStones(g3) === beforeStones + 80, `depth1 灵石+80（实际 ${S.totalStones(g3) - beforeStones}）`);
  ok(g3.items.some((i) => i.名称 === '宗门灵脉晶' && i.数量 === 1), 'depth1 得材料 宗门灵脉晶×1');
  ok(!g3.items.some((i) => i.名称 === '聚气丹'), 'depth1 深处丹药未出现');
  // 深处(depth2)：聚气丹出现，贡献/灵石按 1.6 倍缩放
  const g2 = mkSect(3, 0);
  const before2 = S.totalStones(g2);
  const r2 = S.exploreSectRealm(g2, 2);
  ok(r2.ok, 'rank3 depth2 可进入');
  ok(g2.sect.contribution === 48, `depth2 贡献 30×1.6=48（实际 ${g2.sect.contribution}）`);
  ok(S.totalStones(g2) === before2 + 128, `depth2 灵石 80×1.6=128（实际 ${S.totalStones(g2) - before2}）`);
  ok(g2.items.some((i) => i.名称 === '宗门灵脉晶' && i.数量 === 3), 'depth2 材料 宗门灵脉晶×3（按 matMul 1.4 缩放）');
  ok(g2.items.some((i) => i.名称 === '聚气丹' && i.数量 === 1), 'depth2 深处得聚气丹×1');
  // 深处(depth3)：材料 ×matMul(1.8)、聚气丹 ×artMul(1.6→2)，与罗盘面板承诺一致
  const g3d = mkSect(3, 0);
  const before3 = S.totalStones(g3d);
  const r3d = S.exploreSectRealm(g3d, 3);
  ok(r3d.ok, 'rank3 depth3 可进入');
  ok(g3d.sect.contribution === 72, `depth3 贡献 30×2.4=72（实际 ${g3d.sect.contribution}）`);
  ok(S.totalStones(g3d) === before3 + 192, `depth3 灵石 80×2.4=192（实际 ${S.totalStones(g3d) - before3}）`);
  ok(g3d.items.some((i) => i.名称 === '宗门灵脉晶' && i.数量 === 5), 'depth3 材料 宗门灵脉晶×5（按 matMul 1.8 缩放）');
  ok(g3d.items.some((i) => i.名称 === '聚气丹' && i.数量 === 2), 'depth3 深处得聚气丹×2（按 artMul 1.6 缩放）');
  // 罗盘选项：rank>=3 出现，rank<3 不出现
  const gOpt = mkSect(1);
  ok(!S.extraCompassOptions(gOpt).some((o) => o.action.type === 'sectRealm'), 'rank1 罗盘无宗门秘境选项');
  gOpt.sect.rank = 3;
  ok(S.extraCompassOptions(gOpt).some((o) => o.action.type === 'sectRealm'), 'rank3 罗盘出现宗门秘境选项');
}


/* ---------- 宗门灵脉晶接入炼器（修复死道具） ---------- */
// 新增「灵脉石饰」配方应将宗门灵脉晶作为真实锻造材料，使其不再是死道具
const lmRecipe = ART_RECIPES.炼器.find((r) => r.id === 'lingmai_shi');
ok(!!lmRecipe, '炼器新增灵脉石饰配方');
ok(lmRecipe && lmRecipe.need['宗门灵脉晶'] === 1, '灵脉石饰配方消耗宗门灵脉晶×1');
ok(lmRecipe && lmRecipe.need['矿石'] === 2, '灵脉石饰配方消耗矿石×2');
// 材料不足：无法锻造、不产出
const lmState = S.createNewGame({ name: '灵脉测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(lmState);
const lmNoMat = S.practiceArt(lmState, '炼器', 'lingmai_shi');
ok(!lmNoMat.some((l) => l.includes('百艺制成')), '无材料时灵脉石饰锻造不产出');
// 给予材料：确定性产出灵脉石饰并消耗材料
storeItem(lmState, { 名称: '宗门灵脉晶', 类型: '材料', 数量: 1, 描述: 'x' });
storeItem(lmState, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: 'x' });
const lmBefore = lmState.items.find((i) => i.名称 === '宗门灵脉晶')?.数量 || 0;
const lmLogs = S.practiceArt(lmState, '炼器', 'lingmai_shi');
ok(lmLogs.some((l) => l.includes('灵脉石饰')), '持材料锻造灵脉石饰成功产出');
ok((lmState.items.find((i) => i.名称 === '宗门灵脉晶')?.数量 || 0) === lmBefore - 1, '锻造消耗宗门灵脉晶×1');
ok(!!lmState.items.find((i) => i.名称 === '灵脉石饰'), '背包出现灵脉石饰装备');

/* ---------- 兽材百艺闭环：妖兽材料接入制符/炼丹（修复装饰性死材料） ---------- */
// 1) 野兽掉落应产出通用「矿石」（此前误产「妖兽矿石」，导致灵脉石饰配方无法在真实游戏完成）
state.arts['制符'] = state.arts['制符'] || { level: 1, exp: 0 };
state.arts['炼丹'] = state.arts['炼丹'] || { level: 1, exp: 0 };
let dropOre = false;
for (let i = 0; i < 600 && !dropOre; i++) {
  const enemy = { name: '试炼妖兽', level: 5, danger: 2 };
  const arr = S.generateBeastDrops(state, enemy);
  if (arr.some((d) => d.名称 === '矿石')) dropOre = true;
}
ok(dropOre, '野兽掉落可产出通用「矿石」（灵脉石饰配方在真实游戏可达）');

// 2) 制符：妖兽皮毛 → 兽皮护符（ward 效果，战斗失败减轻损失）
storeItem(state, { 名称: '妖兽皮毛', 类型: '材料', 数量: 3, 描述: '测试', 价值: 20 });
const beforePelt = state.items.find((i) => i.名称 === '兽皮护符')?.数量 || 0;
S.practiceArt(state, '制符', 'pelt_talisman', undefined, 1);
const afterPelt = state.items.find((i) => i.名称 === '兽皮护符');
ok(afterPelt && afterPelt.数量 > beforePelt && afterPelt.effect && afterPelt.effect.ward === true, '妖兽皮毛可制符为兽皮护符（ward 效果生效）');

// 3) 炼丹：妖兽灵草 → 凝元丹（exp+100）
storeItem(state, { 名称: '妖兽灵草', 类型: '材料', 数量: 2, 描述: '测试', 价值: 20 });
const beforeNing = state.items.find((i) => i.名称 === '凝元丹')?.数量 || 0;
S.practiceArt(state, '炼丹', 'ningyuan', undefined, 1);
const afterNing = state.items.find((i) => i.名称 === '凝元丹');
ok(afterNing && afterNing.数量 > beforeNing && afterNing.effect && afterNing.effect.exp === 100, '妖兽灵草可炼丹为凝元丹（exp+100）');

// 4) 炼丹：妖兽兽骨 → 兽骨续命丹（heal）
storeItem(state, { 名称: '妖兽兽骨', 类型: '材料', 数量: 2, 描述: '测试', 价值: 20 });
const beforeShou = state.items.find((i) => i.名称 === '兽骨续命丹')?.数量 || 0;
S.practiceArt(state, '炼丹', 'shougu_dan', undefined, 1);
const afterShou = state.items.find((i) => i.名称 === '兽骨续命丹');
ok(afterShou && afterShou.数量 > beforeShou && afterShou.effect && afterShou.effect.heal === true, '妖兽兽骨可炼丹为兽骨续命丹（heal 效果生效）');

/* ---------- 地火引：百艺助燃剂（修复装饰性死道具） ---------- */
// 地火引此前 effect.craft 从未被任何逻辑读取，坊市可买、游历可掉、图鉴声称
// "百艺炼器时提高品质"却从不生效，属装饰性死道具；亦不可直接服用（会被白扣）。
// 现接入百艺配方制作：持有则自动消耗 1 张、本次产量 +1，且拦截直接服用。

// 1) 无地火引对照：灵脉石饰基础产量 = 1
const fgBase = S.createNewGame({ name: '地火对照', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(fgBase);
storeItem(fgBase, { 名称: '宗门灵脉晶', 类型: '材料', 数量: 1, 描述: 'x' });
storeItem(fgBase, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: 'x' });
S.practiceArt(fgBase, '炼器', 'lingmai_shi');
const fgBaseQty = fgBase.items.filter((i) => i.名称 === '灵脉石饰').reduce((s, i) => s + (i.数量 || 1), 0);
ok(fgBaseQty === 1, '无地火引时灵脉石饰基础产量 = 1');

// 2) 持地火引：产量 +1，且地火引被消耗
const fgState = S.createNewGame({ name: '地火加成', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(fgState);
storeItem(fgState, { 名称: '宗门灵脉晶', 类型: '材料', 数量: 1, 描述: 'x' });
storeItem(fgState, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: 'x' });
storeItem(fgState, { 名称: '地火引', 类型: '消耗品', 数量: 1, 描述: 'x', effect: { craft: 15 } });
S.practiceArt(fgState, '炼器', 'lingmai_shi');
const fgQty = fgState.items.filter((i) => i.名称 === '灵脉石饰').reduce((s, i) => s + (i.数量 || 1), 0);
ok(fgQty === 2, '持地火引时灵脉石饰产量 +1（=2）');
ok(!fgState.items.some((i) => i.名称 === '地火引'), '百艺制作自动消耗地火引');

// 3) 丹药同样 +1：聚气丹（基础 2）→ 3
const fgPill = S.createNewGame({ name: '地火丹药', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(fgPill);
storeItem(fgPill, { 名称: '百越灵草', 类型: '材料', 数量: 1, 描述: 'x' });
storeItem(fgPill, { 名称: '海灵珠', 类型: '材料', 数量: 1, 描述: 'x' });
storeItem(fgPill, { 名称: '地火引', 类型: '消耗品', 数量: 1, 描述: 'x', effect: { craft: 15 } });
S.practiceArt(fgPill, '炼丹', '聚气丹');
const fgPillQty = fgPill.items.filter((i) => i.名称 === '聚气丹').reduce((s, i) => s + (i.数量 || 1), 0);
ok(fgPillQty === 3, '持地火引时聚气丹产量 +1（=3）');

// 4) 材料不足时地火引不被消耗（避免白扣）
const fgNoMat = S.createNewGame({ name: '地火缺料', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(fgNoMat);
storeItem(fgNoMat, { 名称: '地火引', 类型: '消耗品', 数量: 1, 描述: 'x', effect: { craft: 15 } });
const fgNoMatLogs = S.practiceArt(fgNoMat, '炼器', 'lingmai_shi');
ok(fgNoMatLogs.some((l) => l.includes('材料不足')), '材料不足时配方不产出');
ok(fgNoMat.items.some((i) => i.名称 === '地火引' && i.数量 === 1), '材料不足时地火引不被消耗');

// 5) 直接服用地火引被拦截，不消耗（防白扣）
const fgUse = S.createNewGame({ name: '地火服用', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(fgUse);
storeItem(fgUse, { 名称: '地火引', 类型: '消耗品', 数量: 1, 描述: 'x', effect: { craft: 15 } });
const fgUseIdx = fgUse.items.findIndex((i) => i.名称 === '地火引');
const fgUseRes = S.useItem(fgUse, fgUseIdx);
ok(fgUseRes && fgUseRes.some((l) => l.includes('不宜直接服用')), '直接服用地火引被拦截提示');
ok(fgUse.items.some((i) => i.名称 === '地火引' && i.数量 === 1), '直接服用地火引不被消耗');
/* ---------- 仙缘·太初之气：兑换绝世机缘（死道具修复，确定性收益） ---------- */
{
  const g = S.createNewGame({ name: '太初仙缘', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {};
  g.player.level = 96; g.player.exp = 0; // 96级 expNeed=3000>2000，2000 修为稳定不连升
  storeItem(g, { 名称: '仙缘·太初之气', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  const expBefore = g.player.exp;
  const yunBefore = (g.player.daoYun?.exp || 0);
  const wuxingBefore = (g.player.daoBase?.悟性?.exp || 0);
  const stonesBefore = S.totalStones(g);
  const r = S.performAction(g, { title: '太初仙缘·兑换绝世机缘', action: { type: 'taichuXianyuan' } });
  ok(r && Array.isArray(r.logs) && r.logs.length > 0, '太初仙缘兑换返回结构化日志');
  ok(!g.items.some((i) => i.名称 === '仙缘·太初之气'), '兑换后仙缘·太初之气被消耗');
  ok(g.player.exp === expBefore + 2000, '兑换后修为+2000（高位不连升）');
  ok((g.player.daoYun?.exp || 0) === yunBefore + 40, '兑换后道韵经验+40');
  ok((g.player.daoBase?.悟性?.exp || 0) === wuxingBefore + 25, '兑换后悟性经验+25');
  ok(S.totalStones(g) === stonesBefore + 800, '兑换后下品灵石+800');
  ok(g.techniques.some((t) => t.名称 === '太虚剑经'), '兑换赠天品功法《太虚剑经》');
  // 罗盘选项：持有才出现
  const gOpt = S.createNewGame({ name: '太初选项', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gOpt);
  ok(!S.extraCompassOptions(gOpt).some((o) => o.action.type === 'taichuXianyuan'), '无仙缘时不出现太初仙缘选项');
  storeItem(gOpt, { 名称: '仙缘·太初之气', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  ok(S.extraCompassOptions(gOpt).some((o) => o.action.type === 'taichuXianyuan'), '持有仙缘时出现太初仙缘选项');
  // 持有 2 份：仅消耗 1 份
  const g2 = S.createNewGame({ name: '太初仙缘2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g2);
  storeItem(g2, { 名称: '仙缘·太初之气', 类型: '材料', 数量: 2, 描述: 'x', 价值: 300 });
  S.performAction(g2, { title: '太初仙缘·兑换绝世机缘', action: { type: 'taichuXianyuan' } });
  const remain = g2.items.filter((i) => i.名称 === '仙缘·太初之气').reduce((s, i) => s + (i.数量 || 1), 0);
  ok(remain === 1, '持有 2 份兑换后仅消耗 1 份（剩 1）');
  // 无仙缘时不崩溃、不凭空产生
  const g3 = S.createNewGame({ name: '太初仙缘3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g3);
  const r3 = S.performAction(g3, { title: '太初仙缘·兑换绝世机缘', action: { type: 'taichuXianyuan' } });
  ok(r3 && Array.isArray(r3.logs), '无仙缘·太初之气时兑换不崩溃');
  ok(!g3.items.some((i) => i.名称 === '仙缘·太初之气'), '无仙缘时不凭空产生');
}



/* ---------- 仙缘：掉落修复 + 罗盘「仙缘兑换」消费者（确定性收益） ---------- */
{
  // 1) 掉落修复：xianyuan 必须产出真实「仙缘」，绝不产生幽灵物「妖兽仙缘」
  const gx = S.createNewGame({ name: '仙缘掉落', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gx);
  let phantom = 0, sawXianyuan = 0;
  for (let t = 0; t < 150; t++) {
    const drops = S.generateBeastDrops(gx, { name: '幽冥兽', level: 400, danger: 5, beast: true });
    for (const d of drops) {
      if (d.名称 === '妖兽仙缘') phantom++;
      if (d.名称 === '仙缘') sawXianyuan++;
    }
  }
  ok(phantom === 0, '野兽掉落绝不产生幽灵物「妖兽仙缘」');
  ok(sawXianyuan > 0, '高阶妖兽有概率掉落真实「仙缘」');

  // 2) 兑换确定性收益
  const g = S.createNewGame({ name: '仙缘兑换', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {};
  g.player.level = 96; g.player.exp = 0;
  storeItem(g, { 名称: '仙缘', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  const expB = g.player.exp, yunB = (g.player.daoYun?.exp || 0), wxB = (g.player.daoBase?.悟性?.exp || 0), stB = S.totalStones(g);
  const r = S.performAction(g, { title: '仙缘兑换·道途助益', action: { type: 'xianyuanExchange' } });
  ok(r && Array.isArray(r.logs) && r.logs.length > 0, '仙缘兑换返回结构化日志');
  ok(!g.items.some((i) => i.名称 === '仙缘'), '兑换后「仙缘」被消耗');
  ok(g.player.exp === expB + 200, '兑换后修为+200（高位不连升）');
  ok((g.player.daoYun?.exp || 0) === yunB + 15, '兑换后道韵经验+15');
  ok((g.player.daoBase?.悟性?.exp || 0) === wxB + 20, '兑换后悟性经验+20');
  ok(S.totalStones(g) === stB + 300, '兑换后下品灵石+300');

  // 3) 罗盘选项显隐
  const gOpt = S.createNewGame({ name: '仙缘选项', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gOpt);
  ok(!S.extraCompassOptions(gOpt).some((o) => o.action.type === 'xianyuanExchange'), '无仙缘时不出现仙缘兑换选项');
  storeItem(gOpt, { 名称: '仙缘', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  ok(S.extraCompassOptions(gOpt).some((o) => o.action.type === 'xianyuanExchange'), '持有仙缘时出现仙缘兑换选项');

  // 4) 无仙缘时不崩溃、不凭空产生
  const g3 = S.createNewGame({ name: '仙缘无', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g3);
  const r3 = S.performAction(g3, { title: '仙缘兑换·道途助益', action: { type: 'xianyuanExchange' } });
  ok(r3 && Array.isArray(r3.logs), '无仙缘时兑换不崩溃');
  ok(!g3.items.some((i) => i.名称 === '仙缘'), '无仙缘时不凭空产生');
}
/* ---------- 驯兽口粮（百艺御兽产出）收服时自动消耗 ---------- */
{
  // 1) 持有 1 份：收服尝试后必被消耗（无论成败，与「驭兽香」一致），落实图鉴/UI「可大幅提升收服概率」的承诺
  const tb = S.createNewGame({ name: '驯兽口粮', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(tb);
  tb.beasts.slots = []; tb.beasts.activeIdx = -1; // 清空灵兽栏，保证可收服
  storeItem(tb, { 名称: '驯兽口粮', 类型: '消耗品', 数量: 1, effect: { tame: 15 }, 描述: 'x', 价值: 120 });
  ok(!!tb.items.find((i) => i.名称 === '驯兽口粮'), '注入前持有驯兽口粮');
  const rb = S.tameBeast(tb, { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' }, false);
  ok(rb && Array.isArray(rb.logs), '驯兽口粮收服返回结构化日志');
  ok(!tb.items.some((i) => i.名称 === '驯兽口粮'), '收服尝试后「驯兽口粮」被消耗（消除死道具）');

  // 2) 持有多份：仅消耗 1 份
  const tb2 = S.createNewGame({ name: '驯兽口粮2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(tb2);
  tb2.beasts.slots = []; tb2.beasts.activeIdx = -1;
  storeItem(tb2, { 名称: '驯兽口粮', 类型: '消耗品', 数量: 2, effect: { tame: 15 }, 描述: 'x', 价值: 120 });
  S.tameBeast(tb2, { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' }, false);
  const left = tb2.items.find((i) => i.名称 === '驯兽口粮');
  ok(left && left.数量 === 1, '多份驯兽口粮收服后仅耗 1 份（剩 1）');

  // 3) 无驯兽口粮时不凭空产生、不报错
  const tb3 = S.createNewGame({ name: '驯兽口粮3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(tb3);
  tb3.beasts.slots = []; tb3.beasts.activeIdx = -1;
  S.tameBeast(tb3, { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' }, false);
  ok(!tb3.items.some((i) => i.名称 === '驯兽口粮'), '无驯兽口粮时收服不凭空产生');
}

/* ---------- 灵兽契约首获修复（消除收服死循环） ---------- */
function contractGroup() {
  const c1 = S.createNewGame({ name: '契约1', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(c1);
  c1.beasts.slots = []; c1.beasts.activeIdx = -1;
  let rr = null;
  for (let k = 0; k < 300 && !(rr && rr.ok); k++) rr = S.tameBeast(c1, { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' }, false);
  ok(rr && rr.ok === true, '收服成功返回 ok');
  const contract = c1.items.find((i) => i.名称 === '灵兽契约');
  ok(!!contract && contract.数量 === 1, '成功收服后「灵兽契约」真进入背包（作为驯兽凭证）');
  // 灵兽栏有空位时入口可见（修复后不再以持有契约为门槛，消除死锁）
  c1.beasts.slots = []; c1.beasts.activeIdx = -1;
  ok(S.extraCompassOptions(c1).some((o) => o.action && o.action.type === 'tameBeast'), '灵兽栏有空位时「前往灵兽栖息地」入口可见');
}

/* ---------- 驱虫粉接入真实消费点（消除死道具） ---------- */
function bugPowderGroup() {
  const b1 = S.createNewGame({ name: '驱虫1', gender: '男', raceId: 'human', ageId: 'young', regionId: 'lingnan', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(b1);
  storeItem(b1, { 名称: '驱虫粉', 类型: '消耗品', 数量: 2, effect: { explore: 15 }, 描述: '降低雨林风险', 价值: 35 });
  const before = b1.items.find((i) => i.名称 === '驱虫粉').数量;
  const res = S.resolveWanderEvent(b1);
  const after = b1.items.find((i) => i.名称 === '驱虫粉');
  ok(after && after.数量 === before - 1, '岭南游历后「驱虫粉」被消耗 1 份（消除死道具）');
  ok(Array.isArray(res.logs) && res.logs.length > 0 && res.logs[0].includes('驱虫粉'), '驱虫粉生效提示写入日志');
  const b2 = S.createNewGame({ name: '驱虫2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'lingnan', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(b2);
  const res2 = S.resolveWanderEvent(b2);
  ok(Array.isArray(res2.logs), '无驱虫粉时岭南游历不崩溃');
  ok(!b2.items.some((i) => i.名称 === '驱虫粉'), '无驱虫粉时不凭空产生');
  const b3 = S.createNewGame({ name: '驱虫3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(b3);
  storeItem(b3, { 名称: '驱虫粉', 类型: '消耗品', 数量: 1, effect: { explore: 15 }, 描述: 'x', 价值: 35 });
  S.resolveWanderEvent(b3);
  ok(b3.items.find((i) => i.名称 === '驱虫粉').数量 === 1, '非岭南地区游历不消耗驱虫粉');
}

/* ---------- 图鉴幽灵条目治理 ---------- */
function codexGhostGroup() {
  const entries = codexEntries(S.createNewGame({ name: '图鉴幽灵', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() }));
  ok(!entries.some((e) => ['灵草', '兽骨', '皮毛'].includes(e.name)), '图鉴已移除从不生成的「灵草/兽骨/皮毛」幽灵条目');
  for (const nm of ['妖兽灵草', '妖兽兽骨', '妖兽皮毛', '矿石']) {
    const e = entries.find((x) => x.name === nm);
    ok(!!e && typeof e.effect === 'string' && e.effect.length > 0, `图鉴含真实掉落条目「${nm}」且描述完整`);
  }
}

contractGroup();
bugPowderGroup();
codexGhostGroup();


/* ---------- 灵兽栖息地可达性修复（不再以持有契约为门槛） ---------- */
function beastHabitatReachableGroup() {
  // 新玩家（无契约、栏位空）也应能见到「前往灵兽栖息地」入口（此前契约门槛导致死锁）
  const sb = S.createNewGame({ name: '栖息地可达', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sb);
  ensureBeastState(sb); // 初始化 beasts
  sb.beasts.slots = []; sb.beasts.activeIdx = -1;
  ok(!sb.items.some((i) => i.名称 === '灵兽契约'), '新玩家初始无灵兽契约');
  ok(S.extraCompassOptions(sb).some((o) => o.action && o.action.type === 'tameBeast'), '无契约、栏位空时「前往灵兽栖息地」入口可见（死锁已修复）');
  // 收服成功赠予契约作为驯兽凭证（仅补发一次，不累积）
  let rr = null;
  for (let k = 0; k < 300 && !(rr && rr.ok); k++) rr = S.tameBeast(sb, { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' }, false);
  ok(rr && rr.ok, '可成功收服灵兽');
  const c2 = sb.items.find((i) => i.名称 === '灵兽契约');
  ok(c2 && c2.数量 === 1, '收服后获赠「灵兽契约」且数量仅 1（不累积）');
  // 栏位满时入口隐藏（无法再收服）
  sb.beasts.slots = [{ name: '满灵兽', element: '火', power: 5, skill: 'x', desc: 'x', tamed: true }];
  ok(!S.extraCompassOptions(sb).some((o) => o.action && o.action.type === 'tameBeast'), '灵兽栏满时入口隐藏');
}
beastHabitatReachableGroup();


/* ---------- 基础功法玉简：购买按 effect.technique 授予具体功法（确定性） ---------- */
{
  const g = S.createNewGame({ name: '功法玉简测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.inventory.capacity = 999; g.inventory.used = 0;
  S.addStones(g, 100000);
  const jade = S.shopStock(g).find((x) => x.名称 === '基础功法玉简');
  ok(!!jade, '坊市含基础功法玉简');
  if (jade) {
    S.buyItem(g, jade);
    const t = g.techniques.find((x) => x.名称 === '基础吐纳术');
    ok(!!t, '基础功法玉简授予「基础吐纳术」', t ? '品级=' + t.品级 : '缺失');
    ok(t && t.品级 === '凡品', '「基础吐纳术」品级为凡品', t ? t.品级 : '缺失');
    ok(!g.techniques.some((x) => x.名称 === '基础功法玉简'), '不会把玉简名当功法写入');
  }
}

/* ---------- 道友之能全生效（修复 6 种装饰性假承诺 + 简易阵旗死道具） ---------- */
{
  // T1: daoFriendJob helper
  const g = S.createNewGame({ name: '道友之能测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.npcs = [
    { name: '炉伯', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job: '炼器师', trait: '木讷', level: 10 },
    { name: '剑客', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job: '剑修', trait: '豪爽', level: 10 },
    { name: '游方', relation: 1, relationName: '熟识', favor: 30, met: true, gender: '男', race: '人', realm: '练气', job: '散修', trait: '圆滑', level: 10 },
  ];
  ok(S.daoFriendJob(g, '炼器师') && S.daoFriendJob(g, '炼器师').name === '炉伯', 'daoFriendJob 命中炼器师道友');
  ok(S.daoFriendJob(g, '剑修') && S.daoFriendJob(g, '剑修').name === '剑客', 'daoFriendJob 命中剑修道友');
  ok(S.daoFriendJob(g, '符师') === null, 'daoFriendJob 无对应职业时返回 null');
  ok(S.daoFriendJob(g, '散修') === null, 'relation<3 的散修不计入道友之能');

  // T2: 炼器师八折（enhanceEquip 淬炼造价）
  const mkEquip = () => {
    const s = S.createNewGame({ name: '淬炼测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(s);
    s.player.power = 100;
    s.equipment.weapon = { 名称: '试炼剑', 部位: 'weapon', 等级: 5, 战力: 10, 品阶: 'fan' };
    s.currencies = { '下品灵石': 99999, '中品灵石': 0, '上品灵石': 0 };
    return s;
  };
  const r0 = S.enhanceEquip(mkEquip(), { where: 'equip', slot: 'weapon' });
  ok(r0.cost === 40 * (5 + 1), `无炼器师道友时淬炼造价=240（实际 ${r0.cost}）`);
  const dis = mkEquip();
  dis.npcs = [{ name: '炉伯', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job: '炼器师', trait: '木讷', level: 10 }];
  const r1 = S.enhanceEquip(dis, { where: 'equip', slot: 'weapon' });
  ok(r1.cost === Math.round(40 * (5 + 1) * 0.8), `炼器师道友八折后造价=192（实际 ${r1.cost}）`);

  // T3: 剑修/体修 临阵助拳（战前预估确定性 +6）
  const mkBattle = (withFriend) => {
    const s = S.createNewGame({ name: '助拳测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(s);
    s.player.power = 200;
    if (withFriend) s.npcs = [{ name: '剑客', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job: '剑修', trait: '豪爽', level: 10 }];
    return s;
  };
  const enemy = { name: '试炼傀儡', realm: '练气', level: 10, power: 200 };
  const pvNo = S.previewBattle(mkBattle(false), enemy, 'shengci', 'normal', false).finalRate;
  const pvYes = S.previewBattle(mkBattle(true), enemy, 'shengci', 'normal', false).finalRate;
  ok(pvYes === Math.min(95, pvNo + 6), `剑修道友助拳胜率 +6（${pvNo}→${pvYes}）`);

  // T4: 简易阵旗 / 低阶符箓 现为战斗 ward（修复死道具）—— 败北时消耗且灵石不失
  const wardLossTest = (itemName) => {
    for (let i = 0; i < 200; i++) {
      const s = S.createNewGame({ name: '护阵测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
      ensureLifeState(s);
      s.player.power = 10;
      s.items.push({ 名称: itemName, 类型: '消耗品', 数量: 1, 描述: '测试', 价值: 50, effect: { ward: true } });
      s.currencies = { '下品灵石': 500, '中品灵石': 0, '上品灵石': 0 };
      const before = S.totalStones(s);
      const e = { name: '太古凶兽', realm: '化神', level: 99, power: 999999 };
      const rep = S.resolveBattle(s, e, 'shengci', false, 'normal', false);
      if (!rep.win) {
        ok(!s.items.some((it) => it.名称 === itemName), `${itemName} 败北时被消耗（非死道具）`);
        ok(S.totalStones(s) === before, `${itemName} 替你挡去灵石损失`);
        return;
      }
    }
    ok(false, `${itemName} 未触发败北场景`);
  };
  wardLossTest('简易阵旗');
  wardLossTest('低阶符箓');

  // T5: 散修道友每半年引荐一位未结识高人（确定性，无 RNG）
  {
    const s = S.createNewGame({ name: '引荐测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(s);
    s.world.turns = 5; // nextMonth 会 +1 → 6，恰为 6 的倍数
    s.npcs = [
      { name: '游方', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job: '散修', trait: '圆滑', level: 10 },
      { name: '隐士', relation: 0, relationName: '陌路', favor: 0, met: false, gender: '男', race: '人', realm: '练气', job: '阵师', trait: '清冷', level: 10 },
    ];
    const pendingBefore = s.npcs.filter((n) => n.met === false).length;
    S.nextMonth(s);
    const pend = s.npcs.find((n) => n.name === '隐士');
    ok(pend.met === true, '散修道友引荐使未结识高人变为已结识');
    ok(s.world.turns % 6 === 0 && pendingBefore === 1, '引荐在每半年（turns 为 6 倍数）触发');
  }
}

/* ---------- 道友委托（交付类支线闭环） ---------- */
{
  const cnt = (st, name) => (st.items || []).filter((x) => x.名称 === name).reduce((s, x) => s + (Number(x.数量) || 1), 0);
  const mk = (job) => {
    const g = S.createNewGame({ name: '委托测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.npcs = [{ name: '炉伯', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job, trait: '木讷', level: 10 }];
    return g;
  };
  const g0 = mk('炼器师');
  g0.npcs[0].relation = 1; g0.npcs[0].relationName = '熟识';
  ok(!S.commissionInfo(g0, g0.npcs[0]).available, '关系不足时委托不可见');
  const r0 = S.interactNpc(g0, g0.npcs[0], 'commission');
  ok(Array.isArray(r0) && r0.some((l) => l.includes('无意相托')), '关系不足时交付委托被拦截');
  const g = mk('炼器师');
  const ci = S.commissionInfo(g, g.npcs[0]);
  ok(ci.available && ci.task.item === '矿石' && ci.need === 3, '炼器师委托为矿石x3');
  const blocked = S.interactNpc(g, g.npcs[0], 'commission');
  ok(blocked.some((l) => l.includes('暂难交差')), '材料不足时委托交付被拒');
  ok(cnt(g, '矿石') === 0, '拒绝后不消耗材料');
  storeItem(g, { 名称: '矿石', 类型: '材料', 数量: 3, 描述: '测试矿石', 价值: 5 });
  const beforeStash = g.equipment.stash.length;
  const done = S.interactNpc(g, g.npcs[0], 'commission');
  ok(done.some((l) => l.includes('了结一桩委托')), '材料齐全时交付成功');
  ok(cnt(g, '矿石') === 0, '交付后矿石被消耗');
  ok(g.equipment.stash.length === beforeStash + 1, '交付后回赠一件装备入备用栏');
  ok(g.npcs[0].commissionCd > g.world.turns, '交付后进入冷却');
  const cd = S.interactNpc(g, g.npcs[0], 'commission');
  ok(cd.some((l) => l.includes('筹措中')), '冷却期内不可再交付');
  const gs = mk('散修');
  storeItem(gs, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: '测试矿石', 价值: 5 });
  const stonesBefore = S.totalStones(gs);
  const ds = S.interactNpc(gs, gs.npcs[0], 'commission');
  ok(ds.some((l) => l.includes('灵石+120')), '散修委托确定性回赠灵石+120');
  ok(S.totalStones(gs) === stonesBefore + 120, '灵石实际到账+120');
}

/* ---------- 拍卖拍品不再是死道具（effect 真实落地） ---------- */
const poolXM = AUCTION_ITEMS_POOL.find((x) => x.name === '洗髓丹');
const poolYS = AUCTION_ITEMS_POOL.find((x) => x.name === '延寿丹');
const poolHT = AUCTION_ITEMS_POOL.find((x) => x.name === '灵兽契约');
ok(poolXM && poolXM.effect && poolXM.effect.daoBase, '拍卖洗髓丹带 daoBase effect（非死道具）');
ok(poolYS && poolYS.effect && poolYS.effect.lifespan === 20, '拍卖延寿丹带 lifespan:20 effect');
ok(poolHT && poolHT.effect && poolHT.effect.beastSlot === 1, '拍卖灵兽契约带 beastSlot:1 effect');
// 按 awardAuctionItem 的真实发放映射（name→名称 + 复制 effect/toxicity）构造物品，隔离拍卖 RNG
const grantAuctionItem = (st, tpl) => {
  const it = { 名称: tpl.name, 类型: tpl.type, 数量: 1, 描述: tpl.desc };
  if (tpl.effect) it.effect = tpl.effect;
  if (typeof tpl.toxicity === 'number') it.toxicity = tpl.toxicity;
  return storeItem(st, it);
};
const pickLastIdx = (arr, pred) => { for (let k = arr.length - 1; k >= 0; k--) if (pred(arr[k])) return k; return -1; };

// 洗髓丹服用真实提升道基
const stXM = S.createNewGame({ name: '拍卖洗髓', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(stXM);
stXM.inventory.capacity = 1000;
const dbBefore = Object.values(stXM.player.daoBase).reduce((a, b) => a + b.level, 0);
ok(grantAuctionItem(stXM, poolXM), '拍卖洗髓丹成功入库（带名称映射）');
const idxXM = pickLastIdx(stXM.items, (i) => i.名称 === '洗髓丹' && i.effect && i.effect.daoBase);
S.useItem(stXM, idxXM);
ok(Object.values(stXM.player.daoBase).reduce((a, b) => a + b.level, 0) - dbBefore >= 5, '服用拍卖洗髓丹真实提升道基 5~10 级');

// 延寿丹服用真实提升寿元上限
const stYS = S.createNewGame({ name: '拍卖延寿', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(stYS);
stYS.inventory.capacity = 1000;
const lifeBefore = stYS.player.lifespan;
ok(grantAuctionItem(stYS, poolYS), '拍卖延寿丹成功入库（带名称映射）');
const idxYS = pickLastIdx(stYS.items, (i) => i.名称 === '延寿丹' && i.effect && i.effect.lifespan);
S.useItem(stYS, idxYS);
ok(stYS.player.lifespan === lifeBefore + 20, '服用拍卖延寿丹寿元上限 +20');

// 延寿丹「一生最多 3 颗」上限：第 4 颗服用失效（不消耗、不累加、寿命不变），兑现图鉴承诺
// 注：storeItem 按名称合并，4 颗注入后合并为「数量 4」的单一条目，服用按该条目递减。
{
  const stCap = S.createNewGame({ name: '延寿上限', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stCap);
  stCap.inventory.capacity = 1000;
  const life0 = stCap.player.lifespan;
  for (let i = 0; i < 4; i++) grantAuctionItem(stCap, poolYS); // 4 颗合并为「数量 4」
  const idxYs = pickLastIdx(stCap.items, (i) => i.名称 === '延寿丹' && i.effect && i.effect.lifespan);
  ok(idxYs >= 0 && stCap.items[idxYs].数量 === 4, '延寿上限：注入 4 颗（合并为数量 4）');
  S.useItem(stCap, idxYs); S.useItem(stCap, idxYs); S.useItem(stCap, idxYs); // 服满 3 颗（同条目递减，索引稳定）
  ok(stCap.player.lifespan === life0 + 60, '延寿上限：服满 3 颗寿元 +60');
  ok(stCap.player.lifespanPillsTaken === 3, '延寿上限：服用计数 = 3');
  ok(stCap.items[idxYs] && stCap.items[idxYs].数量 === 1, '延寿上限：3 颗已消耗、剩 1 颗');
  const before4 = stCap.player.lifespan;
  const logs4 = S.useItem(stCap, idxYs) || [];
  ok(stCap.player.lifespan === before4, '延寿上限：第 4 颗服用不增加寿元');
  ok(stCap.player.lifespanPillsTaken === 3, '延寿上限：第 4 颗不累加计数');
  ok(logs4.join('').includes('一生至多可服 3 颗'), '延寿上限：第 4 颗返回拒绝文案');
  ok(stCap.items[idxYs] && stCap.items[idxYs].数量 === 1, '延寿上限：第 4 颗未被消耗（仍留储物袋）');
  const fresh = S.createNewGame({ name: '新世', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ok(fresh.player.lifespanPillsTaken === 0, '延寿上限：转世新一生计数归零（newGame 重置）');
}

// 灵兽契约服用拓宽灵兽栏
const stHT = S.createNewGame({ name: '拍卖契约', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(stHT);
stHT.inventory.capacity = 1000;
ensureBeastState(stHT);
const ms0 = stHT.beasts.maxSlots;
ok(grantAuctionItem(stHT, poolHT), '拍卖灵兽契约成功入库（带名称映射）');
const idxHT = pickLastIdx(stHT.items, (i) => i.名称 === '灵兽契约' && i.effect && i.effect.beastSlot);
S.useItem(stHT, idxHT);
ok(stHT.beasts.maxSlots === ms0 + 1, '服用灵兽契约灵兽栏上限 +1');

/* ---------- 灵兽「伴生天赋」：出战技能真实效果（确定性，无 RNG） ---------- */
{
  // mk 直接返回游戏 state（含 state.beasts），下游以 state 入参调用战斗/秘境接口，避免把包装对象当 state 传入。
  const mk = () => {
    const g = S.createNewGame({ name: '伴生天赋', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    ensureBeastState(g);
    g.player.level = 10; g.player.power = 500;
    return g;
  };
  const enemy = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  // 1) 风刃突袭：出战额外 +5% 胜率（与同配置无天赋灵兽对照，隔离天赋增量）
  {
    const g = mk();
    g.beasts.slots = [{ name: '青风狼', element: '风', star: 1, power: 8, skill: '风刃突袭', desc: 'x' }];
    g.beasts.activeIdx = 0;
    const ctrl = mk(); ctrl.beasts.slots = [{ name: '青风狼', element: '风', star: 1, power: 8, skill: 'x', desc: 'x' }]; ctrl.beasts.activeIdx = 0;
    const ctrlRate = S.previewBattle(ctrl, enemy, 'shengci').finalRate;
    const wolfRate = S.previewBattle(g, enemy, 'shengci').finalRate;
    ok(wolfRate === Math.min(95, ctrlRate + 5), `风刃突袭出战额外 +5%（对照${ctrlRate}/狼${wolfRate}）`);
    ok(S.activeBeastSkill(g) === '风刃突袭', 'activeBeastSkill 返回出战技能名');
    ok(S.activeBeastSkillEffect(g, 'winRate') === 5, 'activeBeastSkillEffect 读取天赋数值');
    ok(S.activeBeastSkillEffect(g, 'defeatRelief') === undefined, '无该天赋时返回 undefined');
  }
  // 2) 幻境迷心：出战且敌方等级高于己方时额外 +8%（越级专用）。
  //    用「高己方等级的敌人」触发天赋，并以同配置无天赋灵兽作对照，隔离 +8 增量（避免因基础率触底或默认灵兽加成干扰）。
  {
    const strongEnemy = { name: '强敌', realm: '金丹', level: 20, power: 500 };
    const g = mk();
    g.beasts.slots = [{ name: '九尾灵狐', element: '幻', star: 1, power: 18, skill: '幻境迷心', desc: 'x' }];
    g.beasts.activeIdx = 0;
    const ctrl = mk(); ctrl.beasts.slots = [{ name: '九尾灵狐', element: '幻', star: 1, power: 18, skill: 'x', desc: 'x' }]; ctrl.beasts.activeIdx = 0;
    const ctrlRate = S.previewBattle(ctrl, strongEnemy, 'shengci').finalRate;
    const skillRate = S.previewBattle(g, strongEnemy, 'shengci').finalRate;
    ok(skillRate === Math.min(95, ctrlRate + 8), `幻境迷心越级额外 +8%（对照${ctrlRate}/天赋${skillRate}）`);
    // 同阶（敌等级不高于己方）不触发：与无天赋对照一致
    const sameEnemy = { name: '平手', realm: '练气', level: 10, power: 500 };
    const sameCtrl = S.previewBattle(ctrl, sameEnemy, 'shengci').finalRate;
    const sameSkill = S.previewBattle(g, sameEnemy, 'shengci').finalRate;
    ok(sameSkill === sameCtrl, `幻境迷心同阶不触发（对照${sameCtrl}/天赋${sameSkill}）`);
  }
  // 3) 雷击俯冲：已由 BEAST_WINRATE 覆盖，天赋名可识别
  {
    const g = mk();
    g.beasts.slots = [{ name: '雷翅隼', element: '雷', star: 1, power: 25, skill: '雷击俯冲', desc: 'x' }];
    g.beasts.activeIdx = 0;
    ok(S.activeBeastSkill(g) === '雷击俯冲', '雷击俯冲技能名可识别');
  }
  // 4) 铁背护主：出战战败减免惩罚（循环至落败，确定性验证免重伤/免失灵石）
  {
    const mkB = () => { const g = mk(); g.beasts.slots = [{ name: '铁背苍熊', element: '土', star: 1, power: 12, skill: '铁背护主', desc: 'x' }]; g.beasts.activeIdx = 0; g.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0 }; return g; };
    let wounded = -1, lostStones = -1, found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const g = mkB();
      const e = { name: '太古凶兽', realm: '化神', level: 60, power: 999999, beast: true };
      const before = S.totalStones(g);
      const rep = S.resolveBattle(g, e, 'yaoshou', false, 'normal', false);
      if (!rep.win) {
        found = true;
        wounded = g.flags.wounded || 0;
        lostStones = before - S.totalStones(g);
        ok(rep.logs.some((l) => l.includes('铁背护体')), '铁背护主战败文案出现');
        ok(wounded === 0, `铁背护主免重伤（wounded=${wounded}）`);
        ok(lostStones === 0, `铁背护主免失灵石（lost=${lostStones}）`);
      }
    }
    ok(found, '循环至落败以验证铁背护主（非 flaky）');
  }
  // 5) 玄水护盾：出战秘境探索灵材 +1（确定性，循环验证每次掉落均带加成文案）
  {
    const g = mk();
    g.beasts.slots = [{ name: '玄水龟', element: '水', star: 1, power: 10, skill: '玄水护盾', desc: 'x' }];
    g.beasts.activeIdx = 0;
    g.currencies = { '下品灵石': 5000, '中品灵石': 0, '上品灵石': 0 };
    ok(S.activeBeastSkillEffect(g, 'gather') === 1, '玄水护盾天赋=采集+1');
    const realm = availableMysticRealms(g).find((m) => !m.requiresMap && g.player.level >= m.minLevel && m.rewards && m.rewards.materials && m.rewards.materials.length);
    if (realm) {
      let allBonus = true, anyDrop = false;
      for (let i = 0; i < 40; i++) {
        const gg = mk(); gg.currencies = { '下品灵石': 5000, '中品灵石': 0, '上品灵石': 0 };
        gg.beasts.slots = [{ name: '玄水龟', element: '水', star: 1, power: 10, skill: '玄水护盾', desc: 'x' }];
        gg.beasts.activeIdx = 0;
        const rep = S.exploreMysticRealm(gg, realm.id, 1);
        const drop = rep.logs.find((l) => l.startsWith('获得材料：'));
        if (drop) { anyDrop = true; if (!drop.includes('玄水护盾相助')) allBonus = false; }
      }
      ok(anyDrop, '秘境确有灵材掉落');
      ok(allBonus, '玄水护盾出战时每次灵材掉落均带 +1 加成文案');
    }
  }
}



/* ---------- 灵兽「涅槃残焰」：出战渡劫失败保命（境界不跌落，确定性） ---------- */
{
  // 先建好 state（用真实随机），再覆盖 Math.random 恒为 0.999 强制突破失败（Rng.chance 必返 false）。
  const realRandom = Math.random;
  const gNo = S.createNewGame({ name: '涅槃对照', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gNo);
  gNo.player.level = 20; // 筑基瓶颈，失败倒退 1 级
  const gYes = S.createNewGame({ name: '涅槃保命', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gYes);
  ensureBeastState(gYes);
  gYes.player.level = 20;
  gYes.beasts.slots = [{ name: '幼凰', element: '火', star: 5, power: 200, skill: '涅槃残焰', desc: '极稀有灵兽' }];
  gYes.beasts.activeIdx = 0;
  try {
    Math.random = () => 0.999;
    const lvB = gNo.player.level;
    const repNo = S.attemptBreakthrough(gNo);
    ok(!repNo.success, '强制失败：突破未成功（无涅槃灵兽）');
    ok(gNo.player.level === lvB - 1, `无涅槃灵兽失败跌落1级（${lvB}→${gNo.player.level}）`);
    ok(repNo.logs.some((l) => l.includes('渡劫失败')), '无涅槃灵兽失败文案出现');
    const lvY = gYes.player.level;
    const repYes = S.attemptBreakthrough(gYes);
    ok(!repYes.success, '强制失败：突破未成功（涅槃灵兽在场）');
    ok(gYes.player.level === lvY, `涅槃残焰保命：境界不跌落（${lvY}→${gYes.player.level}）`);
    ok(repYes.logs.some((l) => l.includes('涅槃残焰')), '涅槃残焰保命文案出现');
  } finally { Math.random = realRandom; }
}

/* ---------- 成就收集里程碑奖励（统计已解锁基础成就数，解锁阶段性收集奖励） ---------- */
const baseIds = ACHIEVEMENTS.filter((a) => !ACH_MILESTONE_IDS.has(a.id)).map((a) => a.id);
ok(baseIds.length >= 30, '基础成就数量充足（≥30）');
const mkAchState = (n) => {
  const s = S.createNewGame({ name: '里程碑测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s);
  s.achievements = baseIds.slice(0, n).map((id) => ({ id, name: 'x', icon: 'x', time: '1年1月' }));
  return s;
};
// 10 个基础成就 → 解锁「小有所成」，但「登堂入室/仙途大成」不解锁
let s10 = mkAchState(10);
const new10 = checkAchievements(s10);
ok(new10.some((a) => a.id === 'achCount10'), '解锁10个基础成就→小有所成');
ok(!new10.some((a) => a.id === 'achCount20'), '仅10个→登堂入室未解锁');
ok(!new10.some((a) => a.id === 'achCountAll'), '仅10个→仙途大成未解锁');
ok(baseIds.slice(0, 10).every((id) => s10.achievements.some((a) => a.id === id)), '手动设置的10个基础成就均已计入（里程碑不挤占基础计数）');
ok(s10.achievements.filter((a) => ACH_MILESTONE_IDS.has(a.id)).every((a) => a.id === 'achCount10'), '解锁的里程碑仅含 achCount10（里程碑自身不混入基础计数）');
// 20 个 → 解锁「登堂入室」
let s20 = mkAchState(20);
const new20 = checkAchievements(s20);
ok(new20.some((a) => a.id === 'achCount20'), '解锁20个基础成就→登堂入室');
ok(!new20.some((a) => a.id === 'achCountAll'), '仅20个→仙途大成未解锁');
// 全部基础成就 → 解锁「仙途大成」
let sAll = mkAchState(baseIds.length);
const newAll = checkAchievements(sAll);
ok(newAll.some((a) => a.id === 'achCountAll'), '解锁全部基础成就→仙途大成');
// 进度条上限正确
const vAll = achievementView(sAll);
const vCountAll = vAll.find((a) => a.id === 'achCountAll');
ok(vCountAll && vCountAll.progress && vCountAll.progress.max === baseIds.length && vCountAll.progress.ratio >= 1, '仙途大成进度上限=基础成就总数');
// 一键领取含三档收集奖励
const rc = claimAllAchievements(sAll);
ok(rc.ok && rc.total >= 800 + 1800 + 5000, '一键领取含三档收集奖励（≥7600灵石）');
const vAfter = achievementView(sAll);
ok(vAfter.filter((a) => ACH_MILESTONE_IDS.has(a.id)).every((a) => a.claimed), '三档收集奖励均已领取');

/* ---------- 行囊换装对比链路（2026-08-26 打磨：装备对比提示） ---------- */
// guessEquipSlot 已导出（行囊装备物品推算槽位的依据，requestEquipFromBag 依赖）
ok(typeof S.guessEquipSlot === 'function', 'guessEquipSlot 已导出为函数');
ok(S.guessEquipSlot({ 名称: '青锋剑', 类型: '装备' }) === 'weapon', 'guessEquipSlot·剑类→武器槽');
ok(S.guessEquipSlot({ 名称: '玄铁重甲', 类型: '装备' }) === 'armor', 'guessEquipSlot·甲类→护甲槽');
ok(S.guessEquipSlot({ 名称: '踏风靴', 类型: '装备' }) === 'boots', 'guessEquipSlot·靴类→鞋子槽');
// 行囊「装备」经 requestEquipFromBag 确认后调用的就是 useItem 此路径：
// 目标部位已有旧装时，旧装备进入备用栏、新装备生效（保障对比弹窗的语义正确）
{
  const eq = S.createNewGame({ name: '换装链路', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(eq);
  // 第一件：弱武器（Lv.1）直接装备，无旧装
  const w1 = S.generateEquip(eq, 'weapon', 1, '试剑·壹');
  eq.items.push({ 名称: w1.名称, 类型: '装备', 数量: 1, 描述: w1.描述, _equip: w1 });
  S.useItem(eq, eq.items.length - 1);
  ok(eq.equipment.weapon && eq.equipment.weapon.名称 === '试剑·壹', '首次装备·武器生效');
  ok((eq.equipment.stash || []).length === 0, '首次装备无旧装·备用栏为空');
  // 第二件：强武器（Lv.5）触发换装，旧装备进入备用栏（requestEquipFromBag 确认后调用的正是此路径）
  const w2 = S.generateEquip(eq, 'weapon', 5, '试剑·贰');
  const p2 = w2.战力;
  eq.items.push({ 名称: w2.名称, 类型: '装备', 数量: 1, 描述: w2.描述, _equip: w2 });
  const logs2 = S.useItem(eq, eq.items.length - 1);
  ok(eq.equipment.weapon && eq.equipment.weapon.名称 === '试剑·贰', '换装后·新武器生效');
  ok(eq.equipment.weapon.战力 === p2, '新武器战力正确');
  ok((eq.equipment.stash || []).some((e) => e.名称 === '试剑·壹'), '旧武器进入备用栏');
  ok((eq.equipment.stash || []).length === 1, '备用栏恰有 1 件');
  ok(Array.isArray(logs2) && logs2.join('').includes('换装'), 'useItem 返回换装日志');
}

/* ---------- 装备淬炼·成功预览（2026-08-26 打磨：enhancePreview 确定性预览） ---------- */
{
  const eq = S.createNewGame({ name: '淬炼预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(eq);
  // 先生成到局部变量再赋值，避免 generateEquip 内部 ensureLifeState 重建 equipment 覆盖手动赋值
  const w = S.generateEquip(eq, 'weapon', 3, '试剑·淬');
  eq.equipment.weapon = w;
  S.enhancePreview(eq, { where: 'equip', slot: 'weapon' }); // 触发一次迁移固化 weapon 槽
  const lvl = eq.equipment.weapon.等级;
  const pv = S.enhancePreview(eq, { where: 'equip', slot: 'weapon' });
  ok(pv.ok, 'enhancePreview·可行装备返回 ok');
  ok(pv.level === lvl, 'enhancePreview·等级一致');
  ok(pv.nextLevel === lvl + 1, 'enhancePreview·成功后等级 +1');
  ok(pv.curPower === eq.equipment.weapon.战力, 'enhancePreview·当前战力一致');
  ok(pv.gain > 0, 'enhancePreview·战力增益为正');
  ok(pv.nextPower === pv.curPower + pv.gain, 'enhancePreview·nextPower = curPower + gain');
  ok(pv.cost === 40 * (lvl + 1), 'enhancePreview·灵石消耗公式 40*(L+1)');
  ok(pv.rate === Math.max(35, 88 - lvl * 2), 'enhancePreview·成功率公式');
  // 备用栏路径：push 到 stash 并触发迁移（migrateEquipment 保留 stash）
  const sw = S.generateEquip(eq, 'armor', 5, '玄甲·淬');
  eq.equipment.stash.push(sw);
  S.enhancePreview(eq, { where: 'equip', slot: 'weapon' });
  ok(S.enhancePreview(eq, { where: 'stash', idx: 0 }).ok, 'enhancePreview·备用栏路径可用');
  // 满级（Lv.30）拒绝：直接抬高已迁移装备的等级，再预览（迁移 normalizeEquip 保留等级）
  eq.equipment.weapon.等级 = 30;
  const pv30 = S.enhancePreview(eq, { where: 'equip', slot: 'weapon' });
  ok(!pv30.ok && pv30.max === true, 'enhancePreview·满级返回 ok:false/max');
  ok(!S.enhanceEquip(eq, { where: 'equip', slot: 'weapon' }).ok, 'enhanceEquip·满级拒绝');
  eq.equipment.weapon = null;
  ok(!S.enhancePreview(eq, { where: 'equip', slot: 'weapon' }).ok, 'enhancePreview·无装备返回 ok:false');
  // enhanceEquip 结构校验（成功率 RNG，用循环确保至少成功一次以验证成功分支）
  const w2 = S.generateEquip(eq, 'weapon', 2, '试剑·二');
  eq.equipment.weapon = w2;
  S.enhancePreview(eq, { where: 'equip', slot: 'weapon' });
  const startLvl = eq.equipment.weapon.等级;
  let succeeded = false;
  for (let i = 0; i < 25 && !succeeded; i++) {
    S.addStones(eq, 100000);
    const before = S.totalStones(eq);
    const curLvl = eq.equipment.weapon.等级; // 调用前捕获，避免成功后等级+1 干扰断言
    const res = S.enhanceEquip(eq, { where: 'equip', slot: 'weapon' });
    ok(res.ok === true, 'enhanceEquip·返回 ok');
    ok(res.cost === 40 * (curLvl + 1), 'enhanceEquip·消耗与预览公式一致');
    ok(res.rate === Math.max(35, 88 - curLvl * 2), 'enhanceEquip·成功率与预览公式一致');
    ok(S.totalStones(eq) === before - res.cost, 'enhanceEquip·灵石已扣');
    if (res.success) {
      succeeded = true;
      ok(eq.equipment.weapon.等级 === startLvl + 1, 'enhanceEquip·成功后等级 +1');
      ok(eq.equipment.weapon.战力 === res.newPower, 'enhanceEquip·成功后战力=预览');
      break;
    }
  }
  ok(succeeded, 'enhanceEquip·高成功率下至少成功一次（验证成功分支）');
}


/* ---------- 丹炉成丹率确定性预览 ---------- */
{
  const ar = S.createNewGame({
    name: '成丹率预览', gender: '男', raceId: 'human', ageId: 'young',
    regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
  });
  ensureLifeState(ar);
  ok(refineRate(ar, '不存在') === null, 'refineRate·未知丹方返回 null');

  const rec = PILL_RECIPES['聚气丹']; // baseRate 92
  // 1) 基础：无洞府加成、无催化
  ar.cave.bonus = 0;
  let pr = refineRate(ar, '聚气丹');
  ok(pr.baseRate === rec.baseRate, 'refineRate·基础成丹率=丹方 baseRate');
  ok(pr.caveBonus === 0, 'refineRate·无洞府时无丹炉加成');
  ok(pr.catalystBonus === 0, 'refineRate·无催化材料时无催化加成');
  ok(pr.rate === Math.min(98, rec.baseRate), 'refineRate·期望率=基础(未超上限)');

  // 2) 洞府丹炉加成：bonus 0.5 → caveBonus = round(0.5*30)=15
  ar.cave.bonus = 0.5;
  pr = refineRate(ar, '聚气丹');
  ok(pr.caveBonus === 15, 'refineRate·洞府bonus0.5→丹炉加成15');
  ok(pr.rate === Math.min(98, rec.baseRate + 15), 'refineRate·叠加丹炉加成后期望率正确');

  // 3) 催化加成：持「年份灵草」+8、「私藏丹方·残卷」+15
  storeItem(ar, { 名称: '年份灵草', 类型: '材料', 数量: 1, 描述: '催化材料' });
  pr = refineRate(ar, '聚气丹');
  ok(pr.catalystBonus === 8, 'refineRate·年份灵草催化+8');
  storeItem(ar, { 名称: '私藏丹方·残卷', 类型: '材料', 数量: 1, 描述: '催化材料' });
  pr = refineRate(ar, '聚气丹');
  ok(pr.catalystBonus === 23, 'refineRate·双催化合计+23');
  ok(pr.rate === Math.min(98, rec.baseRate + 15 + 23), 'refineRate·洞府+双催化期望率累加正确');

  // 4) 封顶 98：筑基丹(base80) + 洞府0.8(24) + 双催化(23) = 127 → 98
  ar.cave.bonus = 0.8;
  const recB = PILL_RECIPES['筑基丹'];
  pr = refineRate(ar, '筑基丹');
  ok(pr.caveBonus === 24, 'refineRate·洞府bonus0.8→丹炉加成24');
  ok(pr.rate === 98, 'refineRate·超出部分封顶98');
  ok(pr.rate === Math.min(98, recB.baseRate + 24 + 23), 'refineRate·与结算公式等价(封顶)');
}

/* ---------- 疆域图·地域典型遭遇胜率预估（确定性预览） ---------- */
{
  // 新手（低境界低战力）踏入高危地域「海外仙岛」(danger5) 胜率应偏低
  const weakState = S.createNewGame({ name: '胜率测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(weakState);
  const haiwaiWeak = S.regionEncounterRate(weakState, 'haiwai');
  ok(haiwaiWeak < 50, `新手海外仙岛典型遭遇胜率偏低(${haiwaiWeak}%)`);
  // 高境界高战力修士回到低危「中州」(danger2) 应碾压（封顶95）
  const strongState = S.createNewGame({ name: '胜率测试2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(strongState);
  strongState.player.level = 80; strongState.player.power = 5000;
  const zhongzhouStrong = S.regionEncounterRate(strongState, 'zhongzhou');
  ok(zhongzhouStrong >= 90, `高阶修士中州遭遇胜率高(${zhongzhouStrong}%)`);
  // 中等修士（25级/战力300）：低危地域胜率应明显高于高危地域
  const midState = S.createNewGame({ name: '胜率测试3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(midState);
  midState.player.level = 25; midState.player.power = 300;
  ok(S.regionEncounterRate(midState, 'zhongzhou') > S.regionEncounterRate(midState, 'haiwai'), '中等修士·低危地域胜率高于高危地域');
  // 与 previewBattle 对同中点妖兽复算一致
  const mid = Math.round((beastLevelRange('haiwai', false).min + beastLevelRange('haiwai', false).max) / 2);
  const repEnemy = { name: '妖兽', level: mid, power: beastPowerOfLevel(mid, 5), beast: true, realm: S.realmLevelName(mid), danger: 5, regionId: 'haiwai' };
  ok(S.regionEncounterRate(weakState, 'haiwai') === S.previewBattle(weakState, repEnemy, 'yaoshou', 'normal', false).finalRate, 'regionEncounterRate 与 previewBattle 中点复算一致');
}

/* ---------- 秘境探索·护宝妖兽预估胜率（确定性预览） ---------- */
{
  // 护宝妖兽取 stronger 等级区间中点（与 makeEnemy 一致，+15% 上浮）；深度1/2 不缩放，胜率应一致
  const st = S.createNewGame({ name: '秘境胜率', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(st);
  const r1 = S.mysticBeastRate(st, 1);
  const r2 = S.mysticBeastRate(st, 2);
  ok(r1 === r2, `秘境护宝妖兽·深度1与2胜率一致(${r1}/${r2})`);
  // 深度3 妖兽更强（1.2倍等级/1.3倍战力），胜率应不高于深度1
  const r3 = S.mysticBeastRate(st, 3);
  ok(r3 <= r1, `秘境护宝妖兽·深度3胜率不高于深度1(${r3}<=${r1})`);
  // 与 previewBattle 对同代表妖兽复算一致（深度1，无缩放）
  const reg = REGION_TRAVEL[st.world.regionId] || REGION_TRAVEL.zhongzhou;
  const { min, max } = beastLevelRange(st.world.regionId, true);
  const mlv = Math.max(1, Math.round((min + max) / 2));
  const mpower = Math.round(beastPowerOfLevel(mlv, reg.danger || 2) * 1.15);
  const repEnemy = { name: '护宝妖兽', level: mlv, power: mpower, beast: true, realm: S.realmLevelName(mlv), danger: reg.danger || 2, regionId: st.world.regionId };
  ok(r1 === S.previewBattle(st, repEnemy, 'yaoshou', 'normal', false).finalRate, 'mysticBeastRate 与 previewBattle 复算一致(深度1)');
  // 护宝妖兽 +15% 上浮应使胜率不高于「未上浮」的同中点妖兽
  const repEnemyNoStrong = { name: '护宝妖兽', level: mlv, power: beastPowerOfLevel(mlv, reg.danger || 2), beast: true, realm: S.realmLevelName(mlv), danger: reg.danger || 2, regionId: st.world.regionId };
  const rateNoStrong = S.previewBattle(st, repEnemyNoStrong, 'yaoshou', 'normal', false).finalRate;
  ok(r1 <= rateNoStrong, `护宝妖兽+15%上浮使胜率不高于未上浮(${r1}<=${rateNoStrong})`);
  // 高阶修士碾压护宝妖兽（封顶95）
  const strong = S.createNewGame({ name: '秘境胜率2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(strong);
  strong.player.level = 80; strong.player.power = 6000;
  ok(S.mysticBeastRate(strong, 3) >= 90, `高阶修士·深度3护宝妖兽胜率仍高(${S.mysticBeastRate(strong, 3)}%)`);
}

/* ---------- 灵兽收服成功率预览（确定性，无 RNG） ---------- */
{
  const tb = S.createNewGame({ name: '收服率预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(tb);
  const tpl = { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' };
  ok(S.tameBeastRate(tb, tpl, false) === 30, `收服率·御兽0级基础为30(${S.tameBeastRate(tb, tpl, false)})`);
  tb.arts['御兽'] = { name: '御兽', level: 10, 经验: 0 };
  ok(S.tameBeastRate(tb, tpl, false) === 50, `收服率·御兽10级=50(${S.tameBeastRate(tb, tpl, false)})`);
  storeItem(tb, { 名称: '驯兽口粮', 类型: '消耗品', 数量: 1, effect: { tame: 15 }, 描述: '测试' });
  ok(S.tameBeastRate(tb, tpl, false) === 65, `收服率·含驯兽口粮=65(${S.tameBeastRate(tb, tpl, false)})`);
  storeItem(tb, { 名称: '驭兽香', 类型: '消耗品', 数量: 1, effect: { tame: 20 }, 描述: '测试' });
  ok(S.tameBeastRate(tb, tpl, true) === 85, `收服率·用驭兽香=85(${S.tameBeastRate(tb, tpl, true)})`);
  const highTpl = { name: '高阶灵兽', power: 5, minLevel: 50, desc: '测试' };
  const lowPlayer = S.createNewGame({ name: '低阶', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(lowPlayer);
  lowPlayer.player.level = 1;
  ok(S.tameBeastRate(lowPlayer, highTpl, false) === 10, `收服率·低于minLevel封底10(${S.tameBeastRate(lowPlayer, highTpl, false)})`);
  const cap = S.createNewGame({ name: '封顶', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cap);
  cap.arts['御兽'] = { name: '御兽', level: 80, 经验: 0 };
  ok(S.tameBeastRate(cap, tpl, false) === 90, `收服率·高御兽等级封顶90(${S.tameBeastRate(cap, tpl, false)})`);
  const beforeFood = tb.items.find((i) => i.名称 === '驯兽口粮')?.数量;
  const beforeInc = tb.items.find((i) => i.名称 === '驭兽香')?.数量;
  S.tameBeastRate(tb, tpl, true); S.tameBeastRate(tb, tpl, true);
  ok(tb.items.find((i) => i.名称 === '驯兽口粮')?.数量 === beforeFood, 'tameBeastRate 不消耗驯兽口粮');
  ok(tb.items.find((i) => i.名称 === '驭兽香')?.数量 === beforeInc, 'tameBeastRate 不消耗驭兽香');
  const rb = S.tameBeast(tb, tpl, false);
  ok(rb && typeof rb.ok === 'boolean' && Array.isArray(rb.logs), 'tameBeast 仍返回结构化结果');
}

/* ---------- 修炼收益确定性预览 ---------- */
const cgN = S.cultivateGainPreview(state, 'normal');
const cgS = S.cultivateGainPreview(state, 'seclusion');
ok(cgN && cgN.gain > 0 && cgS && cgS.gain > 0, '修炼预览收益为正');
ok(cgS.gain > cgN.gain, `闭关预览收益高于普通修炼(${cgS.gain}>${cgN.gain})`);
const cgBefore = S.cultivateGainPreview(state, 'normal').gain;
const _savedLv = state.cave.level, _savedBonus = state.cave.bonus;
state.cave.level = Math.min(8, state.cave.level + 1);
state.cave.bonus = (state.cave.bonus || 0) + 0.25;
const cgAfter = S.cultivateGainPreview(state, 'normal').gain;
ok(cgAfter > cgBefore, `洞府加成提升后预览收益增加(${cgAfter}>${cgBefore})`);
state.cave.level = _savedLv; state.cave.bonus = _savedBonus;
const cgA = S.cultivateGainPreview(state, 'normal').gain;
const cgB = S.cultivateGainPreview(state, 'normal').gain;
ok(cgA === cgB, '修炼预览确定性（同状态两次一致，无 RNG 波动）');
const _savedTox = state.flags.pillToxicity;
const cgLowTox = S.cultivateGainPreview(state, 'normal').gain;
state.flags.pillToxicity = 90;
const cgHighTox = S.cultivateGainPreview(state, 'normal').gain;
ok(cgHighTox < cgLowTox, `丹毒升高拉低修炼预览收益(${cgHighTox}<${cgLowTox})`);
state.flags.pillToxicity = _savedTox;


/* ---------- 天命奖励确定性预览 ---------- */
const dp0 = S.destinyRewardPreview(state);
ok(typeof dp0 === 'string' && dp0.startsWith('奖励：'), '天命奖励预览返回确定性文案');
ok(S.destinyRewardPreview(state) === dp0, '天命奖励预览确定性（无 RNG 波动）');
const savedStage = state.destiny.stage;
const lineStages = DESTINY_LINES[state.destiny.lineId].stages;
state.destiny.stage = lineStages.length - 1;
ok(S.destinyRewardPreview(state).includes('封号'), '末阶段封号奖励预览正确');
const daoIdx = lineStages.findIndex((x) => x.reward.type === '道基');
if (daoIdx >= 0) { state.destiny.stage = daoIdx; ok(S.destinyRewardPreview(state).includes('道基'), '道基奖励预览包含「道基」'); }
state.destiny.stage = savedStage;

/* ---------- 灵草园「一键收获」+ 闭关连续风险可感知 ---------- */
// 一键收获：播种若干株并强制成熟，批量收获应全部入库
const hg = S.createNewGame({ name: '收获测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(hg);
hg.cave.level = 4; hg.currencies['下品灵石'] = 99999;
const seedPool = ['lingcao', 'huoqing', 'yushu', 'yuehua'];
let plantedN = 0;
for (let i = 0; i < 4; i++) { if (plantHerb(hg, seedPool[i]).ok) plantedN++; }
ok(plantedN >= 3, `一键收获测试：播种至少 3 株（实际 ${plantedN}）`);
hg.cave.garden.forEach((h) => { h.progress = h.grow; }); // 强制全部成熟
const beforeItems = hg.items.length;
const ha = harvestAllHerbs(hg);
ok(ha.ok && ha.count === plantedN, `一键收获成熟 ${plantedN} 株（实际 ${ha.count}）`);
ok(hg.cave.garden.length === 0, '一键收获后灵田清空');
ok(hg.items.length > beforeItems, '一键收获产物入储物袋');
const ha2 = harvestAllHerbs(hg);
ok(!ha2.ok && ha2.count === 0, '灵田无成熟株时一键收获返回失败且不误处理');

// 闭关连续风险可感知提示
const sp = S.createNewGame({ name: '闭关', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(sp);
sp.player.level = 10;
ok(S.cultivateGainPreview(sp, 'normal').note === '稳定·无风险', '普通修炼提示稳定无风险');
ok(S.cultivateGainPreview(sp, 'seclusion').note.includes('Lv.30'), '低等级闭关不再虚报走火入魔风险');
sp.player.level = 40; sp.flags.seclusionStreak = 0;
ok(S.cultivateGainPreview(sp, 'seclusion').note.includes('走火入魔风险'), '高等级闭关提示走火入魔风险');
sp.flags.seclusionStreak = 2;
ok(S.cultivateGainPreview(sp, 'seclusion').note.includes('再闭关将走火入魔'), '连关2月提示再闭关将触发走火入魔');

/* ---------- 秘境收益确定性预览（宗门秘境 / 秘境探索） ---------- */
const rpS = S.createNewGame({ name: '预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(rpS);
const rpR1 = S.sectRealmRewardPreview(rpS, 1);
ok(rpR1.contribution === 30 && rpR1.stones === 80 && rpR1.crystal === 1 && rpR1.pill === 0, '宗门秘境 d1：贡献+30 灵石+80 灵脉晶+1 无聚气丹');
const rpR2 = S.sectRealmRewardPreview(rpS, 2);
ok(rpR2.contribution === 48 && rpR2.stones === 128 && rpR2.crystal === 3 && rpR2.pill === 1, '宗门秘境 d2：贡献+48 灵石+128 灵脉晶+3 聚气丹+1');
const rpR3 = S.sectRealmRewardPreview(rpS, 3);
ok(rpR3.contribution === 72 && rpR3.stones === 192 && rpR3.crystal === 5 && rpR3.pill === 2, '宗门秘境 d3：贡献+72 灵石+192 灵脉晶+5 聚气丹+2');
const rpMr = S.createNewGame({ name: '预览2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(rpMr);
const rpPm = S.mysticRealmRewardPreview(rpMr, 'qingxu', 1);
ok(rpPm && rpPm.stoneMin === 50 && rpPm.stoneMax === 200 && rpPm.matMin === 1 && rpPm.matMax === 3, '青虚秘境 d1：灵石 50~200 材料 1~3');
ok(rpPm.artChance === 5 && rpPm.fee === 0 && !rpPm.requiresMap, '青虚秘境 d1：法宝 5% 无护阵费 非残图秘境');
const rpPy = S.mysticRealmRewardPreview(rpMr, 'yifu', 3);
ok(rpPy && rpPy.requiresMap && rpPy.fee === 100 && rpPy.artChance >= 100, '海上遗府 d3：需残图 护阵费 100 法宝必得');

/* ---------- 转世继承确定性预览（自由优化：补齐投资型决策预览最后缺口） ---------- */
const rcS = S.createNewGame({ name: '转世', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(rcS);
rcS.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0, '极品灵石': 0, '灵晶': 0 };
rcS.player.daoBase['根骨'].level = 10;
rcS.player.daoBase['悟性'].level = 5;
rcS.player.daoYun.exp = 200;
rcS.player.mainTechnique = rcS.techniques[0].名称;
const pv = S.reincarnatePreview(rcS);
ok(pv.stones === 500, '转世预览：继承灵石为半数（1000→500）');
ok(pv.totalStones === 1000, '转世预览：记录总灵石数');
const gengu = pv.daoList.find((d) => d.name === '根骨');
ok(gengu && gengu.cur === 10 && gengu.add === 3 && gengu.next === 13, '转世预览：根骨 +floor(10×0.3)=+3（10→13）');
const wux = pv.daoList.find((d) => d.name === '悟性');
ok(wux && wux.cur === 5 && wux.add === 1 && wux.next === 6, '转世预览：悟性 +floor(5×0.3)=+1（5→6）');
ok(pv.yunExp === 40, '转世预览：道韵经验 +floor(200×0.2)=+40');
ok(pv.techName === rcS.techniques[0].名称, '转世预览：主修功法名为当前主修');
ok(rcS.player.daoBase['根骨'].level === 10 && rcS.player.daoYun.exp === 200 && rcS.currencies['下品灵石'] === 1000, '转世预览纯函数：完全不改动原状态');
const inhR = S.reincarnate(rcS, false);
ok(inhR && inhR.stones === 500 && inhR.daoBase['根骨'] === 3 && inhR.yunExp === 40 && inhR.tech && inhR.tech.名称 === rcS.techniques[0].名称, 'reincarnate 返回继承对象与预览一致（行为不变）');
ok(S.reincarnate(rcS, true) === null, 'reincarnate(full=true) 返回 null（完全重开走新建流程）');

// ---------- 状态危机预警（寿元/丹毒）纯函数 ----------
function mkCrisisState({ age = 30, lifespan = 100, toxic = 0 } = {}) {
  return {
    player: { age, lifespan, level: 10, daoBase: { '根骨': { level: 1 } } },
    flags: { pillToxicity: toxic },
  };
}
// 寿元预警：安康 / 警告 / 危险 三档
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 100 })).level === 'ok', '寿元预警：余寿70年→安康');
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 100 })).lifeLeft === 70, '寿元预警：lifeLeft=余寿计算正确(70)');
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 45 })).level === 'warn', '寿元预警：余寿15年→警告');
ok(S.lifespanWarning(mkCrisisState({ age: 90, lifespan: 100 })).level === 'warn', '寿元预警：余寿10年→警告(>8)');
ok(S.lifespanWarning(mkCrisisState({ age: 95, lifespan: 100 })).level === 'danger', '寿元预警：余寿5年→危险');
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 45 })).hint.includes('延寿丹'), '寿元预警：警告提示含延寿丹途径');
ok(S.lifespanWarning(mkCrisisState({ age: 95, lifespan: 100 })).hint.includes('转世'), '寿元预警：危险提示含转世途径');
// 丹毒预警：清净 / 警告 / 危险 三档
ok(S.toxicityWarning(mkCrisisState({ toxic: 0 })).level === 'ok', '丹毒预警：0→清净');
ok(S.toxicityWarning(mkCrisisState({ toxic: 50 })).level === 'ok', '丹毒预警：50→清净(阈值60)');
ok(S.toxicityWarning(mkCrisisState({ toxic: 60 })).level === 'warn', '丹毒预警：60→警告');
ok(S.toxicityWarning(mkCrisisState({ toxic: 85 })).level === 'danger', '丹毒预警：85→危险');
ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).level === 'danger', '丹毒预警：90→危险');
ok(S.toxicityWarning(mkCrisisState({ toxic: 70 })).hint.includes('暂缓毒性丹药'), '丹毒预警：警告提示宜暂缓毒性丹药');
ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).hint.includes('凝血丹'), '丹毒预警：危险提示含凝血丹');
// 纯函数：完全不改动原状态
const cst = mkCrisisState({ age: 95, lifespan: 100, toxic: 90 });
S.lifespanWarning(cst); S.toxicityWarning(cst);
ok(cst.player.age === 95 && cst.player.lifespan === 100 && cst.flags.pillToxicity === 90, '危机预警纯函数：完全不改动原状态');

// 解药服用闭环：危机预警下手握解药，服用即生效（对应横幅「服用」按钮逻辑）
const scCure = JSON.parse(JSON.stringify(state));
scCure.player.age = scCure.player.lifespan - 3; // 触发 danger 预警
scCure.items.push({ 名称: '延寿丹', 类型: '丹药', 数量: 1, 描述: '延寿', effect: { lifespan: 20 }, toxicity: 15 });
const li = scCure.items.length - 1;
ok(S.lifespanWarning(scCure).level === 'danger' && S.useItem(scCure, li) && scCure.player.lifespan > (state.player.lifespan || 0), '寿元将尽+持有延寿丹：服用提升寿元上限');
const stCure = JSON.parse(JSON.stringify(state));
stCure.flags = Object.assign({}, stCure.flags, { pillToxicity: 90, wounded: 2 }); // 触发 danger 预警
stCure.items.push({ 名称: '凝血丹', 类型: '丹药', 数量: 1, 描述: '清伤', effect: { heal: true }, toxicity: 0 });
const ti = stCure.items.length - 1;
ok(S.toxicityWarning(stCure).level === 'danger' && S.useItem(stCure, ti) && (stCure.flags.wounded || 0) === 0, '丹毒攻心+持有凝血丹：服用清除全部伤势');

// —— 残片法宝：死道具→炼器「残片修复」闭环（消除“待修复成长”假承诺）——
ok(ART_RECIPES.炼器.some((r) => r.id === 'repair_canpian'), '残片修复：炼器配方已登记');
const rcBase = JSON.parse(JSON.stringify(state));
rcBase.items.push({ 名称: '残片法宝', 类型: '材料', 数量: 1, 描述: '法宝残片', 价值: 60 });
rcBase.items.push({ 名称: '星砂', 类型: '材料', 数量: 1, 描述: '高阶炼器材料', 价值: 120 });
S.practiceArt(rcBase, '炼器', 'repair_canpian');
const rcArt = rcBase.items.find((x) => x.名称 === '灵珠法宝');
ok(rcArt && rcArt.类型 === '法宝' && rcArt._equip && rcArt._equip.战力 > 0, '残片修复：消耗残片+星砂产出可装备灵珠法宝（战力>0）');
ok(!rcBase.items.find((x) => x.名称 === '残片法宝'), '残片修复：残片法宝已被消耗');
ok(!rcBase.items.find((x) => x.名称 === '星砂'), '残片修复：星砂消耗1份');
const rcNo = JSON.parse(JSON.stringify(state));
rcNo.items.push({ 名称: '星砂', 类型: '材料', 数量: 1, 描述: '高阶炼器材料', 价值: 120 });
const rcLogs = S.practiceArt(rcNo, '炼器', 'repair_canpian');
ok(rcLogs.some((l) => l.includes('材料不足')), '残片修复：缺残片时拒绝并提示材料不足');
const rcEquip = JSON.parse(JSON.stringify(rcBase));
const rcIdx = rcEquip.items.findIndex((x) => x.名称 === '灵珠法宝');
S.useItem(rcEquip, rcIdx);
ok(rcEquip.equipment.artifact && rcEquip.equipment.artifact.名称 === '灵珠法宝' && rcEquip.equipment.artifact.战力 > 0, '残片修复产出可被装备为灵珠法宝，法宝槽战力>0');
const rcFrag = JSON.parse(JSON.stringify(state));
rcFrag.items.push({ 名称: '残片法宝', 类型: '材料', 数量: 1, 描述: '法宝残片', 价值: 60 });
const rcFragIdx = rcFrag.items.length - 1;
const rcFragRes = S.useItem(rcFrag, rcFragIdx);
ok(rcFragRes === null && rcFrag.items[rcFragIdx].名称 === '残片法宝', '残片法宝：类型材料不会被误装备/误消耗');

/* ---------- 研读功法确定性预览（补齐投资型决策预览缺口） ---------- */
function studyPreviewGroup() {
  // 正常：有主修功法且未达瓶颈，等级1经验0 → need=20，+40 触发突破
  const sg = S.createNewGame({ name: '研读预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg);
  ok(!!sg.player.mainTechnique, '新游戏默认主修功法已设置（修复 state.player.mainTechnique 初始 undefined 的错位 bug）');
  const prev = S.studyGainPreview(sg);
  ok(typeof prev === 'string' && prev.length > 0, 'studyGainPreview 返回非空字符串');
  const tech = sg.techniques.find((t) => t.名称 === sg.player.mainTechnique);
  ok(prev.includes(tech.名称), '预览包含主修功法名');
  ok(prev.includes('+40'), '预览标明功法经验+40');
  ok(prev.includes('突破至第2层'), '等级1经验0：研读+40(=40≥need20)预览将突破至第2层');
  // 临近瓶颈但不足：等级5经验5 → need=100，after=45 < 100 → 不突破，距突破还差55
  const sg2 = S.createNewGame({ name: '研读预览2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg2);
  const t2 = sg2.techniques.find((x) => x.名称 === sg2.player.mainTechnique);
  t2.等级 = 5; t2.经验 = 5;
  const prev2 = S.studyGainPreview(sg2);
  ok(prev2.includes('距突破还差55'), '临界不突破：等级5经验5预览标明距突破差55（' + prev2 + '）');
  // 已达瓶颈：凡品 maxLv=30，设等级30 → 提示瓶颈
  const sg3 = S.createNewGame({ name: '研读预览3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg3);
  const t3 = sg3.techniques.find((x) => x.名称 === sg3.player.mainTechnique);
  t3.等级 = 30;
  const prev3 = S.studyGainPreview(sg3);
  ok(prev3.includes('瓶颈'), '凡品满级(30)：预览提示已至瓶颈（' + prev3 + '）');
  // 无主修功法
  const sg4 = S.createNewGame({ name: '研读预览4', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg4);
  sg4.player.mainTechnique = null;
  sg4.mainTechnique = null; // 同时清空顶层，模拟真正无主修（兜底读取不命中）
  const prev4 = S.studyGainPreview(sg4);
  ok(prev4.includes('尚未主修'), '未主修功法：预览提示尚未主修（' + prev4 + '）');
}
studyPreviewGroup();

/* ---------- 宗门任务 / 兑换所 确定性预览 ---------- */
{
  const st = S.createNewGame({ name: '宗门预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(st);
  S.joinSect(st, '预览宗门');
  const normal = S.sectTaskPreview(st, 'escort');
  ok(normal && normal.contribution > 0 && normal.wuxing[0] === 3 && normal.wuxing[1] === 8 && normal.battle === null, '常规宗门任务预览：贡献>0、悟性 3~8、无战斗');
  const subdue = S.sectTaskPreview(st, 'subdue');
  ok(subdue && typeof subdue.battle === 'number' && subdue.battle >= 0 && subdue.battle <= 100, '降服任务预览：返回 0~100 区间预估胜率');
  ok(S.sectTaskPreview(st, '不存在的任务') === null, '未知任务 id 预览返回 null');
  const p1 = S.sectTaskPreview(st, 'escort'), p2 = S.sectTaskPreview(st, 'escort');
  ok(p1.contribution === p2.contribution && p1.wuxing[1] === p2.wuxing[1], '宗门任务预览纯函数：重复调用结果一致（无副作用）');
}

/* ---------- 英雄卡护身道具常驻展示（wardItems 计数助手） ---------- */
{
  const st = S.createNewGame({ name: '护身计数', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(st);
  // 新游戏初始不应自带护身类道具
  ok(S.wardItems(st).length === 0, '护身计数：新游戏初始无护身道具');
  // 注入两件不同护身道具，合并按数量计数
  st.items.push({ 名称: '低阶护身符', 类型: '消耗品', 数量: 2, 描述: '测试' });
  st.items.push({ 名称: '简易阵旗', 类型: '消耗品', 数量: 1, 描述: '测试', effect: { ward: true } });
  const held = S.wardItems(st);
  const total = held.reduce((s, x) => s + (Number(x.数量) || 1), 0);
  ok(held.length === 2 && total === 3, '护身计数：持有 2 种共 3 件（低阶护身符×2 + 简易阵旗×1）');
  // 高阶护身符识别（败北时挡重伤并护住灵石）
  st.items.push({ 名称: '护身符', 类型: '消耗品', 数量: 1, 描述: '测试' });
  ok(S.wardItems(st).some((x) => x.名称 === '护身符'), '护身计数：高阶护身符被正确纳入统计');
  // 非护身类物品不应计入
  st.items.push({ 名称: '凝火丹', 类型: '丹药', 数量: 5, 描述: '测试' });
  ok(S.wardItems(st).length === 3, '护身计数：非护身类物品（丹药）不计入统计');
}

/* ---------- 临时战力增益（丹药增益 buff） ---------- */
// 直接构造一颗狂战丹并服用，验证 buff 生效、战力提升、跨月过期、存档往返、解锁判定
const beforePower = S.calcPower(state);
state.items.push({ 名称: '狂战丹', 类型: '丹药', 数量: 1, 描述: '测试', effect: { power: 150, powerMonths: 3 }, toxicity: 0 });
const buffIdx = state.items.length - 1;
const buffLogs = S.useItem(state, buffIdx);
ok(buffLogs && buffLogs.some((l) => l.includes('战力临时')), '服用战力丹写入临时增益日志');
ok(state.buffs && state.buffs.power === 150, 'buffs.power 已置为 150');
ok(state.buffs && state.buffs.expireMonth === state.world.year * 12 + state.world.month + 3, 'buffs 过期月份=当前+3');
ok(S.calcPower(state) === beforePower + 150, '临时战力增益已计入 calcPower（+150）');
const buffBd = S.powerBreakdown(state);
ok(buffBd.items.find((x) => x.label === '丹药增益').value === 150, '战力拆解丹药增益项=150');
ok(S.activeBuffPower(state) === 150, 'activeBuffPower 返回当前增益 150');
// 跨月推进 3 个月后过期
for (let i = 0; i < 3; i++) { state.world.month++; if (state.world.month > 12) { state.world.month = 1; state.world.year++; } }
S.refreshDerived(state);
ok(S.activeBuffPower(state) === 0, '3 月后临时增益过期（activeBuffPower=0）');
ok(S.calcPower(state) === beforePower, '过期后战力回落至服用前');
// 存档往返（过期态应被清理为 power=0）
let ser = serialize(state);
let de = deserialize(ser);
ok(de.buffs && de.buffs.power === 0, '存档往返：过期态 buffs.power=0');
// 未过期 buff 持久化
state.buffs = { power: 100, expireMonth: state.world.year * 12 + state.world.month + 2 };
ser = serialize(state);
de = deserialize(ser);
ok(de.buffs && de.buffs.power === 100 && de.buffs.expireMonth === state.world.year * 12 + state.world.month + 2, '未过期 buff 存档往返正确');
// 解锁判定：筑基期（21级）解锁、低等级不解锁
ok(isRecipeUnlocked({ player: { level: 21 }, sect: { rank: 0 }, arts: { 炼丹: { level: 0 } }, flags: {} }, '狂战丹') === true, '狂战丹在筑基期（21级）解锁');
ok(isRecipeUnlocked({ player: { level: 1 }, sect: { rank: 0 }, arts: { 炼丹: { level: 0 } }, flags: {} }, '狂战丹') === false, '狂战丹在低等级未解锁');

// 闭关走火入魔风险预警（纯函数，与修炼弹窗同口径；Lv.30+ 连关满 3 月触发）
ok(S.seclusionRiskWarning(state).level === 'ok', '低等级无闭关风险预警');
state.player.level = 35;
state.flags.seclusionStreak = 0;
ok(S.seclusionRiskWarning(state).level === 'ok', 'Lv.30+ 连关0月无预警');
state.flags.seclusionStreak = 1;
const sw1 = S.seclusionRiskWarning(state);
ok(sw1.level === 'warn' && sw1.streak === 1 && sw1.text === '连续闭关 1 月', 'Lv.30+ 连关1月 warn');
state.flags.seclusionStreak = 2;
const sw2 = S.seclusionRiskWarning(state);
ok(sw2.level === 'danger' && sw2.streak === 2 && sw2.text === '连续闭关 2 月', 'Lv.30+ 连关2月 danger（再闭关即触发）');
state.flags.seclusionStreak = 3;
ok(S.seclusionRiskWarning(state).level === 'danger', 'Lv.30+ 连关3月 danger（必触发走火入魔）');
state.flags.seclusionStreak = 0;


// 战力构成摘要（英雄卡战力悬浮拆解，纯函数、与 powerBreakdown 同口径）
const ps = S.powerSummary(state);
ok(typeof ps === 'string' && ps.includes('境界修为') && ps.includes('合计'), '战力构成摘要含各项与合计');
const _bd = S.powerBreakdown(state);
ok(ps.includes(`合计 ${_bd.total}`), '战力构成摘要合计与 powerBreakdown 一致');
state.buffs = { power: 120, expireMonth: state.world.year * 12 + state.world.month + 3 };
const ps2 = S.powerSummary(state);
ok(ps2.includes('丹药增益 120'), '战力构成摘要含临时丹药增益');
state.buffs = { power: 0, expireMonth: 0 };

/* ---------- 储物袋容量常驻（信息透明 + 危机预警） ---------- */
ok(typeof S.bagUsage === 'function', 'bagUsage 已导出');
const bagState = (used, cap, ring = 0) => ({ inventory: { used, capacity: cap, ringBonus: ring } });
ok(S.bagUsage(bagState(0, 100)).used === 0 && S.bagUsage(bagState(0, 100)).capacity === 100 && S.bagUsage(bagState(0, 100)).total === 100, '0/100 容量字段正确');
ok(S.bagUsage(bagState(0, 100)).level === 'ok' && S.bagUsage(bagState(0, 100)).ratio === 0, '空袋 0/100 → ok、ratio=0');
// 90% → danger（满仓临界，再拾取物品将被 storeItem 静默丢弃）
ok(S.bagUsage(bagState(92, 100)).level === 'danger' && Math.abs(S.bagUsage(bagState(92, 100)).ratio - 0.92) < 1e-9, '占用 92/100 → danger');
// 70% → warn（容量偏紧）
ok(S.bagUsage(bagState(70, 100)).level === 'warn', '占用 70/100 → warn');
// 50% → ok
ok(S.bagUsage(bagState(50, 100)).level === 'ok', '占用 50/100 → ok');
// 边界：恰好 0.9（90/100）→ danger
ok(S.bagUsage(bagState(90, 100)).level === 'danger', '恰好 90/100 → danger（临界）');
// 空间戒 ringBonus 计入 total（与 canStore 同口径）
const ru = S.bagUsage(bagState(100, 100, 20));
ok(ru.total === 120 && Math.abs(ru.ratio - 100 / 120) < 1e-9, '空间戒 ringBonus 计入 total');
ok(ru.level === 'warn', '100/120（含戒）→ warn（83% 偏紧，与阈值一致）');

console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);

process.exit(fail ? 1 : 0);
