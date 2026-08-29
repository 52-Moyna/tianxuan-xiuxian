# -*- coding: utf-8 -*-
import io, sys

ROOT = 'Z:/1/xiuxian'

def edit(path, old, new, count=1, label=''):
    with io.open(ROOT + '/' + path, 'r', encoding='utf-8') as f:
        s = f.read()
    n = s.count(old)
    if n != count:
        print(f'[WARN] {label}: expected {count} occurrence(s), found {n}; skipping')
        return False
    s = s.replace(old, new, 1) if count == 1 else s.replace(old, new)
    with io.open(ROOT + '/' + path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] {label}: patched')
    return True

# ---------- systems.js: 新增 powerSummary 纯函数 ----------
systems_old = """  const total = Math.max(1, Math.round(totalRaw * daoBaseMul));
  return { items, daoBaseMul, milestone: milestone ? milestone.name : null, total };
}

export function refreshDerived(state) {"""

systems_new = """  const total = Math.max(1, Math.round(totalRaw * daoBaseMul));
  return { items, daoBaseMul, milestone: milestone ? milestone.name : null, total };
}

/**
 * 战力构成摘要：取 powerBreakdown 逐项拆解，格式化为单行纯文本，
 * 供英雄卡「战力」数值悬浮展示（信息透明，延续确定性预览主题）。
 * 例如「境界修为 123｜灵根资质 56｜… ‖ 合计 1234（×1.00）」。
 */
export function powerSummary(state) {
  const bd = powerBreakdown(state);
  const lines = bd.items.map((it) => `${it.label} ${it.value}`).join('｜');
  const mul = bd.daoBaseMul !== 1 ? `（×${bd.daoBaseMul.toFixed(2)}）` : '';
  const ms = bd.milestone ? ` · 道基里程碑「${bd.milestone}」` : '';
  return `${lines} ‖ 合计 ${bd.total}${mul}${ms}`;
}

export function refreshDerived(state) {"""

edit('public/js/systems.js', systems_old, systems_new, 1, 'systems.powerSummary')

# ---------- ui.js: 战力数字悬浮拆解 + 点击直达战力构成面板 ----------
ui_old = "  $('#st-power').textContent = fmtBig(p.power);"
ui_new = """  const powerEl = $('#st-power');
  if (powerEl) {
    powerEl.textContent = fmtBig(p.power);
    powerEl.title = '战力构成：' + S.powerSummary(st);
    powerEl.classList.add('clickable-stat');
    powerEl.onclick = () => { if (typeof setSideTab === 'function') setSideTab('realm'); };
  }"""

edit('public/js/ui.js', ui_old, ui_new, 1, 'ui.stPowerHover')

# ---------- main.css: 可点击战力数值样式 ----------
css_old = """.hero-stats .stat b {
  margin-left: auto;
  font-size: 1.02rem;
  color: var(--gold);
}"""
css_new = """.hero-stats .stat b {
  margin-left: auto;
  font-size: 1.02rem;
  color: var(--gold);
}
/* 战力数值可点击：悬浮看十维拆解、点击直达战力构成面板 */
#st-power.clickable-stat { cursor: pointer; border-bottom: 1px dotted currentColor; }
#st-power.clickable-stat:hover { filter: brightness(1.2); }"""

edit('public/css/main.css', css_old, css_new, 1, 'css.clickableStat')

print('DONE')
