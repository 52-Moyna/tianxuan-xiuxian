# -*- coding: utf-8 -*-
import io

ROOT = "Z:/1/xiuxian/"

def edit(path, old, new, count=1):
    with io.open(ROOT + path, "r", encoding="utf-8") as f:
        s = f.read()
    c = s.count(old)
    if c == 0:
        print(f"[MISS] {path}: 未匹配到旧串，跳过该处")
        return False
    if count is not None and c != count:
        print(f"[WARN] {path}: 命中 {c} 处（期望 {count}），仍执行替换")
    s = s.replace(old, new, count if count is not None else -1)
    with io.open(ROOT + path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] {path}: 已替换 {c} 处")
    return True

# 1) index.html：在 beast-row 之后新增 juling-row（默认隐藏）
idx_old = '''          <div class="vital-row beast-row" id="st-beast-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>
            <span class="vital-label">出战</span><b id="st-beast">—</b>
          </div>'''
idx_new = '''          <div class="vital-row beast-row" id="st-beast-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>
            <span class="vital-label">出战</span><b id="st-beast">—</b>
          </div>
          <div class="vital-row juling-row" id="st-juling-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>
            <span class="vital-label">聚灵</span><b id="st-juling">—</b>
          </div>'''
edit("public/index.html", idx_old, idx_new, 1)

# 2) ui.js：在 beast 渲染块之后插入聚灵加成常驻渲染
ui_old = '''  } else if (beastRow) {
    beastRow.style.display = 'none';
  }
  // 危机提示横幅：汇总寿元/丹毒预警'''
ui_new = '''  } else if (beastRow) {
    beastRow.style.display = 'none';
  }
  // 聚灵加成常驻显示：服用聚灵丹/布下聚灵阵旗后，未来数月修炼效率 +15%（flags.cultivateBoostMonths），
  // 此前仅在「修炼」行动预览里可见（聚灵×1.15），切走即不可知；现做英雄卡常驻行，
  // 延续「跨标签页不可见状态常驻化」主题，让玩家随时知晓聚灵增益还剩几月
  const julingMonths = (st.flags?.cultivateBoostMonths || 0);
  const julingRow = document.getElementById('st-juling-row');
  const julingB = document.getElementById('st-juling');
  if (julingRow && julingB) {
    if (julingMonths > 0) {
      julingRow.style.display = '';
      julingB.innerHTML = '×1.15 · 余 ' + julingMonths + ' 月';
      julingB.title = '聚灵加成生效中：修炼效率 +15%（来自聚灵丹或聚灵阵旗），剩余 ' + julingMonths + ' 月后消退';
    } else {
      julingRow.style.display = 'none';
    }
  }
  // 危机提示横幅：汇总寿元/丹毒预警'''
edit("public/js/ui.js", ui_old, ui_new, 1)

# 3) main.css：补 .juling-row 灵气蓝样式（区分 omen 金、beast 青碧）
css_old = '''.beast-row b { color: var(--jade, #74b39c); font-weight: 600; }
.omen-ico { margin-right: 2px; }'''
css_new = '''.beast-row b { color: var(--jade, #74b39c); font-weight: 600; }
.juling-row { background: linear-gradient(90deg, rgba(126,155,214,.16), rgba(126,155,214,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }
.juling-row .vital-label { color: #7e9bd6; }
.juling-row b { color: #7e9bd6; font-weight: 600; }
.omen-ico { margin-right: 2px; }'''
edit("public/css/main.css", css_old, css_new, 1)

print("DONE")
