# -*- coding: utf-8 -*-
"""天玄修仙录 · 丹炉催化材料可视化（信息透明·确定性预览主题延伸）。

改动：
  systems.js：导入 ALCHEMY_CATALYSTS + 新增 catalystStatus 纯函数（持有数/加成/是否持有）。
  ui.js：丹炉面板新增催化材料常驻块（持有则显示数量+自动消耗提示；未持有则提示获取途径）+ 每丹方「🔥催化就绪」徽标。
  main.css：补 .alchemy-catalysts / .ar-cat* / .ar-cat-ready 样式。
"""
import io, sys, os

ROOT = "Z:/1/xiuxian"
sys_js = os.path.join(ROOT, "public", "js", "systems.js")
ui_js = os.path.join(ROOT, "public", "js", "ui.js")
css = os.path.join(ROOT, "public", "css", "main.css")

def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f"[FAIL] 锚点未命中 {label} @ {path}")
    if new in s:
        print(f"[SKIP] 已存在 {label}")
        return
    s = s.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] {label}")

# ---------- systems.js：导入 ALCHEMY_CATALYSTS ----------
patch(sys_js,
      "beastLevelRange, beastPowerOfLevel } from './life.js';",
      "beastLevelRange, beastPowerOfLevel, ALCHEMY_CATALYSTS } from './life.js';",
      "systems.js 导入 ALCHEMY_CATALYSTS")

# ---------- systems.js：新增 catalystStatus ----------
catalyst_fn = '''
/** 炼丹催化材料持有状态：供丹炉面板在开炉前透明展示「持有数量 / 开炉自动消耗 / 提升成丹率」。
 *  此前玩家只在成丹率里看到「＋催化X」，无从得知自己持有多少、开炉会被自动消耗，
 *  现把催化材料可见化，落实「信息透明·确定性预览」主题（确定性、无 RNG）。 */
export function catalystStatus(state) {
  return Object.entries(ALCHEMY_CATALYSTS).map(([name, cfg]) => {
    const have = state.items.find((x) => x.名称 === name)?.数量 || 0;
    return { name, have, bonus: cfg.bonus, label: cfg.label, held: have >= 1 };
  });
}
'''
patch(sys_js,
      "export function addDaoBaseExp(state, name, amount, logs) {",
      catalyst_fn + "\nexport function addDaoBaseExp(state, name, amount, logs) {",
      "systems.js 新增 catalystStatus")

# ---------- ui.js：每丹方「🔥催化就绪」徽标 ----------
patch(ui_js,
      '<div class="ar-meta">耗时 ${r.months}月 ｜ 期望成丹 <b class="ar-rate">${pr.rate}%</b><span class="ar-bonus">（基础${pr.baseRate}${pr.caveBonus ? `＋丹炉${pr.caveBonus}` : ""}${pr.catalystBonus ? `＋催化${pr.catalystBonus}` : ""}）</span></div>',
      '<div class="ar-meta">耗时 ${r.months}月 ｜ 期望成丹 <b class="ar-rate">${pr.rate}%</b><span class="ar-bonus">（基础${pr.baseRate}${pr.caveBonus ? `＋丹炉${pr.caveBonus}` : ""}${pr.catalystBonus ? `＋催化${pr.catalystBonus}` : ""}）</span>${pr.catalystBonus ? `<span class="ar-cat-ready">🔥催化就绪</span>` : ""}</div>',
      "ui.js 丹方催化就绪徽标")

# ---------- ui.js：丹炉面板插入催化材料常驻块 ----------
patch(ui_js,
      "        }).join('')}\n        </div>\n      </div>`;\n    box.innerHTML = `",
      "        }).join('')}\n        </div>\n        ${alchemyCatalystBlock(st)}\n      </div>`;\n    box.innerHTML = `",
      "ui.js 插入催化材料常驻块")

# ---------- ui.js：新增 alchemyCatalystBlock 助手 ----------
catalyst_block_fn = '''
/** 丹炉面板催化材料常驻块：开炉前透明展示催化材料持有与自动消耗，落实信息透明。 */
function alchemyCatalystBlock(st) {
  const cats = S.catalystStatus(st);
  const held = cats.filter((c) => c.have > 0);
  const rows = held.length
    ? held.map((c) => `<span class="ar-cat">${c.name} ×${c.have}<i>开炉自动消耗1份 · 成丹率 +${c.bonus}%</i></span>`).join('')
    : `<span class="ar-cat ar-cat-empty">未持有催化材料：道友深谈 / 委托可得「年份灵草」「私藏丹方·残卷」，开炉自动催化提升成丹率</span>`;
  return `<div class="alchemy-catalysts"><div class="side-subsubtitle">催化材料（开炉自动消耗）</div><div class="ar-cats">${rows}</div></div>`;
}
'''
patch(ui_js,
      "  if (sideTab === 'cave') {",
      catalyst_block_fn + "\n  if (sideTab === 'cave') {",
      "ui.js 新增 alchemyCatalystBlock")

# ---------- main.css：补样式 ----------
css_append = '''
.alchemy-catalysts { margin: 4px 0 2px; padding: 8px 10px; border-radius: 10px; background: rgba(224,138,106,.08); border: 1px solid var(--gold-soft); }
.ar-cats { display: flex; flex-wrap: wrap; gap: 6px; }
.ar-cat { font-size: .7rem; color: #e08a6a; border: 1px solid var(--gold-soft); border-radius: 999px; padding: 2px 9px; background: rgba(224,138,106,.1); }
.ar-cat i { font-style: normal; color: var(--text-faint); margin-left: 5px; }
.ar-cat-empty { color: var(--text-faint); border-color: var(--line-soft); background: transparent; }
.ar-cat-ready { font-size: .66rem; color: #e08a6a; margin-left: 6px; }
'''
patch(css,
      ".ar-bonus { color: var(--text-dim); font-size: .68rem; margin-left: 2px; }",
      ".ar-bonus { color: var(--text-dim); font-size: .68rem; margin-left: 2px; }\n" + css_append,
      "main.css 补催化材料样式")

print("ALL PATCHES DONE")
