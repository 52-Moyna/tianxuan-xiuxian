# -*- coding: utf-8 -*-
"""补丁 c：更新 ui-smoke 中「一键浇灌」断言以覆盖新的灵石降级行为。
旧断言假设按钮恒定出现且带 id；新行为是灵石不足时降级/禁用，故先给足灵石再断言，
并新增两条覆盖「只够浇部分」与「一株都浇不起」。
"""
import io, sys
ROOT = 'Z:/1/xiuxian/'
p = ROOT + 'tests/test-ui-smoke.mjs'
s = io.open(p, 'r', encoding='utf-8').read()

old = """    // 一键浇灌（批量 QoL）：灵田有未熟灵草时应出现批量按钮
    ok(caveHtml.includes('一键浇灌'), '洞府面板显示一键浇灌按钮');
    ok(caveHtml.includes('btn-irrigate-all'), '一键浇灌按钮带绑定 id');"""
new = """    // 一键浇灌（批量 QoL）：灵田有未熟灵草且灵石充足时应出现批量按钮
    // 新行为：灵石不足会降级/禁用，故先给足灵石再断言「完整形态」
    const keepCur = JSON.parse(JSON.stringify(st.currencies || {}));
    LIFE.lifeAddStones(st, 10000);
    UI.renderAll(); await sleep(120);
    const caveHtml2 = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(caveHtml2.includes('一键浇灌'), '洞府面板显示一键浇灌按钮');
    ok(!!$('#btn-irrigate-all'), '一键浇灌按钮带绑定 id');
    // 灵石只够浇 1 株（共 2 株可浇）→ 按钮只承诺 1/2，不再谎报 2 株
    st.cave.garden.push({ id: 'herb_lingcao', name: '乙株灵草', progress: 1, grow: 5, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 });
    for (const k of Object.keys(st.currencies)) st.currencies[k] = 0;
    LIFE.lifeAddStones(st, LIFE.HERB_IRRIGATE_COST);
    UI.renderAll(); await sleep(120);
    const irrTxt = $('#btn-irrigate-all') ? $('#btn-irrigate-all').textContent : '';
    ok(irrTxt.includes('1/2'), `灵石只够 1 株时按钮只承诺 1/2（实际：${irrTxt}）`);
    // 一株都浇不起 → 按钮禁用并写明原因（而非点了才发现）
    for (const k of Object.keys(st.currencies)) st.currencies[k] = 0;
    UI.renderAll(); await sleep(120);
    ok($$('#center-body button[disabled]').some((b) => b.textContent.includes('灵石不足，暂无法浇灌')),
      '灵石归零时一键浇灌按钮禁用并写明原因');
    st.currencies = keepCur; UI.renderAll(); await sleep(100);"""
if old not in s:
    print('!! 未匹配锚点'); sys.exit(1)
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('已更新一键浇灌断言（覆盖灵石降级/禁用）')
