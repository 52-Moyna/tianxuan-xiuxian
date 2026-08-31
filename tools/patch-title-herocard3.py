#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""接入 activeTitleView 纯函数并复用 + 测试断言。index.html/css/行渲染已在前两脚本完成。"""
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

# ---- 1. systems.js：新增 activeTitleView 纯函数（放在 checkTitles 之后） ----
sys_old = '''  return newly;
}

/* ============================================================
 * 日志系统（操作/战斗/事件/天命/系统，持久化到 日志.ini）'''
sys_new = '''  return newly;
}

/** 佩称号视图（纯函数，不改动状态）：返回当前佩戴封号的展示信息，供英雄卡常驻行使用。 */
export function activeTitleView(state) {
  const id = state?.player?.activeTitle;
  if (!id) return { has: false, name: '', desc: '' };
  const t = TITLE_MAP[id] || TITLES.find((x) => x.id === id);
  if (!t) return { has: false, name: '', desc: '' };
  return { has: true, name: t.name, desc: t.desc };
}

/* ============================================================
 * 日志系统（操作/战斗/事件/天命/系统，持久化到 日志.ini）'''
patch(f'{ROOT}/public/js/systems.js', sys_old, sys_new)

# ---- 2. ui.js：复用 activeTitleView（替换内联查找） ----
ui_old = '''  // 佩称号常驻显示：玩家收集的封号是身份/威名收集型目标，此前仅在「成就·封号」面板可见，
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
ui_new = '''  // 佩称号常驻显示：玩家收集的封号是身份/威名收集型目标，此前仅在「成就·封号」面板可见，
  // 切走即不可知；现做英雄卡常驻行，延续「跨标签页不可见状态常驻化」主题，让玩家随时看到当前佩戴的封号；点击直达封号面板。
  const activeTitleObj = S.activeTitleView(st);
  const titleRow = document.getElementById('st-title-row');
  const titleB = document.getElementById('st-title');
  if (titleRow && titleB) {
    if (activeTitleObj.has) {
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

# ---- 3. test-newfeatures.mjs：在封号块后补 activeTitleView 断言 ----
t_old = '''// 天命封号授予
S.awardTitle(state, 'xinghui_zhanxian', []);
ok(state.player.titles.includes('xinghui_zhanxian'), 'awardTitle 授予天命封号');'''
t_new = '''// 天命封号授予
S.awardTitle(state, 'xinghui_zhanxian', []);
ok(state.player.titles.includes('xinghui_zhanxian'), 'awardTitle 授予天命封号');
// 佩称号视图（英雄卡常驻行使用，纯函数）：解析已佩戴封号，无佩戴返回 has:false
const tv1 = S.activeTitleView(state);
ok(tv1.has === true && tv1.name === '初露锋芒', 'activeTitleView 解析已佩戴封号');
state.player.activeTitle = '';
const tv2 = S.activeTitleView(state);
ok(tv2.has === false, 'activeTitleView 无佩戴返回 has:false');
state.player.activeTitle = 'chuji_fengmang';'''
patch(f'{ROOT}/tests/test-newfeatures.mjs', t_old, t_new)

print('[DONE] activeTitleView 抽出 + 复用 + 断言已接入')
