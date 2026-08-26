# -*- coding: utf-8 -*-
"""test-newfeatures.mjs 追加丹炉成丹率预览确定性断言。"""
import io, os

TEST = "Z:/1/xiuxian/tests/test-newfeatures.mjs"

with io.open(TEST, "r", encoding="utf-8") as f:
    s = f.read()

# 1) 导入 refineRate
imp_old = "isRecipeUnlocked, alchemySlots, storeItem, REGION_TRAVEL,"
imp_new = "isRecipeUnlocked, alchemySlots, refineRate, storeItem, REGION_TRAVEL,"
if imp_old not in s:
    raise SystemExit("[失败] 未找到 life 导入锚点")
if "refineRate," in imp_old and imp_new in s:
    pass
s = s.replace(imp_old, imp_new, 1)

# 2) 在最终汇总前插入测试段
anchor = "console.log(`\n===== 本轮新功能专项测试"
if anchor not in s:
    raise SystemExit("[失败] 未找到汇总锚点")
section = """/* ---------- 丹炉成丹率确定性预览 ---------- */
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

"""
s = s.replace(anchor, section + anchor, 1)

with io.open(TEST, "w", encoding="utf-8") as f:
    f.write(s)
print("[OK] test-newfeatures.mjs 追加 refineRate 断言")
