# -*- coding: utf-8 -*-
"""本轮打磨补丁：
1) ui.js：接线 travelOptions（去掉 UI 里手写的邻接推导，避免与结算口径分叉）
2) ui.js：地图/旅行入口灵石不足时禁用按钮并明示缺口
3) ui.js：删除死导入 upgradeBag（UI 从不调用，坊市走 buyItem）
4) life.js：nextBagGrade 改为「取第一个门槛高于当前容量的品级」，更稳
5) main.css：新增 .route-row-poor 样式
"""
import io, re, sys

ROOT = 'Z:/1/xiuxian/'
def rw(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()
def ww(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

ok = []

# ---------- 1) ui.js ----------
p = ROOT + 'public/js/ui.js'
s = rw(p)

# 1a 删除死导入 upgradeBag
old_imp = "startTravel, travelCost, travelOptions, bagGradeInfo, nextBagGrade, upgradeBag, craftRecipe,"
new_imp = "startTravel, travelCost, travelOptions, bagGradeInfo, nextBagGrade, craftRecipe,"
if old_imp in s:
    s = s.replace(old_imp, new_imp, 1)
    ok.append('ui.js: 删除死导入 upgradeBag')
else:
    print('!! 未匹配导入行'); sys.exit(1)

# 1b flowMap 路线改用 travelOptions
old = "  const routes = current.neighbors.map((id) => ({ id, ...REGION_TRAVEL[id] }));"
new = "  // 邻接路线统一取自 travelOptions（唯一真源），避免 UI 与 startTravel 各写一份邻接推导而分叉\n  const routes = travelOptions(st);"
if old in s:
    s = s.replace(old, new, 1)
    ok.append('ui.js flowMap: 路线改用 travelOptions')
else:
    print('!! 未匹配 flowMap routes'); sys.exit(1)

# 1c flowMap 灵石不足禁用
old = """      <div class="route-list">${routes.map((r) => {
        const q = travelCost(st, r.id);
        const off = q.cost < q.base ? `<em class="route-off">原价${q.base}</em>` : '';
        return `<button class="route-row" data-region="${r.id}"><span>${names[r.id]}</span><small>${r.specialty} · 路费${q.cost}灵石${off ? ' ' : ''}${off} · ${r.months}个月</small></button>`;
      }).join('')}</div>"""
new = """      <div class="route-list">${routes.map((r) => {
        const q = travelCost(st, r.id);
        const off = q.cost < q.base ? `<em class="route-off">原价${q.base}</em>` : '';
        const poor = S.totalStones(st) < q.cost;
        return poor
          ? `<div class="route-row route-row-poor" title="灵石不足，尚缺 ${q.cost - S.totalStones(st)}"><span>${names[r.id]}</span><small>${r.specialty} · 灵石不足（需 ${q.cost}）${off}</small></div>`
          : `<button class="route-row" data-region="${r.id}"><span>${names[r.id]}</span><small>${r.specialty} · 路费${q.cost}灵石 ${off} · ${r.months}个月</small></button>`;
      }).join('')}</div>"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('ui.js flowMap: 灵石不足路线置灰并明示缺口')
else:
    print('!! 未匹配 flowMap route-list'); sys.exit(1)

# 1d 地图面板邻接集合改用 travelOptions
old = """    const cards = regionDefs.map((r) => {
      const t = REGION_TRAVEL[r.id] || {};
      const isCur = r.id === curId;
      const isNeighbor = (cur.neighbors || []).includes(r.id);"""
new = """    // 可直达的邻接地域集合统一取自 travelOptions（与 flowMap / startTravel 同口径）
    const neighborIds = new Set(travelOptions(st).map((o) => o.id));
    const cards = regionDefs.map((r) => {
      const t = REGION_TRAVEL[r.id] || {};
      const isCur = r.id === curId;
      const isNeighbor = neighborIds.has(r.id);"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('ui.js 地图: 邻接判定改用 travelOptions')
else:
    print('!! 未匹配地图 cards'); sys.exit(1)

# 1e 地图卡片按钮灵石不足禁用
old = """                ? `<button class="btn btn-sm btn-gold" data-go="${r.id}" title="${(() => { const q = travelCost(st, r.id); return q.cost < q.base ? `原价 ${q.base} 灵石，已享减免 → ${q.cost}` : `路费 ${q.cost} 灵石`; })()}">前往（${travelCost(st, r.id).cost}灵石·${t.months}月）</button>`"""
new = """                ? (() => {
                  const q = travelCost(st, r.id);
                  const tip = q.cost < q.base ? `原价 ${q.base} 灵石，已享减免 → ${q.cost}` : `路费 ${q.cost} 灵石`;
                  return S.totalStones(st) < q.cost
                    ? `<button class="btn btn-sm" disabled title="${tip} · 尚缺 ${q.cost - S.totalStones(st)} 灵石">灵石不足（需 ${q.cost}）</button>`
                    : `<button class="btn btn-sm btn-gold" data-go="${r.id}" title="${tip}">前往（${q.cost}灵石·${t.months}月）</button>`;
                })()"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('ui.js 地图: 路费不足按钮禁用')
else:
    print('!! 未匹配地图 go 按钮'); sys.exit(1)

ww(p, s)

# ---------- 2) life.js nextBagGrade ----------
p = ROOT + 'public/js/life.js'
s = rw(p)
old = """/** 下一个储物袋品级 + 还差多少格（纯函数，供行囊页展示扩容进度）。
 *  已达最高品级时返回 null。与 bagGradeInfo 同口径（容量含储物戒加成）。 */
export function nextBagGrade(state) {
  const cur = bagGradeInfo(state);
  const cap = (state.inventory?.capacity || 100) + (state.inventory?.ringBonus || 0);
  const next = BAG_GRADES[BAG_GRADES.findIndex((g) => g.id === cur.id) + 1];
  if (!next) return null;
  return { id: next.id, name: next.name, color: next.color, capacity: next.capacity, need: next.capacity - cap };
}"""
new = """/** 下一个储物袋品级 + 还差多少格（纯函数，供行囊页展示扩容进度）。
 *  已达最高品级时返回 null。与 bagGradeInfo 同口径（容量含储物戒加成）。
 *  用「第一个门槛高于当前容量的品级」而非下标 +1，避免容量不在档位上时算出错误档。 */
export function nextBagGrade(state) {
  const cap = (state.inventory?.capacity || 100) + (state.inventory?.ringBonus || 0);
  const next = BAG_GRADES.find((g) => g.capacity > cap);
  if (!next) return null;
  return { id: next.id, name: next.name, color: next.color, capacity: next.capacity, need: next.capacity - cap };
}"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('life.js: nextBagGrade 取档逻辑加固')
else:
    print('!! 未匹配 nextBagGrade'); sys.exit(1)
ww(p, s)

# ---------- 3) main.css ----------
p = ROOT + 'public/css/main.css'
s = rw(p)
old = "/* 储物袋扩容进度：距下一品级还差多少格 */"
new = """/* 路线不可达（灵石不足）：置灰且不可点击 */
.route-row-poor { opacity: .45; cursor: not-allowed; filter: grayscale(.6); }
.route-row-poor small { color: var(--text-faint); }
/* 储物袋扩容进度：距下一品级还差多少格 */"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('main.css: 新增 .route-row-poor')
else:
    print('!! 未匹配 css 锚点'); sys.exit(1)
ww(p, s)

print('补丁完成：')
for x in ok:
    print('  -', x)
