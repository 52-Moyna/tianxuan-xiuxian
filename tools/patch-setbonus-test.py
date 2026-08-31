# -*- coding: utf-8 -*-
# 为套装 7 项加成落实补确定性回归断言
import io, sys
p = 'tests/test-newfeatures.mjs'
s = io.open(p, encoding='utf-8').read()

# 1) import 补 travelCost 与 setBonusFlags
old_imp = ", startTravel, travelOptions, ART_RECIPES,"
new_imp = ", startTravel, travelOptions, travelCost, ART_RECIPES,"
if s.count(old_imp) != 1:
    print('!! import 锚点异常'); sys.exit(1)
s = s.replace(old_imp, new_imp)

old_imp2 = "import { achievementView, checkAchievements, codexEntries, ownedEquipPower, activeSetBonuses,"
new_imp2 = "import { achievementView, checkAchievements, codexEntries, ownedEquipPower, activeSetBonuses, setBonusFlags, SET_BONUSES,"
if s.count(old_imp2) != 1:
    print('!! codex import 锚点异常'); sys.exit(1)
s = s.replace(old_imp2, new_imp2)

ANCHOR = "console.log(`\n===== 本轮新功能专项测试："
if s.count(ANCHOR) != 1:
    print('!! 汇总锚点异常'); sys.exit(1)
