#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""test-newfeatures.mjs：新增坊市锁定 + marketCompare 专项断言。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/tests/test-newfeatures.mjs"
with io.open(path, "r", encoding="utf-8") as f:
    s = f.read()

anchor = """console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""
assert anchor in s, "汇总锚点未匹配"

block = """// ===== 坊市货架锁定（展示即所得）+ marketCompare 对比徽标 =====
{
  const g = S.createNewGame({ name: '坊市', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2 });
  ensureLifeState(g);
  g.inventory.capacity = 999; g.inventory.used = 0;
  S.addStones(g, 100000);
  const stock = S.shopStock(g);
  const eqStock = stock.find((x) => x.类型 === '装备');
  ok(eqStock && eqStock._equip, '坊市装备已锁定生成对象(_equip)');
  const listedPow = eqStock._equip ? eqStock._equip.战力 : eqStock.战力;
  const lenBefore = g.equipment.stash.length;
  S.buyItem(g, eqStock);
  const bought = g.equipment.stash[lenBefore];
  ok(bought && bought.战力 === listedPow, `坊市装备购买即所得（展示战力${listedPow}==入手${bought && bought.战力}）`);
}
{
  // 法宝路径：合成带 _equip 的货架项，购买后战力须一致
  const g = S.createNewGame({ name: '坊市宝', gender: '女', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2 });
  ensureLifeState(g);
  g.inventory.capacity = 999; g.inventory.used = 0; S.addStones(g, 100000);
  const artGoods = { 名称: '试炼法宝', 类型: '法宝', 部位: 'artifact', 等级: 4, 品阶: '法器', 价格: 100, 价值: 80, 描述: '测试', effect: {}, _equip: { 名称: '试炼法宝', 类型: '法宝', 部位: 'artifact', 品阶: '法器', 等级: 4, 战力: 42, 描述: '测试', 效果: {} } };
  const lenBefore = g.equipment.stash.length;
  const r = S.buyItem(g, artGoods);
  ok(g.equipment.stash.length === lenBefore + 1 && g.equipment.stash[lenBefore].战力 === 42, '坊市法宝(_equip)购买即所得(战力42)');
}
{
  // marketCompare 四态：新装备位 / 更强 / 略逊 / 持平（含法宝槽）
  const mk = () => S.createNewGame({ name: '对比', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2 });
  let st = mk(); // 无任何装备
  ok(S.marketCompare(st, { 类型: '装备', 部位: 'weapon', 战力: 10 }).cls === 'new', 'marketCompare：无当前装备→新装备位');
  st = mk(); st.equipment.weapon = { 战力: 5 };
  const up = S.marketCompare(st, { 类型: '装备', 部位: 'weapon', 战力: 12 });
  ok(up.cls === 'up' && up.text.includes('+7'), 'marketCompare：更强(+7)');
  const down = S.marketCompare(st, { 类型: '装备', 部位: 'weapon', 战力: 3 });
  ok(down.cls === 'down' && down.text.includes('2'), 'marketCompare：略逊当前(-2)');
  const flat = S.marketCompare(st, { 类型: '装备', 部位: 'weapon', 战力: 5 });
  ok(flat.cls === 'flat', 'marketCompare：战力持平→持平');
  const fa = S.marketCompare(mk(), { 类型: '法宝', 部位: 'artifact', 战力: 30 });
  ok(fa.cls === 'new', 'marketCompare：法宝槽新装备位');
  ok(S.marketCompare(mk(), { 类型: '丹药' }) === null, 'marketCompare：非装备/法宝返回 null');
}

"""

assert block not in s, "测试块已存在"
s = s.replace(anchor, block + anchor, 1)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("test-newfeatures.mjs 已更新")
