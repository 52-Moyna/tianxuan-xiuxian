#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""套装系统修复补丁（第二轮）：
1) codex.js activeSetBonuses 计件口径由「不同 token 命中数」改为「命中 token 的不同物品件数」，
   使 3 件实体套装部件即激活 3 件效果（妖纹仅 2 个 token，原口径永远到不了 3 件）。
2) life.js 东荒妖域坊市补 青风靴 / 妖纹战铠，使妖纹套装在真实玩法可凑齐（此前仅妖纹护腕一件=死内容）。
3) codex.js 图鉴补 青风靴 / 妖纹战铠 条目（与既有商店装备一致）。
4) life.js startTravel 文案补「路费减半」，恢复旧测试期望。
5) tests 修正 calcPower 断言为同状态对比（消除独立 createNewGame 的灵根 RNG 差异）。
"""
import io, sys, os

ROOT = r'Z:/1/xiuxian'

def patch(path, replacements):
    p = os.path.join(ROOT, path)
    with io.open(p, 'r', encoding='utf-8') as f:
        s = f.read()
    for i, (old, new, times) in enumerate(replacements):
        cnt = s.count(old)
        if cnt != times:
            raise SystemExit(f'[{path}] 替换 #{i} 期望 {times} 次实际 {cnt} 次:\n{old[:80]}')
        s = s.replace(old, new)
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'OK {path} ({len(replacements)} 处替换)')

# ---- 1) codex.js activeSetBonuses 计件口径 ----
codex = 'public/js/codex.js'
patch(codex, [
    (
        "    const matched = (set.tokens || []).filter((t) =>\n"
        "      items.some((it) => {\n"
        "        const isMaterial = it?.类型 === '材料';\n"
        "        return isMaterial ? (it.名称 === t) : (it.名称 && it.名称.includes(t));\n"
        "      })\n"
        "    );\n"
        "    const count = matched.length;\n",
        "    // 计件口径：命中任一套装 token 的「不同物品」数（而非不同 token 数），\n"
        "    // 这样集齐 3 件实体套装部件即激活 3 件效果（妖纹仅 2 个 token，按原口径永远到不了 3 件）。\n"
        "    // 材料仍须名称精确等于 token，否则「青风狼内丹」会因 token '青风' 为其子串而误触妖纹套装。\n"
        "    const matchedItems = items.filter((it) => {\n"
        "      const isMaterial = it?.类型 === '材料';\n"
        "      return (set.tokens || []).some((t) => (isMaterial ? (it.名称 === t) : (it.名称 && it.名称.includes(t))));\n"
        "    });\n"
        "    const count = matchedItems.length;\n",
        1
    ),
    (
        "    return { name, count, text, tokens: matched, bonus };",
        "    return { name, count, text, tokens: [...new Set(matchedItems.flatMap((it) => {\n"
        "      const isMaterial = it?.类型 === '材料';\n"
        "      return (set.tokens || []).filter((t) => (isMaterial ? (it.名称 === t) : (it.名称 && it.名称.includes(t))));\n"
        "    }))], bonus };",
        1
    ),
])

# ---- 2) life.js 东荒妖域补妖纹装备 ----
life = 'public/js/life.js'
patch(life, [
    (
        "    { name: '妖纹护腕', type: '装备', price: 220, level: 2, desc: '以妖纹强化筋骨，战力 +2。' },\n",
        "    { name: '妖纹护腕', type: '装备', price: 220, level: 2, desc: '以妖纹强化筋骨，战力 +2。' },\n"
        "    { name: '青风靴', type: '装备', price: 200, level: 2, desc: '轻捷步战，战力 +2，妖纹套装组件。' },\n"
        "    { name: '妖纹战铠', type: '装备', price: 300, level: 3, desc: '妖纹铭刻甲片，战力 +3，妖纹套装组件。' },\n",
        1
    ),
    # 3) startTravel 文案补「路费减半」
    (
        "  if (usedVoucher) tailParts.push(`使用「${usedVoucher.名称}」`);\n",
        "  if (usedVoucher) tailParts.push(`使用「${usedVoucher.名称}」路费减半`);\n",
        1
    ),
])

# ---- 3) codex.js 图鉴补妖纹装备条目 ----
patch(codex, [
    (
        "  ['accessory', 'fabao', 'gear_yao_wrist', '妖纹护腕', '稀有', '东荒妖域坊市、妖兽材料炼制', '以妖纹强化筋骨'],\n",
        "  ['accessory', 'fabao', 'gear_yao_wrist', '妖纹护腕', '稀有', '东荒妖域坊市、妖兽材料炼制', '以妖纹强化筋骨'],\n"
        "  ['boots', 'fabao', 'gear_qingfeng_boots', '青风靴', '稀有', '东荒妖域坊市', '轻捷步战，妖纹套装组件'],\n"
        "  ['armor', 'fabao', 'gear_yaowen_armor', '妖纹战铠', '稀有', '东荒妖域坊市、妖兽材料炼制', '妖纹铭刻甲片，妖纹套装组件'],\n",
        1
    ),
])

# ---- 4) tests calcPower 断言改为同状态对比 ----
test = 'tests/test-newfeatures.mjs'
patch(test, [
    (
        "  // calcPower 应真实包含该 +2（与拆解同口径）\n"
        "  const noSet = mkSet([]);\n"
        "  noSet.equipment.artifact = { 名称: '测试法宝', 类型: '法宝', 战力: 10, 等级: 5, 品阶: 'fan' };\n"
        "  ok(S.calcPower(xh2) - S.calcPower(noSet) >= 10, 'calcPower 计入套装战力与法宝额外加成');\n",
        "  // calcPower 应真实包含该 +2（与拆解同口径）；同状态去件对比，消除独立 createNewGame 的灵根 RNG 差异\n"
        "  const pWithSet = S.calcPower(xh2);\n"
        "  const savedItems = xh2.items; xh2.items = [];\n"
        "  const pNoSet = S.calcPower(xh2);\n"
        "  xh2.items = savedItems;\n"
        "  ok(pWithSet - pNoSet >= 10, 'calcPower 计入套装战力与法宝额外加成');\n",
        1
    ),
])

print('全部补丁应用完成')
