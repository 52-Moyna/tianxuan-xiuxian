# -*- coding: utf-8 -*-
"""仅修正测试插入位置（按行定位，规避换行符差异）。"""
import io, os
ROOT = 'Z:/1/xiuxian'
p = os.path.join(ROOT, 'tests/test-newfeatures.mjs')
with io.open(p, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

block = '''/* ---------- 灵兽收服成功率预览（确定性，无 RNG） ---------- */
{
  const tb = S.createNewGame({ name: '收服率预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(tb);
  const tpl = { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' };
  ok(S.tameBeastRate(tb, tpl, false) === 30, `收服率·御兽0级基础为30(${S.tameBeastRate(tb, tpl, false)})`);
  tb.arts['御兽'] = { name: '御兽', level: 10, 经验: 0 };
  ok(S.tameBeastRate(tb, tpl, false) === 50, `收服率·御兽10级=50(${S.tameBeastRate(tb, tpl, false)})`);
  storeItem(tb, { 名称: '驯兽口粮', 类型: '消耗品', 数量: 1, effect: { tame: 15 }, 描述: '测试' });
  ok(S.tameBeastRate(tb, tpl, false) === 65, `收服率·含驯兽口粮=65(${S.tameBeastRate(tb, tpl, false)})`);
  storeItem(tb, { 名称: '驭兽香', 类型: '消耗品', 数量: 1, effect: { tame: 20 }, 描述: '测试' });
  ok(S.tameBeastRate(tb, tpl, true) === 85, `收服率·用驭兽香=85(${S.tameBeastRate(tb, tpl, true)})`);
  const highTpl = { name: '高阶灵兽', power: 5, minLevel: 50, desc: '测试' };
  const lowPlayer = S.createNewGame({ name: '低阶', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(lowPlayer);
  lowPlayer.player.level = 1;
  ok(S.tameBeastRate(lowPlayer, highTpl, false) === 10, `收服率·低于minLevel封底10(${S.tameBeastRate(lowPlayer, highTpl, false)})`);
  const cap = S.createNewGame({ name: '封顶', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cap);
  cap.arts['御兽'] = { name: '御兽', level: 80, 经验: 0 };
  ok(S.tameBeastRate(cap, tpl, false) === 90, `收服率·高御兽等级封顶90(${S.tameBeastRate(cap, tpl, false)})`);
  const beforeFood = tb.items.find((i) => i.名称 === '驯兽口粮')?.数量;
  const beforeInc = tb.items.find((i) => i.名称 === '驭兽香')?.数量;
  S.tameBeastRate(tb, tpl, true); S.tameBeastRate(tb, tpl, true);
  ok(tb.items.find((i) => i.名称 === '驯兽口粮')?.数量 === beforeFood, 'tameBeastRate 不消耗驯兽口粮');
  ok(tb.items.find((i) => i.名称 === '驭兽香')?.数量 === beforeInc, 'tameBeastRate 不消耗驭兽香');
  const rb = S.tameBeast(tb, tpl, false);
  ok(rb && typeof rb.ok === 'boolean' && Array.isArray(rb.logs), 'tameBeast 仍返回结构化结果');
}'''

# 定位 console.log(` 且其下一行是汇总标题
idx = None
for i, ln in enumerate(lines):
    if ln.strip() == 'console.log(`' and i + 1 < len(lines) and lines[i + 1].startswith('===== 本轮新功能专项测试：'):
        idx = i
        break
assert idx is not None, '未定位汇总 console.log 行'
lines[idx:idx] = block.split('\n') + ['']
with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines))
print('测试插入已修正（按行定位）。')
