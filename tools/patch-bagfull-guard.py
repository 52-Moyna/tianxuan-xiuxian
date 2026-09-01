# -*- coding: utf-8 -*-
"""天玄修仙录 · 补丁：储物袋满仓导致产出静默丢失（P1）

三处「先扣代价、后 storeItem」的写法在储物袋满载时会静默丢弃产出，
玩家白白损失灵石/材料/数月生长，且日志仍谎称成功。本补丁改为
「产物先入袋成功 → 再扣代价」，满仓时无损拒绝并给出可行动提示。

同时新增 irrigateAllHerbs（灵草园一键浇灌 QoL）。
"""
import io, sys

P = r"Z:/1/xiuxian/public/js/life.js"
src = io.open(P, encoding="utf-8").read()
orig = src
changed = []

# ---------- A. harvestHerb：满仓时保留灵草、拒绝收获 ----------
A_OLD = """  const def = HERB_TYPES.find((d) => d.id === h.id);
  if (!def) return { ok: false, logs: ['未知灵草种子，无法收获。'] };
  state.cave.garden.splice(idx, 1);
  if (def.yield) {
    const q = herbQuality(state);
    const baseQty = def.yield.数量 || 1;
    const qualityQty = Math.max(1, Math.round(baseQty * q.mul));
    const irriBonus = Math.min(h.irrigated || 0, HERB_IRRIGATE_YIELD_CAP);
    const qty = qualityQty + irriBonus;
    storeItem(state, { ...def.yield, 数量: qty });
"""
A_NEW = """  const def = HERB_TYPES.find((d) => d.id === h.id);
  if (!def) return { ok: false, logs: ['未知灵草种子，无法收获。'] };
  if (def.yield) {
    const q = herbQuality(state);
    const baseQty = def.yield.数量 || 1;
    const qualityQty = Math.max(1, Math.round(baseQty * q.mul));
    const irriBonus = Math.min(h.irrigated || 0, HERB_IRRIGATE_YIELD_CAP);
    const qty = qualityQty + irriBonus;
    const outItem = { ...def.yield, 数量: qty };
    // 满仓保护：产物先入袋，成功才移除灵草。
    // 旧写法先 splice 灵草再 storeItem，储物袋满时产出被静默丢弃 —— 玩家白白
    // 损失播种灵石、浇灌灵石与数月生长，日志却仍写「已收入储物袋」。
    if (!canStore(state, outItem)) {
      return { ok: false, logs: [`储物袋空间不足，「${def.yield.名称}」×${qty} 无处安放；灵草仍留在灵田，请先出售杂物或扩容储物袋。`] };
    }
    storeItem(state, outItem);
    state.cave.garden.splice(idx, 1);
"""
assert src.count(A_OLD) == 1, "A: 未唯一匹配 harvestHerb 片段"
src = src.replace(A_OLD, A_NEW)
changed.append("harvestHerb 满仓保护")

# ---------- A2. harvestHerb 无产出分支：补 splice ----------
A2_OLD = """    return { ok: true, logs: [`你采得「${def.yield.名称}」×${qty}${tag}，已收入储物袋。`, ...notes] };
  }
  return { ok: true, logs: [`「${h.name}」已收获，但灵种异变，未见产出。`] };
"""
A2_NEW = """      return { ok: true, logs: [`你采得「${def.yield.名称}」×${qty}${tag}，已收入储物袋。`, ...notes] };
  }
  state.cave.garden.splice(idx, 1);
  return { ok: true, logs: [`「${h.name}」已收获，但灵种异变，未见产出。`] };
"""
assert src.count(A2_OLD) == 1, "A2: 未唯一匹配 harvestHerb 无产出分支"
src = src.replace(A2_OLD, A2_NEW)
changed.append("harvestHerb 无产出分支补 splice")

