# -*- coding: utf-8 -*-
"""天玄修仙录 · 补丁：灵草园「一键浇灌」按钮 + 满仓收获警示（UI 层）

配合 life.js 的 irrigateAllHerbs 与满仓保护：
  - 洞府·灵草园新增「一键浇灌 N 株（M 灵石）」批量按钮（按最接近成熟优先浇灌）；
  - 储物袋已满且有成熟灵草时，常驻红色警示，避免玩家点了收获才发现收不进去。
"""
import io, sys

JS = r"Z:/1/xiuxian/public/js/ui.js"
CSS = r"Z:/1/xiuxian/public/css/main.css"

src = io.open(JS, encoding="utf-8").read()
orig = src
changed = []

# ---------- 1. import 补齐 ----------
I_OLD = "harvestAllHerbs, irrigateHerb, crossbreedHerbs,"
I_NEW = "harvestAllHerbs, irrigateHerb, irrigateAllHerbs, crossbreedHerbs,"
assert src.count(I_OLD) == 1, "1: 未唯一匹配 import 片段"
src = src.replace(I_OLD, I_NEW)
changed.append("ui.js import irrigateAllHerbs")

# ---------- 2. 灵草园：一键浇灌按钮 + 满仓警示 ----------
G_OLD = """        ${garden.some((h) => h.progress >= h.grow) ? `<button class="btn btn-gold btn-block" id="btn-harvest-all" style="margin:6px 0 4px">🌿 一键收获成熟灵草（${garden.filter((h) => h.progress >= h.grow).length} 株）</button>` : ''}
"""
G_NEW = """        ${(() => {
          const canIrr = garden.filter((h) => h.progress < h.grow && (h.irrigatedThisMonth || 0) < HERB_IRRIGATE_CAP_PER_MONTH);
          if (!canIrr.length) return '';
          return `<button class="btn btn-sm btn-gold btn-block" id="btn-irrigate-all" style="margin:6px 0 2px">💧 一键浇灌 ${canIrr.length} 株（${canIrr.length * HERB_IRRIGATE_COST} 灵石）</button>`;
        })()}
        ${(() => {
          const left = (st.inventory.capacity || 0) + (st.inventory.ringBonus || 0) - inventoryUsed(st);
          const matureN = garden.filter((h) => h.progress >= h.grow).length;
          if (matureN > 0 && left <= 0) return `<div class="herb-bag-warn">⚠ 储物袋已满，成熟灵草无处安放 —— 请先出售杂物或扩容储物袋再收获。</div>`;
          return '';
        })()}
""" + G_OLD
assert src.count(G_OLD) == 1, "2: 未唯一匹配一键收获按钮片段"
src = src.replace(G_OLD, G_NEW)
changed.append("一键浇灌按钮 + 满仓警示")

# ---------- 3. 事件绑定 ----------
E_OLD = """    box.querySelectorAll('[data-irrigate]').forEach((b) => b.addEventListener('click', () => {
      const r = irrigateHerb(st, Number(b.dataset.irrigate));
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法浇灌'), r.ok ? 'jade' : 'warn');
      renderAll();
    }));
"""
E_NEW = E_OLD + """    const iaBtn = box.querySelector('#btn-irrigate-all');
    if (iaBtn) iaBtn.addEventListener('click', () => {
      const r = irrigateAllHerbs(st);
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? `已浇灌 ${r.count} 株灵草（耗灵石 ${r.spent}）` : (r.logs[0] || '无可浇灌灵草'), r.ok ? 'jade' : 'warn');
      renderAll();
    });
"""
assert src.count(E_OLD) == 1, "3: 未唯一匹配浇灌事件片段"
src = src.replace(E_OLD, E_NEW)
changed.append("一键浇灌事件绑定")

if src != orig:
    io.open(JS, "w", encoding="utf-8").write(src)
    print("ui.js 已更新：")
    for c in changed:
        print("  -", c)
else:
    print("ui.js 无改动")
    sys.exit(1)

# ---------- 4. CSS ----------
css = io.open(CSS, encoding="utf-8").read()
if ".herb-bag-warn" not in css:
    anchor = ".herb-row.mature {"
    assert css.count(anchor) == 1, "4: 未唯一匹配 CSS 锚点"
    add = """.herb-bag-warn { margin: 6px 0 8px; padding: 7px 10px; border-radius: 9px; font-size: .78rem; line-height: 1.5; color: var(--danger-strong); background: var(--danger-bg); border: 1px solid var(--danger-strong); }
"""
    css = css.replace(anchor, add + anchor)
    io.open(CSS, "w", encoding="utf-8").write(css)
    print("main.css 已新增 .herb-bag-warn")
else:
    print("main.css 已存在 .herb-bag-warn，跳过")
