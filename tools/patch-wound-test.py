# -*- coding: utf-8 -*-
# 修正 toxicityWarning 文档注释(凝血丹→解毒丹) + 补充危机预警测试(解毒丹化解丹毒/凝血丹清伤/伤势阈值/横幅cure契约)
import io

ROOT = 'Z:/1/xiuxian'
SYS = ROOT + '/public/js/systems.js'
TST = ROOT + '/tests/test-newfeatures.mjs'

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)

def rep(s, old, new, label):
    if s.count(old) != 1:
        raise SystemExit('[FAIL] ' + label + ' count=' + str(s.count(old)))
    return s.replace(old, new, 1)

# 1) systems.js 文档注释修正（无害但避免假承诺残留）
s = read(SYS)
s = rep(s,
        " *  hint 提醒减服毒性丹药，必要时用「凝血丹」清伤（无毒副作用）。 */",
        " *  hint 提醒减服毒性丹药，必要时服「解毒丹」化解丹毒。 */",
        'toxicity.doc')
write(SYS, s)
print('[OK] systems.js 注释修正')

# 2) 测试：危险提示断言 凝血丹→解毒丹
t = read(TST)
t = rep(t,
        "ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).hint.includes('凝血丹'), '丹毒预警：危险提示含凝血丹');",
        "ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).hint.includes('解毒丹'), '丹毒预警：危险提示含解毒丹');",
        'test.toxHint')
print('[OK] 丹毒危险提示断言已改')

# 3) 解药服用闭环：原 stCure 把「丹毒危机」误用「凝血丹」清伤（语义错），改为 解毒丹化解丹毒 + 新增 凝血丹清伤 + 伤势阈值 + 横幅cure契约
OLD_BLOCK = """const stCure = JSON.parse(JSON.stringify(state));
stCure.flags = Object.assign({}, stCure.flags, { pillToxicity: 90, wounded: 2 }); // 触发 danger 预警
stCure.items.push({ 名称: '凝血丹', 类型: '丹药', 数量: 1, 描述: '清伤', effect: { heal: true }, toxicity: 0 });
const ti = stCure.items.length - 1;
ok(S.toxicityWarning(stCure).level === 'danger' && S.useItem(stCure, ti) && (stCure.flags.wounded || 0) === 0, '丹毒攻心+持有凝血丹：服用清除全部伤势');"""
NEW_BLOCK = """// 丹毒危机 → 解毒丹（真实化解丹毒，非凝血丹；对应横幅「服用解毒丹」按钮）
const toxCure = JSON.parse(JSON.stringify(state));
toxCure.flags = Object.assign({}, toxCure.flags, { pillToxicity: 90 });
toxCure.items.push({ 名称: '解毒丹', 类型: '丹药', 数量: 1, 描述: '解丹毒', effect: { detox: 30 }, toxicity: 0 });
const ti = toxCure.items.length - 1;
ok(S.toxicityWarning(toxCure).level === 'danger' && S.useItem(toxCure, ti) && toxCure.flags.pillToxicity === 60, '丹毒攻心+持有解毒丹：服用化解丹毒(90→60)');
// 重伤危机 → 凝血丹（清除全部伤势；对应横幅「服用凝血丹」按钮，与英雄卡伤势行同口径）
const woundCure = JSON.parse(JSON.stringify(state));
woundCure.flags = Object.assign({}, woundCure.flags, { wounded: 3 });
woundCure.items.push({ 名称: '凝血丹', 类型: '丹药', 数量: 1, 描述: '清伤', effect: { heal: true }, toxicity: 0 });
const wi = woundCure.items.length - 1;
ok(S.woundWarning(woundCure).level === 'danger' && S.useItem(woundCure, wi) && (woundCure.flags.wounded || 0) === 0, '身负重伤+持有凝血丹：服用清除全部伤势');
// 伤势预警阈值：0→安康、1~2月→警告、≥3月→危险（与英雄卡伤势危险行同口径）
ok(S.woundWarning({ flags: { wounded: 0 } }).level === 'ok', '伤势预警：0伤→安康');
ok(S.woundWarning({ flags: { wounded: 1 } }).level === 'warn' && S.woundWarning({ flags: { wounded: 2 } }).level === 'warn', '伤势预警：1~2月→警告');
ok(S.woundWarning({ flags: { wounded: 3 } }).level === 'danger', '伤势预警：3月→危险');
// 危机横幅「服用」按钮契约：各危险态须暴露 cure 字段（否则横幅无按钮，预警→行动断链）
ok(S.lifespanWarning(mkCrisisState({ age: 95, lifespan: 100 })).cure === '延寿丹', '危机预警契约：寿元危险提供 cure=延寿丹');
ok(S.toxicityWarning(mkCrisisState({ toxic: 90 })).cure === '解毒丹', '危机预警契约：丹毒危险提供 cure=解毒丹');
ok(S.woundWarning({ flags: { wounded: 3 } }).cure === '凝血丹', '危机预警契约：重伤危险提供 cure=凝血丹');"""
t = rep(t, OLD_BLOCK, NEW_BLOCK, 'test.cureClosure')
write(TST, t)
print('[OK] 解药服用闭环测试已重写')
