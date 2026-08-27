# -*- coding: utf-8 -*-
"""写本轮自动化记忆与每日日志（C: harness 副本）。"""
import pathlib

AUTO = pathlib.Path(r"C:/z/1/xiuxian/.workbuddy/automations/automation-1787049297553/memory.md")
MEMDIR = pathlib.Path(r"C:/z/1/xiuxian/.workbuddy/memory")
DAILY = MEMDIR / "2026-08-27.md"

auto_entry = """
## 2026-08-27 约 16:34 轮次 · 自由优化：灵草园一键收获 + 闭关连续风险可感知提示
- 方向：自由优化/审查（确定性预览主题已完成）。审计发现两处打磨点。
- 改动（游戏本体，相对路径、可整体迁移）：
  - life.js：新增 harvestAllHerbs（批量收获所有成熟灵草，按成熟株索引降序 splice 避免错位，确定性无 RNG，返回 {ok,count,logs}）。
  - ui.js：灵草园新增「🌿 一键收获成熟灵草（N 株）」按钮（仅当存在成熟株时显示）并接线；导入 harvestAllHerbs。
  - systems.js：cultivateGainPreview 闭关提示改为真实可感知——普通修炼「稳定·无风险」；Lv.30 前闭关「稳定（Lv.30 后久闭有走火入魔风险）」不再虚报；Lv.30+ 连关<2月提示「走火入魔风险（连续闭关积累）」、连关>=2月提示「连关N月，再闭关将走火入魔（满3月必触发）」，对应 qihuo 事件真实机制（seclusionStreak>=3 触发，需 Lv.30+）。
- 测试：test-newfeatures 新增 9 条确定性断言（一键收获 3 株全入库/清空/产物入袋/无成熟株不误处理；闭关提示四档）。
- 结果：针对性跑 8 套相关测试零失败（newfeatures 529/0、life16/codex50/features39/smoke31/ui-smoke17/ui29/server19）。三改动文件 node --check 语法通过。
- 提交 20dd7ec 并推送 origin/main。补丁脚本 tools/patch-harvest-all-and-seclusion-note.py + tools/fix-seedpool.py。
- 下一轮：自由优化/审查；可继续 UI数值打磨 / 装饰性文案审查 / 新小玩法。
"""

daily_entry = """# 2026-08-27 工作日志

## 16:34 轮次 · 灵草园一键收获 + 闭关连续风险可感知提示
- life.js 新增 harvestAllHerbs；ui.js 灵草园加「一键收获」按钮；systems.js cultivateGainPreview 闭关提示真实可感知（低等级不再虚报、连关>=2月预警走火入魔，对应 qihuo 事件）。
- 测试 +9 断言，8 套相关测试零失败（newfeatures 529/0）。
- 提交 20dd7ec 推送 origin/main。
"""

# 追加到自动化记忆
t = AUTO.read_text(encoding="utf-8") if AUTO.exists() else ""
if "灵草园一键收获" not in t:
    AUTO.write_text(t.rstrip() + "\n" + auto_entry.lstrip(), encoding="utf-8")
    print("[OK] 追加自动化记忆")
else:
    print("[SKIP] 自动化记忆已含本轮")

# 创建/追加每日日志
MEMDIR.mkdir(parents=True, exist_ok=True)
if DAILY.exists():
    d = DAILY.read_text(encoding="utf-8")
    if "一键收获" not in d:
        DAILY.write_text(d.rstrip() + "\n" + daily_entry.strip() + "\n", encoding="utf-8")
        print("[OK] 追加每日日志")
    else:
        print("[SKIP] 每日日志已含本轮")
else:
    DAILY.write_text(daily_entry, encoding="utf-8")
    print("[OK] 创建每日日志")
