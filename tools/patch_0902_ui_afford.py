# -*- coding: utf-8 -*-
"""UI 打磨：灵草园播种/补满/浇灌按钮在灵石不足时直接禁用。

扣款口径已修为「总资产」判定，按钮可用性必须与之同口径，
否则玩家点了才发现钱不够（或明明有钱按钮却灰着）。
"""
import io
import sys

P = 'Z:/1/xiuxian/public/js/ui.js'

PAIRS = [
    # 播种
    ("""data-plant="${hb.id}" ${garden.length >= gardenCapacity(st) ? 'disabled' : ''}""",
     """data-plant="${hb.id}" ${garden.length >= gardenCapacity(st) || !S.canAfford(st, hb.seedCost) ? 'disabled' : ''}""", 1),
    # 补满
    ("""data-plantfill="${hb.id}" title="把剩余 ${gardenCapacity(st) - garden.length} 个空位全部播上「${hb.name}」\"""",
     """data-plantfill="${hb.id}" ${S.canAfford(st, (gardenCapacity(st) - garden.length) * hb.seedCost) ? '' : 'disabled'} title="把剩余 ${gardenCapacity(st) - garden.length} 个空位全部播上「${hb.name}」\"""", 1),
    # 浇灌
    ("""data-irrigate="${i}" ${mature || atCap ? 'disabled' : ''}""",
     """data-irrigate="${i}" ${mature || atCap || !S.canAfford(st, HERB_IRRIGATE_COST) ? 'disabled' : ''}""", 1),
]

with io.open(P, encoding='utf-8') as f:
    src = f.read()

for old, new, cnt in PAIRS:
    n = src.count(old)
    if n != cnt:
        print('!! 匹配失败 期望 %d 实得 %d：%s' % (cnt, n, old[:80]))
        sys.exit(1)
    src = src.replace(old, new)

with io.open(P, 'w', encoding='utf-8') as f:
    f.write(src)
print('OK ui.js')
