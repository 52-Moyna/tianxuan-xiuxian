# -*- coding: utf-8 -*-
"""丹炉成丹率预览补丁（第二部分：ui.js 接入 + main.css 样式）。"""
import io, os

ROOT = "Z:/1/xiuxian"
UI = os.path.join(ROOT, "public/js/ui.js")
CSS = os.path.join(ROOT, "public/css/main.css")

def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f"[失败] 未在 {path} 找到锚点：{label}")
    s = s.replace(old, new)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] {path} ｜ {label}")

# 1. ui.js import 引入 refineRate
ui_import_old = ", omenActive, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';"
ui_import_new = ", omenActive, refineRate, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';"
patch(UI, ui_import_old, ui_import_new, "ui.js 引入 refineRate")

# 2. ui.js 计算 pr
ui_pr_old = "            const unlocked = isRecipeUnlocked(st, r.id);"
ui_pr_new = "            const unlocked = isRecipeUnlocked(st, r.id);\n            const pr = refineRate(st, r.id);"
patch(UI, ui_pr_old, ui_pr_new, "ui.js 计算 refineRate 预览")

# 3. ui.js ar-meta 期望成丹率
ui_meta_old = '              <div class="ar-meta">耗时 ${r.months}月 ｜ 基础成丹 ${r.baseRate}%</div>'
ui_meta_new = ('              <div class="ar-meta">耗时 ${r.months}月 ｜ 期望成丹 '
               '<b class="ar-rate">${pr.rate}%</b>'
               '<span class="ar-bonus">（基础${pr.baseRate}'
               '${pr.caveBonus ? `＋丹炉${pr.caveBonus}` : ""}'
               '${pr.catalystBonus ? `＋催化${pr.catalystBonus}` : ""}）</span></div>')
patch(UI, ui_meta_old, ui_meta_new, "ui.js ar-meta 期望成丹率")

# 4. main.css 样式
css_add = """

/* 丹炉面板 · 期望成丹率预览（与 settleRefine 同口径，确定性） */
.ar-rate { color: var(--jade); font-weight: 700; }
.ar-bonus { color: var(--text-dim); font-size: .68rem; margin-left: 2px; }
"""
with io.open(CSS, "r", encoding="utf-8") as f:
    cs = f.read()
if ".ar-rate" not in cs:
    cs = cs.rstrip() + "\n" + css_add
    with io.open(CSS, "w", encoding="utf-8") as f:
        f.write(cs)
    print(f"[OK] {CSS} ｜ 追加 .ar-rate / .ar-bonus 样式")
else:
    print(f"[跳过] {CSS} 已含 .ar-rate 样式")

print("ui/css 补丁完成。")
