# -*- coding: utf-8 -*-
"""补丁：行囊面板按钮改用 S.itemUsePreview 判定（修复多种丹药无法服用），
并为按钮补确定性效果 tooltip、为自动消耗类物品补说明标记。"""
import io

UI = 'public/js/ui.js'
s = io.open(UI, encoding='utf-8').read()

old_judge = """    const isDirectlyUsable = (it) => {
      if (it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝') return false;
      if (!it.effect) return false;
      return !!(it.effect.exp || it.effect.heal);
    };
    const isEquipable = (it) => !!(it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝');"""
new_judge = """    // 2026-08-30 修复：按钮可用性改由 S.itemUsePreview 统一判定（与 useItem 能力对齐）。
    // 旧判定只认 effect.exp / effect.heal，导致凝神丹、洗髓丹、炎玉丹、玉华丹、狂战丹、
    // 延寿丹、灵兽契约、聚灵阵旗等已实现效果的物品在行囊中无按钮、玩家根本无法服用。
    const usePreviewOf = (it) => S.itemUsePreview(st, it);
    const attr = (v) => String(v || '').replace(/"/g, '&quot;');
    const isEquipable = (it) => !!(it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝');"""
assert s.count(old_judge) == 1, '判定函数锚点异常'
s = s.replace(old_judge, new_judge)

old_row = """              const i = nonContainerItems.indexOf(it);
              const usable = isDirectlyUsable(it);
              return `
              <div class="item-row">
                <div class="item-icon">${TYPE_ICONS[t] || '📦'}</div>
                <div class="item-main"><b>${it.名称}</b><span>${it.描述 || ''}${it.价值 ? ` · 价值${it.价值}灵石` : ''}</span></div>
                ${it.数量 > 1 ? `<div class="item-qty">×${it.数量}</div>` : ''}
                <div class="item-acts">
                  ${isEquipable(it) ? `<button class="btn btn-sm btn-gold" data-use="${i}">装备</button>` : ''}
                  ${usable ? `<button class="btn btn-sm btn-gold" data-use="${i}">使用</button>` : ''}
                  <button class="btn btn-sm" data-codex="${it.名称}">图鉴</button>
                </div>
              </div>`;"""
new_row = """              const i = nonContainerItems.indexOf(it);
              const pv = usePreviewOf(it);
              return `
              <div class="item-row">
                <div class="item-icon">${TYPE_ICONS[t] || '📦'}</div>
                <div class="item-main"><b>${it.名称}</b><span>${it.描述 || ''}${it.价值 ? ` · 价值${it.价值}灵石` : ''}</span>${pv.mode === 'use' ? `<span class="item-eff">服用效果：${pv.text}</span>` : ''}</div>
                ${it.数量 > 1 ? `<div class="item-qty">×${it.数量}</div>` : ''}
                <div class="item-acts">
                  ${pv.mode === 'equip' ? `<button class="btn btn-sm btn-gold" data-use="${i}" title="${attr(pv.text)}">装备</button>` : ''}
                  ${pv.mode === 'use' ? `<button class="btn btn-sm btn-gold" data-use="${i}" title="${attr(pv.text)}">${pv.label}</button>` : ''}
                  ${pv.mode === 'auto' ? `<span class="item-auto-note" title="${attr(pv.text)}">⚙ 自动生效</span>` : ''}
                  <button class="btn btn-sm" data-codex="${it.名称}">图鉴</button>
                </div>
              </div>`;"""
assert s.count(old_row) == 1, '物品行锚点异常'
s = s.replace(old_row, new_row)

io.open(UI, 'w', encoding='utf-8', newline='\n').write(s)
print('ui.js 已打补丁')
