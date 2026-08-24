# -*- coding: utf-8 -*-
import io
def patch(path, olds, news):
    with io.open(path,'r',encoding='utf-8') as f: s=f.read()
    for old,new in zip(olds,news):
        c=s.count(old)
        if c!=1: raise SystemExit('[FAIL] anchor not unique (%d)'%c)
        s=s.replace(old,new,1)
    with io.open(path,'w',encoding='utf-8') as f: f.write(s)
    print('[OK]', path)

SYS='public/js/systems.js'
helpers='''/* ---------------- 道友委托（支线闭环） ----------------
 * 道友级（relation>=3）NPC 可按其职业托付一份「交付类委托」：交付指定材料即获确定性奖励。
 * 完成后进入冷却，防止无限刷取，使委托成为持续但克制的长期玩法。*/
export const COMMISSION_COOLDOWN = 3;

function countItem(state, name) {
  return (state.items || []).filter((x) => x.名称 === name).reduce((s, x) => s + (Number(x.数量) || 1), 0);
}

function removeItemByName(state, name, n) {
  let left = n;
  for (const it of state.items) {
    if (left <= 0) break;
    if (it.名称 === name) {
      const take = Math.min(left, Number(it.数量) || 1);
      it.数量 -= take; left -= take;
    }
  }
  state.items = state.items.filter((x) => (Number(x.数量) || 0) > 0);
  state.inventory.used = inventoryUsed(state);
}

export function commissionInfo(state, npc) {
  const task = COMMISSION_TASKS[npc.job] || COMMISSION_TASKS['散修'];
  const onCd = npc.commissionCd != null && npc.commissionCd > state.world.turns;
  const available = (npc.relation || 0) >= 3 && !onCd;
  const have = available ? countItem(state, task.item) : 0;
  return { task, available, have, need: task.need, cdRemaining: onCd ? (npc.commissionCd - state.world.turns) : 0 };
}

function applyCommissionReward(state, task, npc, logs) {
  const r = task.reward;
  if (r.type === 'stones') {
    addStones(state, r.amount);
    logs.push(`「${npc.name}」如约相酬，灵石+${r.amount}。`);
  } else if (r.type === 'item') {
    const it = { ...r }; delete it.type;
    if (storeItem(state, it)) logs.push(`「${npc.name}」收下${task.item}，回赠${r.名称}x${r.数量 || 1}，已收入储物袋。`);
    else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
  } else if (r.type === 'equip') {
    const eq = generateEquip(state, r.slot, r.level);
    state.equipment.stash.push(eq);
    logs.push(`「${npc.name}」回赠${eq.名称}（${getEquipGrade(eq.品阶)?.name || eq.品阶}，战力+${eq.战力}）！`);
  } else if (r.type === 'exp') {
    addDaoBaseExp(state, r.base, r.amount, logs);
    logs.push(`一番奔走，你对「${r.base}」之道颇有所得。`);
  }
}

'''
case_block='''      break;
    }
    case 'commission': {
      if ((npc.relation || 0) < 3) {
        logs.push(`与「${npc.name}」尚不够熟稔，对方无意相托委托。`);
        break;
      }
      const ctask = COMMISSION_TASKS[npc.job] || COMMISSION_TASKS['散修'];
      if (npc.commissionCd != null && npc.commissionCd > state.world.turns) {
        logs.push(`「${npc.name}」的委托尚在筹措中（还需 ${npc.commissionCd - state.world.turns} 个月方可再托）。`);
        break;
      }
      const have = countItem(state, ctask.item);
      if (have < ctask.need) {
        logs.push(`「${npc.name}」托你寻${ctask.need}份「${ctask.item}」，你手中仅有${have}份，暂难交差。`);
        break;
      }
      removeItemByName(state, ctask.item, ctask.need);
      npc.lastMeet = state.world.turns;
      npc.mood = '托付';
      applyCommissionReward(state, ctask, npc, logs);
      npc.commissionCd = state.world.turns + COMMISSION_COOLDOWN;
      logs.push(`你向「${npc.name}」交付了${ctask.need}份「${ctask.item}」，了结一桩委托。`);
      break;
    }
  }
  // 关系层级晋升
'''
patch(SYS,
  ["  DAOYUAN_LEVELS, FACTIONS, WORLD_EVENTS, BEASTS, RELATION_RULES, DEEP_NPC_EVENTS,",
   "export function interactNpc(state, npc, kind) {",
   "      break;\n    }\n  }\n  // 关系层级晋升"],
  ["  DAOYUAN_LEVELS, FACTIONS, WORLD_EVENTS, BEASTS, RELATION_RULES, DEEP_NPC_EVENTS, COMMISSION_TASKS,",
   helpers + "export function interactNpc(state, npc, kind) {",
   case_block])
