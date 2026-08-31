#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补全 ui.js 渲染 + main.css 样式（index.html 已在上一脚本完成）。"""
import io

ROOT = 'Z:/1/xiuxian'

def patch(path, old, new):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f'[FAIL] 未找到锚点 in {path}\n--- 期望包含 ---\n{old[:160]}')
    if s.count(old) != 1:
        raise SystemExit(f'[FAIL] 锚点非唯一 in {path}，出现 {s.count(old)} 次')
    s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] patched {path}')

# ---- 2. ui.js：renderAll 渲染佩称号行（注意 2 空格外层缩进） ----
ui_old = '''  if (sectRow && sectB) {
    if (sc.has) {
      sectRow.style.display = '';
      sectB.innerHTML = `${sc.contribution} ｜ ${sc.rankName}`;
      sectB.title = `已入宗门「${sc.name}」，职级：${sc.rankName}，宗门贡献 ${sc.contribution}（宗门秘境/任务累积，兑换所消费）。`;
    } else {
      sectRow.style.display = 'none';
    }
  }'''
ui_new = '''  if (sectRow && sectB) {
    if (sc.has) {
      sectRow.style.display = '';
      sectB.innerHTML = `${sc.contribution} ｜ ${sc.rankName}`;
      sectB.title = `已入宗门「${sc.name}」，职级：${sc.rankName}，宗门贡献 ${sc.contribution}（宗门秘境/任务累积，兑换所消费）。`;
    } else {
      sectRow.style.display = 'none';
    }
  }
  // 佩称号常驻显示：玩家收集的封号是身份/威名收集型目标，此前仅在「成就·封号」面板可见，
  // 切走即不可知；现做英雄卡常驻行，延续「跨标签页不可见状态常驻化」主题，让玩家随时看到当前佩戴的封号；点击直达封号面板。
  const activeTitleObj = (st.player.activeTitle && D.TITLES.find((t) => t.id === st.player.activeTitle)) || null;
  const titleRow = document.getElementById('st-title-row');
  const titleB = document.getElementById('st-title');
  if (titleRow && titleB) {
    if (activeTitleObj) {
      titleRow.style.display = '';
      titleB.textContent = '🏅 ' + activeTitleObj.name;
      titleB.title = '当前佩戴封号「' + activeTitleObj.name + '」：' + activeTitleObj.desc + '（点击切换/查看全部封号）';
      titleRow.classList.add('clickable-stat');
      titleRow.onclick = () => { if (typeof setSideTab === 'function') setSideTab('achv'); };
    } else {
      titleRow.style.display = 'none';
      titleRow.classList.remove('clickable-stat');
      titleRow.onclick = null;
    }
  }'''
patch(f'{ROOT}/public/js/ui.js', ui_old, ui_new)

# ---- 3. main.css：封号行样式（金，可点击） ----
css_old = '.sect-row b { color: #b48ad6; font-weight: 600; }'
css_new = '''.sect-row b { color: #b48ad6; font-weight: 600; }
.title-row { background: linear-gradient(90deg, rgba(212,175,55,.14), rgba(212,175,55,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }
.title-row .vital-label { color: var(--gold, #d4af37); }
.title-row b { color: var(--gold, #d4af37); font-weight: 600; }
.title-row.clickable-stat { cursor: pointer; border-bottom: 1px dotted currentColor; }
.title-row.clickable-stat:hover { filter: brightness(1.2); }'''
patch(f'{ROOT}/public/css/main.css', css_old, css_new)

print('[DONE] 佩称号常驻行 ui.js + css 已接入')
