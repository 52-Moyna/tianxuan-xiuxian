# -*- coding: utf-8 -*-
import io
BASE = 'Z:/1/xiuxian/'
def read(p):
    with io.open(p, 'r', encoding='utf-8') as f: return f.read()
def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f: f.write(s)
def edit(p, old, new, count=1):
    s = read(p); n = s.count(old)
    if n != count: print(f'[MISS] {p} 期望 {count} 实际 {n}'); return
    write(p, s.replace(old, new, 1)); print(f'[OK] {p}')

# cultivation: 补合法 expireMonth（模拟未过期丹药增益计入战力）
edit(BASE + 'tests/test-cultivation.mjs',
     "  base.buffs = { power: 5000 }; // 丹药增益计入战力，验证渡劫参考战力",
     "  base.buffs = { power: 5000, expireMonth: 99999 }; // 丹药增益计入战力（未过期），验证渡劫参考战力",
     count=1)

# newfeatures: 低等级未解锁断言改用干净的 Lv.1 状态（避免主测试 state 的炼丹艺已被前序用例升级导致误判）
edit(BASE + 'tests/test-newfeatures.mjs',
     "ok(isRecipeUnlocked(state, '狂战丹') === false, '狂战丹在低等级未解锁');",
     "ok(isRecipeUnlocked({ player: { level: 1 }, sect: { rank: 0 }, arts: { 炼丹: { level: 0 } }, flags: {} }, '狂战丹') === false, '狂战丹在低等级未解锁');",
     count=1)
print('=== 补丁3 完成 ===')
