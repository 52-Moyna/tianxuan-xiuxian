# -*- coding: utf-8 -*-
"""修复天机运势(state.flags.omen)未随档持久化的 bug。
omen 驱动修炼/悟性/交易三类真实收益倍率，但 serialize 未写入、deserialize 未还原，
导致玩家存读档后手中有效运势静默消失。
ROOT 必须使用 Windows 形式（native python 不认 /z/ 挂载）。
"""
import io

ROOT = 'Z:/1/xiuxian/public/js/save.js'

with io.open(ROOT, 'r', encoding='utf-8') as f:
    s = f.read()

# 1) serialize：设置.ini 标记状态 段补写天机运势
old_ser = "        战前增益: state.flags?.nextBattleWin || 0,\n"
new_ser = old_ser + "        天机运势: state.flags?.omen || null,\n"
assert old_ser in s, "serialize 锚点未找到"
s = s.replace(old_ser, new_ser, 1)

# 2) deserialize：flags 还原块补回 omen（对象校验，避免误写入死字段/旧档兼容）
old_de = "    nextBattleWin: Number(flagsRaw.战前增益) || 0,\n"
new_de = old_de + "    // 天机运势：随档持久化，否则存读档后有效运势静默消失（修炼/悟性/交易倍率失效）\n" \
                   "    omen: (flagsRaw.天机运势 && typeof flagsRaw.天机运势 === 'object') ? flagsRaw.天机运势 : null,\n"
assert old_de in s, "deserialize 锚点未找到"
s = s.replace(old_de, new_de, 1)

with io.open(ROOT, 'w', encoding='utf-8') as f:
    f.write(s)

print("omen 持久化补丁已写入 save.js")
