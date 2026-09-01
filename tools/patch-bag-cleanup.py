# -*- coding: utf-8 -*-
"""行囊清理闭环 + 入袋提示收尾（2026-09-01 20:00 轮次）
1) systems.js 月华露满仓静默丢失 → 补 else 提示（入袋审计收尾）
2) systems.js 抽出 itemSellPrice 唯一计价口径，供卖单件 / 按类型批量 / 按索引批量三处复用
3) systems.js 新增 lowValueSuggestions（满仓建议清理清单）与 sellItemsByIndex（按索引批量出售）
无 RNG 行为变更：单件与批量出售的 Rng 调用次数保持原样，不破坏既有随机序列断言。
"""
import io
import sys

BASE = 'Z:/1/xiuxian/public/js/'
p = BASE + 'systems.js'
s = io.open(p, encoding='utf-8').read()
orig = s

# --- 1) 月华露满仓提示（此前满仓时整条奇遇静默无提示） ---
old = "        if (storeItem(state, rare)) logs.push('草丛中竟藏着一滴泛着月华的露珠——「月华露」！');\n"
new = old + "        else logs.push('草丛中竟藏着一滴「月华露」，储物袋已满，只能眼睁睁看它蒸散在晨光里。');\n"
assert s.count(old) == 1, '月华露锚点异常'
s = s.replace(old, new)

# --- 2) itemSpace 导入（新增两函数要用） ---
old_imp = "inventoryUsed, normalizeEquip,"
assert s.count(old_imp) == 1, 'import 锚点异常'
s = s.replace(old_imp, "inventoryUsed, itemSpace, normalizeEquip,")

# --- 3) 抽出 itemSellPrice + 重构 sellItem ---
old_sell = """export function sellItem(state, idx) {
  ensureLifeState(state);
  const it = state.items[idx];
  if (!it) return '物品不存在。';
  if (it.类型 === '容器') return '当前储物袋正在使用，不能直接出售。';
  const regionalBonus = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(it.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;
  const newsMul = newsPriceMul(state, it);
  const base = it.价值 || (it.类型 === '材料' ? 35 : 15);
  const price = Math.max(1, Math.round(base * (it.数量 || 1) * regionalBonus * newsMul * Rng.float(0.92, 1.08) * omenMul(state, 'trade')));
  addStones(state, price);
  state.items.splice(idx, 1);
  ensureLifeState(state);
  const fluct = newsMul > 1 ? '（行情看涨，价格上扬）' : newsMul < 1 ? '（行情低迷，价格走低）' : '';
  addLog(state, '操作', `坊市售出「${it.名称}」，得灵石${price}。${fluct}`);
  return `售出「${it.名称}」，得灵石${price}。${fluct}`;
}"""
assert s.count(old_sell) == 1, 'sellItem 锚点异常'

new_sell = """/** 坊市出售价（唯一计价口径）：地域特产 1.25x · 行情 newsMul · 交易运势 omenMul，
 *  另含 ±8% 随机浮动（withFluct=false 时不消耗 RNG，供 UI 预估价展示，避免渲染污染随机序列）。
 *  sellItem / sellItems / sellItemsByIndex 三处共用，杜绝「同一件物品不同入口报价不一致」。 */
export function itemSellPrice(state, item, withFluct = true) {
  const regionalBonus = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(item.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;
  const newsMul = newsPriceMul(state, item);
  const base = item.价值 || (item.类型 === '材料' ? 35 : 15);
  const fluct = withFluct ? Rng.float(0.92, 1.08) : 1;
  return Math.max(1, Math.round(base * (item.数量 || 1) * regionalBonus * newsMul * fluct * omenMul(state, 'trade')));
}
/** 行情播报文案（看涨 / 低迷），与 itemSellPrice 同口径取 newsPriceMul。 */
export function priceFluctNote(state, item) {
  const m = newsPriceMul(state, item);
  return m > 1 ? '（行情看涨，价格上扬）' : m < 1 ? '（行情低迷，价格走低）' : '';
}

export function sellItem(state, idx) {
  ensureLifeState(state);
  const it = state.items[idx];
  if (!it) return '物品不存在。';
  if (it.类型 === '容器') return '当前储物袋正在使用，不能直接出售。';
  const fluct = priceFluctNote(state, it);
  const price = itemSellPrice(state, it);
  addStones(state, price);
  state.items.splice(idx, 1);
  ensureLifeState(state);
  addLog(state, '操作', `坊市售出「${it.名称}」，得灵石${price}。${fluct}`);
  return `售出「${it.名称}」，得灵石${price}。${fluct}`;
}"""
s = s.replace(old_sell, new_sell)