BLOCK = r'''
/* ---------- 套装效果 7 项加成落实（此前为文案承诺但零实现的死字段） ---------- */
{
  const mkSet = (names) => {
    const st2 = S.createNewGame({
      name: '套装测试', gender: '男', raceId: 'human', ageId: 'young',
      regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
    });
    ensureLifeState(st2);
    st2.inventory.capacity = 1000;
    st2.items = names.map((n) => ({ 名称: n.名称, 类型: n.类型 || '装备', 数量: 1, 描述: '套装测试件' }));
    return st2;
  };

  // —— 星辉共鸣（2件）：法宝战力额外 +2（仅佩戴本命法宝时生效）——
  const xh2 = mkSet([{ 名称: '星辉剑' }, { 名称: '星纹护甲' }]);
  const f2 = setBonusFlags(xh2);
  ok(f2.artifactPower === 2, '星辉2件：setBonusFlags 含 artifactPower=2');
  ok(S.setArtifactBonus(xh2) === 0, '星辉2件：未佩戴法宝时不给法宝加成');
  xh2.equipment.artifact = { 名称: '测试法宝', 类型: '法宝', 战力: 10, 等级: 5, 品阶: 'fan' };
  ok(S.setArtifactBonus(xh2) === 2, '星辉2件：佩戴法宝后法宝战力额外 +2');
  const bdA = S.powerBreakdown(xh2).items.find((i) => i.label === '法宝核心');
  ok(bdA && bdA.hint.includes('含星辉套装 +2'), '战力拆解「法宝核心」标注套装加成来源');
  // calcPower 应真实包含该 +2（与拆解同口径）
  const noSet = mkSet([]);
  noSet.equipment.artifact = { 名称: '测试法宝', 类型: '法宝', 战力: 10, 等级: 5, 品阶: 'fan' };
  ok(S.calcPower(xh2) - S.calcPower(noSet) >= 10, 'calcPower 计入套装战力与法宝额外加成');

  // —— 星辉圆满（3件）：渡劫成功率 +10%（预览与结算同口径）——
  const xh3 = mkSet([{ 名称: '星辉剑' }, { 名称: '星纹护甲' }, { 名称: '星砂', 类型: '材料' }]);
  ok(setBonusFlags(xh3).breakthrough === 10, '星辉3件：setBonusFlags 含 breakthrough=10');
  const plain = mkSet([]);
  plain.player.level = 20; xh3.player.level = 20;
  const rPlain = S.breakthroughRate(plain);
  const r3 = S.breakthroughRate(xh3);
  ok(rPlain !== null && r3 !== null && r3 - rPlain === 10, '星辉3件：渡劫成功率预览 +10%');

  // —— 海行无阻（2件）：跨域路费 -20% ——
  const hx2 = mkSet([{ 名称: '海兽皮甲' }, { 名称: '海灵佩' }]);
  ok(Math.abs(setBonusFlags(hx2).travelDiscount - 0.2) < 1e-9, '海行2件：setBonusFlags 含 travelDiscount=0.2');
  const qBase = travelCost(plain, 'nanming');
  const qDisc = travelCost(hx2, 'nanming');
  ok(qBase.cost === REGION_TRAVEL.nanming.cost, '未激活套装时路费等于地域基准价');
  ok(qDisc.cost === Math.round(REGION_TRAVEL.nanming.cost * 0.8), '海行2件：路费按 20% 折扣结算');
  // 与旅行凭证叠加：先套装折扣，再凭证减半
  hx2.items.push({ 名称: '远航凭证', 类型: '消耗品', 数量: 1, effect: { travel: 50 } });
  const qBoth = travelCost(hx2, 'nanming');
  ok(qBoth.cost === Math.round(Math.round(REGION_TRAVEL.nanming.cost * 0.8) * 0.5), '套装折扣与旅行凭证可叠加');
  ok(qBoth.voucher && qBoth.voucher.名称 === '远航凭证', 'travelCost 回传将被消耗的凭证');
  ok(travelCost(plain, 'not_a_region').cost === 0, 'travelCost 对未知地域返回 0 不抛错');

  // —— 海行无阻（2件）：海域游历灵石收益 +30% ——
  ok(Math.abs(S.seaEventBonusMul(setBonusFlags(hx2), 'haiwai') - 1.3) < 1e-9, '海行2件：海外仙岛收益倍率 1.3');
  ok(Math.abs(S.seaEventBonusMul(setBonusFlags(hx2), 'beiming') - 1.3) < 1e-9, '海行2件：北冥瀚海同享收益加成');
  ok(S.seaEventBonusMul(setBonusFlags(hx2), 'zhongzhou') === 1, '非海域不享海行收益加成');
  ok(S.seaEventBonusMul(setBonusFlags(plain), 'haiwai') === 1, '未激活海行套装时海域无收益加成');

  // —— 海行圆满（3件）：海域奇遇权重翻倍 ——
  const hx3 = mkSet([{ 名称: '海兽皮甲' }, { 名称: '海灵佩' }, { 名称: '远航罗盘' }]);
  const fh3 = setBonusFlags(hx3);
  ok(fh3.seaChance === true, '海行3件：setBonusFlags 含 seaChance');
  ok(S.seaEventWeightMul(fh3, 'cave', 'haiwai') === 2, '海行3件：海域「风化洞府（遗府残图）」权重翻倍');
  ok(S.seaEventWeightMul(fh3, 'xianyuan', 'haiwai') === 2, '海行3件：海域「仙缘使者」奇遇权重翻倍');
  ok(S.seaEventWeightMul(fh3, 'plain', 'haiwai') === 1, '非奇遇事件权重不变');
  ok(S.seaEventWeightMul(fh3, 'cave', 'zhongzhou') === 1, '非海域不触发海上奇遇加权');
  ok(S.seaEventWeightMul(setBonusFlags(plain), 'cave', 'haiwai') === 1, '未激活海行圆满时无奇遇加权');

  // —— 妖纹护体（2件）：妖兽战利品期望数量 +20% ——
  const yw2 = mkSet([{ 名称: '妖纹战铠' }, { 名称: '青风靴' }]);
  ok(Math.abs(S.beastLootMul(yw2) - 1.2) < 1e-9, '妖纹2件：战利品倍率 1.2');
  ok(S.beastLootMul(plain) === 1, '未激活妖纹套装时战利品倍率 1');

  // —— 妖纹大成（3件）：珍稀「仙缘」掉落上限 15%→30% ——
  const yw3 = mkSet([{ 名称: '妖纹战铠' }, { 名称: '青风靴' }, { 名称: '青风狼牙' }]);
  ok(setBonusFlags(yw3).beastFind === true, '妖纹3件：setBonusFlags 含 beastFind');
  ok(Math.abs(S.rareMaterialChance(plain, 60) - 0.15) < 1e-9, '未激活：仙缘掉落上限 15%');
  ok(Math.abs(S.rareMaterialChance(yw3, 60) - 0.3) < 1e-9, '妖纹3件：仙缘掉落上限提至 30%');
  ok(Math.abs(S.rareMaterialChance(plain, 20) - 0.1) < 1e-9, '未激活：低等级仙缘概率 lv/200');
  ok(Math.abs(S.rareMaterialChance(yw3, 20) - 0.2) < 1e-9, '妖纹3件：低等级仙缘概率 lv/100');

  // —— 回归护栏：SET_BONUSES 中出现的每一个加成键都必须有真实消费方 ——
  const WIRED = new Set(['power', 'artifactPower', 'mysticFind', 'breakthrough', 'craftQuality', 'craftExp', 'pillToxicityHalf', 'travelDiscount', 'seaBonus', 'seaChance', 'beastLoot', 'beastFind']);
  const allKeys = new Set();
  for (const set of Object.values(SET_BONUSES)) {
    for (const k of Object.keys(set.bonus2 || {})) allKeys.add(k);
    for (const k of Object.keys(set.bonus3 || {})) allKeys.add(k);
  }
  const orphan = [...allKeys].filter((k) => !WIRED.has(k));
  ok(orphan.length === 0, `套装加成键全部已接线（发现未接线键：${orphan.join(',') || '无'}）`);
}

'''
s = s.replace(ANCHOR, BLOCK + ANCHOR)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('OK ' + p)
