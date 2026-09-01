# -*- coding: utf-8 -*-
"""UI 冒烟：洞府灵草园「每月生长 + 成熟预估」渲染断言"""
import io, sys

P = 'Z:/1/xiuxian/tests/test-ui-smoke.mjs'

with io.open(P, 'r', encoding='utf-8') as f:
    t = f.read()

old = """  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""
new = """  // 洞府面板：灵草园展示「每月生长」与每株「约 N 月后熟」（成熟预估，消除心算盲区）
  try {
    const LIFE = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const st = GameState.data;
    LIFE.ensureLifeState(st);
    st.cave.garden.push({ id: 'herb_lingcao', name: '凝露灵草', progress: 1, grow: 5, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 });
    st.cave.arrayLevel = 4; // 阵 4 重 → 月生长 +2 → 每月 3 月 → 剩余 4 月 → 约 2 月后熟
    UI.setSideTab('cave'); await sleep(120);
    const caveHtml = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(caveHtml.includes('每月生长'), '洞府面板显示灵草园每月生长');
    ok(caveHtml.includes('聚灵阵 +2'), '每月生长标注聚灵阵贡献 +2');
    ok(caveHtml.includes('约 2 月后熟'), '灵草行按聚灵阵月生长给出成熟预估（约 2 月后熟）');
  } catch (e) { ok(false, `洞府灵草园预估渲染: ${e.message}`); }

  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""

if t.count(old) != 1:
    print('DUP/MISS: %d' % t.count(old)); sys.exit(1)
t = t.replace(old, new)
with io.open(P, 'w', encoding='utf-8', newline='') as f:
    f.write(t)
print('OK')
