# -*- coding: utf-8 -*-
"""测试补丁：行囊搜索 + 满仓建议清理（2026-09-01 20:00 轮次）
- test-newfeatures.mjs：itemSellPrice 确定性与口径统一 / sellItemsByIndex / lowValueSuggestions / 清理闭环
- test-ui-smoke.mjs：搜索框渲染 + 搜索过滤 + 满仓清理区块出现并可一键出货
"""
import io
import sys

NF = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'
UIS = 'Z:/1/xiuxian/tests/test-ui-smoke.mjs'

# ---------------- test-newfeatures.mjs ----------------
s = io.open(NF, encoding='utf-8').read()
tail = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
assert s.count(tail) == 1, 'newfeatures 尾部锚点异常'

block = r"""
/* ---------- 行囊清理闭环：唯一估价口径 / 按索引出售 / 建议清理清单 ---------- */
{
  const sc = S.createNewGame({ name: '清仓测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sc);
  sc.items.length = 0;
  sc.inventory.capacity = 200; sc.inventory.ringBonus = 0;
  const cheap = { 名称: '粗铁', 类型: '材料', 数量: 2, 价值: 10, 描述: '不值钱的边角料。' };
  const mid = { 名称: '星砂', 类型: '材料', 数量: 1, 价值: 120, 描述: '炼器灵材。' };
  const costly = { 名称: '月华露', 类型: '材料', 数量: 1, 价值: 300, 描述: '月华凝露。' };
  storeItem(sc, cheap); storeItem(sc, mid); storeItem(sc, costly);

  // itemSellPrice 唯一口径：withFluct=false 时不消耗 RNG，重复调用结果一致
  const p1 = S.itemSellPrice(sc, mid, false);
  const p2 = S.itemSellPrice(sc, mid, false);
  ok(p1 === p2 && p1 > 0, `itemSellPrice 无浮动时确定性（${p1}）`);
  ok(S.itemSellPrice(sc, costly, false) > S.itemSellPrice(sc, cheap, false), 'itemSellPrice：价值越高售价越高');
  ok(S.itemSellPrice(sc, { 名称: '未标价', 类型: '材料', 数量: 1 }, false) > 0, 'itemSellPrice：未标价物品按类型兜底且不为 0');

  // lowValueSuggestions：按每格售价升序，最多 n 件，跳过在用容器
  const sug = S.lowValueSuggestions(sc, 5);
  ok(sug.length === 3, `lowValueSuggestions 返回全部可售件数（${sug.length}）`);
  ok(sug[0].name === '粗铁', `lowValueSuggestions 最不值钱的排第一（${sug[0].name}）`);
  let asc = true;
  for (let i = 1; i < sug.length; i++) if (sug[i].perSlot < sug[i - 1].perSlot) asc = false;
  ok(asc, 'lowValueSuggestions 按每格售价升序');
  ok(S.lowValueSuggestions(sc, 2).length === 2, 'lowValueSuggestions 遵守 n 上限');
  ok(sug.every((r) => Number.isInteger(r.idx) && sc.items[r.idx] && sc.items[r.idx].名称 === r.name), 'lowValueSuggestions 的 idx 与 state.items 对齐');
  sc.items.push({ 名称: '在用储物袋', 类型: '容器', 数量: 1, 价值: 999, 描述: '正在使用的储物袋。' });
  ok(S.lowValueSuggestions(sc, 9).every((r) => r.name !== '在用储物袋'), 'lowValueSuggestions 跳过在用容器');
  sc.items.pop();

  // sellItemsByIndex：精确出售指定物品，灵石增加、格位腾出、跳过容器
  const before = S.totalStones(sc);
  const usedBefore = inventoryUsed(sc);
  const idxCheap = sc.items.findIndex((i) => i.名称 === '粗铁');
  const bagIdx = sc.items.push({ 名称: '在用储物袋', 类型: '容器', 数量: 1, 价值: 999, 描述: 'x' }) - 1;
  const res = S.sellItemsByIndex(sc, [idxCheap, bagIdx]);
  ok(res.count === 1 && res.names[0] === '粗铁', 'sellItemsByIndex 只卖出指定物品');
  ok(!sc.items.some((i) => i.名称 === '粗铁'), 'sellItemsByIndex 目标已移出行囊');
  ok(sc.items.some((i) => i.名称 === '在用储物袋'), 'sellItemsByIndex 跳过在用容器');
  ok(S.totalStones(sc) === before + res.stones && res.stones > 0, 'sellItemsByIndex 灵石入账与返回值一致');
  ok(res.space === 2 && inventoryUsed(sc) === usedBefore - 2, 'sellItemsByIndex 腾出格位数正确（粗铁 ×2 = 2 格）');
  ok(sc.items.some((i) => i.名称 === '星砂') && sc.items.some((i) => i.名称 === '月华露'), 'sellItemsByIndex 不影响未指定的物品');

  // 重复 / 越界 / 非法索引安全
  const safe = S.sellItemsByIndex(sc, [999, -1, null, undefined, 'x']);
  ok(safe.count === 0 && safe.stones === 0, 'sellItemsByIndex 对已售/越界/非法索引安全无副作用');
  ok(S.sellItemsByIndex(sc, []).count === 0, 'sellItemsByIndex 空数组返回 0');
  ok(S.sellItemsByIndex(sc, null).count === 0, 'sellItemsByIndex null 参数不报错');
  sc.items = sc.items.filter((i) => i.类型 !== '容器');
  // 补两件低价材料，保证清理闭环有 2 件可售
  storeItem(sc, { 名称: '备用材料甲', 类型: '材料', 数量: 1, 价值: 30, 描述: 'd' });
  storeItem(sc, { 名称: '备用材料乙', 类型: '材料', 数量: 2, 价值: 20, 描述: 'd' });

  // 清理闭环：满仓 → 按建议售出 → 腾出空间后可重新入袋（此前是「静默丢弃」死结）
  const bag = S.bagUsage(sc);
  sc.inventory.capacity = Math.max(1, inventoryUsed(sc)); sc.inventory.ringBonus = 0;
  ok(S.bagUsage(sc).ratio >= 1, '构造满仓状态成功');
  ok(storeItem(sc, { 名称: '新拾取', 类型: '材料', 数量: 1, 价值: 50, 描述: 'd' }) === false, '满仓时新物品无法入袋');
  const plan = S.lowValueSuggestions(sc, 2);
  const sold = S.sellItemsByIndex(sc, plan.map((r) => r.idx));
  ok(sold.count === 2 && sold.space >= 2, `按建议售出 2 件，腾出 ${sold.space} 格`);
  ok(storeItem(sc, { 名称: '新拾取', 类型: '材料', 数量: 1, 价值: 50, 描述: 'd' }) === true, '清理后新物品可正常入袋（闭环成立）');
  ok(bag.total > 0, 'bagUsage 提供容量口径供 UI 判定');
}

"""
s = s.replace(tail, block + tail)
io.open(NF, 'w', encoding='utf-8', newline='\n').write(s)
print('test-newfeatures.mjs patched')

