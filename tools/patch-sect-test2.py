#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复 test-newfeatures 中「星辉3件：渡劫成功率预览 +10%」偶发失败（flaky）。
根因：plain 与 xh3 由两次独立 mkSet 生成，灵根/道基/道韵/战力随机不同，
导致渡劫率差值混入随机项而非恰好 +10（探针实测仅 ~32% 命中）。
修复：xh3 改为 plain 的深克隆后仅替换套装物品，保证除套装件外一切一致，断言确定性。"""
import sys, pathlib

ROOT = pathlib.Path(r"Z:/1/xiuxian")
p = ROOT / "tests" / "test-newfeatures.mjs"
s = p.read_text(encoding="utf-8")

old = (
    "  // —— 星辉圆满（3件）：渡劫成功率 +10%（预览与结算同口径）——\n"
    "  const xh3 = mkSet([{ 名称: '星辉剑' }, { 名称: '星纹护甲' }, { 名称: '星砂', 类型: '材料' }]);\n"
    "  ok(setBonusFlags(xh3).breakthrough === 10, '星辉3件：setBonusFlags 含 breakthrough=10');\n"
    "  const plain = mkSet([]);\n"
    "  plain.player.level = 20; xh3.player.level = 20;\n"
    "  const rPlain = S.breakthroughRate(plain);\n"
    "  const r3 = S.breakthroughRate(xh3);\n"
    "  ok(rPlain !== null && r3 !== null && r3 - rPlain === 10, '星辉3件：渡劫成功率预览 +10%');\n"
)
cnt = s.count(old)
if cnt != 1:
    print(f"[FAIL] 星辉锚点命中 {cnt} 次（应为 1）")
    sys.exit(1)

new = (
    "  // —— 星辉圆满（3件）：渡劫成功率 +10%（预览与结算同口径）——\n"
    "  // plain 与 xh3 共享同一基础状态（xh3 为 plain 深克隆后仅替换物品），保证除套装件外一切一致；\n"
    "  // 否则二者灵根/道基/道韵/战力随机不同，渡劫率差值会混入随机项而非恰好 +10（确定性、无 flaky）。\n"
    "  const plain = mkSet([]);\n"
    "  const xh3 = JSON.parse(JSON.stringify(plain));\n"
    "  xh3.items = [{ 名称: '星辉剑', 类型: '装备', 数量: 1, 描述: '套装测试件' }, { 名称: '星纹护甲', 类型: '装备', 数量: 1, 描述: '套装测试件' }, { 名称: '星砂', 类型: '材料', 数量: 1, 描述: '套装测试件' }];\n"
    "  ok(setBonusFlags(xh3).breakthrough === 10, '星辉3件：setBonusFlags 含 breakthrough=10');\n"
    "  plain.player.level = 20; xh3.player.level = 20;\n"
    "  const rPlain = S.breakthroughRate(plain);\n"
    "  const r3 = S.breakthroughRate(xh3);\n"
    "  ok(rPlain !== null && r3 !== null && r3 - rPlain === 10, '星辉3件：渡劫成功率预览 +10%（仅套装差，确定性）');\n"
)

s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("[OK] test-newfeatures.mjs: 星辉3件断言改为确定性（plain 克隆基线）")
