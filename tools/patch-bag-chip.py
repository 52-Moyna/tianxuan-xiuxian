# -*- coding: utf-8 -*-
"""天玄修仙录·打磨：储物袋容量常驻顶栏 chip。
改动真实仓库 Z:/1/xiuxian 下的 public/ 四处，纯显示型、零破坏。
"""
import io, pathlib, sys

ROOT = pathlib.Path(r"Z:/1/xiuxian")
SYS = ROOT / "public/js/systems.js"
HTML = ROOT / "public/index.html"
UI = ROOT / "public/js/ui.js"
CSS = ROOT / "public/css/main.css"

def patch(path: pathlib.Path, anchor: str, payload: str, *, after=True, desc=""):
    txt = path.read_text(encoding="utf-8")
    if anchor not in txt:
        raise SystemExit(f"[FAIL] 锚点未命中 {path.name}: {desc or anchor!r}")
    if after:
        new = txt.replace(anchor, anchor + payload, 1)
    else:
        new = txt.replace(anchor, payload + anchor, 1)
    if new == txt:
        raise SystemExit(f"[FAIL] 替换后无变化 {path.name}: {anchor!r}")
    path.write_text(new, encoding="utf-8")
    print(f"[OK] {path.name}: {desc or 'patched'}")

# 1) systems.js：新增 bagUsage 纯函数（与危机预警同口径）
bag_fn = '''

/**
 * 储物袋容量使用情况（纯函数，不修改 state）。
 * 与危机预警（寿元/丹毒）同口径：ratio>=0.9 危险（满仓临界、再拾取物品将被静默丢弃）、
 * >=0.7 警告（容量偏紧）、否则 ok。
 * 此前储物袋满仓时 storeItem 会静默丢物（canStore 返回 false、return false），玩家仅在行囊面板可见容量、
 * 切走即不可知，易在满仓时「丢物品而不自知」；现供顶栏 chip 常驻展示，延续
 * 「跨标签页不可见状态常驻化」+「危机预警」主题。
 */
export function bagUsage(state) {
  const inv = state.inventory || {};
  const used = Number(inv.used || 0);
  const capacity = Number(inv.capacity || 100);
  const ringBonus = Number(inv.ringBonus || 0);
  const total = capacity + ringBonus;
  const ratio = total > 0 ? used / total : 0;
  const level = ratio >= 0.9 ? 'danger' : ratio >= 0.7 ? 'warn' : 'ok';
  return { used, capacity, ringBonus, total, ratio, level };
}
'''
patch(SYS, "export function addDaoBaseExp(state, name, amount, logs) {", bag_fn, after=False,
      desc="新增 bagUsage 纯函数")

# 2) index.html：顶栏 .tb-res 内、tb-herb 之后新增 tb-bag chip
html_anchor = '        <span id="tb-herb" class="tb-chip tb-herb" style="display:none"></span>'
html_payload = '\n        <span id="tb-bag" class="tb-chip tb-bag" style="display:none"></span>'
patch(HTML, html_anchor, html_payload, after=True, desc="新增 tb-bag chip")

# 3) ui.js：renderAll 在 herbChip 块之后（// 状态卡 注释之前）渲染储物袋 chip
ui_anchor = "\n  // 状态卡"
ui_payload = '''
  // 储物袋容量常驻提示：储物袋满仓时 storeItem 会静默丢弃物品（canStore 返回 false、return false），
  // 此前玩家仅在行囊面板可见容量、切走即不可知，易在满仓时「丢物品而不自知」。
  // 此处做顶栏常驻 chip，接近满载变色预警，点击直达行囊整理/扩容（延续跨标签页不可见状态常驻化 + 危机预警主题）。
  const bag = S.bagUsage(st);
  const bagChip = document.getElementById('tb-bag');
  if (bagChip) {
    bagChip.style.display = '';
    const pct = Math.round(bag.ratio * 100);
    bagChip.innerHTML = `${ICO('<path d="M6 10h12l-1.2 9H7.2z"/><path d="M9 10V8a3 3 0 0 1 6 0v2"/>')}储物袋 ${bag.used}/${bag.total}（${pct}%）`;
    bagChip.classList.remove('tb-bag-warn', 'tb-bag-danger', 'tb-clickable');
    if (bag.level === 'danger') {
      bagChip.classList.add('tb-bag-danger', 'tb-clickable');
      bagChip.title = `储物袋即将满载（${bag.used}/${bag.total}），再拾取物品将被丢弃！点击前往行囊整理或扩容。`;
    } else if (bag.level === 'warn') {
      bagChip.classList.add('tb-bag-warn', 'tb-clickable');
      bagChip.title = `储物袋容量偏紧（${bag.used}/${bag.total}，${pct}%），建议整理行囊或扩容。`;
    } else {
      bagChip.title = `储物袋容量 ${bag.used}/${bag.total}（${pct}%）。`;
    }
    bagChip.onclick = () => { if (bag.level !== 'ok' && typeof setSideTab === 'function') setSideTab('items'); };
  }
'''
patch(UI, ui_anchor, ui_payload, after=False, desc="renderAll 渲染储物袋 chip")

# 4) main.css：在 .tb-herb 样式之后新增 tb-bag warn/danger 样式
css_anchor = ".tb-herb { color: var(--jade); border-color: var(--jade-soft); }"
css_payload = '''
.tb-bag { color: var(--text-dim); }
.tb-bag-warn { color: var(--warn); border-color: var(--warn); background: rgba(220,180,70,.1); }
.tb-bag-danger { color: var(--danger); border-color: var(--danger); background: rgba(224,138,106,.12); font-weight: 600; }'''
patch(CSS, css_anchor, css_payload, after=True, desc="新增 tb-bag 样式")

print("\n[ALL DONE] 四处源码改动完成。")
