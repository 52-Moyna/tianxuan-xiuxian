#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""test-newfeatures.mjs 追加宗门贡献常驻化（sectContribution）确定性断言。"""
import sys, pathlib

ROOT = pathlib.Path(r"Z:/1/xiuxian")
p = ROOT / "tests" / "test-newfeatures.mjs"
s = p.read_text(encoding="utf-8")

old = (
    "  ok(orphan.length === 0, `套装加成键全部已接线（发现未接线键：${orphan.join(',') || '无'}）`);\n"
    "}\n"
)
cnt = s.count(old)
if cnt != 1:
    print(f"[FAIL] 锚点命中 {cnt} 次（应为 1）")
    sys.exit(1)

new = (
    "  ok(orphan.length === 0, `套装加成键全部已接线（发现未接线键：${orphan.join(',') || '无'}）`);\n"
    "\n"
    "  /* ---------- 宗门贡献常驻化（英雄卡行 + 顶栏 chip 数据源） ---------- */\n"
    "  ok(typeof S.sectContribution === 'function', 'sectContribution 已导出');\n"
    "  // 未入宗门：has=false、贡献为 0、职级名为空\n"
    "  const noSect = S.createNewGame({ name: '无宗门', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "  const ns = S.sectContribution(noSect);\n"
    "  ok(ns.has === false && ns.contribution === 0 && ns.rankName === '', '未入宗门 → has=false、贡献0、职级名为空');\n"
    "  // 已入宗门：正确返回名称/职级/贡献；rankName 取自 SECT_RANKS\n"
    "  noSect.sect = { name: '玄天宗', rank: 2, contribution: 500 };\n"
    "  const ys = S.sectContribution(noSect);\n"
    "  ok(ys.has === true && ys.name === '玄天宗' && ys.rank === 2 && ys.contribution === 500, '已入宗门 → 名称/职级/贡献正确');\n"
    "  ok(typeof ys.rankName === 'string' && ys.rankName.length > 0, '已入宗门 → rankName 取自 SECT_RANKS 非空');\n"
    "  // 贡献字段缺失容错：不抛错、回退 0\n"
    "  const partial = S.sectContribution({ sect: { name: '散修盟', rank: 0 } });\n"
    "  ok(partial.has === true && partial.contribution === 0, '宗门缺 contribution 字段 → 容错为 0 不报错');\n"
    "}\n"
)

s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("[OK] test-newfeatures.mjs: 追加 sectContribution 断言（5 条）")
