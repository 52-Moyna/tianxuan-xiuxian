# -*- coding: utf-8 -*-
"""sellItemsByIndex 索引校验收紧：只接受 number 类型的合法整数索引。
原实现用 Number(i) 强转，导致 null → 0、'' → 0 被当成有效下标，
会把行囊第 0 件物品（往往是玩家最重要的东西）卖掉。
"""
import io
import sys

p = 'Z:/1/xiuxian/public/js/systems.js'
s = io.open(p, encoding='utf-8').read()

old = """  const idxs = [...new Set((indexes || []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < state.items.length))]
    .sort((a, b) => b - a);"""
new = """  // 只接受 number 类型的合法整数下标：若用 Number(i) 强转，null / '' 会被当成 0 而误售首件物品
  const idxs = [...new Set((indexes || [])
    .filter((i) => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < state.items.length))]
    .sort((a, b) => b - a);"""
assert s.count(old) == 1, '索引校验锚点异常'
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('systems.js 索引校验已收紧')
