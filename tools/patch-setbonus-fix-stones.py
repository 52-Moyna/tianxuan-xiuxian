# -*- coding: utf-8 -*-
# 修正：海外事件收益补发应读 totalStones（灵石分档存于 state.currencies，state.player.stones 并不存在）
import io, sys
p = 'public/js/systems.js'
s = io.open(p, encoding='utf-8').read()
pairs = [
    ("  const stonesBefore = Number(state.player.stones || 0);",
     "  const stonesBefore = totalStones(state);"),
    ("    const gained = Number(state.player.stones || 0) - stonesBefore;",
     "    const gained = totalStones(state) - stonesBefore;"),
]
for old, new in pairs:
    if s.count(old) != 1:
        print('!! 锚点异常(%d): %s' % (s.count(old), old)); sys.exit(1)
    s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('OK ' + p)
