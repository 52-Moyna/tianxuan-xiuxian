# -*- coding: utf-8 -*-
"""修复口径转换的正则误伤：把 `X.currencies['下品灵石'] === Y` 误换成
`setStones(X, == Y)` 的 15 处改回比较形式 `stones(X) === Y`。"""
import io
import re

BASE = 'Z:/1/xiuxian/tests/'
BAD = re.compile(r"setStones\(([^,]+), == ")

for path in ['test-newfeatures.mjs', 'test-codex.mjs', 'test-life.mjs']:
    p = BASE + path
    with io.open(p, encoding='utf-8') as f:
        src = f.read()
    src, n = BAD.subn(lambda m: 'stones(%s) === ' % m.group(1), src)
    if n:
        with io.open(p, 'w', encoding='utf-8') as f:
            f.write(src)
    print('%s：修复 %d 处' % (path, n))
