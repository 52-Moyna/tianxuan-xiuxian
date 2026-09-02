# -*- coding: utf-8 -*-
"""给 test-ui-smoke.mjs 追加两组回归断言：
1) 行囊「扩容进度」行（距下一品级还差多少格），并覆盖容量超最高档的边界
2) 地图「路费门禁」：灵石充足可点、清零后按钮禁用且不带 data-go
"""
import io, sys

ROOT = 'Z:/1/xiuxian/'
p = ROOT + 'tests/test-ui-smoke.mjs'
s = io.open(p, 'r', encoding='utf-8').read()

anchor = "  ok($$('.avatar-grid').length > 0 && !$('#avatar-file'), '设置面板含内置头像选择（无上传）');"
if anchor not in s:
    print('!! 未匹配锚点'); sys.exit(1)

add = anchor + r"""

  // 行囊「扩容进度」：明示距下一品级还差多少格（玩家能算出该攒多少灵石）
  try {
    const LF = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    $$('.side-tab').find((b) => b.dataset.tab === 'items').click(); await sleep(120);
    UI.renderAll(); await sleep(150);
    const st = GameState.data;
    ok(!!$('.bag-next'), '行囊页出现「扩容进度」行');
    const txt = $('.bag-next') ? $('.bag-next').textContent : '';
    const nx = LF.nextBagGrade(st);
    if (nx) {
      ok(txt.includes(String(nx.need)) && txt.includes(nx.name),
        `扩容进度显示缺口与目标品级（差 ${nx.need} 格 → ${nx.name}，实际：${txt}）`);
    } else {
      ok(txt.includes('已达最高品级'), `满级时显示「已达最高品级」（实际：${txt}）`);
    }
    ok(!txt.includes('undefined') && !txt.includes('NaN'), '扩容进度文案无 undefined/NaN');
    // 边界：容量抬到最高档之上，应判满级而非算出错误档（曾会用下标+1 取到首档）
    const cap0 = st.inventory.capacity;
    st.inventory.capacity = 99999; UI.renderAll(); await sleep(120);
    ok(LF.nextBagGrade(st) === null, '容量超最高档时 nextBagGrade 返回 null');
    ok($('.bag-next').textContent.includes('已达最高品级'), '超档时 UI 显示已达最高品级');
    st.inventory.capacity = cap0; UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `行囊扩容进度: ${e.message}`); }

  // 地图「路费门禁」：灵石不足时按钮禁用并写明缺口，避免点了才发现买不起
  try {
    const LF = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    $$('.side-tab').find((b) => b.dataset.tab === 'map').click(); await sleep(120);
    UI.renderAll(); await sleep(150);
    const st = GameState.data;
    ok($$('.region-card').length === 7, `地图渲染 7 域卡片（实际 ${$$('.region-card').length}）`);
    const routes = LF.travelOptions(st);
    ok(routes.length > 0, `当前地域有可直达邻域（${routes.length} 条）`);
    const nb = routes[0].id;
    const keep = JSON.parse(JSON.stringify(st.currencies));
    LF.lifeAddStones(st, 100000); UI.renderAll(); await sleep(150);
    ok(!!$(`[data-go="${nb}"]`), '灵石充足时相邻地域出现可点击「前往」按钮');
    // 清零灵石：按钮应禁用、文案明示缺口、且不带 data-go（点了不会触发旅行）
    for (const k of Object.keys(st.currencies)) st.currencies[k] = 0;
    UI.renderAll(); await sleep(150);
    const dis = $$('.region-card .btn[disabled]');
    ok(dis.length > 0, '灵石清零后相邻地域按钮被禁用');
    ok(dis.some((b) => b.textContent.includes('灵石不足')), '禁用按钮文案明示「灵石不足」');
    ok(dis.every((b) => !b.dataset.go), '禁用按钮不带 data-go，点击不会触发旅行');
    ok(!$(`[data-go="${nb}"]`), '灵石不足时不再出现可点击的「前往」');
    st.currencies = keep; UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `地图路费门禁: ${e.message}`); }"""

s = s.replace(anchor, add, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('已追加两组 UI 回归断言（扩容进度 / 地图路费门禁）')
