# -*- coding: utf-8 -*-
"""为天玄修仙录新增「成就收集里程碑」奖励（确定性、无 RNG）。"""
import io, sys, os

ROOT = "Z:/1/xiuxian"
PATH = os.path.join(ROOT, "public/js/codex.js")
with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

# 锚点需匹配 codex.js 中真实 emoji（用 Python \U 转义表示）
LEAF = "\U0001F33F"   # 🌿
BRONZE = "\U0001F949" # 🥉
SILVER = "\U0001F948" # 🥈
GOLD = "\U0001F3C6"   # 🏆

anchor1 = "export const ACHIEVEMENTS = ["
assert anchor1 in src and src.count(anchor1) == 1, "ACHIEVEMENTS 锚点异常"
block1 = (
    "/* 成就收集里程碑集合（不计入基础成就统计，避免自计数导致解锁抖动） */\n"
    "export const ACH_MILESTONE_IDS = new Set(['achCount10', 'achCount20', 'achCountAll']);\n"
    "/** 统计已解锁的「基础成就」数量（排除收集里程碑自身） */\n"
    "function achBaseUnlocked(state) {\n"
    "  return (state.achievements || []).filter((a) => !ACH_MILESTONE_IDS.has(a.id)).length;\n"
    "}\n\n"
    "export const ACHIEVEMENTS = ["
)
src = src.replace(anchor1, block1, 1)

anchor2 = (
    "  { id: 'herbHybrid', name: '灵植奇才', icon: '" + LEAF + "', desc: '杂交出全部 4 种奇珍灵材。', reward: { stones: 1200 }, "
    "check: (s) => ['材料:凝火奇实', '材料:玉华灵髓', '材料:露华玉液', '材料:炎玉灵枣'].every((k) => (s.codex?.discovered || []).includes(k)) },\n"
    "];"
)
assert anchor2 in src and src.count(anchor2) == 1, "herbHybrid 结尾锚点异常"
block2 = (
    "  { id: 'herbHybrid', name: '灵植奇才', icon: '" + LEAF + "', desc: '杂交出全部 4 种奇珍灵材。', reward: { stones: 1200 }, "
    "check: (s) => ['材料:凝火奇实', '材料:玉华灵髓', '材料:露华玉液', '材料:炎玉灵枣'].every((k) => (s.codex?.discovered || []).includes(k)) },\n"
    "  // —— 成就收集里程碑：统计已解锁的「基础成就」数（不含里程碑自身），解锁阶段性收集奖励 ——\n"
    "  { id: 'achCount10', name: '小有所成', icon: '" + BRONZE + "', desc: '累计解锁 10 个基础成就。', reward: { stones: 800 }, check: (s) => achBaseUnlocked(s) >= 10, progress: (s) => ({ cur: achBaseUnlocked(s), max: 10 }) },\n"
    "  { id: 'achCount20', name: '登堂入室', icon: '" + SILVER + "', desc: '累计解锁 20 个基础成就。', reward: { stones: 1800 }, check: (s) => achBaseUnlocked(s) >= 20, progress: (s) => ({ cur: achBaseUnlocked(s), max: 20 }) },\n"
    "  { id: 'achCountAll', name: '仙途大成', icon: '" + GOLD + "', desc: '解锁全部基础成就。', reward: { stones: 5000 }, check: (s) => achBaseUnlocked(s) >= ACH_BASE_TOTAL, progress: (s) => ({ cur: Math.min(achBaseUnlocked(s), ACH_BASE_TOTAL), max: ACH_BASE_TOTAL }) },\n"
    "];\n"
    "/** 基础成就总数（不含收集里程碑自身），用于「仙途大成」进度上限与测试断言 */\n"
    "export const ACH_BASE_TOTAL = ACHIEVEMENTS.filter((a) => !ACH_MILESTONE_IDS.has(a.id)).length;\n"
)
src = src.replace(anchor2, block2, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

checks = ["ACH_MILESTONE_IDS", "achBaseUnlocked", "achCount10", "achCount20", "achCountAll", "ACH_BASE_TOTAL"]
missing = [c for c in checks if c not in src]
if missing:
    print("FAIL 缺少:", missing); sys.exit(1)
print("OK codex.js 已注入成就收集里程碑。")
