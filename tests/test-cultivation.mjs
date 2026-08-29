// 修仙新增系统专项测试：战力构成 / 渡劫成功率 / 装备淬炼 / 灵草园 / 存档往返
// 运行：node tests/test-cultivation.mjs
import * as S from '../public/js/systems.js';
import { ensureLifeState, plantHerb, harvestHerb, growHerbs } from '../public/js/life.js';
import { serialize, deserialize } from '../public/js/save.js';

let pass = 0, fail = 0;
const ok = (condition, name) => condition ? pass++ : (fail++, console.error('FAIL:', name));

function fresh() {
  const st = S.createNewGame({
    name: '测试修士', gender: '男', raceId: 'human', ageId: 'young',
    regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
  });
  ensureLifeState(st);
  st.currencies = st.currencies || {};
  st.currencies['下品灵石'] = 5000;
  return st;
}

/* ---- 战力构成 ---- */
{
  const st = fresh();
  const bd = S.powerBreakdown(st);
  ok(Array.isArray(bd.items) && bd.items.length === 10, '战力构成含十项');
  ok(bd.total === S.calcPower(st), '战力构成合计与 calcPower 一致');
  ok(bd.items.every((i) => Number.isFinite(i.value)), '战力构成各项为有限数');
  ok(bd.total >= 1, '战力合计至少为 1');
}

/* ---- 渡劫成功率 ---- */
{
  const st = fresh();
  const r = S.breakthroughRate(st);
  ok(r === null || (r >= 5 && r <= 95), '渡劫成功率在 5~95 或为空（非瓶颈）');
  // 强制推到一个已知瓶颈级别验证数值化
  st.player.level = 10;
  st.player.daoBase = st.player.daoBase || {};
  st.player.daoBase['道心'] = { level: 0 };
  st.player.daoBase['气运'] = { level: 0 };
  const r2 = S.breakthroughRate(st);
  ok(typeof r2 === 'number' && r2 >= 5 && r2 <= 95, '瓶颈期渡劫成功率数值化在 5~95');
}

/* ---- 渡劫成功率参考战力（确定性：同一基准态仅差丹药战力，消除灵根随机偶发） ---- */
{
  const base = fresh();
  base.player.level = 10;
  base.player.daoBase = { '道心': { level: 0 }, '气运': { level: 0 } };
  base.equipment = { weapon: null, armor: null, pants: null, boots: null, accessory: null, artifact: null, stash: [] };
  base.spiritRoot = { gradeId: 'zhong', name: '中品灵根', speed: 1.0 }; // 固定灵根，排除废灵根(fei +15 天劫)随机干扰
  base.player.daoYun = { id: 'fan', name: '凡道韵', level: 0 };          // 排除天人道韵(+8)随机干扰
  base.items = [];
  base.flags = base.flags || {};
  const rWeak = S.breakthroughRate(base);
  base.buffs = { power: 5000, expireMonth: 99999 }; // 丹药增益计入战力（未过期），验证渡劫参考战力
  const rStrong = S.breakthroughRate(base);
  ok(rStrong > rWeak, `渡劫成功率随战力提升（弱${rWeak}% → 强${rStrong}%）`);
}

/* ---- 装备淬炼（失败无损 / 成功提升） ---- */
{
  const st = fresh();
  st.equipment.stash.push({ 名称: '淬炼测试剑', 类型: '装备', 等级: 3, 部位: 'weapon', 战力: 5, 描述: '测试' });
  const before = st.equipment.stash[0];
  const beforeLevel = before.等级, beforePower = before.战力;
  let beforeStones = S.totalStones(st);
  let levelUpSeen = false, loseStonesSeen = false;
  for (let i = 0; i < 30; i++) {
    const res = S.enhanceEquip(st, { where: 'stash', idx: 0 });
    ok(res.ok === true, '淬炼调用成功');
    ok(res.cost > 0 && res.rate >= 35 && res.rate <= 88, '淬炼消耗与成功率合理');
    ok(S.totalStones(st) < beforeStones, '淬炼必耗灵石');
    loseStonesSeen = true;
    if (res.success) { levelUpSeen = true; ok(st.equipment.stash[0].等级 === beforeLevel + 1 && st.equipment.stash[0].战力 >= beforePower, '淬炼成功提升等级与战力'); break; }
    else { ok(st.equipment.stash[0].等级 === beforeLevel && st.equipment.stash[0].战力 === beforePower, '淬炼失败装备无损'); }
    beforeStones = S.totalStones(st);
  }
  ok(levelUpSeen || loseStonesSeen, '淬炼至少发生一次（成功或失败）');
}

/* ---- 灵草园：播种 → 生长 → 收获 → 入袋 ---- */
{
  const st = fresh();
  const plant = plantHerb(st, 'lingcao');
  ok(plant.ok === true, '播种凝露灵草成功');
  ok(st.cave.garden.length === 1, '灵草园已有一株');
  const def = st.cave.garden[0];
  // 按月生长至成熟
  for (let i = 0; i < 20 && st.cave.garden[0].progress < st.cave.garden[0].grow; i++) growHerbs(st);
  ok(st.cave.garden[0].progress >= st.cave.garden[0].grow, '灵草已成熟');
  const bagBefore = st.items.length;
  const harv = harvestHerb(st, 0);
  ok(harv.ok === true, '收获成熟灵草成功');
  ok(st.cave.garden.length === 0, '收获后灵草园清空');
  ok(st.items.length > bagBefore, '收获产物已入袋');
}

/* ---- 灵草园存档往返 ---- */
{
  const st = fresh();
  plantHerb(st, 'huoqing');
  growHerbs(st);
  const serialized = serialize(st);
  const st2 = deserialize(serialized);
  ok(Array.isArray(st2.cave.garden) && st2.cave.garden.length === 1, '存档往返后灵草园保留');
  ok(st2.cave.garden[0].progress === 1, '存档往返后生长进度保留');
}

console.log(`\n===== 修仙新增系统专项测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
