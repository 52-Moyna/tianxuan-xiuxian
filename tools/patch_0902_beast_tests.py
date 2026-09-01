# -*- coding: utf-8 -*-
"""补灵兽放归回归测试（test-newfeatures.mjs）。
背景：releaseBeast 早已实现但从未接线到 UI，灵兽栏满后玩家无法换更强灵兽（死锁）。
本测试把「放归 → 腾栏位 → 可再收服」这条链路固化下来，防止回归。
"""
import io, sys

P = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


src = read(P)

# --- 1) import 补充 canTameBeast（codex.js 导出） ---
old_imp = "beastPowerBonus, ensureBeastState, availableMysticRealms,"
new_imp = "beastPowerBonus, ensureBeastState, canTameBeast, availableMysticRealms,"
if old_imp not in src:
    print('!! import 锚点未命中'); sys.exit(1)
src = src.replace(old_imp, new_imp, 1)
print('OK import canTameBeast')

# --- 2) 在「灵石不足时拒绝升星」之后插入放归测试段 ---
anchor = "ok(!upPoor.ok && state.beasts.slots[state.beasts.slots.length - 1].star === 1, '灵石不足时拒绝升星');\n"
if src.count(anchor) != 1:
    print('!! 插入锚点命中 %d 次' % src.count(anchor)); sys.exit(1)

block = anchor + """
/* ---------- 灵兽放归（UI 入口接线，消除「栏满即死锁」） ---------- */
{
  const bs = ensureBeastState(state);
  // 造一个「栏位 = 2、已占满」的局面：满栏时 canTameBeast 为假，罗盘不再出现灵兽栖息地
  bs.maxSlots = 2;
  bs.slots = [
    { name: '青风狼', element: '风', power: 30, skill: '风刃突袭', desc: '弱', star: 1, tamed: true },
    { name: '赤焰狐', element: '火', power: 90, skill: '吐息', desc: '强', star: 2, tamed: true },
  ];
  bs.activeIdx = 1;
  ok(bs.slots.length === 2 && !canTameBeast(state), '灵兽栏占满时不可再收服（死锁前提）');

  // 放归出战中的那一只：栏位腾出、不可再收服状态解除、出战索引不越界
  const msg = S.releaseBeast(state, 1);
  ok(bs.slots.length === 1 && bs.slots[0].name === '青风狼', '放归指定灵兽，剩余栏位正确');
  ok(typeof msg === 'string' && msg.includes('赤焰狐'), '放归返回可读提示（含灵兽名）');
  ok(bs.activeIdx === 0, '放归出战灵兽后出战索引回落到 0（不越界）');
  ok(canTameBeast(state), '放归后恢复可收服，死锁解除');

  // 放归中间索引时，出战索引正确前移（避免「出战对象错位」类事故）
  bs.maxSlots = 3;
  bs.slots = [
    { name: 'A兽', element: '水', power: 10, skill: 'x', desc: '', star: 1, tamed: true },
    { name: 'B兽', element: '土', power: 10, skill: 'x', desc: '', star: 1, tamed: true },
    { name: 'C兽', element: '雷', power: 10, skill: 'x', desc: '', star: 1, tamed: true },
  ];
  bs.activeIdx = 2;
  S.releaseBeast(state, 0);
  ok(bs.activeIdx === 1 && bs.slots[1].name === 'C兽', '放归前方灵兽后出战索引前移，仍指向同一只');

  // 越界 / 空位：返回提示而非抛错，UI 可安全调用
  ok(typeof S.releaseBeast(state, 99) === 'string', '放归越界索引返回提示而不抛错');
  S.releaseBeast(state, 0); S.releaseBeast(state, 0);
  ok(bs.slots.length === 0 && bs.activeIdx === -1, '放空全部灵兽后出战索引为 -1');

  // 存档往返：放归结果必须能落盘（不可逆操作）
  bs.maxSlots = 2;
  bs.slots = [{ name: '存档兽', element: '幻', power: 12, skill: 'x', desc: '', star: 1, tamed: true }];
  bs.activeIdx = 0;
  S.releaseBeast(state, 0);
  const back = deserialize(serialize(state));
  ensureBeastState(back);
  ok((back.beasts.slots || []).length === 0, '放归结果存读档往返后保持（不会「复活」）');
}
"""

src = src.replace(anchor, block, 1)
write(P, src)
print('OK 插入放归测试段')
print('完成')
