# -*- coding: utf-8 -*-
# 自动打磨轮次补丁：灵泉浇灌除加速外，累计浸润同时提升收获产量（封顶）。
import os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def patch(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new, label in replacements:
        cnt = content.count(old)
        if cnt == 0:
            print('  [WARN] 未找到锚点（跳过）：' + label)
            continue
        if cnt > 1:
            print('  [ERROR] 锚点出现 ' + str(cnt) + ' 次（应唯一）：' + label)
            sys.exit(1)
        content = content.replace(old, new, 1)
        print('  [OK] ' + label)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# ---------------- life.js ----------------
life = BASE + '/public/js/life.js'
patch(life, [
  ("export const HERB_SPRING_LEVEL = 5;\n",
   "export const HERB_SPRING_LEVEL = 5;\n/** 单株累计浸润可转化为收获产量加成的上限：防止付费无限堆产，保留平衡 */\nexport const HERB_IRRIGATE_YIELD_CAP = 3;\n",
   "life: 新增 HERB_IRRIGATE_YIELD_CAP 常量"),
  ("  state.cave.garden.push({ id: def.id, name: def.name, progress: 0, grow: def.grow, planted: `${state.world.year}年${state.world.month}月`, irrigatedThisMonth: 0 });\n",
   "  state.cave.garden.push({ id: def.id, name: def.name, progress: 0, grow: def.grow, planted: `${state.world.year}年${state.world.month}月`, irrigatedThisMonth: 0, irrigated: 0 });\n",
   "life: plantHerb 播种记 irrigated=0"),
  ("  h.irrigatedThisMonth = (h.irrigatedThisMonth || 0) + 1;\n",
   "  h.irrigatedThisMonth = (h.irrigatedThisMonth || 0) + 1;\n  h.irrigated = (h.irrigated || 0) + 1;\n",
   "life: irrigateHerb 累计 h.irrigated"),
  ("  state.cave.garden.splice(idx, 1);\n  if (def.yield) {\n    const q = herbQuality(state);\n    const baseQty = def.yield.数量 || 1;\n    const qty = Math.max(1, Math.round(baseQty * q.mul));\n    storeItem(state, { ...def.yield, 数量: qty });\n    const extra = qty - baseQty;\n    const tag = q.tier === '下品' ? '' : `（${q.tier}灵田·+${extra}）`;\n    return { ok: true, logs: [`你采得「${def.yield.名称}」×${qty}${tag}，已收入储物袋。`, q.tier === '下品' ? '灵田灵气平淡，产出寻常。' : `洞府灵气滋养，灵草品质达「${q.tier}」，产量提升。`] };\n  }\n",
   "  state.cave.garden.splice(idx, 1);\n  if (def.yield) {\n    const q = herbQuality(state);\n    const baseQty = def.yield.数量 || 1;\n    const qualityQty = Math.max(1, Math.round(baseQty * q.mul));\n    const irriBonus = Math.min(h.irrigated || 0, HERB_IRRIGATE_YIELD_CAP);\n    const qty = qualityQty + irriBonus;\n    storeItem(state, { ...def.yield, 数量: qty });\n    const qualityExtra = qualityQty - baseQty;\n    const tagParts = [];\n    if (q.tier !== '下品') tagParts.push(`${q.tier}灵田·+${qualityExtra}`);\n    if (irriBonus > 0) tagParts.push(`灵泉浸润·+${irriBonus}`);\n    const tag = tagParts.length ? `（${tagParts.join('，')}）` : '';\n    const notes = [];\n    if (q.tier !== '下品') notes.push(`洞府灵气滋养，灵草品质达「${q.tier}」，产量提升。`);\n    if (irriBonus > 0) notes.push(`灵泉反复浸润，灵草肥硕，额外多收 ${irriBonus} 份。`);\n    if (!notes.length) notes.push('灵田灵气平淡，产出寻常。');\n    return { ok: true, logs: [`你采得「${def.yield.名称}」×${qty}${tag}，已收入储物袋。`, ...notes] };\n  }\n",
   "life: harvestHerb 累加浸润产量加成"),
])

# ---------------- ui.js ----------------
ui = BASE + '/public/js/ui.js'
patch(ui, [
  ("import { ensureLifeState, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, relationBenefit, relationIndex, startTravel, upgradeBag, craftRecipe, inventoryUsed, organizeBag, gardenCapacity, herbQuality, plantHerb, harvestHerb, irrigateHerb, HERB_IRRIGATE_COST, HERB_IRRIGATE_CAP_PER_MONTH, herbSpringBonus, omenActive, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';",
   "import { ensureLifeState, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, relationBenefit, relationIndex, startTravel, upgradeBag, craftRecipe, inventoryUsed, organizeBag, gardenCapacity, herbQuality, plantHerb, harvestHerb, irrigateHerb, HERB_IRRIGATE_COST, HERB_IRRIGATE_CAP_PER_MONTH, herbSpringBonus, HERB_IRRIGATE_YIELD_CAP, omenActive, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';",
   "ui: 导入 HERB_IRRIGATE_YIELD_CAP"),
  ("            <div class=\"herb-info\"><b>${h.name}</b><span>播种于 ${h.planted || '?'}</span><span class=\"herb-q\">${herbQuality(st).label}灵田${herbSpringBonus(st) > 0 ? ' · 💧灵泉' : ''}</span></div>\n",
   "            <div class=\"herb-info\"><b>${h.name}</b><span>播种于 ${h.planted || '?'}</span><span class=\"herb-q\">${herbQuality(st).label}灵田${herbSpringBonus(st) > 0 ? ' · 💧灵泉' : ''}${(h.irrigated||0) > 0 ? ` · 💧浸润${h.irrigated}（收获+${Math.min(h.irrigated, HERB_IRRIGATE_YIELD_CAP)}）` : ''}</span></div>\n",
   "ui: 灵草行显示浸润与收获加成"),
  ("        <div class=\"opt-desc\" style=\"margin-top:8px\">灵草成熟需若干月（随游戏月度推进），<b>播种即解锁「灵草」图鉴</b>，收获产物自动入袋，可在行囊「材料」分类与图鉴中查看。集齐全部 4 种灵草可触发「百草通鉴」成就。</div>\n",
   "        <div class=\"opt-desc\" style=\"margin-top:8px\">灵草成熟需若干月（随游戏月度推进），<b>播种即解锁「灵草」图鉴</b>，收获产物自动入袋，可在行囊「材料」分类与图鉴中查看。集齐全部 4 种灵草可触发「百草通鉴」成就。<b>灵泉浇灌除加速生长外，每次还会累积提升最终收获产量（累计封顶 +${HERB_IRRIGATE_YIELD_CAP}）。</b></div>\n",
   "ui: 灵草园说明补充浇灌增产"),
])

# ---------------- test-newfeatures.mjs ----------------
test = BASE + '/tests/test-newfeatures.mjs'
anchor = "/* ---------- 灵草图鉴解锁：播种解锁灵草条目、收获解锁产物材料、集齐得「百草通鉴」成就 ---------- */"
block = (
"/* ---------- 灵泉浇灌提升收获产量（加速 + 累计浸润增产，封顶） ---------- */\n"
"{\n"
"  ok(typeof HERB_IRRIGATE_YIELD_CAP === 'number' && HERB_IRRIGATE_YIELD_CAP === 3, '浇灌增产上限常量为 3');\n"
"  function yieldOf(level, irrigated) {\n"
"    const g = S.createNewGame({ name: 'irr', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
"    ensureLifeState(g); g.cave.level = level; g.cave.garden = [{ id: 'lingcao', name: '凝露灵草', progress: 3, grow: 3, planted: 'x', irrigated: irrigated }];\n"
"    g.currencies = g.currencies || {}; g.currencies['下品灵石'] = 1000;\n"
"    const before = g.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);\n"
"    harvestHerb(g, 0);\n"
"    const after = g.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);\n"
"    return after - before;\n"
"  }\n"
"  ok(yieldOf(0, 0) === 2, '无浇灌 Lv.0 收获凝露草×2（与旧逻辑一致）');\n"
"  ok(yieldOf(0, 2) === 4, 'Lv.0 + 浸润2次 → 凝露草×4（2+2）');\n"
"  ok(yieldOf(0, 3) === 5, 'Lv.0 + 浸润3次 → 凝露草×5（2+3，达上限）');\n"
"  ok(yieldOf(0, 99) === 5, 'Lv.0 + 浸润99次 → 仍封顶 ×5（2+3）');\n"
"  ok(yieldOf(8, 2) === 7, 'Lv.8 仙品×5 + 浸润2 → ×7（品质与浸润叠加）');\n"
"  const g2 = S.createNewGame({ name: 'irr2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
"  ensureLifeState(g2); g2.cave.level = 0; g2.cave.garden = []; g2.currencies = g2.currencies || {}; g2.currencies['下品灵石'] = 99999;\n"
"  const pr = plantHerb(g2, 'lingcao'); ok(pr.ok && g2.cave.garden[0].irrigated === 0, '播种后浸润计数初始化为 0');\n"
"  ok(irrigateHerb(g2, 0).ok && g2.cave.garden[0].irrigated === 1, '首次浇灌浸润计数=1');\n"
"  ok(irrigateHerb(g2, 0).ok && g2.cave.garden[0].irrigated === 2, '二次浇灌浸润计数=2（达月度上限）');\n"
"  ok(!irrigateHerb(g2, 0).ok, '同日第三次浇灌被月度上限拒绝');\n"
"  g2.cave.garden[0].progress = 3;\n"
"  const before2 = g2.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);\n"
"  const hr2 = harvestHerb(g2, 0);\n"
"  const after2 = g2.items.filter((it) => it.名称 === '凝露草').reduce((a, it) => a + (it.数量 || 1), 0);\n"
"  ok(hr2.ok && (after2 - before2) === 4, '浸润2次实际收获 +4（基础2+浸润2）');\n"
"}\n\n"
) + anchor

with open(test, 'r', encoding='utf-8') as f:
    tc = f.read()
if anchor not in tc:
    print('  [ERROR] 测试锚点未找到')
    sys.exit(1)
tc = tc.replace(anchor, block, 1)
old_imp2 = "HERB_SPRING_LEVEL, growHerbs, omenActive, omenMul, omenAdd, refinePill, settleRefine, decayPillToxicity, isRecipeUnlocked, alchemySlots, storeItem, REGION_TRAVEL, beastLevelRange } from '../public/js/life.js';"
new_imp2 = "HERB_SPRING_LEVEL, HERB_IRRIGATE_YIELD_CAP, growHerbs, omenActive, omenMul, omenAdd, refinePill, settleRefine, decayPillToxicity, isRecipeUnlocked, alchemySlots, storeItem, REGION_TRAVEL, beastLevelRange } from '../public/js/life.js';"
if old_imp2 in tc:
    tc = tc.replace(old_imp2, new_imp2, 1)
    print('  [OK] test: 导入 HERB_IRRIGATE_YIELD_CAP')
else:
    print('  [WARN] test 导入行锚点未命中（可能已含）')
with open(test, 'w', encoding='utf-8') as f:
    f.write(tc)

print('补丁应用完毕。')
