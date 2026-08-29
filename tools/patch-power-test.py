# -*- coding: utf-8 -*-
import io

ROOT = 'Z:/1/xiuxian'
path = 'tests/test-newfeatures.mjs'
with io.open(ROOT + '/' + path, 'r', encoding='utf-8') as f:
    s = f.read()

anchor = "\nconsole.log(`\n===== 本轮新功能专项测试："
assert s.count(anchor) == 1, ('anchor count', s.count(anchor))

block = """
// 战力构成摘要（英雄卡战力悬浮拆解，纯函数、与 powerBreakdown 同口径）
const ps = S.powerSummary(state);
ok(typeof ps === 'string' && ps.includes('境界修为') && ps.includes('合计'), '战力构成摘要含各项与合计');
const _bd = S.powerBreakdown(state);
ok(ps.includes(`合计 ${_bd.total}`), '战力构成摘要合计与 powerBreakdown 一致');
state.buffs = { power: 120, expireMonth: state.world.year * 12 + state.world.month + 3 };
const ps2 = S.powerSummary(state);
ok(ps2.includes('丹药增益 120'), '战力构成摘要含临时丹药增益');
state.buffs = { power: 0, expireMonth: 0 };

"""

new = "\n" + block + "console.log(`\n===== 本轮新功能专项测试："
s = s.replace(anchor, new, 1)
with io.open(ROOT + '/' + path, 'w', encoding='utf-8') as f:
    f.write(s)
print('[OK] test patched')
