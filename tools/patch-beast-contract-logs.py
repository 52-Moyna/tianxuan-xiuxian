#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修正：tameBeast 内无 logs 变量（上一补丁误用）

tameBeast 是「直接 return { ok, logs: [...] }」风格，函数体内并没有 logs 变量，
直接传 logs 会抛 ReferenceError。改为局部 extra 数组收集满仓提示，再并入返回 logs。
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def sub_once(text, old, new, tag):
    if old not in text:
        print('[MISS] ' + tag)
        sys.exit(1)
    if text.count(old) != 1:
        print('[DUP] %s -> %d' % (tag, text.count(old)))
        sys.exit(1)
    print('[OK] ' + tag)
    return text.replace(old, new)


p = os.path.join(ROOT, 'public', 'js', 'systems.js')
s = read(p)

OLD = """    // 收服成功赠予「灵兽契约」作为驯兽凭证（见证羁绊）；仅在缺失时补发，避免重复累积。
    if (!state.items.some((i) => i.名称 === '灵兽契约')) {
      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。', 价值: 0, effect: { beastSlot: 1 } };
      // 满仓提示：旧写法无条件 storeItem + discoverItem，储物袋满时图鉴解锁了「灵兽契约」、
      // 行囊里却没有实物，玩家翻遍行囊找不着，以为是 bug。
      if (storeItemOrNote(state, contract, logs, '⚠ 储物袋已满，「灵兽契约」未能带走（灵兽已收服，可腾出格子后重新收服补领）。')) {
        discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });
      }
    }"""

NEW = """    // 收服成功赠予「灵兽契约」作为驯兽凭证（见证羁绊）；仅在缺失时补发，避免重复累积。
    // 本函数是「直接 return { ok, logs }」风格，函数体内没有 logs 变量，
    // 故用局部 extra 收集满仓提示，再在返回时并入，避免 ReferenceError。
    const extra = [];
    if (!state.items.some((i) => i.名称 === '灵兽契约')) {
      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。', 价值: 0, effect: { beastSlot: 1 } };
      // 满仓提示：旧写法无条件 storeItem + discoverItem，储物袋满时图鉴解锁了「灵兽契约」、
      // 行囊里却没有实物，玩家翻遍行囊找不着，以为是 bug。
      if (storeItemOrNote(state, contract, extra, '⚠ 储物袋已满，「灵兽契约」未能带走（灵兽已收服，可腾出格子后再次收服补领）。')) {
        discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });
      }
    }"""

s = sub_once(s, OLD, NEW, 'tameBeast: extra 替代 logs')

OLD2 = """    return { ok: true, logs: [`你成功收服「${beast.name}」！${beast.desc} 战力 +${beast.power}。${foodNote}`] };"""
NEW2 = """    return { ok: true, logs: [`你成功收服「${beast.name}」！${beast.desc} 战力 +${beast.power}。${foodNote}`, ...extra] };"""
s = sub_once(s, OLD2, NEW2, 'tameBeast: 返回并入 extra')

write(p, s)
print('DONE')
