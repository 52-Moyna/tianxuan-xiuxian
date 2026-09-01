# -*- coding: utf-8 -*-
"""天玄修仙录 · 补丁：拍卖落槌前的储物袋预检

非「装备/法宝/功法」类拍品成交后走 storeItem 入袋；储物袋满载时
storeItem 返回 false，玩家已付出灵石却一无所获（静默丢失）。
本补丁在扣款前做容量预检，不足则拒绝成交并给出可行动提示。
"""
import io, sys

P = r"Z:/1/xiuxian/public/js/systems.js"
src = io.open(P, encoding="utf-8").read()
orig = src
changed = []

# ---------- A. 一口价：扣款前预检 ----------
A_OLD = """  if (!canAfford(state, amount)) return { ok: false, logs: [`灵石不足（一口价需 ${amount}）。`] };
  spendStones(state, amount);
  awardAuctionItem(state, item, amount);
"""
A_NEW = """  if (!canAfford(state, amount)) return { ok: false, logs: [`灵石不足（一口价需 ${amount}）。`] };
  const bagBlock = auctionBagBlockReason(state, item);
  if (bagBlock) return { ok: false, logs: [bagBlock] };
  spendStones(state, amount);
  awardAuctionItem(state, item, amount);
"""
assert src.count(A_OLD) == 1, "A: 未唯一匹配 buyoutAuction 片段"
src = src.replace(A_OLD, A_NEW)
changed.append("buyoutAuction 落槌前容量预检")

# ---------- B. 竞价落槌：扣款前预检 ----------
B_OLD = """  // 对手放弃 → 你以当前出价落槌
  spendStones(state, amount);
  awardAuctionItem(state, item, amount);
"""
B_NEW = """  // 对手放弃 → 你以当前出价落槌
  const bagBlock2 = auctionBagBlockReason(state, item);
  if (bagBlock2) return { ok: false, logs: [bagBlock2] };
  spendStones(state, amount);
  awardAuctionItem(state, item, amount);
"""
assert src.count(B_OLD) == 1, "B: 未唯一匹配 placeBid 落槌片段"
src = src.replace(B_OLD, B_NEW)
changed.append("placeBid 落槌前容量预检")

# ---------- C. 新增预检纯函数（置于 awardAuctionItem 之前） ----------
C_ANCHOR = """/** 拍卖成交后的统一发放（按类型生成对应物品） */
function awardAuctionItem(state, item, amount) {
"""
C_ADD = """/**
 * 拍卖落槌前的储物袋预检：装备/法宝入装备库、功法入功法栏，皆不受行囊格位限制；
 * 其余拍品（丹药/材料/道具等）需占用储物袋格位，容量不足时返回拒绝理由
 * （调用方须在扣灵石前拦截），避免「付款成功却因满仓被静默丢弃」。
 * 纯函数、确定性、不改动状态。
 */
export function auctionBagBlockReason(state, item) {
  if (!item) return null;
  if (item.type === '装备' || item.type === '法宝' || item.type === '功法') return null;
  const probe = { 名称: item.name, 类型: item.type || '杂物', 数量: 1 };
  if (canStore(state, probe)) return null;
  return `储物袋空间不足，「${item.name}」无处安放，请先出售杂物或扩容储物袋再行竞价。`;
}

""" + C_ANCHOR
assert src.count(C_ANCHOR) == 1, "C: 未唯一匹配 awardAuctionItem 锚点"
src = src.replace(C_ANCHOR, C_ADD)
changed.append("新增 auctionBagBlockReason 预检函数")

if src != orig:
    io.open(P, "w", encoding="utf-8").write(src)
    print("systems.js 已更新：")
    for c in changed:
        print("  -", c)
else:
    print("无改动")
    sys.exit(1)
