import * as S from '../public/js/systems.js';
import { ensureLifeState, gardenCapacity, herbQuality, plantHerb, harvestHerb, irrigateHerb, HERB_IRRIGATE_COST, HERB_IRRIGATE_CAP_PER_MONTH, herbSpringBonus, HERB_SPRING_LEVEL, growHerbs, omenActive, omenMul, omenAdd, refinePill, settleRefine, decayPillToxicity, isRecipeUnlocked, alchemySlots, storeItem, REGION_TRAVEL, beastLevelRange } from '../public/js/life.js';
import { DIVINATION, PILL_RECIPES } from '../public/js/data.js';
import { achievementView, checkAchievements, codexEntries, ownedEquipPower, activeSetBonuses, beastPowerBonus, ensureBeastState } from '../public/js/codex.js';
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

console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);

process.exit(fail ? 1 : 0);
