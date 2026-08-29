# -*- coding: utf-8 -*-
"""修正因主修功法 bug 修复而暴露的测试断言（这些测试当年在 bug 状态下写就，
假设 mainTech 成就不解锁）。修复后 mainTech 正确解锁，需更新断言反映正确行为。
同时修正本论新增的「未主修功法」断言（兜底读取顶层 mainTechnique，需同时清空两层）。"""
import io

TST = "Z:/1/xiuxian/tests/test-newfeatures.mjs"
CODEX = "Z:/1/xiuxian/tests/test-codex.mjs"

# ===== 1. test-newfeatures：里程碑计数断言改为健壮写法（不依赖 mainTech 是否解锁） =====
anchor1 = "ok(s10.achievements.filter((a) => !ACH_MILESTONE_IDS.has(a.id)).length === 10, '里程碑自身不计入基础计数');"
new1 = """ok(baseIds.slice(0, 10).every((id) => s10.achievements.some((a) => a.id === id)), '手动设置的10个基础成就均已计入（里程碑不挤占基础计数）');
ok(s10.achievements.filter((a) => ACH_MILESTONE_IDS.has(a.id)).every((a) => a.id === 'achCount10'), '解锁的里程碑仅含 achCount10（里程碑自身不混入基础计数）');"""
with io.open(TST, "r", encoding="utf-8") as f:
    t = f.read()
print("newfeatures 里程碑锚点命中:", t.count(anchor1))
if t.count(anchor1) == 1:
    t = t.replace(anchor1, new1, 1)
else:
    print("WARN: 里程碑锚点异常")
with io.open(TST, "w", encoding="utf-8") as f:
    f.write(t)

# ===== 2. test-newfeatures：未主修功法断言——同时清空顶层 mainTechnique =====
anchor2 = """  sg4.player.mainTechnique = null;
  const prev4 = S.studyGainPreview(sg4);"""
new2 = """  sg4.player.mainTechnique = null;
  sg4.mainTechnique = null; // 同时清空顶层，模拟真正无主修（兜底读取不命中）
  const prev4 = S.studyGainPreview(sg4);"""
with io.open(TST, "r", encoding="utf-8") as f:
    t = f.read()
print("未主修锚点命中:", t.count(anchor2))
if t.count(anchor2) == 1:
    t = t.replace(anchor2, new2, 1)
else:
    print("WARN: 未主修锚点异常")
with io.open(TST, "w", encoding="utf-8") as f:
    f.write(t)

# ===== 3. test-codex：一键领取预期改为按实际未领奖励计算（含 mainTech+富甲一方） =====
anchor3 = """  // 一键领取：reS 中 start 已领取，仅强制解锁「富甲一方」(reward 1000) 可领
  reS.achievements.push({ id: 'rich', name: '富甲一方', icon: '💰', time: '测试' });
  const stonesBeforeAll = reS.currencies['下品灵石'];
  const ra = claimAllAchievements(reS);
  ok('一键领取发放剩余未领奖励(1000)', ra.ok && ra.total === 1000 && reS.currencies['下品灵石'] === stonesBeforeAll + 1000);"""
new3 = """  // 一键领取：reS 中 start 已领取；mainTech（选定主修功法）与富甲一方为未领，合计发放
  reS.achievements.push({ id: 'rich', name: '富甲一方', icon: '💰', time: '测试' });
  const stonesBeforeAll = reS.currencies['下品灵石'];
  const unclaimedRewards = reS.achievements
    .filter((a) => !a.claimed)
    .reduce((sum, a) => sum + (ACHIEVEMENTS.find((x) => x.id === a.id)?.reward?.stones || 0), 0);
  const ra = claimAllAchievements(reS);
  ok('一键领取发放剩余未领奖励(含mainTech+富甲一方)', ra.ok && ra.total === unclaimedRewards && reS.currencies['下品灵石'] === stonesBeforeAll + unclaimedRewards);"""
with io.open(CODEX, "r", encoding="utf-8") as f:
    c = f.read()
print("codex 一键领取锚点命中:", c.count(anchor3))
if c.count(anchor3) == 1:
    c = c.replace(anchor3, new3, 1)
else:
    print("WARN: codex 一键领取锚点异常")
with io.open(CODEX, "w", encoding="utf-8") as f:
    f.write(c)

print("DONE")