# ---------------- test-ui-smoke.mjs ----------------
u = io.open(UIS, encoding='utf-8').read()
anchor = """  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""
assert u.count(anchor) == 1, 'ui-smoke 锚点异常'

uiblock = r"""  // 行囊搜索 + 满仓「建议清理」一键出货
  try {
    const SS = await import(pathToFileURL(join(ROOT, 'public/js/systems.js')).href);
    const invBtn = $$('.side-tab').find((b) => b.dataset.tab === 'items');
    invBtn.click(); await sleep(150);
    ok(!!$('#inv-search'), '行囊渲染搜索框 #inv-search');
    ok($('#inv-search').placeholder.includes('搜索'), '搜索框含占位提示文案');

    // 搜索过滤：按名称命中
    const st3 = GameState.data;
    st3.items.push({ 名称: '独角测试草', 类型: '材料', 数量: 1, 价值: 20, 描述: '仅用于搜索验证的灵草。' });
    st3.items.push({ 名称: '另一件杂物', 类型: '材料', 数量: 1, 价值: 20, 描述: '描述里含暗号麒麟。' });
    UI.renderAll(); await sleep(120);
    const inp = $('#inv-search');
    inp.value = '独角';
    inp.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(150);
    ok($('#center-body').textContent.includes('独角测试草'), '搜索「独角」命中目标物品');
    ok(!$('#center-body').textContent.includes('另一件杂物'), '搜索时过滤掉不相关物品');
    ok(!!$('.inv-search-hit') && $('.inv-search-hit').textContent.includes('匹配'), '搜索显示命中数量');

    // 描述匹配
    const inp2 = $('#inv-search');
    inp2.value = '麒麟';
    inp2.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(150);
    ok($('#center-body').textContent.includes('另一件杂物'), '搜索可命中描述中的关键词');

    // 清空按钮
    $('#inv-search-clear').click(); await sleep(150);
    ok($('#center-body').textContent.includes('独角测试草'), '清空搜索后恢复全部物品');
    ok(!$('#inv-search-clear'), '清空后清空按钮自身消失');

    // 满仓时出现「建议清理」区块，并可一键出货腾格
    const body = $('#center-body');
    body.dataset.invQuery = '';
    UI.renderAll(); await sleep(120);
    const s4 = GameState.data;
    // 容量 = 当前占用 → ratio = 1，必定触发「建议清理」（注意 capacity 不能设 0，会被归一成 100）
    s4.inventory.capacity = Math.max(1, SS.bagUsage(s4).used);
    s4.inventory.ringBonus = 0;
    UI.renderAll(); await sleep(150);
    ok(!!$('.bag-cleanup'), '储物袋吃紧时行囊出现「建议清理」区块');
    ok(!!$('#btn-sell-cleanup'), '建议清理区块含一键出售按钮');
    const used4 = SS.bagUsage(s4).used;
    const stones4 = SS.totalStones(s4);
    $('#btn-sell-cleanup').click(); await sleep(200);
    ok(SS.bagUsage(s4).used < used4, `一键清理后占用下降（${used4} → ${SS.bagUsage(s4).used}）`);
    ok(SS.totalStones(s4) > stones4, '一键清理后灵石增加');
    ok(!$('.bag-cleanup'), '清理后建议区块自动消失（不再吃紧）');
    s4.inventory.capacity = 200;
    s4.items = s4.items.filter((i) => !['独角测试草', '另一件杂物'].includes(i.名称));
    UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `行囊搜索/清理交互: ${e.message}`); }

"""
u = u.replace(anchor, uiblock + anchor)
io.open(UIS, 'w', encoding='utf-8', newline='\n').write(u)
print('test-ui-smoke.mjs patched')