# ---------- B. crossbreedHerbs：满仓时拒绝（不扣灵石与材料） ----------
B_OLD = """  if (!spendStoneLike(state, HERB_HYBRID_COST)) return { ok: false, logs: [`灵石不足（需 ${HERB_HYBRID_COST}）。`] };
  itemA.数量 -= 1; if (itemA.数量 <= 0) state.items.splice(state.items.indexOf(itemA), 1);
  itemB.数量 -= 1; if (itemB.数量 <= 0) state.items.splice(state.items.indexOf(itemB), 1);
  storeItem(state, { ...def.out });
"""
B_NEW = """  const outItem = { ...def.out };
  // 满仓保护：先确认奇珍灵材有处安放，再扣灵石与材料。
  // 旧写法先扣代价再 storeItem，储物袋满时玩家损失灵石 + 两份灵草产物却一无所获。
  if (!canStore(state, outItem)) {
    return { ok: false, logs: ['储物袋空间不足，奇珍灵材无处安放；请先出售杂物或扩容储物袋再行杂交。'] };
  }
  if (!spendStoneLike(state, HERB_HYBRID_COST)) return { ok: false, logs: [`灵石不足（需 ${HERB_HYBRID_COST}）。`] };
  storeItem(state, outItem);
  itemA.数量 -= 1; if (itemA.数量 <= 0) state.items.splice(state.items.indexOf(itemA), 1);
  itemB.数量 -= 1; if (itemB.数量 <= 0) state.items.splice(state.items.indexOf(itemB), 1);
"""
assert src.count(B_OLD) == 1, "B: 未唯一匹配 crossbreedHerbs 片段"
src = src.replace(B_OLD, B_NEW)
changed.append("crossbreedHerbs 满仓保护")

# ---------- C. irrigateAllHerbs：灵草园一键浇灌 ----------
C_ANCHOR = """  const mature = h.progress >= h.grow;
  return { ok: true, logs: [`你引灵泉浇灌「${h.name}」，灵草生长 +1 月（${h.progress}/${h.grow} 月）${mature ? '，现已可收获！' : ''}。`, `耗灵石 ${HERB_IRRIGATE_COST}（本月已浇灌 ${h.irrigatedThisMonth}/${HERB_IRRIGATE_CAP_PER_MONTH} 次）。`] };
}
"""
C_ADD = C_ANCHOR + """
/**
 * 灵草园「一键浇灌」：本月内对所有仍可浇灌的未熟灵草各浇灌 1 次，
 * 优先浇灌最接近成熟的（灵石优先换来「当下即可收获」的收益），
 * 直至灵石不足或无株可浇。等价于逐个调用 irrigateHerb，确定性、无 RNG。
 * 返回 { ok, count, spent, logs }。
 */
export function irrigateAllHerbs(state) {
  ensureLifeState(state);
  const garden = state.cave.garden || [];
  const order = [];
  for (let i = 0; i < garden.length; i++) {
    const h = garden[i];
    if (!h || h.progress >= h.grow) continue;
    if ((h.irrigatedThisMonth || 0) >= HERB_IRRIGATE_CAP_PER_MONTH) continue;
    order.push(i);
  }
  if (!order.length) {
    return { ok: false, count: 0, spent: 0, logs: ['灵草园中没有可浇灌的灵草（均已成熟或本月浇灌已达上限）。'] };
  }
  order.sort((a, b) => (garden[a].grow - garden[a].progress) - (garden[b].grow - garden[b].progress));
  let count = 0;
  let spent = 0;
  const logs = [];
  for (const idx of order) {
    const r = irrigateHerb(state, idx);
    if (!r.ok) { if (r.logs && r.logs[0]) logs.push(r.logs[0]); break; }
    count += 1;
    spent += HERB_IRRIGATE_COST;
    logs.push(...(r.logs || []));
  }
  if (!count) return { ok: false, count: 0, spent: 0, logs };
  return { ok: true, count, spent, logs: [`你引灵泉遍洒灵田，共浇灌 ${count} 株灵草（耗灵石 ${spent}）。`, ...logs] };
}
"""
assert src.count(C_ANCHOR) == 1, "C: 未唯一匹配 irrigateHerb 结尾"
src = src.replace(C_ANCHOR, C_ADD)
changed.append("新增 irrigateAllHerbs（一键浇灌）")

if src != orig:
    io.open(P, "w", encoding="utf-8").write(src)
    print("life.js 已更新：")
    for c in changed:
        print("  -", c)
else:
    print("无改动")
    sys.exit(1)
