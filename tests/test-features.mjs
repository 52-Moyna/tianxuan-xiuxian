// 运行时功能验证：直接在 Node 中加载游戏模块并驱动新功能逻辑（无需浏览器 DOM）
import { GameState, Rng, bus } from '../public/js/state.js';
import * as S from '../public/js/systems.js';
import * as D from '../public/js/data.js';
import * as L from '../public/js/life.js';

let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL:', n, extra); } };

// 初始化一个最小游戏状态（createNewGame 需要完整 opts：raceId/ageId/regionId/packId/yunId/spiritRoot/name/gender）
GameState.data = S.createNewGame({
  name: '测仙', gender: '男',
  raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 1, yunId: 'mingcha',
  spiritRoot: S.rollSpiritRoot(),
});
ok(GameState.data, 'createNewGame 返回状态');
const g = GameState.data;
ok(g && g.equipment && g.equipment.weapon !== undefined, '装备多部位结构存在');
ok(typeof g.equipment.stash === 'array' || Array.isArray(g.equipment.stash), '备用装备槽为数组');

// 0) ensureLifeState 不能丢失已装备道具与备用槽（回归：migrateEquipment 改写 equipment 会清空）
g.equipment.weapon = { 名称: '留存剑', 部位: 'weapon', 品阶: 'fan', 等级: 2, 战力: 16, 描述: 'x', 效果: {}, 价值: 50 };
g.equipment.stash.push({ 名称: '备用甲', 部位: 'armor', 品阶: 'fan', 等级: 1, 战力: 4, 描述: 'x', 效果: {}, 价值: 10 });
const stashBefore = g.equipment.stash.length;
L.ensureLifeState(g);
L.ensureLifeState(g); // 连续两次也应保持
ok(g.equipment.weapon && g.equipment.weapon.名称 === '留存剑', 'ensureLifeState 保留已装备道具');
ok(g.equipment.stash.length === stashBefore, 'ensureLifeState 保留备用装备槽', `before=${stashBefore} after=${g.equipment.stash.length}`);


// 1) 游历事件池：每个事件都能无异常执行
let wanderOk = true, wanderLog = '';
for (const ev of S.WANDER_EVENTS) {
  try {
    const before = JSON.stringify(g.items.length) + '|' + g.player.exp + '|' + JSON.stringify(g.beasts?.slots?.length);
    const r = ev.run(g);
    if (!r || !Array.isArray(r.logs)) { wanderOk = false; wanderLog = ev.id + ' 无 logs'; }
  } catch (e) { wanderOk = false; wanderLog = ev.id + ': ' + e.message; }
}
ok(wanderOk, 'WANDER_EVENTS 全部可运行', wanderLog);

// 2) resolveWanderEvent 多次抽取不抛错
let resolveOk = true;
for (let i = 0; i < 50; i++) { try { S.resolveWanderEvent(g); } catch (e) { resolveOk = false; console.log('  wander resolve err', e.message); break; } }
ok(resolveOk, 'resolveWanderEvent 50次无异常');

// 3) 坊市货架：分类丰富 + 含渡劫丹与六部位装备
const stock = S.shopStock(g);
ok(Array.isArray(stock) && stock.length >= 10, '坊市商品数量充足', 'count=' + stock.length);
ok(stock.some((x) => x.名称 === '渡劫丹'), '坊市含渡劫丹');
ok(stock.some((x) => x.类型 === '丹药' && x.品阶), '丹药带品阶');
const eqSlots = new Set(stock.filter((x) => x.类型 === '装备').map((x) => x.部位));
ok(eqSlots.size >= 5, '装备细分多部位', [...eqSlots].join(','));

// 为购买/出售验证准备充足空间与灵石（前序游历事件已占满行囊）
g.inventory.capacity = 999; g.inventory.used = 0;
S.addStones(g, 100000);

// 4) 购买：装备进 stash，丹药进 items
const dan = stock.find((x) => x.名称 === '渡劫丹');
const eq = stock.find((x) => x.类型 === '装备');
const beforeStash = g.equipment.stash.length;
const buy1 = S.buyItem(g, dan); ok(/灵石/.test(buy1), '购买渡劫丹成功', buy1);
const afterStash = g.equipment.stash.length;
const buy2 = S.buyItem(g, eq);
ok(afterStash + 1 === g.equipment.stash.length, '购买装备入备用槽', `before=${beforeStash} after1=${afterStash} after2=${g.equipment.stash.length} msg=${buy2}`);
ok(g.items.some((x) => x.名称 === '渡劫丹'), '渡劫丹进入行囊');

