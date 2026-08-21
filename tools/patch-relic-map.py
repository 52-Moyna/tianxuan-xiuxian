#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复秘境残图死道具 bug，并在罗盘遗府选项显示当前残图持有数。

- systems.js 洞府游历事件产出 秘境残图（全代码无消费点，死道具）
  改为 海上遗府残图，使其能凑齐开启海上遗府秘境。
- extraCompassOptions 的 海上遗府 选项附上当前持有残图数。
"""
import io, sys

PATH = "/z/1/xiuxian/public/js/systems.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    s = f.read()

# ---- 1. 修复洞府游历事件的死道具名称 ----
old_map = (
    "    const map = { 名称: '秘境残图', 类型: '线索', 数量: 1, 描述: '上古遗府的残片地图，集齐或可开启一次遗府探索。', 价值: 120 };\n"
    "    if (storeItem(state, map)) logs.push('你误入一处风化洞府，在石台夹层寻得「秘境残图」一张。');\n"
    "    else logs.push('你寻得「秘境残图」，储物袋已满只能暂存怀中。');"
)
new_map = (
    "    const map = { 名称: '海上遗府残图', 类型: '线索', 数量: 1, 描述: '上古遗府的残片地图，集齐 3 张可开启一次遗府探索。', 价值: 120 };\n"
    "    if (storeItem(state, map)) logs.push('你误入一处风化洞府，在石台夹层寻得「海上遗府残图」一张。');\n"
    "    else logs.push('你寻得「海上遗府残图」，储物袋已满只能暂存怀中。');"
)
assert old_map in s, "未找到洞府游历残图旧代码，可能已改动"
s = s.replace(old_map, new_map, 1)

# ---- 2. 罗盘遗府选项显示当前残图持有数 ----
old_opt = (
    "    const needMap = m.requiresMap ? '（需集齐 3 张「海上遗府残图」开启）' : '';\n"
    "    opts.push({ icon: '🏔️', tag: '秘境', title: `探索「${m.name}」`, desc: m.desc + needMap, action: { type: 'mystic', realmId: m.id }, risk: true, preview: '高风险高回报：材料、灵石、法宝；可能遭遇护宝妖兽' });"
)
new_opt = (
    "    const mapCount = state.items.filter((i) => i.名称 === '海上遗府残图').reduce((sum, i) => sum + (i.数量 || 1), 0);\n"
    "    const needMap = m.requiresMap\n"
    "      ? (mapCount >= 3 ? '（已集齐 3 张残图，可开启！）' : `（需集齐 3 张「海上遗府残图」开启，当前持有 ${mapCount} 张）`)\n"
    "      : '';\n"
    "    opts.push({ icon: '🏔️', tag: '秘境', title: `探索「${m.name}」`, desc: m.desc + needMap, action: { type: 'mystic', realmId: m.id }, risk: true, preview: '高风险高回报：材料、灵石、法宝；可能遭遇护宝妖兽' });"
)
assert old_opt in s, "未找到罗盘遗府选项旧代码，可能已改动"
s = s.replace(old_opt, new_opt, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(s)

# 校验：游戏中不应再出现孤立的 秘境残图 名称
assert "秘境残图" not in s, "修复后仍存在孤立的 秘境残图 名称"
assert s.count("海上遗府残图") >= 4, "海上遗府残图 数量异常"
print("OK: 残图死道具已修复，罗盘进度提示已接入")
