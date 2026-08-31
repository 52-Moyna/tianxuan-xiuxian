# -*- coding: utf-8 -*-
# 落实套装效果死字段（阶段一）：travelDiscount / artifactPower / breakthrough
import io, sys

def rw(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new, tag in pairs:
        if s.count(old) != 1:
            print('!! 锚点异常(%d): %s' % (s.count(old), tag)); sys.exit(1)
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('OK ' + path)

L_OLD1 = 'export function startTravel(state, regionId) {'
L_NEW1 = """/**
 * 跨域旅行路费口径（纯函数，唯一真源）——供 startTravel 结算与地图面板预览共用。
 * 结算顺序：地域基准路费 → 海行套装折扣（travelDiscount，持久生效、不消耗）→ 旅行凭证减免（消耗一张）。
 * @returns {{base:number, setDiscount:number, voucher:object|null, cost:number}}
 */
export function travelCost(state, regionId) {
  const target = REGION_TRAVEL[regionId];
  if (!target) return { base: 0, setDiscount: 0, voucher: null, cost: 0 };
  const setDiscount = Number(setBonusFlags(state).travelDiscount || 0);
  let cost = Math.max(0, Math.round(target.cost * (1 - setDiscount)));
  const voucher = (state.items || []).find((i) => i.effect && i.effect.travel) || null;
  if (voucher) cost = Math.max(0, Math.round(cost * (1 - (voucher.effect.travel || 0) / 100)));
  return { base: target.cost, setDiscount, voucher, cost };
}

export function startTravel(state, regionId) {"""
L_OLD2 = """  // 跨域旅行凭证：持有时本次路费减半（单张消耗），使「远航凭证/旅行凭证」成为真实可用道具
  let cost = target.cost;
  const voucher = state.items.find((i) => i.effect && i.effect.travel);
  let usedVoucher = null;
  if (voucher) {
    cost = Math.max(0, Math.round(target.cost * (1 - (voucher.effect.travel || 0) / 100)));
    usedVoucher = voucher;
  }
"""
L_NEW2 = """  // 路费统一走 travelCost（海行套装折扣 + 旅行凭证减免），避免结算与预览两套口径漂移
  const quote = travelCost(state, regionId);
  const cost = quote.cost;
  const usedVoucher = quote.voucher;
"""
L_OLD3 = "  const tail = usedVoucher ? `（使用「${usedVoucher.名称}」，路费减半）` : '';"
L_NEW3 = """  const tailParts = [];
  if (quote.setDiscount > 0) tailParts.push(`海行套装省${Math.round(quote.setDiscount * 100)}%`);
  if (usedVoucher) tailParts.push(`使用「${usedVoucher.名称}」`);
  const tail = tailParts.length ? `（${tailParts.join('，')}：路费 ${quote.base}→${cost}）` : '';"""

rw('public/js/life.js', [
    (L_OLD1, L_NEW1, 'life.travelCost 插入'),
    (L_OLD2, L_NEW2, 'life.startTravel 路费口径'),
    (L_OLD3, L_NEW3, 'life.startTravel 提示文案'),
])
