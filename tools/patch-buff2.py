# -*- coding: utf-8 -*-
import io
BASE = 'Z:/1/xiuxian/'

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()
def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)
def edit(p, old, new, count=1):
    s = read(p)
    n = s.count(old)
    if n != count:
        print(f'[MISS] {p} 期望 {count} 实际 {n}')
        return False
    s = s.replace(old, new, 1)
    write(p, s)
    print(f'[OK] {p} 替换成功')
    return True

# life.js ensureLifeState 的 flags 初始化后补充 buffs 归一化（唯一锚点：后接 omen 判断）
L = BASE + 'public/js/life.js'
edit(L,
     "  state.flags = state.flags || {};\n  if (state.flags.omen && typeof state.flags.omen !== 'object') state.flags.omen = null;",
     "  state.flags = state.flags || {};\n  state.buffs = (state.buffs && typeof state.buffs === 'object') ? state.buffs : {};\n  state.buffs.power = Number(state.buffs.power) || 0;\n  state.buffs.expireMonth = Number(state.buffs.expireMonth) || 0;\n  if (state.flags.omen && typeof state.flags.omen !== 'object') state.flags.omen = null;",
     count=1)

# test-newfeatures.mjs 在汇总打印前插入临时战力增益专项测试
T = BASE + 'tests/test-newfeatures.mjs'
TEST_BLOCK = '''/* ---------- 临时战力增益（丹药增益 buff） ---------- */
// 直接构造一颗狂战丹并服用，验证 buff 生效、战力提升、跨月过期、存档往返、解锁判定
const beforePower = S.calcPower(state);
state.items.push({ 名称: '狂战丹', 类型: '丹药', 数量: 1, 描述: '测试', effect: { power: 150, powerMonths: 3 }, toxicity: 0 });
const buffIdx = state.items.length - 1;
const buffLogs = S.useItem(state, buffIdx);
ok(buffLogs && buffLogs.some((l) => l.includes('战力临时')), '服用战力丹写入临时增益日志');
ok(state.buffs && state.buffs.power === 150, 'buffs.power 已置为 150');
ok(state.buffs && state.buffs.expireMonth === state.world.year * 12 + state.world.month + 3, 'buffs 过期月份=当前+3');
ok(S.calcPower(state) === beforePower + 150, '临时战力增益已计入 calcPower（+150）');
const buffBd = S.powerBreakdown(state);
ok(buffBd.items.find((x) => x.label === '丹药增益').value === 150, '战力拆解丹药增益项=150');
ok(S.activeBuffPower(state) === 150, 'activeBuffPower 返回当前增益 150');
// 跨月推进 3 个月后过期
for (let i = 0; i < 3; i++) { state.world.month++; if (state.world.month > 12) { state.world.month = 1; state.world.year++; } }
S.refreshDerived(state);
ok(S.activeBuffPower(state) === 0, '3 月后临时增益过期（activeBuffPower=0）');
ok(S.calcPower(state) === beforePower, '过期后战力回落至服用前');
// 存档往返（过期态应被清理为 power=0）
let ser = serialize(state);
let de = deserialize(ser);
ok(de.buffs && de.buffs.power === 0, '存档往返：过期态 buffs.power=0');
// 未过期 buff 持久化
state.buffs = { power: 100, expireMonth: state.world.year * 12 + state.world.month + 2 };
ser = serialize(state);
de = deserialize(ser);
ok(de.buffs && de.buffs.power === 100 && de.buffs.expireMonth === state.world.year * 12 + state.world.month + 2, '未过期 buff 存档往返正确');
// 解锁判定：筑基期（21级）解锁、低等级不解锁
ok(isRecipeUnlocked({ player: { level: 21 }, sect: { rank: 0 }, arts: { 炼丹: { level: 0 } }, flags: {} }, '狂战丹') === true, '狂战丹在筑基期（21级）解锁');
ok(isRecipeUnlocked(state, '狂战丹') === false, '狂战丹在低等级未解锁');

'''
edit(T,
     "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);",
     TEST_BLOCK + "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);",
     count=1)

print('=== 补丁2 执行完毕 ===')
