#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""天玄修仙录 · 道友之能全生效补丁（相对路径、可整体迁移）。"""
import io

def patch(path, repls):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    for old, new in repls:
        assert old in s, f"[{path}] 未找到目标片段:\n{old[:120]}"
        s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f"[OK] {path} 已修改（{len(repls)} 处）")

SYS = 'public/js/systems.js'
sys_repls = [
    (
"""/** 道缘是否已结识（缺省视为已结识，兼容旧档） */
export function isMet(npc) {
  return npc.met !== false;
}
""",
"""/** 道缘是否已结识（缺省视为已结识，兼容旧档） */
export function isMet(npc) {
  return npc.met !== false;
}

/** 是否拥有某职业的「道友」（relation>=3）级道缘；返回该 NPC 或 null。
 *  供「道友之能」按职业触发专属效果（炼器师八折 / 剑修体修助拳 / 散修引荐）。 */
export function daoFriendJob(state, job) {
  return knownNpcs(state).find((n) => (n.relation || 0) >= 3 && n.job === job) || null;
}
"""
    ),
    (
"""  const cost = 40 * (level + 1);
  if (!spendStones(state, cost)) return { ok: false, logs: [`灵石不足（需 ${cost}）。`] };""",
"""  let cost = 40 * (level + 1);
  // 道友之能·炼器师：法器保养与小修八折（relation>=3 的炼器师道友在旁，省下两成灵石）
  if (daoFriendJob(state, '炼器师')) cost = Math.round(cost * 0.8);
  if (!spendStones(state, cost)) return { ok: false, logs: [`灵石不足（需 ${cost}）。`] };"""
    ),
    (
"""      const wFull = state.items.find((i) => i.名称 === '护身符');
      const wLow = state.items.find((i) => i.名称 === '低阶护身符');
      const w = wFull || wLow;
      if (w) {
        wardKind = wFull ? 'ward' : 'wardLow';
        w.数量 -= 1;
        if (w.数量 <= 0) state.items.splice(state.items.indexOf(w), 1);
      }""",
"""      const wFull = state.items.find((i) => i.名称 === '护身符');
      const wLow = state.items.find((i) => i.名称 === '低阶护身符' || i.名称 === '低阶符箓' || i.名称 === '简易阵旗');
      const w = wFull || wLow;
      if (w) {
        wardKind = wFull ? 'ward' : 'wardLow';
        w.数量 -= 1;
        if (w.数量 <= 0) state.items.splice(state.items.indexOf(w), 1);
      }"""
    ),
    (
"""  if (state.flags.companionMonths > 0) apply(10, 'ally');""",
"""  if (state.flags.companionMonths > 0) apply(10, 'ally');
  // 道友之能·剑修/体修：仗义护持，道友级（relation>=3）即在战斗中助拳（确定性 +6，不掷运）
  if (daoFriendJob(state, '剑修') || daoFriendJob(state, '体修')) apply(6, 'ally');"""
    ),
    (
"""  if (state.flags.companionMonths > 0 && !fled) {
    finalRate = Math.min(95, finalRate + 10);
    logs.push(`同行道友「${state.flags.companion}」从旁策应，胜率提高。`);
  }""",
"""  if (state.flags.companionMonths > 0 && !fled) {
    finalRate = Math.min(95, finalRate + 10);
    logs.push(`同行道友「${state.flags.companion}」从旁策应，胜率提高。`);
  }
  // 道友之能·剑修/体修：仗义护持，道友级（relation>=3）即在战斗中助拳（确定性 +6）
  const warFriend = !fled && (daoFriendJob(state, '剑修') || daoFriendJob(state, '体修'));
  if (warFriend) {
    finalRate = Math.min(95, finalRate + 6);
    logs.push(`道友「${warFriend.name}」仗义助拳，胜率提高。`);
  }"""
    ),
    (
"""      } else if (npc.skill.includes('风声')) {
        logs.push(`道友「${npc.name}」捎来一条秘闻：${Rng.pick(WORLD_EVENTS)}。`);
      }
    }
  }""",
"""      } else if (npc.skill.includes('风声')) {
        logs.push(`道友「${npc.name}」捎来一条秘闻：${Rng.pick(WORLD_EVENTS)}。`);
      } else if (npc.skill.includes('手作')) {
        if (npc.job === '符师') {
          const gift = { 名称: '低阶符箓', 类型: '消耗品', 数量: 1, 描述: `${npc.name}所赠符箓，败北时替你挡灾。`, 价值: 50, effect: { ward: true } };
          if (storeItem(state, gift)) logs.push(`道友「${npc.name}」敬赠一张低阶符箓，已收入储物袋。`);
          else logs.push(`道友「${npc.name}」赠来符箓，但储物袋已满，暂未收下。`);
        } else { // 阵师
          const gift = { 名称: '简易阵旗', 类型: '消耗品', 数量: 1, 描述: `${npc.name}所赠阵旗，战场布成临时护阵，败北时挡灾。`, 价值: 70, effect: { ward: true } };
          if (storeItem(state, gift)) logs.push(`道友「${npc.name}」赠你一面简易阵旗，已收入储物袋。`);
          else logs.push(`道友「${npc.name}」赠来阵旗，但储物袋已满，暂未收下。`);
        }
      }
    }
  }
  // 道友之能·散修：引荐延誉，每半年（turns 为 6 的倍数）引荐一位尚未结识的高人
  if (state.world.turns % 6 === 0) {
    const matchmaker = daoFriendJob(state, '散修');
    if (matchmaker) {
      const pend = state.npcs.find((n) => n.met === false);
      if (pend) {
        pend.met = true; pend.relation = 0; pend.relationName = '陌路';
        logs.push(`道友「${matchmaker.name}」（散修）引荐，你结识了${pend.race || ''}${pend.job || ''}「${pend.name}」，多了一段道缘。`);
        addLog(state, '事件', `经「${matchmaker.name}」引荐，结识「${pend.name}」。`);
      }
    }
  }"""
    ),
]

