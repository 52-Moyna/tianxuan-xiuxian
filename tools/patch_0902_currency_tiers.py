# -*- coding: utf-8 -*-
"""修补：灵石分层消费口径统一。

背景：货币分 5 档（下/中/上/极/晶），1:100 递进。addStones/收入侧会重新分档，
导致「下品灵石」单档账面恒 < 100。而 life.js 的 spendStoneLike 与灵兽升星、
引泉升级只检查/扣减「下品灵石」这一档 —— 玩家身家百万仍处处判定「灵石不足」：
储物袋扩容（300+）、跨域旅行路费（80~180）、灵兽升星（200~3200）、
玉髓芝/月华露藤播种（120/240）全部实质不可用。

修法：全部改走与 systems.totalStones 同口径的分层扣款（先按总资产判定，再重新分档）。
另：把各处硬编码的 Math.pow(100, i) 换成 data.js 的 CURRENCY_RATE 常量，消除脱钩。
"""
import io
import sys

BASE = 'Z:/1/xiuxian/public/js/'


def patch(path, pairs):
    p = BASE + path
    with io.open(p, encoding='utf-8') as f:
        src = f.read()
    for old, new, cnt in pairs:
        n = src.count(old)
        if n != cnt:
            print('!! 匹配失败 %s 期望 %d 实得 %d' % (path, cnt, n))
            print('---snippet---')
            print(old[:200])
            sys.exit(1)
        src = src.replace(old, new)
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(src)
    print('OK', path)


# ---------------------------------------------------------------- life.js
LIFE_MONEY_FUNCS = """function spendStoneLike(state, amount) {
  const total = state.currencies['下品灵石'] || 0;
  if (total < amount) return false;
  state.currencies['下品灵石'] = total - amount;
  return true;
}"""

LIFE_MONEY_NEW = """/** 分层货币折算（下品灵石最小单位）——与 systems.totalStones 完全同口径。
 *  独立实现是为避免 life ↔ systems 循环依赖（systems 才是引用 life 的一方）。
 *
 *  【重要】绝不可只扣「下品灵石」单档：分档后该档恒 < CURRENCY_RATE，
 *  会导致玩家身家百万却处处判定「灵石不足」（旅行 / 扩容 / 升星 / 播种全线瘫痪）。
 */
export function lifeTotalStones(state) {
  return CURRENCIES.reduce((s, c, i) => s + (state.currencies?.[c] || 0) * Math.pow(CURRENCY_RATE, i), 0);
}
/** 按总量重新分档，保证账面各档永远正确 */
function lifeRedistribute(state, totalUnits) {
  let rest = Math.max(0, Math.round(totalUnits));
  for (let i = CURRENCIES.length - 1; i >= 0; i--) {
    const unit = Math.pow(CURRENCY_RATE, i);
    const c = Math.floor(rest / unit);
    state.currencies[CURRENCIES[i]] = c;
    rest -= c * unit;
  }
}
/** 能否支付（按总资产判定，不受单档账面影响） */
export function lifeCanAfford(state, amount) {
  return lifeTotalStones(state) >= amount;
}
/** 分层扣款：先按总资产判定，再整体重新分档 */
export function lifeSpendStones(state, amount) {
  if (!lifeCanAfford(state, amount)) return false;
  lifeRedistribute(state, lifeTotalStones(state) - Math.round(amount));
  return true;
}
/** 分层加款：同样重新分档，避免「5000 下品」这类未进位账面 */
export function lifeAddStones(state, amount) {
  lifeRedistribute(state, lifeTotalStones(state) + Math.max(0, Math.round(amount)));
}"""

LIFE_ALCHEMY_OLD = """/** 分层货币折算（下品灵石最小单位），与 systems.totalStones 同口径 */
function alchemyTotalStones(state) {
  return CURRENCIES.reduce((s, c, i) => s + (state.currencies?.[c] || 0) * Math.pow(100, i), 0);
}
function alchemyRedistribute(state, total) {
  let rest = Math.max(0, Math.round(total));
  for (let i = CURRENCIES.length - 1; i >= 0; i--) {
    const unit = Math.pow(100, i);
    const c = Math.floor(rest / unit);
    state.currencies[CURRENCIES[i]] = c;
    rest -= c * unit;
  }
}
function alchemyCanAfford(state, amt) { return alchemyTotalStones(state) >= amt; }
function alchemySpendStones(state, amt) {
  if (!alchemyCanAfford(state, amt)) return false;
  alchemyRedistribute(state, alchemyTotalStones(state) - Math.round(amt));
  return true;
}
function alchemyAddStones(state, amt) {
  alchemyRedistribute(state, alchemyTotalStones(state) + Math.max(0, Math.round(amt)));
}"""

LIFE_ALCHEMY_NEW = """/* 炼丹的扣款 / 退款统一复用文件顶部分层货币工具
 * （lifeCanAfford / lifeSpendStones / lifeAddStones），
 * 与 systems.totalStones 同口径，不再各自维护一份折算实现。 */"""

