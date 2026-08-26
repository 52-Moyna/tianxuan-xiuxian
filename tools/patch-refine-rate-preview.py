# -*- coding: utf-8 -*-
"""天玄修仙录 · 丹炉成丹率确定性预览补丁。

- life.js: 新增纯函数 refineRate（与 settleRefine 同口径，不消耗状态）。
- ui.js: 丹炉面板接入 refineRate，展示真实期望成丹率并拆解洞府丹炉加成 / 催化加成。
- main.css: 补充 .ar-rate / .ar-bonus 样式。

仅做追加式 / 定点替换，不改任何已有行为。
"""
import io, os, sys

ROOT = "Z:/1/xiuxian"
LIFE = os.path.join(ROOT, "public/js/life.js")
UI = os.path.join(ROOT, "public/js/ui.js")
CSS = os.path.join(ROOT, "public/css/main.css")

def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f"[失败] 未在 {path} 找到锚点：{label}")
    if old.count(old) != 1:
        # 仍替换，但提示
        print(f"[提醒] 锚点 {label} 出现 {old.count(old)} 次，全部替换。")
    s = s.replace(old, new)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] {path} ｜ {label}")

# ---- 1. life.js：插入 refineRate 纯函数 ----
life_old = """  default: return false;
  }
}

/** 开炉炼制：校验解锁/材料/灵石 → 扣材料与灵石 → 写入「炼制中」队列 */"""
life_new = """  default: return false;
  }
}

/**
 * 开炉成丹率预览（与 settleRefine 同口径，但不消耗材料/状态）。
 * 返回 { baseRate, caveBonus, catalystBonus, rate }，供丹炉面板在开炉前展示真实期望成丹率，
 * 让玩家看清洞府丹炉加成与催化材料加成，做出更明智的投入决策（确定性、无 RNG）。
 */
export function refineRate(state, recipeId) {
  const r = PILL_RECIPES[recipeId];
  if (!r) return null;
  const baseRate = r.baseRate;
  const caveBonus = Math.round((state.cave?.bonus || 0) * 30);
  let catalystBonus = 0;
  for (const [cname, cfg] of Object.entries(ALCHEMY_CATALYSTS)) {
    const it = state.items.find((x) => x.名称 === cname);
    if (it && it.数量 >= 1) catalystBonus += cfg.bonus;
  }
  const rate = Math.min(98, baseRate + caveBonus + catalystBonus);
  return { baseRate, caveBonus, catalystBonus, rate };
}

/** 开炉炼制：校验解锁/材料/灵石 → 扣材料与灵石 → 写入「炼制中」队列 */"""
patch(LIFE, life_old, life_new, "life.js 新增 refineRate")

# ---- 2. ui.js：import 引入 refineRate ----
ui_import_old = "... , omenActive, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';"
ui_import_new = "... , omenActive, refineRate, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';"
patch(UI, ui_import_old, ui_import_new, "ui.js 引入 refineRate")

# ---- 3. ui.js：在 recipe map 内计算 pr ----
ui_pr_old = "            const unlocked = isRecipeUnlocked(st, r.id);"
ui_pr_new = "            const unlocked = isRecipeUnlocked(st, r.id);\n            const pr = refineRate(st, r.id);"
patch(UI, ui_pr_old, ui_pr_new, "ui.js 计算 refineRate 预览")

# ---- 4. ui.js：替换 ar-meta 展示期望成丹率 ----
ui_meta_old = '              <div class="ar-meta">耗时 ${r.months}月 ｜ 基础成丹 ${r.baseRate}%</div>'
ui_meta_new = ('              <div class="ar-meta">耗时 ${r.months}月 ｜ 期望成丹 '
               '<b class="ar-rate">${pr.rate}%</b>'
               '<span class="ar-bonus">（基础${pr.baseRate}'
               '${pr.caveBonus ? `＋丹炉${pr.caveBonus}` : ""}'
               '${pr.catalystBonus ? `＋催化${pr.catalystBonus}` : ""}）</span></div>')
patch(UI, ui_meta_old, ui_meta_new, "ui.js ar-meta 期望成丹率")

# ---- 5. main.css：补充样式 ----
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

print("全部补丁完成。")
