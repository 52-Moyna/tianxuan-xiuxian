#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修正宗门秘境测试：用 S.totalStones 量灵石总额（游戏有多档灵石，addStones 会重新分配档位）。"""
import io

ROOT = "Z:/1/xiuxian"
p = f"{ROOT}/tests/test-newfeatures.mjs"
s = io.open(p, "r", encoding="utf-8").read()

repls = [
    ("const beforeStones = g3.currencies['下品灵石'];",
     "const beforeStones = S.totalStones(g3);"),
    ("ok(g3.currencies['下品灵石'] === beforeStones + 80, `depth1 灵石+80（实际 ${g3.currencies['下品灵石'] - beforeStones}）`);",
     "ok(S.totalStones(g3) === beforeStones + 80, `depth1 灵石+80（实际 ${S.totalStones(g3) - beforeStones}）`);"),
    ("const before2 = g2.currencies['下品灵石'];",
     "const before2 = S.totalStones(g2);"),
    ("ok(g2.currencies['下品灵石'] === before2 + 128, `depth2 灵石 80×1.6=128（实际 ${g2.currencies['下品灵石'] - before2}）`);",
     "ok(S.totalStones(g2) === before2 + 128, `depth2 灵石 80×1.6=128（实际 ${S.totalStones(g2) - before2}）`);"),
]

for old, new in repls:
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"[FAIL] 期望匹配 1 处，实际 {n}：{old[:40]}")
    s = s.replace(old, new, 1)

io.open(p, "w", encoding="utf-8").write(s)
print("[OK] 测试断言已改用 S.totalStones 量灵石总额")