patch('life.js', [
    # 1) 导入常量
    ("HERB_HYBRIDS, HERB_HYBRID_COST } from './data.js';",
     "HERB_HYBRIDS, HERB_HYBRID_COST, CURRENCY_RATE } from './data.js';", 1),
    # 2) 单档扣款 → 分层扣款工具
    (LIFE_MONEY_FUNCS, LIFE_MONEY_NEW, 1),
    # 3) 五处调用点改名（扩容 / 路费 / 播种 / 浇灌 / 杂交）
    ('spendStoneLike(', 'lifeSpendStones(', 5),
    # 4) 引泉升级改分层
    ("""  if ((state.currencies?.['下品灵石'] || 0) < cost) {
    return { ok: false, logs: [`引泉需 ${cost} 下品灵石，灵石不足。`] };
  }
  state.currencies['下品灵石'] -= cost;""",
     """  if (!lifeCanAfford(state, cost)) {
    return { ok: false, logs: [`引泉需 ${cost} 下品灵石，灵石不足。`] };
  }
  lifeSpendStones(state, cost);""", 1),
    # 5) 删除炼丹私有折算副本
    (LIFE_ALCHEMY_OLD, LIFE_ALCHEMY_NEW, 1),
    # 6) 炼丹三处调用改用公共工具
    ('alchemyCanAfford(', 'lifeCanAfford(', 1),
    ('alchemySpendStones(', 'lifeSpendStones(', 1),
    ('alchemyAddStones(', 'lifeAddStones(', 1),
])

# ---------------------------------------------------------------- systems.js
patch('systems.js', [
    # 导入常量
    ("  CAVE_LEVELS, CURRENCIES, ARTS,",
     "  CAVE_LEVELS, CURRENCIES, CURRENCY_RATE, ARTS,", 1),
    # 硬编码档率 → 常量
    ('Math.pow(100, i)', 'Math.pow(CURRENCY_RATE, i)', 2),
    # 灵兽升星改分层
    ("""  if ((state.currencies?.['下品灵石'] || 0) < cost) return { ok: false, logs: [`升星需 ${cost} 下品灵石，灵石不足。`] };
  state.currencies['下品灵石'] -= cost;""",
     """  if (!canAfford(state, cost)) return { ok: false, logs: [`升星需 ${cost} 下品灵石，灵石不足。`] };
  spendStones(state, cost);""", 1),
])

# ---------------------------------------------------------------- codex.js
CODEX_TOTAL_OLD = """function totalStonesOf(s) {
  return CURRENCIES.reduce((sum, c, i) => sum + (s.currencies?.[c] || 0) * Math.pow(100, i), 0);
}"""

CODEX_TOTAL_NEW = """function totalStonesOf(s) {
  return CURRENCIES.reduce((sum, c, i) => sum + (s.currencies?.[c] || 0) * Math.pow(CURRENCY_RATE, i), 0);
}
/** 按总量重新分档（成就奖励发放后账面自动进位，避免出现「5000 下品」） */
function codexRedistribute(state, totalUnits) {
  let rest = Math.max(0, Math.round(totalUnits));
  for (let i = CURRENCIES.length - 1; i >= 0; i--) {
    const unit = Math.pow(CURRENCY_RATE, i);
    const c = Math.floor(rest / unit);
    state.currencies[CURRENCIES[i]] = c;
    rest -= c * unit;
  }
}
/** 分层发放灵石奖励 */
export function codexAddStones(state, amount) {
  state.currencies = state.currencies || {};
  codexRedistribute(state, totalStonesOf(state) + Math.max(0, Math.round(amount || 0)));
}"""

patch('codex.js', [
    ("import { EQUIP_GRADES, calcEquipPower, CURRENCIES } from './data.js';",
     "import { EQUIP_GRADES, calcEquipPower, CURRENCIES, CURRENCY_RATE } from './data.js';", 1),
    (CODEX_TOTAL_OLD, CODEX_TOTAL_NEW, 1),
    ("  state.currencies['下品灵石'] = (state.currencies['下品灵石'] || 0) + (rw.stones || 0);",
     "  codexAddStones(state, rw.stones || 0);", 2),
])

# ---------------------------------------------------------------- ui.js
patch('ui.js', [
    # 杂交按钮可用性：结算已走分层，UI 判定必须同口径
    ("const can = ca >= 1 && cb >= 1 && (st.currencies['下品灵石'] || 0) >= D.HERB_HYBRID_COST;",
     "const can = ca >= 1 && cb >= 1 && S.canAfford(st, D.HERB_HYBRID_COST);", 1),
    # 灵兽升星按钮可用性
    ("const canAfford = (st.currencies?.['下品灵石'] || 0) >= starCost;",
     "const canAfford = S.canAfford(st, starCost);", 1),
])

print('全部替换完成')
