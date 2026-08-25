# -*- coding: utf-8 -*-
# 天玄修仙录 · 灵泉引泉升级（HERB_SPRING 可成长叠加）
# 加法式改造：保留洞府>=Lv.5 基础加成 +1，新增 cave.springLevel 可耗灵石升级。
import os

ROOT = 'Z:/1/xiuxian'

# ---------------- life.js ----------------
p = os.path.join(ROOT, 'public/js/life.js')
s = open(p, encoding='utf-8').read()

old1 = """/** 灵泉涌动阈值：洞府达到此等级（Lv.5+），灵泉自然涌动，灵草每月额外 +1 自然生长 */
export const HERB_SPRING_LEVEL = 5;"""
new1 = """/** 灵泉涌动阈值：洞府达到此等级（Lv.5+），灵泉自然涌动，灵草每月额外 +1 自然生长（基础加成） */
export const HERB_SPRING_LEVEL = 5;
/** 灵泉可成长上限：玩家可耗灵石引泉，使灵泉涌动额外叠加（每重 +1 月生长） */
export const HERB_SPRING_MAX = 3;
/** 引泉升级费用基数：第 k 重费用 = HERB_SPRING_COST_BASE × k（k 从 1 起） */
export const HERB_SPRING_COST_BASE = 400;"""
assert s.count(old1) == 1, ('life const', s.count(old1))
s = s.replace(old1, new1)

old2 = """export function herbSpringBonus(state) {
  return (state.cave?.level || 0) >= HERB_SPRING_LEVEL ? 1 : 0;
}"""
new2 = """export function herbSpringBonus(state) {
  // 基础加成（洞府>=Lv.5 自动涌动）叠加可成长的引泉重数，确定性、无 RNG。
  const base = (state.cave?.level || 0) >= HERB_SPRING_LEVEL ? 1 : 0;
  const grown = state.cave?.springLevel || 0;
  return base + grown;
}"""
assert s.count(old2) == 1, ('life herbSpringBonus', s.count(old2))
s = s.replace(old2, new2)

anchor = """}

/* ============================================================
 * 天机运势（观星卜算所得，下月生效，跨月由 systems.nextMonth 过期清理）"""
func = '''
/**
 * 引泉升级：消耗下品灵石，提升灵泉涌动重数（每重灵草月生长额外 +1）。
 * 与洞府等级的基础加成叠加，提供灵草园长线投资回报，确定性、无 RNG。
 */
export function upgradeHerbSpring(state) {
  ensureLifeState(state);
  const cur = state.cave?.springLevel || 0;
  if (cur >= HERB_SPRING_MAX) {
    return { ok: false, logs: [`灵泉已臻「${HERB_SPRING_MAX}重涌动」之境，无需再引。`] };
  }
  const cost = HERB_SPRING_COST_BASE * (cur + 1);
  if ((state.currencies?.['下品灵石'] || 0) < cost) {
    return { ok: false, logs: [`引泉需 ${cost} 下品灵石，灵石不足。`] };
  }
  state.currencies['下品灵石'] -= cost;
  state.cave.springLevel = cur + 1;
  return {
    ok: true,
    cost,
    logs: [`你引动地脉灵泉，灵泉涌动升至 ${state.cave.springLevel} 重！灵草每月自然生长额外 +${state.cave.springLevel} 月（基础涌动另计）。`],
  };
}
'''
assert s.count(anchor) == 1, ('life anchor', s.count(anchor))
s = s.replace(anchor, '}\n' + func + '\n/* ============================================================\n * 天机运势（观星卜算所得，下月生效，跨月由 systems.nextMonth 过期清理）')

old4 = "{ level: 0, name: CAVE_LEVELS[0].name, bonus: 0 }"
assert s.count(old4) >= 1, ('life cave literal', s.count(old4))
s = s.replace(old4, "{ level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0 }")
open(p, 'w', encoding='utf-8').write(s)
print('life.js patched')

# ---------------- systems.js ----------------
p = os.path.join(ROOT, 'public/js/systems.js')
s = open(p, encoding='utf-8').read()

oldA = "ensureLifeState, storeItem"
newA = "ensureLifeState, upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE, storeItem"
assert s.count(oldA) == 1, ('sys import', s.count(oldA))
s = s.replace(oldA, newA)

oldB = """      break;
    }
    case 'social': {"""
newB = """      break;
    }
    case 'upgradeHerbSpring': {
      const r = upgradeHerbSpring(state);
      logs.push(...r.logs);
      break;
    }
    case 'social': {"""
assert s.count(oldB) == 1, ('sys case', s.count(oldB))
s = s.replace(oldB, newB)

oldC = "  // 新增玩法选项（秘境/拍卖/灵兽/宗门/机缘）"
newC = """  // —— 引泉升级（灵石充裕且未达上限时出现） ——
  {
    const cur = state.cave?.springLevel || 0;
    if (cur < HERB_SPRING_MAX && canAfford(state, HERB_SPRING_COST_BASE * (cur + 1))) {
      opts.push({ icon: '💧', tag: '经营', title: `引泉升级（灵泉涌动 ${cur}→${cur + 1} 重）`, desc: `花费灵石${HERB_SPRING_COST_BASE * (cur + 1)}，灵草每月自然生长额外 +1 月（与洞府基础涌动叠加）。`, action: { type: 'upgradeHerbSpring' } });
    }
  }

  // 新增玩法选项（秘境/拍卖/灵兽/宗门/机缘）"""
assert s.count(oldC) == 1, ('sys compass', s.count(oldC))
s = s.replace(oldC, newC)
open(p, 'w', encoding='utf-8').write(s)
print('systems.js patched')

