# -*- coding: utf-8 -*-
"""秘境/宗门秘境深度选择面板：满仓警示（天玄修仙录）
与 systems.mysticBagBlockReason 同口径，UI 只做展示与按钮禁用，不重算容量。
"""
import io, sys

P = 'Z:/1/xiuxian/public/js/ui.js'
s = io.open(P, encoding='utf-8').read()
orig = s

# ---------- 1) 秘境深度选择：满仓时禁用「深入」并给警示条 ----------
old = """async function chooseMysticDepth(realmId) {
  const st = GameState.data;
  const depths = D.MYSTIC_DEPTH.levels;
  let pick = null;"""
new = """async function chooseMysticDepth(realmId) {
  const st = GameState.data;
  const depths = D.MYSTIC_DEPTH.levels;
  let pick = null;
  // 满仓前置警示：与 systems.exploreMysticRealm 的拦截同口径（同一纯函数，杜绝 UI 与结算漂移）
  const bagBlock = S.mysticBagBlockReason(st, D.MYSTIC_REALMS.find((r) => r.id === realmId) || null, '秘境所得灵材');"""
assert s.count(old) == 1, 'chooseMysticDepth 锚点不唯一'
s = s.replace(old, new, 1)

old = """      <div class="choice-intro">选择本次探索的深度。越深，灵石、材料与法宝越丰厚，但护宝妖兽更凶、更可能出现隐藏奇遇。</div>
      <div class="depth-list">"""
new = """      <div class="choice-intro">选择本次探索的深度。越深，灵石、材料与法宝越丰厚，但护宝妖兽更凶、更可能出现隐藏奇遇。</div>
      ${bagBlock ? `<div class="herb-bag-warn">⚠ ${bagBlock}。（残图与护阵灵石不会被消耗）</div>` : ''}
      <div class="depth-list">"""
assert s.count(old) == 1, '秘境 choice-intro 锚点不唯一'
s = s.replace(old, new, 1)

old = """            <button class="btn btn-sm btn-gold" data-depth="${dv}">深入${d.name}</button>
          </div>`; }).join('')}
      </div>
      <div class="modal-actions"><button class="btn" id="btn-cancel-depth">取消</button></div>`,"""
new = """            <button class="btn btn-sm btn-gold" data-depth="${dv}" ${bagBlock ? 'disabled' : ''}>深入${d.name}</button>
          </div>`; }).join('')}
      </div>
      <div class="modal-actions"><button class="btn" id="btn-cancel-depth">取消</button></div>`,"""
assert s.count(old) == 1, '秘境深度按钮锚点不唯一'
s = s.replace(old, new, 1)

# ---------- 2) 宗门秘境深度选择：满仓警示（不禁用，贡献与灵石仍可得） ----------
old = """async function chooseSectDepth() {
  const st = GameState.data;
  const depths = D.MYSTIC_DEPTH.levels;
  let pick = null;"""
new = """async function chooseSectDepth() {
  const st = GameState.data;
  const depths = D.MYSTIC_DEPTH.levels;
  let pick = null;
  // 满仓预警：贡献与灵石照常入账，但灵脉晶与深处丹药需占格（口径同 exploreSectRealm）
  const sectBagWarn = S.mysticBagBlockReason(st, null, '灵脉晶与丹房旧藏');"""
assert s.count(old) == 1, 'chooseSectDepth 锚点不唯一'
s = s.replace(old, new, 1)

old = """      <div class="choice-intro">选择本次潜修的纵深。越深，宗门贡献、灵石与材料越丰厚；深处更藏有宗门丹房旧藏（聚气丹）。无妖兽风险。</div>
      <div class="depth-list">"""
new = """      <div class="choice-intro">选择本次潜修的纵深。越深，宗门贡献、灵石与材料越丰厚；深处更藏有宗门丹房旧藏（聚气丹）。无妖兽风险。</div>
      ${sectBagWarn ? `<div class="herb-bag-warn">⚠ ${sectBagWarn}，本次所得灵脉晶与丹药无法带走（贡献与灵石仍照常入账）。</div>` : ''}
      <div class="depth-list">"""
assert s.count(old) == 1, '宗门 choice-intro 锚点不唯一'
s = s.replace(old, new, 1)

if s == orig:
    print('NO CHANGE'); sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js patched OK')
