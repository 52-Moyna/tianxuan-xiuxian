# -*- coding: utf-8 -*-
"""聚灵阵联动灵草园 + 灵草成熟预估可视化"""
import io, sys, re

BASE = 'Z:/1/xiuxian/public/js/'

def rd(p):
    with io.open(BASE + p, 'r', encoding='utf-8') as f:
        return f.read()

def wr(p, s):
    with io.open(BASE + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(src, old, new, tag):
    if old not in src:
        print('MISS: ' + tag)
        sys.exit(1)
    if src.count(old) != 1:
        print('DUP(%d): %s' % (src.count(old), tag))
        sys.exit(1)
    print('OK: ' + tag)
    return src.replace(old, new)

# ---------------- life.js ----------------
life = rd('life.js')

life = rep(life,
"export const ARRAY_UPGRADE_BASE = 300;     // 布设第 k 重费用 = ARRAY_UPGRADE_BASE × k（k 从 1 起）",
"""export const ARRAY_UPGRADE_BASE = 300;     // 布设第 k 重费用 = ARRAY_UPGRADE_BASE × k（k 从 1 起）
/** 聚灵阵对灵草园的灵气增益：每 ARRAY_GROWTH_EVERY 重令灵草月度自然生长额外 +1 月（确定性，无 RNG） */
export const ARRAY_GROWTH_EVERY = 2;   // 每 2 重 +1 月生长
export const ARRAY_GROWTH_MAX = 2;     // 最高 +2 月生长（5 重阵可达）""",
'life: 新增 ARRAY_GROWTH 常量')

life = rep(life,
"""/** 月度生长：所有灵草进度 +1（于 settleMonth 调用）；同时重置本月浇灌额度 */
export function growHerbs(state) {
  ensureLifeState(state);
  const spring = herbSpringBonus(state);
  for (const h of state.cave.garden) {
    if (h.progress < h.grow) h.progress += 1 + omenAdd(state, 'garden') + spring;
    h.irrigatedThisMonth = 0;
  }
}""",
"""/**
 * 灵草园「每月自然生长月数」的唯一事实来源：基础 1 月 + 天机运势 + 灵泉涌动 + 聚灵阵灵气。
 * growHerbs（真实结算）与洞府面板的成熟预估（UI）共用此函数，避免口径漂移。确定性、无 RNG。
 */
export function herbMonthlyGrowth(state) {
  return 1 + omenAdd(state, 'garden') + herbSpringBonus(state) + herbArrayGrowth(state);
}
/**
 * 聚灵阵带来的灵草额外月生长：每 ARRAY_GROWTH_EVERY 重 +1 月，封顶 ARRAY_GROWTH_MAX 月。
 * 与引泉（每重 +1 月）互补：聚灵阵主收益仍是修炼与丹炉，灵草只是其复合增益的一翼。
 */
export function herbArrayGrowth(state) {
  const lv = state?.cave?.arrayLevel || 0;
  return Math.min(Math.floor(lv / ARRAY_GROWTH_EVERY), ARRAY_GROWTH_MAX);
}

/** 月度生长：所有灵草进度按 herbMonthlyGrowth 推进（于 settleMonth 调用）；同时重置本月浇灌额度 */
export function growHerbs(state) {
  ensureLifeState(state);
  const step = herbMonthlyGrowth(state);
  for (const h of state.cave.garden) {
    if (h.progress < h.grow) h.progress += step;
    h.irrigatedThisMonth = 0;
  }
}""",
'life: herbMonthlyGrowth + growHerbs 复用')

wr('life.js', life)

# ---------------- systems.js ----------------
sysjs = rd('systems.js')

sysjs = rep(sysjs,
"ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, ARRAY_UPGRADE_BASE,",
"ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, ARRAY_UPGRADE_BASE, ARRAY_GROWTH_EVERY, ARRAY_GROWTH_MAX, herbArrayGrowth, herbMonthlyGrowth,",
'systems: import 补齐')

sysjs = rep(sysjs,
"""desc: `花费灵石${ARRAY_UPGRADE_BASE * (cur + 1)}，修炼效率与丹炉成丹率各永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%/重（最高 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100 * ARRAY_MAX_LEVEL)}%，与洞府加成、聚灵阵旗叠加）。`""",
"""desc: `花费灵石${ARRAY_UPGRADE_BASE * (cur + 1)}，修炼效率与丹炉成丹率各永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%/重（最高 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100 * ARRAY_MAX_LEVEL)}%，与洞府加成、聚灵阵旗叠加）；每 ${ARRAY_GROWTH_EVERY} 重另令灵草月生长 +1 月（最高 +${ARRAY_GROWTH_MAX} 月）。`""",
'systems: 罗盘聚灵阵描述')

sysjs = rep(sysjs,
"""          logs.push(`聚灵阵布设至第 ${state.cave.arrayLevel} 重！修炼效率与丹炉成丹率各永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%/重（现各合计 +${Math.round(state.cave.arrayLevel * ARRAY_BONUS_PER_LEVEL * 100)}%）。`);""",
"""          const g = herbMonthlyGrowth(state);
          const gTxt = herbArrayGrowth(state) > 0 ? `；灵草每月自然生长 +${herbArrayGrowth(state)} 月（现合计 ${g} 月/月）` : '';
          logs.push(`聚灵阵布设至第 ${state.cave.arrayLevel} 重！修炼效率与丹炉成丹率各永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%/重（现各合计 +${Math.round(state.cave.arrayLevel * ARRAY_BONUS_PER_LEVEL * 100)}%）${gTxt}。`);""",
'systems: 升级日志补灵草')

wr('systems.js', sysjs)

# ---------------- ui.js ----------------
ui = rd('ui.js')

ui = rep(ui,
"HERB_IRRIGATE_YIELD_CAP, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL,",
"HERB_IRRIGATE_YIELD_CAP, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, herbMonthlyGrowth, herbArrayGrowth,",
'ui: import 补齐')

ui = rep(ui,
"""        <div class="side-subtitle">灵草园 · ${garden.length}/${gardenCapacity(st)} 株${herbSpringBonus(st) > 0 ? ` · 💧灵泉涌动（引泉 ${st.cave?.springLevel || 0} 重）` : ''}</div>""",
"""        <div class="side-subtitle">灵草园 · ${garden.length}/${gardenCapacity(st)} 株${herbSpringBonus(st) > 0 ? ` · 💧灵泉涌动（引泉 ${st.cave?.springLevel || 0} 重）` : ''} · 每月生长 ${herbMonthlyGrowth(st)} 月${herbArrayGrowth(st) > 0 ? `（含🔯聚灵阵 +${herbArrayGrowth(st)}）` : ''}</div>""",
'ui: 灵草园标题补月生长')

ui = rep(ui,
"""            <div class="herb-grow"><i style="width:${Math.min(100, Math.round(h.progress / h.grow * 100))}%"></i><span>${h.progress}/${h.grow} 月${mature ? ' · 可收获' : (atCap ? ' · 本月浇灌已满' : '')}</span></div>""",
"""            <div class="herb-grow"><i style="width:${Math.min(100, Math.round(h.progress / h.grow * 100))}%"></i><span>${h.progress}/${h.grow} 月${mature ? ' · 可收获' : ` · 约 ${Math.max(1, Math.ceil((h.grow - h.progress) / Math.max(1, herbMonthlyGrowth(st))))} 月后熟`}${(atCap && !mature) ? ' · 本月浇灌已满' : ''}</span></div>""",
'ui: 每株成熟预估')

wr('ui.js', ui)

print('ALL DONE')
