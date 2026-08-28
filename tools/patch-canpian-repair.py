"""天玄修仙录 · 残片法宝闭环打磨补丁。

将 codex.js 中「残片法宝」（eq_af_canpian，原描述“待修复成长”、无获取也无消费）接入真实玩法：
  - 游历事件掉落「残片法宝」（战利品来源，类型=材料，不会被误装备）。
  - 百艺·炼器新增「残片修复」配方：消耗 残片法宝×1 + 星砂×1 → 重铸为可用「灵珠法宝」（法宝，战力16）。
  - codex 描述改为真实可兑现的说明。
落点：Z:/1/xiuxian（真实 git ,repo）。请勿在 C: 副本上改动。
"""
import io

ROOT = "Z:/1/xiuxian"


def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8") as f:
        txt = f.read()
    if old not in txt:
        raise SystemExit("PATCH FAIL [%s]: 锚点未命中\n---期望包含---\n%s" % (label, old[:200]))
    if new in txt:
        print("SKIP [%s]: 已应用，跳过。" % label)
        return
    txt = txt.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    print("OK   [%s]: 已写入。" % label)


# —— 1. life.js：ART_RECIPES.炼器 新增「残片修复」 ——
life_path = ROOT + "/public/js/life.js"
life_old = ("    { id: 'free', name: '自由锻造', need: { '赤铜精': 1 }, output: { type: '装备', quantity: 1, level: 3, "
            "desc: '自选部位锻造一件装备，战力随品阶浮动。' }, value: 200 },\n  ],")
life_new = ("    { id: 'free', name: '自由锻造', need: { '赤铜精': 1 }, output: { type: '装备', quantity: 1, level: 3, "
            "desc: '自选部位锻造一件装备，战力随品阶浮动。' }, value: 200 },\n"
            "    // 残片修复：法宝残片（游历/秘境战利品）+ 星砂 → 重铸为可用灵珠法宝，消除「残片法宝」死道具与“待修复成长”假承诺\n"
            "    { id: 'repair_canpian', name: '残片修复', need: { '残片法宝': 1, '星砂': 1 }, output: { name: '灵珠法宝', type: '法宝', quantity: 1, level: 3, desc: '由法宝残片重铸而成的灵珠法宝，战力+16。' }, value: 220 },\n"
            "  ],")
patch(life_path, life_old, life_new, "life.ART_RECIPES.炼器.repair_canpian")

# —— 2. systems.js：practiceArt 新增「残片修复」分支（确定性，无 RNG） ——
sys_path = ROOT + "/public/js/systems.js"
sys_old = ("      logs.push(`你凝火锻器，自由锻造出「${equip.名称}」（${slotName}，战力+${equip.战力}）。`);\n"
           "    } else {")
sys_new = ("      logs.push(`你凝火锻2器，自由锻造出「${equip.名称}」（${slotName}，战力+${equip.战力}）。`);\n"
           "    } else if (artName === '炼器' && recipe.id === 'repair_canpian') {\n"
           "      // 残片修复：法宝残片（游历/秘境战利品）+ 星砂 → 重铸为可用灵珠法宝（确定性，无 RNG）\n"
           "      const repairedName = '灵珠法宝';\n"
           "      const artPower = 16;\n"
           "      const artItem = {\n"
           "        名称: repairedName, 类型: '法宝', 数量: 1,\n"
           "        描述: `法宝残片重铸而成的「${repairedName}」（法器），战力+${artPower}。`,\n"
           "        _equip: { 名称: repairedName, 类型: '法宝', 部位: 'artifact', 品阶: '法器', 等级: 3, 战力: artPower, 描述: `法宝残片重铸而成的「${repairedName}」（法器），战力+${artPower}。` },\n"
           "        价值: 200,\n"
           "      };\n"
           "      if (!canStore(state, artItem)) return ['储物袋空间不足，请先出售或扩容。'];\n"
           "      for (const [nm, cnt] of Object.entries(recipe.need)) {\n"
           "        const it = state.items.find((x) => x.名称 === nm);\n"
           "        if (!it) return ['材料不足，无法开工。'];\n"
           "        it.数量 -= cnt; if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);\n"
           "      }\n"
           "      storeItem(state, artItem);\n"
           "      state.inventory.used = inventoryUsed(state);\n"
           "      logs.push(`你将「残片法宝」投入地火，辅以「星砂」熔炼重铸，一枚「${repairedName}」（法器，战力+${artPower}）焕发新生！`);\n"
           "    } else {")
patch(sys_path, sys_old, sys_new, "systems.practiceArt.repair_canpian")

