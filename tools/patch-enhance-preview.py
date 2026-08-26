# -*- coding: utf-8 -*-
"""补丁：systems.js 新增 enhancePreview 纯函数（确定性成功预览），并重构 enhanceEquip 复用其公式。"""
import io, sys, os

ROOT = 'Z:/1/xiuxian' if os.path.exists('Z:/1/xiuxian') else '.'
path = os.path.join(ROOT, 'public/js/systems.js')
with io.open(path, 'r', encoding='utf-8') as f:
    src = f.read()

# 定位 enhanceEquip 注释块起点
start_marker = '''/**
 * 装备强化（淬炼）：消耗灵石提升装备等级 → 战力按 calcEquipPower 同步增长。'''
si = src.find(start_marker)
if si < 0:
    print('ERROR: 找不到 enhanceEquip 注释起点'); sys.exit(2)

# 定位 enhanceEquip 函数结尾（唯一）
end_marker = "  refreshDerived(state);\n  return { ok: true, success, logs, cost, rate, newPower };\n}"
ei = src.find(end_marker, si)
if ei < 0:
    print('ERROR: 找不到 enhanceEquip 函数结尾'); sys.exit(2)
end = ei + len(end_marker)

new_block = '''/**
 * 装备强化（淬炼）预览：纯函数，不改动 state，确定性返回本次淬炼的消耗/成功率与
 * 「成功后」的等级与战力（供 UI 弹窗展示，帮玩家决策）。与 enhanceEquip 共用同一套公式，单一事实来源。
 * target: { where:'equip', slot } 或 { where:'stash', idx }
 * 返回 { ok, level, cost, rate, curPower, nextLevel, nextPower, gain, max? }
 */
export function enhancePreview(state, target) {
  ensureLifeState(state);
  const item = target.where === 'stash' ? state.equipment.stash[target.idx] : state.equipment[target.slot];
  if (!item || !item.名称 || item.名称 === '无') return { ok: false, logs: ['目标装备不存在。'] };
  const level = Number(item.等级) || 1;
  if (level >= 30) return { ok: false, max: true, level, logs: ['该装备已臻化境，无法继续淬炼。'] };
  let cost = 40 * (level + 1);
  // 道友之能·炼器师：法器保养与小修八折（relation>=3 的炼器师道友在旁，省下两成灵石）
  if (daoFriendJob(state, '炼器师')) cost = Math.round(cost * 0.8);
  const rate = Math.max(35, 88 - level * 2);
  const newLevel = level + 1;
  const grade = getEquipGrade(item.品阶) || getEquipGradeByLevel(newLevel);
  const updated = normalizeEquip({ ...item, 等级: newLevel, 品阶: grade?.id || item.品阶 }, item.部位);
  return { ok: true, level, cost, rate, curPower: item.战力, nextLevel: newLevel, nextPower: updated.战力, gain: updated.战力 - (item.战力 || 0) };
}

/**
 * 装备强化（淬炼）：消耗灵石提升装备等级 → 战力按 calcEquipPower 同步增长。
 * 失败仅损耗灵石、装备无损（友好设计，避免数值崩坏与挫败感）。
 * target: { where:'equip', slot } 或 { where:'stash', idx }
 * 返回 { ok, success, logs, cost, rate, newPower? }
 */
export function enhanceEquip(state, target) {
  ensureLifeState(state);
  const item = target.where === 'stash' ? state.equipment.stash[target.idx] : state.equipment[target.slot];
  if (!item || !item.名称 || item.名称 === '无') return { ok: false, logs: ['目标装备不存在。'] };
  const prev = enhancePreview(state, target);
  if (!prev.ok) return { ok: false, logs: prev.logs };
  const { cost, rate, level, nextLevel } = prev;
  if (!spendStones(state, cost)) return { ok: false, logs: [`灵石不足（需 ${cost}）。`] };
  const success = Rng.chance(rate / 100);
  const logs = [`你引动灵力淬炼「${item.名称}」（Lv.${level}），耗灵石 ${cost}。`];
  let newPower = null;
  if (success) {
    const grade = getEquipGrade(item.品阶) || getEquipGradeByLevel(nextLevel);
    const updated = normalizeEquip({ ...item, 等级: nextLevel, 品阶: grade?.id || item.品阶 }, item.部位);
    if (target.where === 'stash') state.equipment.stash[target.idx] = updated;
    else state.equipment[target.slot] = updated;
    newPower = updated.战力;
    logs.push(`✨ 淬炼成功！「${updated.名称}」升至 Lv.${updated.等级}，战力 ${item.战力} → ${updated.战力}。`);
  } else {
    logs.push('淬炼未成，灵力散去，装备未有寸进（材料已耗，装备无损）。');
  }
  refreshDerived(state);
  return { ok: true, success, logs, cost, rate, newPower };
}'''

new_src = src[:si] + new_block + src[end:]
with io.open(path, 'w', encoding='utf-8') as f:
    f.write(new_src)
print('OK: systems.js enhancePreview 已写入；文件行数', new_src.count(chr(10)) + 1)