// 5) 天机简报行情 + 售价浮动
S.generateNews(g);
ok(g.world.marketTrend && typeof g.world.marketTrend === 'object', 'marketTrend 已生成');
const mat = Object.keys(g.world.marketTrend)[0];
const testItem = { 名称: mat + '测试物', 类型: '材料', 数量: 1, 价值: 100, 描述: '' };
const mul = S.newsPriceMul(g, testItem);
ok(mul >= 0.5 && mul <= 2, 'newsPriceMul 在合理区间', 'mul=' + mul);
const stonesBefore = S.totalStones(g);
const sellMsg = S.sellItem(g, g.items.findIndex((x) => x.名称 === '渡劫丹'));
ok(/灵石/.test(sellMsg), '出售成功', sellMsg);
ok(S.totalStones(g) > stonesBefore, '出售后灵石增加');

// 6) 渡劫：放入筑基丹，尝试突破（构造瓶颈场景）
g.player.level = 19; g.player.exp = 0; g.player.power = 1;
g.items.push({ 名称: '筑基丹', 类型: '丹药', 数量: 1, 价值: 700, effect: { item: '筑基丹' } });
let btOk = true, btInfo = '';
try { const bt = S.attemptBreakthrough(g); btInfo = 'rate=' + bt.rate + ' success=' + bt.success; if (bt.rate < 5 || bt.rate > 100) btOk = false; }
catch (e) { btOk = false; btInfo = e.message; }
ok(btOk, 'attemptBreakthrough 含专属丹不抛错', btInfo);

// 7) 轻量行动逻辑：study / seclusion / social 经 performAction 不抛错
let actOk = true, actErr = '';
try {
  S.performAction(g, { title: '研读', action: { type: 'study' } });
  S.performAction(g, { title: '闭关', action: { type: 'cultivate', mode: 'seclusion' } });
  S.performAction(g, { title: '拜访', action: { type: 'social', target: '测试NPC' } });
} catch (e) { actOk = false; actErr = e.message; }
ok(actOk, '轻量行动 performAction 无异常', actErr);

// 8) 坊市批量出售 + 行囊整理（QoL 批量操作）
let batchOk = true, batchErr = '';
try {
  const bs = {
    world: { regionId: 'zhongzhou', region: '中州', turns: 1 },
    currencies: { '下品灵石': 500 },
    inventory: { capacity: 100, used: 0, upgrades: 0, bagName: '储物袋' },
    items: [], equipment: { stash: [] }, flags: {}, player: {}, npcs: [],
  };
  L.ensureLifeState(bs);
  const stoneBefore = S.totalStones(bs);
  bs.items.push({ 名称: '玄铁', 类型: '材料', 数量: 5, 价值: 35, 描述: '矿' });
  bs.items.push({ 名称: '破布', 类型: '杂物', 数量: 3, 价值: 15, 描述: '废' });
  bs.items.push({ 名称: '丹药A', 类型: '丹药', 数量: 2, 价值: 100, 描述: '药' });
  const rMat = S.sellItems(bs, (it) => it.类型 === '材料');
  ok(rMat.count === 1 && rMat.stones > 0, 'sellItems 按类型批量出售材料', `count=${rMat.count}`);
  ok(!bs.items.find((x) => x.名称 === '玄铁'), 'sellItems 已移除售出物品');
  ok(bs.items.find((x) => x.名称 === '丹药A'), 'sellItems 保留非匹配物品');
  ok(S.totalStones(bs) > stoneBefore, 'sellItems 增加灵石');
  const rAll = S.sellItems(bs, null);
  ok(rAll.count === 2 && bs.items.length === 0, 'sellItems(null) 清空剩余物品');
  bs.items.push({ 名称: '乾坤袋', 类型: '容器', 数量: 1, 描述: '袋' });
  const rBag = S.sellItems(bs, () => true);
  ok(rBag.count === 0 && bs.items.length === 1, 'sellItems 跳过容器', `count=${rBag.count}`);

  bs.items = [];
  bs.items.push({ 名称: '乙材料', 类型: '材料', 数量: 2, 描述: 'm' });
  bs.items.push({ 名称: '甲丹药', 类型: '丹药', 数量: 1, 描述: 'd' });
  bs.items.push({ 名称: '甲材料', 类型: '材料', 数量: 3, 描述: 'm' });
  bs.items.push({ 名称: '甲材料', 类型: '材料', 数量: 4, 描述: 'm' });
  const nOrg = L.organizeBag(bs);
  ok(nOrg === 3, 'organizeBag 合并重复堆叠后剩 3 件', `n=${nOrg}`);
  const jia = bs.items.find((x) => x.名称 === '甲材料');
  ok(jia && jia.数量 === 7, 'organizeBag 合并数量正确', `qty=${jia && jia.数量}`);
  const iDan = bs.items.findIndex((x) => x.类型 === '丹药');
  const iMat = bs.items.findIndex((x) => x.类型 === '材料');
  ok(iDan < iMat, 'organizeBag 按类型排序(丹药先于材料)', `iDan=${iDan} iMat=${iMat}`);
} catch (e) { batchOk = false; batchErr = e.message; }
ok(batchOk, '批量出售与行囊整理整体无异常', batchErr);

