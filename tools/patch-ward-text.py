# -*- coding: utf-8 -*-
"""补丁：护身道具文案按高阶/低阶精确区分（消除假承诺）。
resolveBattle 实际口径：wardKind==='ward'（高阶「护身符」）才挡重伤/修为倒退；
低阶护符（低阶护身符/低阶符箓/简易阵旗/兽皮护符）仅护住灵石不失。"""
import io

SYS = 'public/js/systems.js'
s = io.open(SYS, encoding='utf-8').read()
old = "  if (eff.ward) return { mode: 'auto', label: '', text: '护身道具：战斗败北时自动消耗一件，替你挡去重伤' };"
new = ("  if (eff.ward) return { mode: 'auto', label: '',\n"
       "    text: it.名称 === '护身符'\n"
       "      ? '高阶护身道具：战斗败北时自动消耗一件，挡去重伤与修为倒退，并护住灵石'\n"
       "      : '低阶护身道具：战斗败北时自动消耗一件，护住灵石分毫未失（重伤仍会承受）' };")
assert s.count(old) == 1, 'ward 文案锚点异常'
s = s.replace(old, new)
io.open(SYS, 'w', encoding='utf-8', newline='\n').write(s)

UI = 'public/js/ui.js'
u = io.open(UI, encoding='utf-8').read()
oldu = """        ? '持有护身道具 ' + wardCount + ' 件' + (hasHigh ? '（含高阶护身符：败北时挡重伤并护住灵石）' : '（败北时自动消耗一件替你挡去重伤）')"""
newu = """        ? '持有护身道具 ' + wardCount + ' 件' + (hasHigh ? '（含高阶护身符：败北时挡去重伤与修为倒退，并护住灵石）' : '（低阶护符：败北时自动消耗一件护住灵石，重伤仍会承受）')"""
assert u.count(oldu) == 1, 'ui ward tooltip 锚点异常'
u = u.replace(oldu, newu)
io.open(UI, 'w', encoding='utf-8', newline='\n').write(u)
print('护符文案已精确化')
