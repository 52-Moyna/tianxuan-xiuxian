#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本轮打磨补丁：状态危机预警（寿元/丹毒）。
在真实仓库 Z:/1/xiuxian 下修改 public/js/systems.js、public/index.html、
public/js/ui.js、public/css/main.css。所有改动为加法，不破坏已有功能。
"""
import io, sys, os

ROOT = "Z:/1/xiuxian"

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    with io.open(full, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f"[FAIL] 锚点未命中 {label}: {path}\n--- 期望包含 ---\n{old[:200]}")
    if new in s:
        print(f"[SKIP] 已存在 {label}: {path}")
        return
    s = s.replace(old, new, 1)
    with io.open(full, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] 已应用 {label}: {path}")

# ---------- 1. systems.js：新增两个纯函数 ----------
systems_old = """  return {
    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,
    note,
  };
}

/** 道基加经验（含升级） */"""

systems_new = """  return {
    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,
    note,
  };
}

/** 寿元危机预警（纯函数，不修改状态；供状态卡展示）。
 *  level: 'danger' 命悬一线（余寿≤8年）、'warn' 寿元将尽（≤20年）、'ok' 安康。
 *  hint 指向已实现的延寿途径：延寿丹(+20年)/冲击更高境界增寿/寿元耗尽转世。 */
export function lifespanWarning(state) {
  const p = state.player;
  const lifeLeft = Math.max(0, (p.lifespan || 0) - (p.age || 0));
  let level = 'ok', hint = '';
  if (lifeLeft <= 8) {
    level = 'danger';
    hint = '寿元将尽！可服「延寿丹」(+20年)、冲击更高境界增寿，或寿元耗尽后转世续道。';
  } else if (lifeLeft <= 20) {
    level = 'warn';
    hint = '寿元渐少，留意「延寿丹」（坊市/拍卖/宗门兑换所可得）以备不时之需。';
  }
  return { level, lifeLeft, hint };
}

/** 丹毒危机预警（纯函数，不修改状态；供状态卡展示）。
 *  level: 'danger' 剧毒攻心(≥85)、'warn' 丹毒累积(≥60)、'ok' 清净。
 *  hint 提醒减服毒性丹药，必要时用「凝血丹」清伤（无毒副作用）。 */
export function toxicityWarning(state) {
  const toxic = Number(state.flags?.pillToxicity || 0);
  let level = 'ok', hint = '';
  if (toxic >= 85) {
    level = 'danger';
    hint = '丹毒攻心！再服毒丹将重创修为，可服「凝血丹」清伤（无毒）或暂停服丹。';
  } else if (toxic >= 60) {
    level = 'warn';
    hint = '丹毒累积偏多，服丹收益下降、风险升高，宜暂缓毒性丹药。';
  }
  return { level, toxic, hint };
}

/** 道基加经验（含升级） */"""

patch("public/js/systems.js", systems_old, systems_new, "systems.js 危机预警函数")

# ---------- 2. index.html：丹毒行 + 危机横幅 ----------
html_old = """          <div class="vital-row wound-row" id="st-wound-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1.5 3-1 5.5-1 8s2.5 4 2.5 7-1 4-3.5 5"/></svg>
            <span class="vital-label">伤势</span><b id="st-wound">—</b>
          </div>
        </div>

        <div class="hero-exp">"""

html_new = """          <div class="vital-row wound-row" id="st-wound-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1.5 3-1 5.5-1 8s2.5 4 2.5 7-1 4-3.5 5"/></svg>
            <span class="vital-label">伤势</span><b id="st-wound">—</b>
          </div>
          <div class="vital-row" id="st-toxic-row">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v3l3 5v10H6v-10l3-5z"/><path d="M8 14h8"/></svg>
            <span class="vital-label">丹毒</span><b id="st-toxic">0</b>
          </div>
        </div>

        <!-- 危机预警横幅：寿元将尽/丹毒攻心时给出可行途径 -->
        <div class="crisis-banner" id="crisis-banner" style="display:none"></div>

        <div class="hero-exp">"""

patch("public/index.html", html_old, html_new, "index.html 丹毒行+横幅")

# ---------- 3. ui.js：接入危机预警渲染 ----------
ui_old = """  // 英雄卡生命体征：骨龄 / 寿元余 / 气血(血条) / 伤势，渲染到头像下方的 #hero-vitals
  const wounds = st.flags?.wounded || 0;
  const lifeLeft = Math.max(0, p.lifespan - p.age);
  const ageEl = $('#st-age'); if (ageEl) ageEl.textContent = `${p.age} 岁`;
  const lifeEl = $('#st-life'); if (lifeEl) lifeEl.textContent = `${lifeLeft} 年`;
  const lifeRow = $('#st-life-row'); if (lifeRow) lifeRow.classList.toggle('danger', lifeLeft <= 10);"""

ui_new = """  // 英雄卡生命体征：骨龄 / 寿元余 / 气血(血条) / 伤势 / 丹毒，渲染到头像下方的 #hero-vitals
  const wounds = st.flags?.wounded || 0;
  const lifeWarn = S.lifespanWarning(st);
  const lifeLeft = lifeWarn.lifeLeft;
  const ageEl = $('#st-age'); if (ageEl) ageEl.textContent = `${p.age} 岁`;
  const lifeEl = $('#st-life'); if (lifeEl) lifeEl.textContent = `${lifeLeft} 年`;
  const lifeRow = $('#st-life-row'); if (lifeRow) lifeRow.classList.toggle('danger', lifeWarn.level !== 'ok');
  // 丹毒生命体征（状态卡直接可见当前丹毒，偏高时整行标红）
  const toxWarn = S.toxicityWarning(st);
  const toxEl = $('#st-toxic'); if (toxEl) toxEl.textContent = `${toxWarn.toxic}`;
  const toxRow = $('#st-toxic-row'); if (toxRow) toxRow.classList.toggle('danger', toxWarn.level !== 'ok');
  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径
  const banner = $('#crisis-banner');
  if (banner) {
    const warns = [lifeWarn, toxWarn].filter((w) => w.level !== 'ok');
    if (warns.length) {
      banner.className = `crisis-banner ${warns.some((w) => w.level === 'danger') ? 'danger' : 'warn'}`;
      banner.innerHTML = warns.map((w) => `<div class="cb-item">${w.hint}</div>`).join('');
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }"""

patch("public/js/ui.js", ui_old, ui_new, "ui.js 危机预警渲染")

# ---------- 4. main.css：危机横幅样式 ----------
css_old = """.vital-row.danger { background: rgba(224,138,106,.1); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }"""
css_new = """.vital-row.danger { background: rgba(224,138,106,.1); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }
/* 危机预警横幅：寿元将尽 / 丹毒攻心时给出可行的延寿·解毒途径 */
.crisis-banner { margin: 4px 0 2px; padding: 8px 10px; border-radius: 10px; font-size: .8rem; line-height: 1.5; display: flex; flex-direction: column; gap: 5px; }
.crisis-banner.warn { background: rgba(212,184,90,.14); border: 1px solid rgba(212,184,90,.4); color: #d4b85a; }
.crisis-banner.danger { background: rgba(224,138,106,.16); border: 1px solid rgba(224,138,106,.5); color: var(--danger); }
.crisis-banner .cb-item { display: flex; gap: 6px; }
.crisis-banner .cb-item::before { content: '⚠'; flex: none; font-weight: 700; }"""

patch("public/css/main.css", css_old, css_new, "main.css 危机横幅样式")

print("ALL PATCHES APPLIED.")
