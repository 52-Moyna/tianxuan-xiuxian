#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「宗门灵脉晶」接入真实炼器消费点，修复其作为死道具的问题。
- life.js：ART_RECIPES.炼器 新增「灵脉石饰」配方（消耗 宗门灵脉晶×1 + 矿石×2）
- codex.js：图鉴补充「灵脉石饰」条目（与护心甲/星纹剑等锻造产物一致）
安全写回：先 replace 再 write，严禁直接覆盖。
"""
import io, sys, os

BASE = 'Z:/1/xiuxian/public/js'

def patch(path, old, new, label):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    cnt = s.count(old)
    if cnt != 1:
        print(f'FAIL [{label}] 期望命中 1 次，实际 {cnt} 次')
        sys.exit(1)
    s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'OK [{label}] 已替换 1 处')

# 1) life.js：在 ART_RECIPES.炼器 的 星纹剑 之后插入「灵脉石饰」
life_path = os.path.join(BASE, 'life.js')
life_old = """    { id: '星纹剑', name: '星纹剑', need: { '赤铜精': 1, '星砂': 1 }, output: { name: '星纹剑', type: '装备', quantity: 1, level: 4, desc: '精炼武器，战力 +4。' }, value: 420 },
    { id: 'free', name: '自由锻造', need: { '赤铜精': 1 }, output: { type: '装备', quantity: 1, level: 3, desc: '自选部位锻造一件装备，战力随品阶浮动。' }, value: 200 },"""
life_new = """    { id: '星纹剑', name: '星纹剑', need: { '赤铜精': 1, '星砂': 1 }, output: { name: '星纹剑', type: '装备', quantity: 1, level: 4, desc: '精炼武器，战力 +4。' }, value: 420 },
    // 宗门灵脉晶真实消费点：将「宗门灵脉晶」（宗门秘境产出）作为炼器材料，使其成为可用灵材而非死道具
    { id: 'lingmai_shi', name: '灵脉石饰', need: { '宗门灵脉晶': 1, '矿石': 2 }, output: { name: '灵脉石饰', type: '装备', quantity: 1, level: 5, 部位: 'accessory', desc: '宗门秘境灵脉凝琢的石饰，温养元神，战力 +5。' }, value: 220 },
    { id: 'free', name: '自由锻造', need: { '赤铜精': 1 }, output: { type: '装备', quantity: 1, level: 3, desc: '自选部位锻造一件装备，战力随品阶浮动。' }, value: 200 },"""
patch(life_path, life_old, life_new, 'life.js ART_RECIPES.炼器')

# 2) codex.js：在「通用装备名」段的 星纹剑 之后补图鉴条目
codex_path = os.path.join(BASE, 'codex.js')
codex_old = """  ['weapon', 'fabao', 'gear_star_sword', '星纹剑', '稀有', '百艺炼器（赤铜精+星砂）', '精炼武器，星辉共鸣材料'],"""
codex_new = """  ['weapon', 'fabao', 'gear_star_sword', '星纹剑', '稀有', '百艺炼器（赤铜精+星砂）', '精炼武器，星辉共鸣材料'],
  ['accessory', 'fan', 'eq_ac_lingmai', '灵脉石饰', '凡器', '百艺炼器（宗门灵脉晶+矿石）', '宗门秘境灵脉凝琢，温养元神'],"""
patch(codex_path, codex_old, codex_new, 'codex.js 灵脉石饰图鉴')

print('全部补丁应用成功。')
