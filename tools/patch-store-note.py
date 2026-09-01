#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""统一：storeItem 满仓补提示（消除静默丢失的信息盲区）

新增通用工具 storeItemOrNote：入袋成功返回 true；满仓时向 logs 追加一行
⚠ 提示并返回 false。用于「免费奖励」类入袋（赠送 / 拾取 / 退还），
避免玩家触发了机缘却什么都没拿到、日志也不吭声。

应用三处历史静默点：
  1. life.js   废丹退还的残余材料（循环内静默丢失）
  2. systems.js 道友回赠材料（relation >= 3 随机礼）
  3. systems.js 灵兽契约（收服成功赠凭证，满仓时图鉴解锁了物品却没有）
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def sub_once(text, old, new, tag):
    if old not in text:
        print('[MISS] ' + tag)
        sys.exit(1)
    if text.count(old) != 1:
        print('[DUP] %s -> %d' % (tag, text.count(old)))
        sys.exit(1)
    print('[OK] ' + tag)
    return text.replace(old, new)


# ---------- 1. life.js：新增 storeItemOrNote ----------
p = os.path.join(ROOT, 'public', 'js', 'life.js')
s = read(p)

OLD = """/** 整理行囊：按类型稳定排序，并合并非装备/法宝的同类堆叠（storeItem 已即时合并，"""

NEW = """/** 入袋并记录满仓：成功返回 true；储物袋满时向 logs 追加一行 ⚠ 提示并返回 false。
 *  用途：免费奖励（赠送 / 拾取 / 退还）类入袋，杜绝「物品静默消失、玩家一头雾水」。
 *  注意：若属「先付代价再得产出」的场合，仍应先 canStore 校验、再扣代价（见 harvestHerb）。 */
export function storeItemOrNote(state, item, logs, note) {
  if (storeItem(state, item)) return true;
  const name = (item && item.名称) || '物品';
  if (Array.isArray(logs)) logs.push(note || `⚠ 储物袋已满，「${name}」未能带走。`);
  return false;
}

/** 整理行囊：按类型稳定排序，并合并非装备/法宝的同类堆叠（storeItem 已即时合并，"""

s = sub_once(s, OLD, NEW, 'life.js: 新增 storeItemOrNote')
write(p, s)

# ---------- 2. life.js：废丹退还材料 ----------
s = read(p)
OLD = """        const refund = Math.floor(count / 2);
        if (refund > 0) storeItem(state, { 名称: name, 类型: '材料', 数量: refund, 描述: '废丹回收的残余材料。', 价值: 10 });"""
NEW = """        const refund = Math.floor(count / 2);
        // 满仓提示：退还材料入袋失败时明确告知，否则玩家只看到「炼制失败」，
        // 却不知道本该退回的半份材料也没了（静默双重损失）。
        if (refund > 0) storeItemOrNote(state, { 名称: name, 类型: '材料', 数量: refund, 描述: '废丹回收的残余材料。', 价值: 10 }, logs);"""
s = sub_once(s, OLD, NEW, 'life.js: 废丹退还材料补提示')
write(p, s)

# ---------- 3. systems.js：import storeItemOrNote ----------
p = os.path.join(ROOT, 'public', 'js', 'systems.js')
s = read(p)

OLD = "herbArrayGrowth, herbMonthlyGrowth, storeItem, canStore, craftRecipe, canCraft,"
NEW = "herbArrayGrowth, herbMonthlyGrowth, storeItem, storeItemOrNote, canStore, craftRecipe, canCraft,"
s = sub_once(s, OLD, NEW, 'systems.js: import storeItemOrNote')
write(p, s)

# ---------- 4. systems.js：道友回赠材料 ----------
s = read(p)
OLD = """    const gift = { 名称: `${npc.name}的回礼`, 类型: '材料', 数量: 1, 描述: `${npc.job}赠予的地域材料。` };
    if (storeItem(state, gift)) logs.push(`「${npc.name}」回赠一份材料，已收入储物袋。`);"""
NEW = """    const gift = { 名称: `${npc.name}的回礼`, 类型: '材料', 数量: 1, 描述: `${npc.job}赠予的地域材料。` };
    if (storeItemOrNote(state, gift, logs, `储物袋已满，「${npc.name}」的回礼未能带走。`)) logs.push(`「${npc.name}」回赠一份材料，已收入储物袋。`);"""
s = sub_once(s, OLD, NEW, 'systems.js: 道友回礼补提示')
write(p, s)

# ---------- 5. systems.js：灵兽契约 ----------
s = read(p)
OLD = """      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。', 价值: 0, effect: { beastSlot: 1 } };
      storeItem(state, contract);
      discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });"""
NEW = """      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。', 价值: 0, effect: { beastSlot: 1 } };
      // 满仓提示：旧写法无条件 storeItem + discoverItem，储物袋满时图鉴解锁了「灵兽契约」、
      // 行囊里却没有实物，玩家翻遍行囊找不着，以为是 bug。
      if (storeItemOrNote(state, contract, logs, '⚠ 储物袋已满，「灵兽契约」未能带走（灵兽已收服，可腾出格子后重新收服补领）。')) {
        discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });
      }"""
s = sub_once(s, OLD, NEW, 'systems.js: 灵兽契约补提示')
write(p, s)

print('DONE')
