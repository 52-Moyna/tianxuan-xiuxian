# -*- coding: utf-8 -*-
# 套装加成 UI 接线：地图/地域面板显示折后真实路费；修正 codex 妖纹 3 件文案笔误
import io, sys

def rw(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new, tag in pairs:
        if s.count(old) != 1:
            print('!! 锚点异常(%d): %s' % (s.count(old), tag)); sys.exit(1)
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('OK ' + path)

U = []
U.append((
"import { ensureLifeState, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, relationBenefit, relationIndex, startTravel,",
"import { ensureLifeState, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, relationBenefit, relationIndex, startTravel, travelCost,",
 'ui.import travelCost'))

U.append((
"""      <div class="route-list">${routes.map((r) => `<button class="route-row" data-region="${r.id}"><span>${names[r.id]}</span><small>${r.specialty} · 路费约${r.cost}灵石 · ${r.months}个月</small></button>`).join('')}</div>""",
"""      <div class="route-list">${routes.map((r) => {
        const q = travelCost(st, r.id);
        const off = q.cost < q.base ? `<em class="route-off">原价${q.base}</em>` : '';
        return `<button class="route-row" data-region="${r.id}"><span>${names[r.id]}</span><small>${r.specialty} · 路费${q.cost}灵石${off ? ' ' : ''}${off} · ${r.months}个月</small></button>`;
      }).join('')}</div>""",
 'ui.flowMap 路费'))

U.append((
"""                ? `<button class="btn btn-sm btn-gold" data-go="${r.id}">前往（${t.cost}灵石·${t.months}月）</button>`""",
"""                ? `<button class="btn btn-sm btn-gold" data-go="${r.id}" title="${(() => { const q = travelCost(st, r.id); return q.cost < q.base ? `原价 ${q.base} 灵石，已享减免 → ${q.cost}` : `路费 ${q.cost} 灵石`; })()}">前往（${travelCost(st, r.id).cost}灵石·${t.months}月）</button>`""",
 'ui.region 前往按钮'))

rw('public/js/ui.js', U)
rw('public/js/codex.js', [(
    "    text3: '妖纹大成（2件）：在妖域探索时更容易发现珍稀材料。',",
    "    text3: '妖纹大成（3件）：战力再 +5，妖域探索更易寻得珍稀「仙缘」（掉落上限 15%→30%）。',",
    'codex.妖纹 text3 笔误与效果说明'),
])