# —— 3. systems.js：游历事件池新增「残片法宝」战利品掉落 ——
relic_old = "  {\n    id: 'plain', weight: 9,"
relic_new = ("  {\n"
             "    id: 'relic_frag', weight: 5, regionBoost: { xiji: 1.3, nanming: 1.2 },\n"
             "    run(state) {\n"
             "      const logs = [];\n"
             "      const frag = { 名称: '残片法宝', 类型: '材料', 数量: 1, 描述: '法宝残片，可在百艺·炼器「残片修复」中重铸为可用法宝（需辅以星砂）。', 价值: 60 };\n"
             "      if (storeItem(state, frag)) logs.push('残垣断壁间，你拾得一截「法宝残片」，虽失灵性，仍可熔炼重铸。');\n"
             "      else logs.push('废墟中似有「法宝残片」，储物袋已满只得作罢。');\n"
             "      return { logs };\n"
             "    },\n"
             "  },\n"
             "  {\n"
             "    id: 'plain', weight: 9,")
patch(sys_path, relic_old, relic_new, "systems.wander.relic_frag")

# —— 4. codex.js：残片法宝描述改为真实可兑现说明 ——
codex_path = ROOT + "/public/js/codex.js"
codex_old = "  ['artifact', 'fan', 'eq_af_canpian', '残片法宝', '凡器', '炼器、战利品', '法宝残片，待修复成长'],"
codex_new = "  ['artifact', 'fan', 'eq_af_canpian', '残片法宝', '凡器', '炼器、战利品（游历/秘境掉落）', '法宝残片，可在百艺·炼器「残片修复」（辅以星砂）重铸为可用灵珠法宝。'],"
patch(codex_path, codex_old, codex_new, "codex.canpian.desc")

# —— 5. tests/test-newfeatures.mjs：追加确定性断言 ——
test_path = ROOT + "/tests/test-newfeatures.mjs"
test_old = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
test_block = (
    "// —— 残片法宝：死道具→炼器「残片修复」闭环（消除“待修复成长”假承诺）——\n"
    "ok(ART_RECIPES.炼器.some((r) => r.id === 'repair_canpian'), '残片修复：炼器配方已登记');\n"
    "const rcBase = JSON.parse(JSON.stringify(state));\n"
    "rcBase.items.push({ 名称: '残片法宝', 类型: '材料', 数量: 1, 描述: '法宝残片', 价值: 60 });\n"
    "rcBase.items.push({ 名称: '星砂', 类型: '材料', 数量: 1, 描述: '高阶炼器材料', 价值: 120 });\n"
    "S.practiceArt(rcBase, '炼器', 'repair_canpian');\n"
    "const rcArt = rcBase.items.find((x) => x.名称 === '灵珠法宝');\n"
    "ok(rcArt && rcArt.类型 === '法宝' && rcArt._equip && rcArt._equip.战力 === 16, '残片修复：消耗残片+星砂产出可装备灵珠法宝（战力16）');\n"
    "ok(!rcBase.items.find((x) => x.名称 === '残片法宝'), '残片修复：残片法宝已被消耗');\n"
    "ok(!rcBase.items.find((x) => x.名称 === '星砂'), '残片修复：星砂消耗1份');\n"
    "const rcNo = JSON.parse(JSON.stringify(state));\n"
    "rcNo.items.push({ 名称: '星砂', 类型: '材料', 数量: 1, 描述: '高阶炼器材料', 价值: 120 });\n"
    "const rcLogs = S.practiceArt(rcNo, '炼器', 'repair_canpian');\n"
    "ok(rcLogs.some((l) => l.includes('材料不足')), '残片修复：缺残片时拒绝并提示材料不足');\n"
    "const rcEquip = JSON.parse(JSON.stringify(rcBase));\n"
    "const rcIdx = rcEquip.items.findIndex((x) => x.名称 === '灵珠法宝');\n"
    "S.useItem(rcEquip, rcIdx);\n"
    "ok(rcEquip.equipment.artifact && rcEquip.equipment.artifact.战力 === 16, '残片修复产出可被装备，法宝槽战力+16');\n"
    "const rcFrag = JSON.parse(JSON.stringify(state));\n"
    "rcFrag.items.push({ 名称: '残片法宝', 类型: '材料', 数量: 1, 描述: '法宝残片', 价值: 60 });\n"
    "const rcFragIdx = rcFrag.items.length - 1;\n"
    "const rcFragRes = S.useItem(rcFrag, rcFragIdx);\n"
    "ok(rcFragRes === null && rcFrag.items[rcFragIdx].名称 === '残片法宝', '残片法宝：类型材料不会被误装备/误消耗');\n"
    "\n"
    "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
)
patch(test_path, test_old, test_block, "tests.repair_canpian")

print("ALL PATCHES DONE.")
