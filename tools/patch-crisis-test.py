#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""向 tests/test-newfeatures.mjs 追加状态危机预警（寿元/丹毒）确定性断言。
锚定在 reincarnate 收尾断言与汇总 console.log 之间插入。"""
import io, os

ROOT = "Z:/1/xiuxian"
path = os.path.join(ROOT, "tests/test-newfeatures.mjs")

with io.open(path, "r", encoding="utf-8") as f:
    s = f.read()

anchor = "ok(S.reincarnate(rcS, true) === null, 'reincarnate(full=true) 返回 null（完全重开走新建流程）');\n\nconsole.log(`"
if anchor not in s:
    raise SystemExit("[FAIL] test 锚点未命中")

block = """// ---------- 状态危机预警（寿元/丹毒）纯函数 ----------
function mkCrisisState({ age = 30, lifespan = 100, toxic = 0 } = {}) {
  return {
    player: { age, lifespan, level: 10, daoBase: { '根骨': { level: 1 } } },
    flags: { pillToxicity: toxic },
  };
}
// 寿元预警：安康 / 警告 / 危险 三档
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 100 })).level === 'ok', '寿元预警：余寿70年→安康');
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 100 })).lifeLeft === 70, '寿元预警：lifeLeft=余寿计算正确(70)');
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 45 })).level === 'warn', '寿元预警：余寿15年→警告');
ok(S.lifespanWarning(mkCrisisState({ age: 90, lifespan: 100 })).level === 'warn', '寿元预警：余寿10年→警告(>8)');
ok(S.lifespanWarning(mkCrisisState({ age: 95, lifespan: 100 })).level === 'danger', '寿元预警：余寿5年→危险');
ok(S.lifespanWarning(mkCrisisState({ age: 30, lifespan: 45 })).hint.includes('延寿丹'), '寿元预警：警告提示含延寿丹途径');
ok(S.lifespanWarning(mkCrisisState({ age: 95, lifespan: 100 })).hint.includes('转世'), '寿元预警：危险提示含转世途径');
// 丹毒预警：清净 / 警告 / 危险 三档
ok(S.toxicityWarning(mkCrisisState({ toxic: 0 })).level === 'ok', '丹毒预警：0→清净');
ok(S.toxicityWarning(mkCrisisState({ toxic: 50 })).level === 'ok', '丹毒预警：50→清净(阈值60)');
ok(S.toxicityWarning(mkCrisisState({ toxic: 60 })).level === 'warn', '丹毒预警：60→警告');
ok(S.toxicityWarning(mkCrisisState({ toxic: 85 })).level === 'danger', '丹毒预警：85→危险');
ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).level === 'danger', '丹毒预警：90→危险');
ok(S.toxicityWarning(mkCrisisState({ toxic: 70 })).hint.includes('凝血丹'), '丹毒预警：警告提示含凝血丹解毒途径');
ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).hint.includes('凝血丹'), '丹毒预警：危险提示含凝血丹');
// 纯函数：完全不改动原状态
const cst = mkCrisisState({ age: 95, lifespan: 100, toxic: 90 });
S.lifespanWarning(cst); S.toxicityWarning(cst);
ok(cst.player.age === 95 && cst.player.lifespan === 100 && cst.flags.pillToxicity === 90, '危机预警纯函数：完全不改动原状态');

"""

new = "ok(S.reincarnate(rcS, true) === null, 'reincarnate(full=true) 返回 null（完全重开走新建流程）');\n\n" + block + "console.log(`"

if new in s:
    print("[SKIP] 断言已存在")
else:
    s = s.replace(anchor, new, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print("[OK] 已追加危机预警断言")
