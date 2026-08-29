# -*- coding: utf-8 -*-
"""test-codex.mjs 导入补 ACHIEVEMENTS（computed 预期用到）。"""
import io
CODEX = "Z:/1/xiuxian/tests/test-codex.mjs"
old = "ensureBeastState, achievementView, checkAchievements, claimAchievement, claimAllAchievements } from '../public/js/codex.js';"
new = "ensureBeastState, achievementView, checkAchievements, claimAchievement, claimAllAchievements, ACHIEVEMENTS } from '../public/js/codex.js';"
with io.open(CODEX, "r", encoding="utf-8") as f:
    c = f.read()
print("codex 导入锚点命中:", c.count(old))
if c.count(old) == 1:
    c = c.replace(old, new, 1)
else:
    print("WARN: 导入锚点异常")
with io.open(CODEX, "w", encoding="utf-8") as f:
    f.write(c)
print("DONE")
