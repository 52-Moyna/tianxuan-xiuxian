# -*- coding: utf-8 -*-
# 落实套装效果死字段（阶段二·systems.js）：artifactPower / breakthrough / seaBonus / seaChance / beastLoot / beastFind
import io, sys

def rw(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new, tag in pairs:
        if s.count(old) != 1:
            print('!! 锚点异常(%d): %s' % (s.count(old), tag)); sys.exit(1)
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('OK ' + path)

PAIRS = []
# —— 1) 星辉共鸣（2件）：法宝战力额外 +2 ——
PAIRS.append((
"""function totalDaoBaseLevel(state) {
  return Object.values(state.player.daoBase || {}).reduce((s, v) => s + (Number(v.level) || 0), 0);
}""",
"""function totalDaoBaseLevel(state) {
  return Object.values(state.player.daoBase || {}).reduce((s, v) => s + (Number(v.level) || 0), 0);
}

/**
 * 套装「法宝战力额外 +N」（星辉共鸣 artifactPower）。
 * 文案写的是「法宝战力额外」，故仅在真正佩戴本命法宝时生效，空法宝栏不白送战力。
 * calcPower 与 powerBreakdown 共用本口径，避免两处漂移。
 */
export function setArtifactBonus(state, flags) {
  const setFlags = flags || setBonusFlags(state);
  const n = Number(setFlags.artifactPower || 0);
  if (!n) return 0;
  return state.equipment?.artifact ? n : 0;
}""",
 'sys.setArtifactBonus'))
PAIRS.append((
"""  const daoBaseMul = milestone ? (1 + milestone.powerMul) : 1;
  const total = (realmPower + rootBonus + eqPower + artifactPowerVal + techPower""",
"""  const daoBaseMul = milestone ? (1 + milestone.powerMul) : 1;
  const total = (realmPower + rootBonus + eqPower + artifactPowerVal + setArtifactBonus(state, setFlags) + techPower""",
 'sys.calcPower 计入套装法宝加成'))

PAIRS.append((
"""    { label: '法宝核心', value: artifactPowerVal, hint: '本命重器' },""",
"""    { label: '法宝核心', value: artifactPowerVal + setArtifactBonus(state, setFlags), hint: setArtifactBonus(state, setFlags) > 0 ? `本命重器（含星辉套装 +${setArtifactBonus(state, setFlags)}）` : '本命重器' },""",
 'sys.powerBreakdown 法宝核心'))
# —— 2) 星辉圆满（3件）：渡劫成功率 +10%（预览 + 结算同口径）——
PAIRS.append((
"""  if (p.spiritRoot.gradeId === 'fei') rate += 15;
  if (p.daoYun.id === 'tianren') rate += 8;
  if (state.flags.tiandaoBlessing) rate += state.flags.tiandaoBlessing;""",
"""  if (p.spiritRoot.gradeId === 'fei') rate += 15;
  if (p.daoYun.id === 'tianren') rate += 8;
  rate += Number(setBonusFlags(state).breakthrough || 0); // 星辉圆满（3件）：渡劫成功率 +10%
  if (state.flags.tiandaoBlessing) rate += state.flags.tiandaoBlessing;""",
 'sys.breakthroughRate 预览'))

PAIRS.append((
"""  if (p.spiritRoot.gradeId === 'fei') rate += 15; // 废灵根天劫威力减半
  if (p.daoYun.id === 'tianren') rate += 8;""",
"""  if (p.spiritRoot.gradeId === 'fei') rate += 15; // 废灵根天劫威力减半
  if (p.daoYun.id === 'tianren') rate += 8;
  rate += Number(setBonusFlags(state).breakthrough || 0); // 星辉圆满（3件）：渡劫成功率 +10%（与 breakthroughRate 同口径）""",
 'sys.attemptBreakthrough 结算'))
# —— 3) 妖纹套装：beastLoot（战利品数量 +20%）/ beastFind（更易出珍稀材料）——
PAIRS.append((
"""export function generateBeastDrops(state, enemy) {
  ensureLifeState(state);
  const drops = [];
  const lv = enemy.level || 1;""",
"""/**
 * 妖纹套装战利品加成口径（纯函数，供测试与掉落结算共用）。
 * beastLoot：妖兽类战利品数量 +20%（妖纹护体·2件）
 * beastFind：妖域探索更易发现珍稀材料——「仙缘」掉落概率上限翻倍（妖纹大成·3件）
 */
export function beastLootMul(state, flags) {
  const setFlags = flags || setBonusFlags(state);
  return 1 + Number(setFlags.beastLoot || 0);
}

/** 珍稀材料（仙缘）掉落概率：妖纹大成后上限由 15% 提至 30%，且随等级增长更快 */
export function rareMaterialChance(state, level, flags) {
  const setFlags = flags || setBonusFlags(state);
  const lv = Math.max(1, Number(level) || 1);
  return setFlags.beastFind ? Math.min(0.3, lv / 100) : Math.min(0.15, lv / 200);
}

export function generateBeastDrops(state, enemy) {
  ensureLifeState(state);
  const drops = [];
  const lv = enemy.level || 1;
  const setFlags = setBonusFlags(state);
  const lootMul = beastLootMul(state, setFlags);""",
 'sys.beastLoot 纯函数'))
PAIRS.append((
"""    { tpl: MATERIAL_TYPES.find((m) => m.id === 'xianyuan'), chance: Math.min(0.15, lv / 200) },
  ];
  for (const { tpl, chance } of pool) {
    if (tpl && Rng.chance(chance)) {
      const qty = Math.max(1, Math.round(Rng.int(1, Math.max(2, Math.floor(lv / 15) + 1)) * dangerMul));""",
"""    { tpl: MATERIAL_TYPES.find((m) => m.id === 'xianyuan'), chance: rareMaterialChance(state, lv, setFlags), rare: true },
  ];
  for (const { tpl, chance, rare } of pool) {
    // 妖纹护体（2件）：妖兽战利品期望数量 +20% —— 同时抬升掉落概率与件数；
    // 珍稀「仙缘」概率已由 rareMaterialChance 单独处理，不再二次抬升，避免叠加过强。
    const finalChance = rare ? chance : Math.min(0.95, chance * lootMul);
    if (tpl && Rng.chance(finalChance)) {
      const qty = Math.max(1, Math.round(Rng.int(1, Math.max(2, Math.floor(lv / 15) + 1)) * dangerMul * lootMul));""",
 'sys.generateBeastDrops 掉落池'))
# —— 4) 海行套装：seaBonus（海外事件收益 +30%）/ seaChance（海上奇遇·遗府入口）——
PAIRS.append((
"""  const weighted = WANDER_EVENTS.map((e) => {
    let w = e.weight;
    const boost = e.regionBoost && e.regionBoost[regionId];
    if (boost) w *= boost;""",
"""  const seaFlags = setBonusFlags(state);
  const stonesBefore = Number(state.player.stones || 0);
  const weighted = WANDER_EVENTS.map((e) => {
    let w = e.weight;
    const boost = e.regionBoost && e.regionBoost[regionId];
    if (boost) w *= boost;
    w *= seaEventWeightMul(seaFlags, e.id, regionId); // 海行圆满（3件）：海域中更易触发海上奇遇 / 遗府入口""",
 'sys.runWanderEvent 权重'))

PAIRS.append((
"""  if (bugPowderApplied) {
    res.logs = res.logs || [];
    res.logs.unshift('你撒出「驱虫粉」，雨林毒虫退散，此行更添安稳（消耗驱虫粉×1）。');
  }
  return res;
}""",
"""  if (bugPowderApplied) {
    res.logs = res.logs || [];
    res.logs.unshift('你撒出「驱虫粉」，雨林毒虫退散，此行更添安稳（消耗驱虫粉×1）。');
  }
  // 海行无阻（2件）：海外事件收益 +30% —— 按本次事件净增灵石补发，确定性、不改事件内部实现
  const seaMul = seaEventBonusMul(seaFlags, regionId);
  if (seaMul > 1) {
    const gained = Number(state.player.stones || 0) - stonesBefore;
    if (gained > 0) {
      const extra = Math.round(gained * (seaMul - 1));
      if (extra > 0) {
        addStones(state, extra);
        res.logs = res.logs || [];
        res.logs.push(`海行套装护持，海路收益更丰：灵石额外 +${extra}。`);
      }
    }
  }
  return res;
}""",
 'sys.runWanderEvent 收益'))
PAIRS.append((
"""/** 按区域加权抽取一个游历事件并执行 */
export function resolveWanderEvent(state) {""",
"""/** 海域（可享海行套装加成的地域）：海外仙岛与北冥瀚海 */
export const SEA_REGIONS = ['haiwai', 'beiming'];

/**
 * 海行无阻（2件）：海外事件收益倍率（seaBonus）。仅在海域游历时生效。
 * @returns {number} 1 表示无加成，1.3 表示收益 +30%
 */
export function seaEventBonusMul(flags, regionId) {
  const f = flags || {};
  if (!SEA_REGIONS.includes(regionId)) return 1;
  return 1 + Number(f.seaBonus || 0);
}

/**
 * 海行圆满（3件）：海上奇遇权重倍率（seaChance）。
 * 在海域中把「风化洞府（遗府残图）」与「仙缘使者」两类奇遇的抽取权重翻倍，
 * 兑现文案「可触发海上奇遇，有概率发现遗府入口」。
 */
export function seaEventWeightMul(flags, eventId, regionId) {
  const f = flags || {};
  if (!f.seaChance) return 1;
  if (!SEA_REGIONS.includes(regionId)) return 1;
  return (eventId === 'cave' || eventId === 'xianyuan') ? 2 : 1;
}

/** 按区域加权抽取一个游历事件并执行 */
export function resolveWanderEvent(state) {""",
 'sys.sea 纯函数'))

rw('public/js/systems.js', PAIRS)
