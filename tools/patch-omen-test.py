# -*- coding: utf-8 -*-
"""test-save.mjs 增加天机运势(omen)存档往返断言。
ROOT 必须使用 Windows 形式（native python 不认 /z/ 挂载）。
"""
import io

ROOT = 'Z:/1/xiuxian/tests/test-save.mjs'
with io.open(ROOT, 'r', encoding='utf-8') as f:
    s = f.read()

# 1) 制造真实运势状态（在 serialize 之前）
a1 = "st.flags.nextBattleWin = 5;\n"
b1 = (a1
      + "// 天机运势：驱动修炼/悟性/交易倍率，必须随档持久化（否则存读档后有效运势静默消失）\n"
      + "st.flags.omen = { kind: 'cultivate', icon: '🌟', label: '紫气东来', desc: '近期修炼倍率提升', mul: 1.15, add: 0, expireYear: st.world.year + 1, expireMonth: st.world.month };\n")
assert a1 in s, "setup 锚点未找到"
s = s.replace(a1, b1, 1)

# 2) 往返断言（天机运势保留）
a2 = "ok('战前增益保留', rt.flags.nextBattleWin === 5);\n"
b2 = (a2
      + "ok('天机运势对象保留', !!rt.flags.omen);\n"
      + "ok('天机运势类型保留', rt.flags.omen && rt.flags.omen.kind === 'cultivate');\n"
      + "ok('天机运势倍率保留', rt.flags.omen && Math.abs(rt.flags.omen.mul - 1.15) < 1e-9);\n")
assert a2 in s, "assert 锚点未找到"
s = s.replace(a2, b2, 1)

# 3) 旧档（无 omen）兼容：缺字段还原为 null
a3 = "ok('旧档战前增益默认0', rt3.flags.nextBattleWin === 0);\n"
b3 = a3 + "ok('旧档天机运势默认null', rt3.flags.omen === null);\n"
assert a3 in s, "legacy 锚点未找到"
s = s.replace(a3, b3, 1)

with io.open(ROOT, 'w', encoding='utf-8') as f:
    f.write(s)
print("omen 存档往返测试已写入 test-save.mjs")
