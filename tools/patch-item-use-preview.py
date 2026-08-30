# -*- coding: utf-8 -*-
"""补丁：修复行囊「使用」按钮判定过窄（多种丹药/道具无法服用）+ 兽皮护符死道具，
并新增 itemUsePreview 确定性效果预览。相对路径运行于仓库根目录。"""
import io, sys

SYS = 'public/js/systems.js'
s = io.open(SYS, encoding='utf-8').read()

# ---- 1. 兽皮护符纳入护身道具体系（消除死道具/假承诺）----
old_names = "export const WARD_ITEM_NAMES = ['护身符', '低阶护身符', '低阶符箓', '简易阵旗'];"
new_names = "export const WARD_ITEM_NAMES = ['护身符', '低阶护身符', '低阶符箓', '简易阵旗', '兽皮护符'];"
assert s.count(old_names) == 1, 'WARD_ITEM_NAMES 锚点异常'
s = s.replace(old_names, new_names)

old_wlow = "      const wLow = state.items.find((i) => i.名称 === '低阶护身符' || i.名称 === '低阶符箓' || i.名称 === '简易阵旗');"
new_wlow = "      // 2026-08-30 修复：'兽皮护符'（百艺·御兽产出，描述承诺「战斗失败时减轻损失」）此前不在查找列表中，\n      // 玩家耗 3 份妖兽皮毛制成却永不生效（死道具+假承诺），现纳入低阶护符体系。\n      const wLow = state.items.find((i) => i.名称 === '低阶护身符' || i.名称 === '低阶符箓' || i.名称 === '简易阵旗' || i.名称 === '兽皮护符');"
assert s.count(old_wlow) == 1, 'wLow 锚点异常'
s = s.replace(old_wlow, new_wlow)

# ---- 2. 新增 itemUsePreview 纯函数 ----
anchor = "/** 重新计算已穿戴戒指（空间戒）带来的储物袋加成，写入 inventory.ringBonus。"
assert s.count(anchor) == 1, 'itemUsePreview 插入锚点异常'
FN = r"""/** 物品使用预览（纯函数，确定性，不消耗/不修改 state）。
 *  【为何存在】此前行囊面板仅对 effect.exp / effect.heal 显示「使用」按钮，
 *  而 useItem 实际支持 exp/heal/wuxing/daoBase/cultivateBoostMonths/power/lifespan/beastSlot，
 *  导致凝神丹(wuxing)、洗髓丹·炎玉丹·玉华丹(daoBase)、狂战丹(power)、延寿丹(lifespan)、
 *  灵兽契约(beastSlot)、聚灵阵旗(cultivateBoostMonths) 等物品在行囊中无按钮可点 —— 玩家
 *  炼制/拍得后完全无法服用。本函数与 useItem 能力一一对齐，作为行囊按钮的唯一判定口径。
 *  返回 { mode, label, text }：
 *    mode='equip' 可穿戴 / 'use' 可主动服用 / 'auto' 特定时机自动消耗 / 'none' 无可用效果
 *    text 为服用前的确定性效果说明（与 useItem 同口径，含丹毒代价）。 */
export function itemUsePreview(state, it) {
  const none = { mode: 'none', label: '', text: '' };
  if (!it) return none;
  if (it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝') {
    const src = it._equip || it;
    const pw = Number(src.战力) || Number(it.战力) || 0;
    return { mode: 'equip', label: '装备', text: pw ? `穿戴后战力 +${pw}` : '穿戴至对应部位' };
  }
  const eff = it.effect;
  if (!eff) return none;
  // 自动消耗类：主动服用会白扣或无效，故不给按钮，改以说明标记告知时机
  if (it.breakthrough) return { mode: 'auto', label: '', text: '瓶颈专属丹：冲击对应瓶颈时自动消耗（成功率 +20%）' };
  if (typeof eff.tribulation === 'number') return { mode: 'auto', label: '', text: `渡劫丹：渡劫时自动消耗（成功率 +${eff.tribulation}%，按品阶加成）` };
  if (it.名称 === '地火引') return { mode: 'auto', label: '', text: '百艺助燃剂：百艺制作时自动消耗' };
  if (eff.ward) return { mode: 'auto', label: '', text: '护身道具：战斗败北时自动消耗一件，替你挡去重伤' };
  if (typeof eff.tame === 'number') return { mode: 'auto', label: '', text: `驯兽口粮：收服灵兽时自动投喂（成功率 +${eff.tame}%）` };
  const parts = [];
  if (eff.exp) {
    const mult = (it.quality && it.quality.mult) ? it.quality.mult : 1;
    const gain = Math.round(eff.exp * mult);
    parts.push(mult !== 1 ? `修为 +${gain}（${it.quality.grade} ×${mult}）` : `修为 +${gain}`);
  }
  if (eff.heal) parts.push('伤势尽去');
  if (eff.wuxing) parts.push(`悟性经验 +${eff.wuxing}`);
  if (eff.daoBase) {
    const kb = eff.daoBase || {};
    parts.push(`随机提升「${(kb.keys || []).join('/')}」之一 +${kb.min}~${kb.max} 级`);
  }
  if (eff.cultivateBoostMonths) parts.push(`未来 ${eff.cultivateBoostMonths} 月修炼效率 +15%`);
  if (eff.power) parts.push(`战力临时 +${eff.power}（持续 ${eff.powerMonths || 1} 月）`);
  if (eff.lifespan) {
    if (it.名称 === '延寿丹') {
      const taken = (state && state.player && state.player.lifespanPillsTaken) || 0;
      parts.push(taken >= 3
        ? `寿元上限 +${eff.lifespan} 年（一生限 3 颗，已服满 ${taken}/3，此丹暂难生效）`
        : `寿元上限 +${eff.lifespan} 年（一生限 3 颗，已服 ${taken}/3）`);
    } else parts.push(`寿元上限 +${eff.lifespan} 年`);
  }
  if (eff.beastSlot) {
    const cur = (state && state.beasts && state.beasts.maxSlots) || 1;
    parts.push(cur >= 6 ? `灵兽栏上限 +1（已达上限 ${cur}/6，服用无效）` : `灵兽栏上限 +1（现 ${cur}/6 栏）`);
  }
  if (!parts.length) return none;
  const tox = (typeof it.toxicity === 'number') ? it.toxicity : 0;
  if (tox > 0) parts.push(`丹毒 +${tox}`);
  return { mode: 'use', label: it.类型 === '丹药' ? '服用' : '使用', text: parts.join('，') };
}
"""
s = s.replace(anchor, FN + anchor, 1)
io.open(SYS, 'w', encoding='utf-8', newline='\n').write(s)
print('systems.js 已打补丁')
