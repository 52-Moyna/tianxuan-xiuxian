#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""区域特产中的装备类商品也锁定 _equip（展示即所得），保留原风味描述。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/js/systems.js"
with io.open(path, "r", encoding="utf-8") as f:
    s = f.read()

old = "  regional.forEach((g) => stock.push({ 名称: g.name, 类型: g.type, 价格: g.price, 价值: Math.round(g.price * 0.7), 等级: g.level, 部位: g.slot, 描述: g.desc, effect: g.effect }));"
new = """  // 区域特产：装备类商品同样锁定生成对象（展示即所得），并保留原风味描述；其余类型原样入列。
  regional.forEach((g) => {
    if (g.type === '装备') {
      const slot = g.slot || guessEquipSlot({ 名称: g.name, 类型: '装备' });
      const item = generateEquip(state, slot, g.level || 1);
      stock.push({ 名称: g.name, 类型: '装备', 部位: slot, 等级: g.level || 1, 品阶: item.品阶, 价格: g.price, 价值: Math.round(g.price * 0.7), 描述: g.desc, effect: {}, _equip: item });
    } else {
      stock.push({ 名称: g.name, 类型: g.type, 价格: g.price, 价值: Math.round(g.price * 0.7), 等级: g.level, 部位: g.slot, 描述: g.desc, effect: g.effect });
    }
  });"""
assert old in s, "regional 行未匹配"
s = s.replace(old, new, 1)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("systems.js regional 装备已锁定")
