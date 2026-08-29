# -*- coding: utf-8 -*-
"""补丁：把「出战灵兽」接入英雄卡常驻行（index.html + ui.js + main.css）。
纯显示型改动，不改游戏逻辑，零破坏。
"""
import io, sys

ROOT = "Z:/1/xiuxian/public"

# ---------- 1) index.html：在 omen-row 之后新增 beast-row ----------
html_path = f"{ROOT}/index.html"
with io.open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

old_html = """          <div class="vital-row omen-row" id="st-omen-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.6L20 9.2l-4.6 3.8L17 19l-5-3.4L7 19l1.6-6L4 9.2l5.8-.6z"/></svg>
            <span class="vital-label">天机</span><b id="st-omen">—</b>
          </div>"""
new_html = old_html + """
          <div class="vital-row beast-row" id="st-beast-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>
            <span class="vital-label">出战</span><b id="st-beast">—</b>
          </div>"""
assert html.count(old_html) == 1, "index.html 锚点未唯一匹配"
html = html.replace(old_html, new_html)
with io.open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

# ---------- 2) ui.js：renderAll 在 omen 块之后渲染出战灵兽 ----------
js_path = f"{ROOT}/js/ui.js"
with io.open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

old_js = """    } else {
      omenRow.style.display = 'none';
    }
  }"""
new_js = old_js + """
  // 出战灵兽常驻显示：当前出战灵兽的护主加成与伴生天赋生死攸关（如涅槃残焰渡劫保命），
  // 玩家在任意标签页都能看到是哪只灵兽在护主，弥补仅灵兽面板可见、切标签页即丢失的不足
  const beastRow = $('#st-beast-row');
  const beastB = $('#st-beast');
  const beastsState = st.beasts;
  if (beastRow && beastB && beastsState && beastsState.activeIdx != null && beastsState.activeIdx >= 0 && beastsState.slots && beastsState.slots[beastsState.activeIdx]) {
    const ab = beastsState.slots[beastsState.activeIdx];
    const abElem = ({ 风: '🌪️', 土: '🪨', 幻: '👻', 雷: '⚡', 水: '💧', 火: '🔥' })[ab.element] || '✨';
    const abBonus = S.activeBeastBonus(st);
    const abSkill = S.activeBeastSkill(st);
    const abTalent = abSkill ? (BEAST_TALENT_TEXT[abSkill] || '') : '';
    beastRow.style.display = '';
    beastB.innerHTML = abElem + ' ' + ab.name;
    beastB.title = '出战灵兽「' + ab.name + '」' + ab.element + '系·★' + (ab.star || 1) + '｜护主胜率 +' + abBonus + '%（出战）' + (abTalent ? '｜天赋：' + abTalent : '') + '｜灵兽面板可更换';
  } else if (beastRow) {
    beastRow.style.display = 'none';
  }"""
assert js.count(old_js) == 1, "ui.js 锚点未唯一匹配"
js = js.replace(old_js, new_js)
with io.open(js_path, "w", encoding="utf-8") as f:
    f.write(js)

# ---------- 3) main.css：补 .beast-row 青碧样式 ----------
css_path = f"{ROOT}/css/main.css"
with io.open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

old_css = ".omen-row b { color: var(--gold, #d4af37); font-weight: 600; }"
new_css = old_css + """
.beast-row { background: linear-gradient(90deg, rgba(116,179,156,.16), rgba(116,179,156,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }
.beast-row .vital-label { color: var(--jade, #74b39c); }
.beast-row b { color: var(--jade, #74b39c); font-weight: 600; }"""
assert css.count(old_css) == 1, "main.css 锚点未唯一匹配"
css = css.replace(old_css, new_css)
with io.open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

print("OK: 出战灵兽英雄卡常驻行已写入 index.html / js/ui.js / css/main.css")
