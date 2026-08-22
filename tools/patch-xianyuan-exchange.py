# -*- coding: utf-8 -*-
# 修复：仙缘(xianyuan) 掉落被错误命名为「妖兽仙缘」(幽灵物) + 接入真实消费者「仙缘兑换」
import io, sys

def patch(path, repls):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    for old, new, name in repls:
        cnt = s.count(old)
        if cnt != 1:
            raise SystemExit(f"[FAIL] {path} :: 锚点不唯一或缺失：{name} (count={cnt})")
        s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f"[OK] {path} 应用 {len(repls)} 处替换")

# ---------------- systems.js ----------------
sys_p = 'public/js/systems.js'
sys_repls = [
    # 1) 掉落命名修复：xianyuan 掉落为真实「仙缘」，不再生成幽灵物「妖兽仙缘」
    (
        "      const dropName = tpl.id === 'kuangshi' ? '矿石' : `妖兽${tpl.name}`;",
        "      const dropName = tpl.id === 'kuangshi' ? '矿石' : (tpl.id === 'xianyuan' ? '仙缘' : `妖兽${tpl.name}`);",
        "dropName-xianyuan"
    ),
    # 2) performAction 新增 xianyuanExchange（确定性收益，仿 taichuXianyuan 模式）
    (
        "    /* market / art / socialList / auction / tameBeast / sectTask 由 UI 打开子界面处理，不在此处结算 */",
        "    case 'xianyuanExchange': {\n"
        "      // 仙缘：于罗盘「仙缘兑换」换得道途助益（确定性收益，无 RNG、无风险）\n"
        "      const held = state.items.filter((i) => i.名称 === '仙缘');\n"
        "      const cnt = held.reduce((s, i) => s + (i.数量 || 1), 0);\n"
        "      if (cnt < 1) { logs.push('你手中尚无「仙缘」，无缘兑换。'); break; }\n"
        "      const it = held[0];\n"
        "      it.数量 -= 1;\n"
        "      if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);\n"
        "      gainExp(state, 200, logs);\n"
        "      addDaoYunExp(state, 15, logs);\n"
        "      addDaoBaseExp(state, '悟性', 20, logs);\n"
        "      addStones(state, 300);\n"
        "      logs.push('✨ 仙缘加身，修为+200、道韵+15、悟性+20、下品灵石+300。一段寻常机缘就此落定。');\n"
        "      break;\n"
        "    }\n"
        "    /* market / art / socialList / auction / tameBeast / sectTask 由 UI 打开子界面处理，不在此处结算 */",
        "performAction-xianyuanExchange"
    ),
    # 3) extraCompassOptions 新增「仙缘兑换」选项（持有仙缘时出现）
    (
        "  return opts;\n}",
        "  // 仙缘兑换（持有「仙缘」时出现）：寻常机缘变现为道途助益（确定性、无 RNG、无风险）\n"
        "  const xy = state.items.filter((i) => i.名称 === '仙缘').reduce((sum, i) => sum + (i.数量 || 1), 0);\n"
        "  if (xy >= 1) {\n"
        "    opts.push({ icon: '🍀', tag: '天机', title: '仙缘兑换·道途助益', desc: `持「仙缘」×1，于坊间奇人处兑换一段道途助益：修为+200、道韵+15、悟性+20、下品灵石+300。当前持有 ${xy} 份。`, action: { type: 'xianyuanExchange' }, preview: '收益：修为/道韵/悟性 + 下品灵石 300（确定性）' });\n"
        "  }\n"
        "  return opts;\n}",
        "extraCompass-仙缘兑换"
    ),
]
patch(sys_p, sys_repls)

# ---------------- data.js ----------------
data_p = 'public/js/data.js'
data_repls = [
    (
        "  { id: 'xianyuan', name: '仙缘',  type: '材料', desc: '罕见机缘之物，价值不菲。', value: 300 },",
        "  { id: 'xianyuan', name: '仙缘',  type: '材料', desc: '罕见机缘之物，可于罗盘「仙缘兑换」换得道途助益。', value: 300 },",
        "data-xianyuan-desc"
    ),
    (
        "  { id: 'yaodan',   name: '妖丹',  type: '材料', desc: '妖兽精华，可炼丹或出售。', value: 80 },",
        "  { id: 'yaodan',   name: '妖丹',  type: '材料', desc: '妖兽精华内丹（旧称），可出售。', value: 80 },",
        "data-yaodan-desc"
    ),
]
patch(data_p, data_repls)

# ---------------- codex.js ----------------
codex_p = 'public/js/codex.js'
codex_repls = [
    (
        "  { id: 'mat_xianyuan', category: '材料', name: '仙缘', rarity: '稀有材料', source: '高阶妖兽战利品（极低概率）', effect: '罕见机缘之物，价值不菲，可用于特殊交易。' },",
        "  { id: 'mat_xianyuan', category: '材料', name: '仙缘', rarity: '稀有材料', source: '高阶妖兽战利品（极低概率）', effect: '罕见机缘之物，可于罗盘「仙缘兑换」换得道途助益：修为+200、道韵+15、悟性+20、下品灵石+300。' },",
        "codex-xianyuan-effect"
    ),
    (
        "  { id: 'mat_yaodan', category: '材料', name: '妖丹', rarity: '材料', source: '妖兽战利品（各妖兽掉落专属内丹，如青风狼内丹；通用妖丹为旧称）', effect: '妖兽精华内丹，可炼丹、炼器或出售。' },",
        "  { id: 'mat_yaodan', category: '材料', name: '妖丹', rarity: '材料', source: '妖兽战利品（各妖兽掉落专属内丹，如青风狼内丹；通用妖丹为旧称，现已不再掉落）', effect: '妖兽精华内丹，可出售。' },",
        "codex-yaodan-effect"
    ),
]
patch(codex_p, codex_repls)

print("ALL PATCHES APPLIED")