DAT = 'public/js/data.js'
dat_repls = [
    (
"""  '阵师': { text: '对方邀你观其布阵，临行赠你一面阵旗，道「此旗可临时成小小护阵」。', reward: { type: 'item', 名称: '简易阵旗', 类型: '材料', 数量: 1, 描述: '阵师相赠的阵旗，布置可成临时护阵。', 价值: 70 } },""",
"""  '阵师': { text: '对方邀你观其布阵，临行赠你一面阵旗，道「此旗可临时成小小护阵」。', reward: { type: 'item', 名称: '简易阵旗', 类型: '消耗品', 数量: 1, 描述: '阵师相赠的阵旗，战场布成临时护阵，败北时替你挡去重伤与失财。', 价值: 70, effect: { ward: true } } },"""
    ),
]

COX = 'public/js/codex.js'
cox_repls = [
    (
"""  { id: 'item_ward_low', category: '道具', name: '低阶护身符', rarity: '消耗品', source: '西极玄冰域坊市', effect: '下一次战斗失败时减轻损失（效果弱于护身符）。' },""",
"""  { id: 'item_ward_low', category: '道具', name: '低阶护身符', rarity: '消耗品', source: '西极玄冰域坊市', effect: '下一次战斗失败时减轻损失（效果弱于护身符）。' },
  { id: 'item_ward_talisman', category: '道具', name: '低阶符箓', rarity: '消耗品', source: '符师道友敬赠、百艺制符', effect: '下一次战斗失败时减轻损失（效果弱于护身符）。' },
  { id: 'item_simple_flag', category: '道具', name: '简易阵旗', rarity: '消耗品', source: '阵师道友敬赠、阵法百艺', effect: '战场布成临时护阵，下一次战斗失败时替你挡去重伤与失财。' },"""
    ),
]

patch(SYS, sys_repls)
patch(DAT, dat_repls)
patch(COX, cox_repls)
print("全部补丁应用完成。")
