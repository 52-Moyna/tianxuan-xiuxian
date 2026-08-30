# -*- coding: utf-8 -*-
"""补丁：为行囊物品行补「服用效果预览」与「自动生效」标记样式（明暗主题自适应）。"""
import io
CSS = 'public/css/main.css'
s = io.open(CSS, encoding='utf-8').read()
anchor = ".item-acts .btn { border-radius: 999px; padding: 3px 12px; font-size: .74rem; }"
assert s.count(anchor) == 1, 'CSS 锚点异常'
add = anchor + """
/* 行囊物品·服用效果确定性预览（与 systems.itemUsePreview 同口径）。
   注意：.item-main span 默认 nowrap+省略号，效果文案需换行显示，故此处覆盖。 */
.item-main .item-eff { font-size: .7rem; color: var(--jade); line-height: 1.35;
  white-space: normal; overflow: visible; text-overflow: clip; }
/* 自动消耗类物品（瓶颈丹/渡劫丹/护身符/驯兽口粮/地火引）：不给按钮，改以标记说明生效时机 */
.item-auto-note { font-size: .7rem; color: var(--text-dim); align-self: center;
  padding: 2px 9px; border-radius: 999px; white-space: nowrap; cursor: help;
  border: 1px dashed var(--line); background: rgba(127, 127, 127, .08); }"""
s = s.replace(anchor, add, 1)
io.open(CSS, 'w', encoding='utf-8', newline='\n').write(s)
print('main.css 已打补丁')
