#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""锁定坊市货架装备/法宝（展示即所得）+ 新增 marketCompare 纯函数。"""
import io, sys

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/js/systems.js"
with io.open(path, "r", encoding="utf-8") as f:
    s = f.read()

# ---- 1) shopStock：装备/法宝生成即锁定 _equip ----
old_stock = """  // —— 装备细分（六部位各一件，可于行囊装备）——
  const gearLv = Math.min(5, Math.max(1, Math.round(lv / 12)));
  const gearGrade = getEquipGradeByLevel(gearLv);
  for (const slot of EQUIP_SLOTS) {
    const name = makeEquipName(slot.id, gearGrade);
    const power = calcEquipPower(slot.id, gearLv, gearGrade);
    stock.push({ 名称: name, 类型: '装备', 部位: slot.id, 等级: gearLv, 品阶: gearGrade.id, 价格: gearLv * gearLv * 130 + 40, 价值: Math.round((gearLv * gearLv * 130 + 40) * 0.7), 描述: `${slot.name}（${gearGrade.name}），战力+${power}。`, effect: {} });
  }
  if (Rng.chance(0.5)) {
    const art = generateEquip(state, 'artifact', gearLv + 1, Rng.pick(ARTIFACT_NAMES));
    stock.push({ 名称: art.名称, 类型: '法宝', 部位: 'artifact', 等级: gearLv + 1, 品阶: art.品阶, 价格: Math.round(art.战力 * 40), 价值: Math.round(art.战力 * 28), 描述: `法宝（${EQUIP_GRADES.find((g) => g.id === art.品阶)?.name}），战力+${art.战力}。`, effect: {} });
  }"""
new_stock = """  // —— 装备细分（六部位各一件，可于行囊装备）——
  // 关键修复：此前货架展示的「战力」由随机生成得到，但购买时 buyItem 又重新随机生成一件，
  // 导致「看到的战力」与「买到的」不一致（买亏却不自知）。现改为生成即锁定：把生成的装备
  // 对象存入 _equip，购买时直接发放这一件（展示即所得）；并供货架渲染「与当前同部位对比」徽标。
  const gearLv = Math.min(5, Math.max(1, Math.round(lv / 12)));
  const gearGrade = getEquipGradeByLevel(gearLv);
  for (const slot of EQUIP_SLOTS) {
    const item = generateEquip(state, slot.id, gearLv);
    stock.push({ 名称: item.名称, 类型: '装备', 部位: slot.id, 等级: gearLv, 品阶: item.品阶, 价格: gearLv * gearLv * 130 + 40, 价值: Math.round((gearLv * gearLv * 130 + 40) * 0.7), 描述: item.描述, effect: {}, _equip: item });
  }
  if (Rng.chance(0.5)) {
    const art = generateEquip(state, 'artifact', gearLv + 1, Rng.pick(ARTIFACT_NAMES));
    stock.push({ 名称: art.名称, 类型: '法宝', 部位: 'artifact', 等级: gearLv + 1, 品阶: art.品阶, 价格: Math.round(art.战力 * 40), 价值: Math.round(art.战力 * 28), 描述: `法宝（${EQUIP_GRADES.find((g) => g.id === art.品阶)?.name}），战力+${art.战力}。`, effect: {}, _equip: art });
  }"""
assert old_stock in s, "shopStock 装备块未匹配"
s = s.replace(old_stock, new_stock, 1)

# ---- 2) buyItem：装备/法宝优先发放锁定的 _equip ----
old_buy = """  } else if (goods.类型 === '装备') {
    const slot = goods.部位 || guessEquipSlot({ 名称: goods.名称, 类型: '装备' });
    const item = generateEquip(state, slot, goods.等级 || 1, goods.名称);
    state.equipment.stash.push(item);
  } else if (goods.类型 === '法宝') {
    const item = generateEquip(state, 'artifact', goods.等级 || 1, goods.名称);
    state.equipment.stash.push(item);
  } else if (goods.类型 === '功法') {"""
new_buy = """  } else if (goods.类型 === '装备') {
    // 优先发放货架锁定的那一件（展示即所得）；无 _equip 时回退原随机生成（兼容兑换所/其它来源）
    const item = goods._equip || generateEquip(state, goods.部位 || guessEquipSlot({ 名称: goods.名称, 类型: '装备' }), goods.等级 || 1, goods.名称);
    state.equipment.stash.push(item);
  } else if (goods.类型 === '法宝') {
    const item = goods._equip || generateEquip(state, 'artifact', goods.等级 || 1, goods.名称);
    state.equipment.stash.push(item);
  } else if (goods.类型 === '功法') {"""
assert old_buy in s, "buyItem 装备/法宝块未匹配"
s = s.replace(old_buy, new_buy, 1)

# ---- 3) 新增 marketCompare 纯函数（插在 sellItem 之前）----
anchor = "export function sellItem(state, idx) {"
assert anchor in s, "sellItem 锚点未匹配"
func = """/** 坊市/兑换所购买时，装备/法宝与「当前同部位已装备」的战力对比（纯函数、不改动状态）。
 *  用于货架渲染智能徽标：🆕 新装备位 / 🟢 更强 / ⚪ 略逊当前 / ➖ 持平，帮助玩家判断是否有效提升，
 *  避免「随机重roll」导致的买亏而不自知。无 _equip 时回退用货架展示的 战力 字段。 */
export function marketCompare(state, goods) {
  if (!goods || (goods.类型 !== '装备' && goods.类型 !== '法宝')) return null;
  const slot = goods.类型 === '法宝' ? 'artifact' : (goods.部位 || guessEquipSlot({ 名称: goods.名称, 类型: '装备' }));
  const cur = state.equipment ? state.equipment[slot] : null;
  const curPow = cur ? (Number(cur.战力) || 0) : 0;
  const newPow = Number(goods.战力) || (goods._equip ? Number(goods._equip.战力) || 0 : 0);
  if (!cur) return { cls: 'new', tag: '🆕', text: '新装备位' };
  const diff = newPow - curPow;
  if (diff > 0) return { cls: 'up', tag: '🟢', text: `战力+${diff}（更强）` };
  if (diff < 0) return { cls: 'down', tag: '⚪', text: `战力${-diff}（略逊当前）` };
  return { cls: 'flat', tag: '➖', text: '持平' };
}

"""
assert func not in s, "marketCompare 已存在"
s = s.replace(anchor, func + anchor, 1)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("systems.js 已更新")
