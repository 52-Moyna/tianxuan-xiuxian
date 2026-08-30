# -*- coding: utf-8 -*-
"""补丁：百艺护符产物描述按实际战斗口径精确化（高阶挡重伤，低阶护灵石）。"""
import io
L = 'public/js/life.js'
s = io.open(L, encoding='utf-8').read()
pairs = [
    ("output: { name: '护身符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '战斗失败时减轻损失。' }",
     "output: { name: '护身符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '高阶护符，战斗败北时自动消耗一件，挡去重伤与修为倒退并护住灵石。' }"),
    ("output: { name: '兽皮护符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '以妖兽皮毛揉制的护符，战斗失败时减轻损失。' }",
     "output: { name: '兽皮护符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '以妖兽皮毛揉制的低阶护符，战斗败北时自动消耗一件，护住灵石分毫未失。' }"),
]
for old, new in pairs:
    assert s.count(old) == 1, f'锚点异常：{old[:40]}'
    s = s.replace(old, new)
io.open(L, 'w', encoding='utf-8', newline='\n').write(s)
print('护符描述已精确化')