// 9) 突破失败惩罚回归（B③）+ 前期节奏（B①）
let bt2Ok = true, bt2Err = '';
try {
  const bs3 = { world: { regionId: 'zhongzhou', region: '中州', turns: 1 }, currencies: { '下品灵石': 1000 },
    inventory: { capacity: 100, used: 0, upgrades: 0, bagName: '储物袋' }, items: [], equipment: { stash: [] },
    flags: {}, npcs: [], cave: { level: 0, name: '凡人客栈', bonus: 0 }, techniques: [],
    player: { level: 1, exp: 0, spiritRoot: { gradeId: 'fan', speed: 1 }, mainTechnique: '',
      daoBase: { 悟性: { level: 0, exp: 0 }, 道心: { level: 0, exp: 0 }, 根骨: { level: 0, exp: 0 }, 气运: { level: 0, exp: 0 }, 血脉: { level: 0, exp: 0 } },
      daoYun: { id: 'none', name: '', level: 1, exp: 0 } } };
  L.ensureLifeState(bs3);
  const expect = { 10: 1, 20: 1, 40: 2, 60: 2, 80: 3 };
  const obs = {};
  for (const lv of Object.keys(expect).map(Number)) {
    for (let k = 0; k < 300; k++) {
      bs3.player.level = lv;
      bs3.player.exp = S.expNeed(lv);
      const r = S.attemptBreakthrough(bs3);
      if (!r.success) { obs[lv] = lv - bs3.player.level; break; }
    }
  }
  for (const lv of Object.keys(expect).map(Number)) {
    ok(obs[lv] === expect[lv], `B③ ${lv}级失败跌落应为${expect[lv]}`, `got=${obs[lv]}`);
  }
  ok(S.expNeed(1) === 35, 'B① 凡人境每级需求应为35', `got=${S.expNeed(1)}`);
  ok(S.expNeed(11) === 110, 'B① 炼气期每级需求应为110', `got=${S.expNeed(11)}`);
  // B③ 回归：通用渡劫丹（effect.tribulation 为数字）消费时不得 ReferenceError（PILL_GRADES 已导入）
  bs3.items = [{ 名称: '渡劫丹', 类型: '丹药', 数量: 1, 品阶: 'zhong', effect: { tribulation: 15 } }];
  bs3.player.level = 20; bs3.player.exp = S.expNeed(20);
  let pillOk = true;
  try { const r2 = S.attemptBreakthrough(bs3); if (typeof r2.rate !== 'number') pillOk = false; }
  catch (e) { pillOk = false; bt2Err = '渡劫丹崩溃: ' + e.message; }
  ok(pillOk, 'B③ 通用渡劫丹消费不崩溃(PILL_GRADES 已导入)', bt2Err);
} catch (e) { bt2Ok = false; bt2Err = e.message; }
ok(bt2Ok, '突破失败惩罚与前期节奏回归整体无异常', bt2Err);

console.log(`\n===== 功能运行时验证：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
