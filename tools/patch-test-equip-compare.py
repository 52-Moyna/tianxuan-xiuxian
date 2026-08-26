# -*- coding: utf-8 -*-
"""为本次「行囊换装对比」改动追加确定性回归断言到 test-newfeatures.mjs。"""
ROOT = "Z:/1/xiuxian"
P = f"{ROOT}/tests/test-newfeatures.mjs"

s = open(P, encoding="utf-8").read()

anchor = (
    "ok(vAfter.filter((a) => ACH_MILESTONE_IDS.has(a.id)).every((a) => a.claimed), '三档收集奖励均已领取');\n"
    "\n"
    "console.log(`"
)
assert s.count(anchor) == 1, ("anchor", s.count(anchor))

block = """ok(vAfter.filter((a) => ACH_MILESTONE_IDS.has(a.id)).every((a) => a.claimed), '三档收集奖励均已领取');

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
  eq.equipment.weapon = { 名称: '旧铁剑', 品阶: '凡品', 等级: 1, 战力: 5, 部位: 'weapon' };
  const stashBefore = (eq.equipment.stash || []).length;
  eq.items.push({ 名称: '青锋剑', 类型: '装备', 数量: 1, 描述: '测试剑', _equip: { 名称: '青锋剑', 品阶: '凡品', 等级: 2, 战力: 12, 部位: 'weapon' } });
  const bagIdx = eq.items.length - 1;
  const logs = S.useItem(eq, bagIdx);
  ok(eq.equipment.weapon && eq.equipment.weapon.名称 === '青锋剑', '换装后武器为新装备');
  ok(eq.equipment.weapon.战力 === 12, '新武器战力生效(+12)');
  ok((eq.equipment.stash || []).some((e) => e.名称 === '旧铁剑'), '旧武器进入备用栏');
  ok((eq.equipment.stash || []).length === stashBefore + 1, '备用栏数量 +1');
  ok(Array.isArray(logs) && logs.join('').includes('换装'), 'useItem 返回换装日志');
}

console.log(`"""

s = s.replace(anchor, block)
open(P, "w", encoding="utf-8").write(s)
print("OK 测试断言已插入")
