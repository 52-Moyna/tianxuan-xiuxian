# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"Z:/1/xiuxian/tests/test-newfeatures.mjs")
t = p.read_text(encoding="utf-8")
old = "const seedPool = ['lingcao', 'huojing', 'yushu', 'yulu'];"
new = "const seedPool = ['lingcao', 'huoqing', 'yushu', 'yuehua'];"
assert old in t, "seedPool 锚点未找到"
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("[OK] 修正测试种子池")
