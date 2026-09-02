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

/* ---- 渡劫预览（点破之前看得懂：成功率 / 将消耗 / 失败跌几级） ---- */
{
  const st = fresh();
  ok(S.breakthroughPreview(st) === null, '非瓶颈层渡劫预览为空');
  ok(S.breakthroughBack(95) === null, '飞升之劫失败不跌级（走轮回）');
  ok(S.breakthroughBack(80) === 3 && S.breakthroughBack(40) === 2 && S.breakthroughBack(20) === 1, '失败跌落级数与结算一致');
  ok(S.breakthroughWaves(20) === 4 && S.breakthroughWaves(60) === 5 && S.breakthroughWaves(5) === 3, '天劫波数与结算一致');
}
{
  const st = fresh();
  st.player.level = 20;
  st.player.exp = 999999;
  st.items.push({ 名称: '筑基丹', 类型: '丹药', 数量: 2, 品阶: 'shang', effect: { tribulation: 20 } });
  const bp = S.breakthroughPreview(st);
  ok(bp && typeof bp.rate === 'number', '瓶颈层渡劫预览给出成功率');
  ok(bp.rate === S.breakthroughRate(st), '预览成功率与 breakthroughRate 同口径');
  ok(bp.rate >= 5 && bp.rate <= 95, '预览成功率被夹在 5~95');
  ok(bp.waves === S.breakthroughWaves(20), '预览波数与结算波数一致');
  ok(bp.back === S.breakthroughBack(20), '预览跌落级数与结算一致');
  ok(typeof bp.failText === 'string' && bp.failText.includes('跌落 1 级'), '预览明示失败跌几级');
  const names = bp.pills.map((x) => x.名称);
  ok(new Set(names).size === names.length, '将消耗丹药按名称去重（不重复列出同堆丹药）');
  ok(bp.pills.length && bp.pills[0].count >= 1, '将消耗丹药带消耗数量');
  ok(bp.parts.length >= 1 && bp.parts[0].label === '瓶颈基础', '预览给出成功率拆解来源');
  const sum = bp.parts.reduce((a, x) => a + x.value, 0);
  ok(Math.min(95, Math.max(5, Math.round(sum))) === bp.rate, '拆解项之和等于最终成功率（同夹取口径）');
  // 口径一致性：预览承诺的成功率必须就是结算实际使用的成功率（预览不消耗道具/状态）
  const before = JSON.stringify(st.items);
  const res = S.attemptBreakthrough(st);
  ok(res.rate === bp.rate, '预览成功率 === 结算成功率');
  ok(res.waves.length <= bp.waves, '结算波数不超过预览承诺的波数');
  ok(JSON.stringify(st.items) !== before, '结算确实消耗了渡劫丹（预览不消耗）');
}
{
  const st = fresh();
  st.player.level = 95;
  st.player.exp = 999999;
  const bp = S.breakthroughPreview(st);
  ok(bp && bp.back === null, '飞升之劫预览标记不跌级');
  ok(bp.failText.includes('轮回'), '飞升之劫预览明示失败将入轮回');
}

console.log(`\n===== 修仙新增系统专项测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
