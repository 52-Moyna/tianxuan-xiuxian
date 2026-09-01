# -*- coding: utf-8 -*-
"""天玄修仙录 · 补丁：UI 冒烟补「一键浇灌按钮」与「满仓警示」渲染断言"""
import io, sys

P = r"Z:/1/xiuxian/tests/test-ui-smoke.mjs"
src = io.open(P, encoding="utf-8").read()
orig = src

OLD = """    ok(caveHtml.includes('约 2 月后熟'), '灵草行按聚灵阵月生长给出成熟预估（约 2 月后熟）');
  } catch (e) { ok(false, `洞府灵草园预估渲染: ${e.message}`); }
"""
NEW = """    ok(caveHtml.includes('约 2 月后熟'), '灵草行按聚灵阵月生长给出成熟预估（约 2 月后熟）');
    // 一键浇灌（批量 QoL）：灵田有未熟灵草时应出现批量按钮
    ok(caveHtml.includes('一键浇灌'), '洞府面板显示一键浇灌按钮');
    ok(caveHtml.includes('btn-irrigate-all'), '一键浇灌按钮带绑定 id');

    // 满仓警示：有成熟灵草且储物袋已满时，给出「先清理再收获」的常驻提示
    st.cave.garden.push({ id: 'herb_lingcao', name: '凝露灵草', progress: 5, grow: 5, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 });
    const usedNow = LIFE.inventoryUsed(st);
    st.inventory.capacity = Math.max(1, usedNow);
    st.inventory.ringBonus = 0;
    // 注意：此时侧边栏已停在 cave，setSideTab 不会触发重渲染，须显式 renderAll
    UI.renderAll(); await sleep(150);
    const fullHtml = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(fullHtml.includes('储物袋已满'), '储物袋已满且有成熟灵草时给出常驻警示');
    st.cave.garden.pop();
    st.inventory.capacity = 200;
  } catch (e) { ok(false, `洞府灵草园预估渲染: ${e.message}`); }
"""
assert src.count(OLD) == 1, "未唯一匹配洞府灵草园断言片段"
src = src.replace(OLD, NEW)

if src != orig:
    io.open(P, "w", encoding="utf-8").write(src)
    print("test-ui-smoke.mjs 已补一键浇灌/满仓警示渲染断言")
else:
    print("无改动")
    sys.exit(1)