# --- 4) 重构 sellItems 循环 + 追加 sellItemsByIndex / lowValueSuggestions ---
old_batch = """  for (const { i } of targets.slice().reverse()) {
    const it = state.items[i];
    if (!it) continue;
    const regionalBonus = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(it.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;
    const newsMul = newsPriceMul(state, it);
    const base = it.价值 || (it.类型 === '材料' ? 35 : 15);
    const price = Math.max(1, Math.round(base * (it.数量 || 1) * regionalBonus * newsMul * Rng.float(0.92, 1.08) * omenMul(state, 'trade')));
    addStones(state, price);
    stones += price;
    names.push(it.名称);
    state.items.splice(i, 1);
  }
  ensureLifeState(state);
  addLog(state, '操作', `坊市批量售出 ${targets.length} 件物品，共得灵石${stones}。`);
  return { count: targets.length, stones, names };
}"""
assert s.count(old_batch) == 1, 'sellItems 锚点异常'

new_batch = """  for (const { i } of targets.slice().reverse()) {
    const it = state.items[i];
    if (!it) continue;
    const price = itemSellPrice(state, it);
    addStones(state, price);
    stones += price;
    names.push(it.名称);
    state.items.splice(i, 1);
  }
  ensureLifeState(state);
  addLog(state, '操作', `坊市批量售出 ${targets.length} 件物品，共得灵石${stones}。`);
  return { count: targets.length, stones, names };
}
/** 按索引批量出售：供「满仓建议清理」等由 UI 指定具体物品的场合使用，
 *  相比按类型批量（sellItems）更精准，不会误卖同类材料里的珍贵品。
 *  索引从大到小删除避免 splice 偏移；在用容器（当前储物袋）自动跳过。
 *  返回 {count, stones, names, space}（space = 腾出的格位数）。 */
export function sellItemsByIndex(state, indexes) {
  ensureLifeState(state);
  const idxs = [...new Set((indexes || []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < state.items.length))]
    .sort((a, b) => b - a);
  let stones = 0;
  let space = 0;
  const names = [];
  for (const i of idxs) {
    const it = state.items[i];
    if (!it || it.类型 === '容器') continue;
    const price = itemSellPrice(state, it);
    addStones(state, price);
    stones += price;
    space += itemSpace(it) * Math.max(1, Number(it.数量) || 1);
    names.push(it.名称);
    state.items.splice(i, 1);
  }
  ensureLifeState(state);
  if (names.length) addLog(state, '操作', `坊市售出 ${names.length} 件指定物品，共得灵石${stones}。`);
  return { count: names.length, stones, names, space };
}
/** 满仓「建议清理」清单：按「每格能卖多少灵石」升序挑出最该处理的 n 件。
 *  无 RNG（用 withFluct=false 的确定性估价），可在 UI 渲染期安全调用而不污染随机序列。
 *  返回 [{idx, name, qty, price, space, perSlot}]，perSlot 越低越值得卖。 */
export function lowValueSuggestions(state, n = 5) {
  ensureLifeState(state);
  const rows = [];
  (state.items || []).forEach((it, idx) => {
    if (!it || it.类型 === '容器') return;
    const qty = Math.max(1, Number(it.数量) || 1);
    const space = itemSpace(it) * qty;
    const price = itemSellPrice(state, it, false);
    rows.push({ idx, name: it.名称, qty, price, space, perSlot: space > 0 ? price / space : price });
  });
  return rows.sort((a, b) => a.perSlot - b.perSlot || a.price - b.price).slice(0, Math.max(1, n));
}"""
s = s.replace(old_batch, new_batch)

if s != orig:
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('systems.js patched')
else:
    print('systems.js UNCHANGED')
    sys.exit(1)
