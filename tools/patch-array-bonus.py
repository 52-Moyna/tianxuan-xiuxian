#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""天玄修仙录 · 聚灵阵（洞府持久修炼加成设施）补丁脚本。
相对路径、可整体迁移；仅改动游戏本体逻辑层与 UI 层。
运行：python3 tools/patch-array-bonus.py
"""
import io, sys, os

ROOT = 'Z:/1/xiuxian'
LIFE = os.path.join(ROOT, 'public/js/life.js')
SYS = os.path.join(ROOT, 'public/js/systems.js')
UI = os.path.join(ROOT, 'public/js/ui.js')
DATA = os.path.join(ROOT, 'public/js/data.js')

def patch(path, repls):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    for old, new, note in repls:
        if old not in s:
            raise SystemExit(f'[{path}] 未找到锚点：{note}\n--- 预览 ---\n' + old[:120])
        if s.count(old) != 1:
            raise SystemExit(f'[{path}] 锚点不唯一（出现 {s.count(old)} 次）：{note}')
        s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'OK 已改 {path}')

# —— life.js：常量 + cave 初始化补 arrayLevel ——
life_repls = [
    (
        "export const HERB_SPRING_COST_BASE = 400;",
        "export const HERB_SPRING_COST_BASE = 400;\n\n"
        "// 聚灵阵：洞府内可布设/升级的持久性修炼灵气增幅设施（独立于洞府等级加成）。\n"
        "export const ARRAY_BONUS_PER_LEVEL = 0.08; // 每重修炼效率 +8%\n"
        "export const ARRAY_MAX_LEVEL = 5;          // 最高 5 重（修炼效率 +40%）\n"
        "export const ARRAY_UPGRADE_BASE = 300;     // 布设第 k 重费用 = ARRAY_UPGRADE_BASE × k（k 从 1 起）",
        "life 新增聚灵阵常量",
    ),
    (
        "if (!state.cave) state.cave = { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0 };",
        "if (!state.cave) state.cave = { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0, arrayLevel: 0 };",
        "life ensureLifeState cave 初始化补 arrayLevel",
    ),
    (
        "state.cave = state.cave || { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0 };",
        "state.cave = state.cave || { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0, arrayLevel: 0 };",
        "life ensureAlchemyState cave 初始化补 arrayLevel",
    ),
]
patch(LIFE, life_repls)

# —— systems.js：导入/乘区/选项/行动（含 createNewGame cave 初始化补 arrayLevel） ——
sys_repls = [
    # 1) 导入常量
    (
        "HERB_SPRING_COST_BASE, storeItem, canStore, craftRecipe, canCraft, relationIndex, relationBenefit, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, startTravel, completeTravel, makeChronicle, gearPower, artifactPower, inventoryUsed, normalizeEquip, equipSlotName, bagNameByCapacity, growHerbs, omenMul, omenAdd, omenActive, refinePill, settleRefine, decayPillToxicity, beastLevelRange, beastPowerOfLevel, ALCHEMY_CATALYSTS } from './life.js';",
        "HERB_SPRING_COST_BASE, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, ARRAY_UPGRADE_BASE, storeItem, canStore, craftRecipe, canCraft, relationIndex, relationBenefit, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, startTravel, completeTravel, makeChronicle, gearPower, artifactPower, inventoryUsed, normalizeEquip, equipSlotName, bagNameByCapacity, growHerbs, omenMul, omenAdd, omenActive, refinePill, settleRefine, decayPillToxicity, beastLevelRange, beastPowerOfLevel, ALCHEMY_CATALYSTS } from './life.js';",
        "systems 导入聚灵阵常量",
    ),
    # 1.5) 新增 arrayMul 纯函数（cultivate 调用）
    (
        "/** 修炼获得修为经验。返回 {gain, logs} */",
        "/** 聚灵阵修炼效率乘区（纯函数，不修改 state）。每重 +8%，最高 5 重。供 cultivate 与 cultivateGainPreview 共用同一事实来源。 */\n"
        "export function arrayMul(state) {\n"
        "  const lv = state?.cave?.arrayLevel || 0;\n"
        "  return 1 + lv * ARRAY_BONUS_PER_LEVEL;\n"
        "}\n\n"
        "/** 修炼获得修为经验。返回 {gain, logs} */",
        "systems 新增 arrayMul 纯函数",
    ),
    # 2) cultivate 真实结算乘入 arrayMul
    (
        "const gain = Math.round(base * p.spiritRoot.speed * (1 + (state.cave.bonus || 0) + sectBonus) * grade.expMul * (1 + p.daoBase['根骨'].level / 200) * toxicMul * boostMul * omenMul(state, 'cultivate'));",
        "const gain = Math.round(base * p.spiritRoot.speed * (1 + (state.cave.bonus || 0) + sectBonus) * grade.expMul * (1 + p.daoBase['根骨'].level / 200) * toxicMul * boostMul * arrayMul(state) * omenMul(state, 'cultivate'));",
        "systems cultivate 乘入 arrayMul",
    ),
    # 3) cultivateGainPreview：声明 arrayMul + 乘入 + 返回
    (
        "  const boostMul = (state.flags?.cultivateBoostMonths || 0) > 0 ? 1.15 : 1;\n  const rootMul = p.spiritRoot.speed;",
        "  const boostMul = (state.flags?.cultivateBoostMonths || 0) > 0 ? 1.15 : 1;\n  const arrayMul = 1 + (state.cave?.arrayLevel || 0) * ARRAY_BONUS_PER_LEVEL;\n  const rootMul = p.spiritRoot.speed;",
        "systems preview 声明 arrayMul",
    ),
    (
        "  const gain = Math.round(base * rootMul * caveMul * gradeMul * boneMul * toxicMul * boostMul * omen);",
        "  const gain = Math.round(base * rootMul * caveMul * arrayMul * gradeMul * boneMul * toxicMul * boostMul * omen);",
        "systems preview 乘入 arrayMul",
    ),
    (
        "    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,",
        "    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, arrayMul, gain,",
        "systems preview 返回 arrayMul",
    ),
    # 4) 选项预览拆解显示聚灵阵
    (
        "      if (pv.boostMul !== 1) parts.push(`聚灵×${pv.boostMul}`);\n      parts.push(`运势×${pv.omen}`);",
        "      if (pv.boostMul !== 1) parts.push(`聚灵×${pv.boostMul}`);\n      if (pv.arrayMul !== 1) parts.push(`聚灵阵×${pv.arrayMul}`);\n      parts.push(`运势×${pv.omen}`);",
        "systems 选项预览显示聚灵阵乘区",
    ),
    # 5) 罗盘经营选项：布设聚灵阵
    (
        "  // 新增玩法选项（秘境/拍卖/灵兽/宗门/机缘）",
        "  // —— 聚灵阵（灵石充裕且未达上限时出现） ——\n"
        "  {\n"
        "    const cur = state.cave?.arrayLevel || 0;\n"
        "    if (cur < ARRAY_MAX_LEVEL && canAfford(state, ARRAY_UPGRADE_BASE * (cur + 1))) {\n"
        "      opts.push({ icon: '🔯', tag: '经营', title: `布设聚灵阵（${cur}→${cur + 1} 重）`, desc: `花费灵石${ARRAY_UPGRADE_BASE * (cur + 1)}，修炼效率永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%（与洞府加成、聚灵阵旗叠加）。`, action: { type: 'upgradeArray' } });\n"
        "    }\n"
        "  }\n\n"
        "  // 新增玩法选项（秘境/拍卖/灵兽/宗门/机缘）",
        "systems 罗盘新增聚灵阵选项",
    ),
    # 0) createNewGame cave 初始化补 arrayLevel
    (
        "    cave: { level: 0, name: CAVE_LEVELS[0].name, bonus: 0 },",
        "    cave: { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, arrayLevel: 0 },",
        "systems createNewGame cave 初始化补 arrayLevel",
    ),
    # 6) performAction 新增 upgradeArray 分支
    (
        "    case 'upgradeHerbSpring': {\n      const r = upgradeHerbSpring(state);\n      logs.push(...r.logs);\n      break;\n    }",
        "    case 'upgradeHerbSpring': {\n      const r = upgradeHerbSpring(state);\n      logs.push(...r.logs);\n      break;\n    }\n"
        "    case 'upgradeArray': {\n"
        "      const cur = state.cave?.arrayLevel || 0;\n"
        "      if (cur >= ARRAY_MAX_LEVEL) logs.push('聚灵阵已布设至最高重数，无需再升。');\n"
        "      else {\n"
        "        const cost = ARRAY_UPGRADE_BASE * (cur + 1);\n"
        "        if (spendStones(state, cost)) {\n"
        "          state.cave.arrayLevel = cur + 1;\n"
        "          logs.push(`聚灵阵布设至第 ${state.cave.arrayLevel} 重！修炼效率永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%（现合计 +${Math.round(state.cave.arrayLevel * ARRAY_BONUS_PER_LEVEL * 100)}%）。`);\n"
        "        } else logs.push('灵石不足，布阵作罢。');\n"
        "      }\n"
        "      break;\n"
        "    }",
        "systems performAction 新增 upgradeArray",
    ),
]
patch(SYS, sys_repls)

# —— ui.js：导入常量 + 洞府面板展示聚灵阵 ——
ui_repls = [
    (
        "HERB_IRRIGATE_YIELD_CAP, omenActive, refineRate, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';",
        "HERB_IRRIGATE_YIELD_CAP, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, omenActive, refineRate, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';",
        "ui 导入聚灵阵常量",
    ),
    (
        "<span class=\"panel-hint\">Lv.${cave.level || 0} ｜ 修炼加成 +${Math.round((cave.bonus || 0) * 100)}%</span></div>",
        "<span class=\"panel-hint\">Lv.${cave.level || 0} ｜ 修炼加成 +${Math.round((cave.bonus || 0) * 100)}%${((st.cave?.arrayLevel || 0) > 0) ? ` ｜ 聚灵阵 +${Math.round((st.cave?.arrayLevel || 0) * ARRAY_BONUS_PER_LEVEL * 100)}%` : ''}</span></div>",
        "ui 洞府面板显示聚灵阵",
    ),
]
patch(UI, ui_repls)

print('全部补丁应用完成。')
