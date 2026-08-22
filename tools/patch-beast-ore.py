#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""天玄修仙录 · 兽材百艺闭环补丁（矿石掉落对齐 + 兽材接入制符/炼丹）"""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYS = os.path.join(ROOT, 'public', 'js', 'systems.js')
LIFE = os.path.join(ROOT, 'public', 'js', 'life.js')
CODEX = os.path.join(ROOT, 'public', 'js', 'codex.js')


def patch(path, replacements):
    with io.open(path, encoding='utf-8') as f:
        s = f.read()
    for old, new in replacements:
        cnt = s.count(old)
        assert cnt == 1, "[%s] 期望匹配1次却匹配%d次:\n%s" % (os.path.basename(path), cnt, old[:80])
        s = s.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print("[ok] %s 改动 %d 处" % (os.path.basename(path), len(replacements)))


sys_repl = [
    (
        "      drops.push({ 名称: `妖兽${tpl.name}`, 类型: tpl.type, 数量: qty, 描述: tpl.desc, 价值: Math.round(tpl.value * (1 + lv / 50) * dangerMul) });",
        "      // 矿石为基础材料，按通用名掉落（与灵脉石饰配方、图鉴对齐）；其余兽材保留「妖兽」前缀\n"
        "      const dropName = tpl.id === 'kuangshi' ? '矿石' : `妖兽${tpl.name}`;\n"
        "      drops.push({ 名称: dropName, 类型: tpl.type, 数量: qty, 描述: tpl.desc, 价值: Math.round(tpl.value * (1 + lv / 50) * dangerMul) });",
    ),
]

life_repl = [
    (
        "    { id: '护身符', name: '护身符', need: { '冰魄符纸': 1, '海灵珠': 1 }, output: { name: '护身符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '战斗失败时减轻损失。' }, value: 100 },",
        "    { id: '护身符', name: '护身符', need: { '冰魄符纸': 1, '海灵珠': 1 }, output: { name: '护身符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '战斗失败时减轻损失。' }, value: 100 },\n"
        "    // 兽材闭环：妖兽皮毛 → 兽皮护符（ward），落实图鉴\"可制防具或符箓\"\n"
        "    { id: 'pelt_talisman', name: '兽皮护符', need: { '妖兽皮毛': 3 }, output: { name: '兽皮护符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '以妖兽皮毛揉制的护符，战斗失败时减轻损失。' }, value: 120 },",
    ),
    (
        "    { id: '凝血丹', name: '凝血丹', need: { '百年灵芝': 1, '青风狼内丹': 1 }, output: { name: '凝血丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除伤势。' }, value: 90 },",
        "    { id: '凝血丹', name: '凝血丹', need: { '百年灵芝': 1, '青风狼内丹': 1 }, output: { name: '凝血丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除伤势。' }, value: 90 },\n"
        "    // 兽材闭环：妖兽灵草 → 凝元丹（exp）；妖兽兽骨 → 兽骨续命丹（heal）\n"
        "    { id: 'ningyuan', name: '凝元丹', need: { '妖兽灵草': 2 }, output: { name: '凝元丹', type: '丹药', quantity: 1, effect: { exp: 100 }, desc: '服用后修为 +100。' }, value: 110 },\n"
        "    { id: 'shougu_dan', name: '兽骨续命丹', need: { '妖兽兽骨': 2 }, output: { name: '兽骨续命丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除全部伤势。' }, value: 90 },",
    ),
]

codex_repl = [
    (
        "  { id: 'item_ward', category: '道具', name: '护身符', rarity: '消耗品', source: '制符、坊市、秘境', effect: '下一次战斗失败时减轻损失（修为不跌、灵石不减）。' },",
        "  { id: 'item_ward', category: '道具', name: '护身符', rarity: '消耗品', source: '制符、坊市、秘境', effect: '下一次战斗失败时减轻损失（修为不跌、灵石不减）。' },\n"
        "  { id: 'item_pelt_talisman', category: '道具', name: '兽皮护符', rarity: '消耗品', source: '百艺制符（妖兽皮毛）', effect: '下一次战斗失败时减轻损失（修为不跌、灵石不减）。' },",
    ),
    (
        "  { id: 'pill_heal', category: '丹药', name: '凝血丹', rarity: '消耗品', source: '坊市、炼丹、道友回礼', effect: '立即清除全部伤势；无毒副作用。', toxicity: 0 },",
        "  { id: 'pill_heal', category: '丹药', name: '凝血丹', rarity: '消耗品', source: '坊市、炼丹、道友回礼', effect: '立即清除全部伤势；无毒副作用。', toxicity: 0 },\n"
        "  { id: 'pill_ningyuan', category: '丹药', name: '凝元丹', rarity: '消耗品', source: '百艺炼丹（妖兽灵草）', effect: '服用后修为 +100；连续服用会产生丹毒。', toxicity: 8 },\n"
        "  { id: 'pill_shougu', category: '丹药', name: '兽骨续命丹', rarity: '消耗品', source: '百艺炼丹（妖兽兽骨）', effect: '立即清除全部伤势；无毒副作用。', toxicity: 0 },",
    ),
    (
        "  { id: 'mat_yaodan', category: '材料', name: '妖丹', rarity: '材料', source: '妖兽战利品（必掉）', effect: '妖兽精华内丹，可炼丹、炼器或出售。' },",
        "  { id: 'mat_yaodan', category: '材料', name: '妖丹', rarity: '材料', source: '妖兽战利品（各妖兽掉落专属内丹，如青风狼内丹；通用妖丹为旧称）', effect: '妖兽精华内丹，可炼丹、炼器或出售。' },",
    ),
    (
        "  { id: 'mat_kuangshi', category: '材料', name: '矿石', rarity: '材料', source: '妖兽战利品（概率）、 mining', effect: '炼器基础材料，各地域矿脉产出不同。' },",
        "  { id: 'mat_kuangshi', category: '材料', name: '矿石', rarity: '材料', source: '妖兽战利品（概率）、百艺炼器消耗', effect: '炼器基础材料，可用于灵脉石饰等配方。' },",
    ),
    (
        "  { id: 'mat_shougu', category: '材料', name: '兽骨', rarity: '材料', source: '妖兽战利品（概率）', effect: '炼器或入药的材料，硬骨质。' },",
        "  { id: 'mat_shougu', category: '材料', name: '兽骨', rarity: '材料', source: '妖兽战利品（概率）', effect: '百艺炼丹（兽骨续命丹）或炼器材料，硬骨质。' },",
    ),
    (
        "  { id: 'mat_pimao', category: '材料', name: '皮毛', rarity: '材料', source: '妖兽战利品（概率）', effect: '可制防具或符箓的皮料。' },",
        "  { id: 'mat_pimao', category: '材料', name: '皮毛', rarity: '材料', source: '妖兽战利品（概率）', effect: '百艺制符（兽皮护符）的皮料。' },",
    ),
]

patch(SYS, sys_repl)
patch(LIFE, life_repl)
patch(CODEX, codex_repl)
print("全部补丁应用完成。")
