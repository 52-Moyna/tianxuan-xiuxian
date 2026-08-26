# -*- coding: utf-8 -*-
"""重写 test-newfeatures.mjs 中「行囊换装对比」测试块，改用 generateEquip 生成合规装备。"""
ROOT = "Z:/1/xiuxian"
P = f"{ROOT}/tests/test-newfeatures.mjs"
s = open(P, encoding="utf-8").read()

old = """{
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
}"""

new = """{
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
}"""

assert s.count(old) == 1, ("old block", s.count(old))
s = s.replace(old, new)
open(P, "w", encoding="utf-8").write(s)
print("OK 测试块已重写")