# ---------------- ui.js ----------------
p = os.path.join(ROOT, 'public/js/ui.js')
s = open(p, encoding='utf-8').read()
oldU = """        <div class="side-subtitle">灵草园 · ${garden.length}/${gardenCapacity(st)} 株${herbSpringBonus(st) > 0 ? ' · 💧灵泉涌动' : ''}</div>"""
newU = """        <div class="side-subtitle">灵草园 · ${garden.length}/${gardenCapacity(st)} 株${herbSpringBonus(st) > 0 ? ` · 💧灵泉涌动（引泉 ${st.cave?.springLevel || 0} 重）` : ''}</div>
        <div class="opt-desc" style="margin:6px 0 10px">💧 灵泉涌动分「洞府基础（Lv.5+ 自动 +1）」与「引泉重数」两部分，可在决策罗盘「经营」中耗灵石引泉升级，每重令灵草月生长额外 +1 月。</div>"""
assert s.count(oldU) == 1, ('ui subtitle', s.count(oldU))
s = s.replace(oldU, newU)
open(p, 'w', encoding='utf-8').write(s)
print('ui.js patched')

# ---------------- tests/test-newfeatures.mjs ----------------
p = os.path.join(ROOT, 'tests/test-newfeatures.mjs')
s = open(p, encoding='utf-8').read()
oldImp = "HERB_IRRIGATE_YIELD_CAP, growHerbs, omenActive, omenMul, omenAdd, refinePill, settleRefine, decayPillToxicity, isRecipeUnlocked, alchemySlots, storeItem, REGION_TRAVEL, beastLevelRange, startTravel, travelOptions, ART_RECIPES } from '../public/js/life.js';"
newImp = "HERB_IRRIGATE_YIELD_CAP, growHerbs, omenActive, omenMul, omenAdd, refinePill, settleRefine, decayPillToxicity, isRecipeUnlocked, alchemySlots, storeItem, REGION_TRAVEL, beastLevelRange, startTravel, travelOptions, ART_RECIPES, upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE } from '../public/js/life.js';"
assert s.count(oldImp) == 1, ('test import', s.count(oldImp))
s = s.replace(oldImp, newImp)

anchorT = "/* ---------- 观星卜算（数据驱动罗盘选项，确定性收益）"
assert s.count(anchorT) == 1, ('test anchor', s.count(anchorT))
block = '''/* ---------- 灵泉·引泉升级（可成长叠加，确定性） ---------- */
{
  ok(HERB_SPRING_MAX === 3, '灵泉引泉上限 HERB_SPRING_MAX=3');
  ok(HERB_SPRING_COST_BASE === 400, '引泉费用基数 HERB_SPRING_COST_BASE=400');
  // 加法式：洞府基础 + 引泉重数
  const lowS = S.createNewGame({ name: '引泉低', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(lowS); lowS.cave = lowS.cave || {}; lowS.cave.level = 0;
  ok(herbSpringBonus(lowS) === 0, '洞府 Lv.0 灵泉总加成=0（基础0+引泉0）');
  const highS = S.createNewGame({ name: '引泉高', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(highS); highS.cave = highS.cave || {}; highS.cave.level = 6; highS.cave.springLevel = 2;
  ok(herbSpringBonus(highS) === 3, '洞府 Lv.6 + 引泉2重 = 灵泉总加成 3');
  // 升级：费用递增、扣灵石、重数+1、封顶、不足拒绝
  const gS = S.createNewGame({ name: '引泉升级', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gS); gS.cave = gS.cave || {}; gS.currencies = gS.currencies || {}; gS.currencies['下品灵石'] = 5000;
  const beforeS = gS.currencies['下品灵石'];
  const rS1 = upgradeHerbSpring(gS);
  ok(rS1.ok && gS.cave.springLevel === 1 && beforeS - gS.currencies['下品灵石'] === HERB_SPRING_COST_BASE * 1, '首次引泉：重数1、扣费=400');
  const rS2 = upgradeHerbSpring(gS);
  ok(rS2.ok && gS.cave.springLevel === 2 && beforeS - gS.currencies['下品灵石'] === HERB_SPRING_COST_BASE * (1 + 2), '二次引泉：重数2、累计扣费=1200');
  const rS3 = upgradeHerbSpring(gS);
  ok(rS3.ok && gS.cave.springLevel === 3, '三次引泉达上限3');
  const rS4 = upgradeHerbSpring(gS);
  ok(!rS4.ok && gS.cave.springLevel === 3, '已达上限拒绝再引泉');
  const poorS = S.createNewGame({ name: '引泉贫', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(poorS); poorS.cave = poorS.cave || {}; poorS.currencies = poorS.currencies || {}; poorS.currencies['下品灵石'] = 100;
  const rS5 = upgradeHerbSpring(poorS);
  ok(!rS5.ok && (poorS.cave.springLevel || 0) === 0, '灵石不足引泉被拒且重数不变');
  // 引泉叠加后影响 growHerbs 自然生长（确定性）
  const gG = S.createNewGame({ name: '引泉生长', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gG); gG.cave = gG.cave || {}; gG.cave.garden = []; gG.cave.level = 6; gG.cave.springLevel = 2;
  plantHerb(gG, 'yushu');
  const bp = gG.cave.garden[0].progress;
  growHerbs(gG);
  ok(gG.cave.garden[0].progress === bp + 1 + 3, '引泉叠加后月自然生长 +4（基础1+引泉3）');
}

'''
s = s.replace(anchorT, block + anchorT)
open(p, 'w', encoding='utf-8').write(s)
print('test-newfeatures.mjs patched')
print('ALL PATCHES APPLIED')
