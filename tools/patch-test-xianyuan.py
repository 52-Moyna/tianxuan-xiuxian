# -*- coding: utf-8 -*-
import io
p = 'tests/test-newfeatures.mjs'
with io.open(p, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

marker = '本轮新功能专项测试'
idx = next(i for i, ln in enumerate(lines) if marker in ln)
assert idx >= 0, "未找到测试汇总行"

block = '''/* ---------- 仙缘：掉落修复 + 罗盘「仙缘兑换」消费者（确定性收益） ---------- */
{
  // 1) 掉落修复：xianyuan 必须产出真实「仙缘」，绝不产生幽灵物「妖兽仙缘」
  const gx = S.createNewGame({ name: '仙缘掉落', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gx);
  let phantom = 0, sawXianyuan = 0;
  for (let t = 0; t < 150; t++) {
    const drops = S.generateBeastDrops(gx, { name: '幽冥兽', level: 400, danger: 5, beast: true });
    for (const d of drops) {
      if (d.名称 === '妖兽仙缘') phantom++;
      if (d.名称 === '仙缘') sawXianyuan++;
    }
  }
  ok(phantom === 0, '野兽掉落绝不产生幽灵物「妖兽仙缘」');
  ok(sawXianyuan > 0, '高阶妖兽有概率掉落真实「仙缘」');

  // 2) 兑换确定性收益
  const g = S.createNewGame({ name: '仙缘兑换', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {};
  g.player.level = 96; g.player.exp = 0;
  storeItem(g, { 名称: '仙缘', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  const expB = g.player.exp, yunB = (g.player.daoYun?.exp || 0), wxB = (g.player.daoBase?.悟性?.exp || 0), stB = S.totalStones(g);
  const r = S.performAction(g, { title: '仙缘兑换·道途助益', action: { type: 'xianyuanExchange' } });
  ok(r && Array.isArray(r.logs) && r.logs.length > 0, '仙缘兑换返回结构化日志');
  ok(!g.items.some((i) => i.名称 === '仙缘'), '兑换后「仙缘」被消耗');
  ok(g.player.exp === expB + 200, '兑换后修为+200（高位不连升）');
  ok((g.player.daoYun?.exp || 0) === yunB + 15, '兑换后道韵经验+15');
  ok((g.player.daoBase?.悟性?.exp || 0) === wxB + 20, '兑换后悟性经验+20');
  ok(S.totalStones(g) === stB + 300, '兑换后下品灵石+300');

  // 3) 罗盘选项显隐
  const gOpt = S.createNewGame({ name: '仙缘选项', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gOpt);
  ok(!S.extraCompassOptions(gOpt).some((o) => o.action.type === 'xianyuanExchange'), '无仙缘时不出现仙缘兑换选项');
  storeItem(gOpt, { 名称: '仙缘', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  ok(S.extraCompassOptions(gOpt).some((o) => o.action.type === 'xianyuanExchange'), '持有仙缘时出现仙缘兑换选项');

  // 4) 无仙缘时不崩溃、不凭空产生
  const g3 = S.createNewGame({ name: '仙缘无', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g3);
  const r3 = S.performAction(g3, { title: '仙缘兑换·道途助益', action: { type: 'xianyuanExchange' } });
  ok(r3 && Array.isArray(r3.logs), '无仙缘时兑换不崩溃');
  ok(!g3.items.some((i) => i.名称 === '仙缘'), '无仙缘时不凭空产生');
}

'''

lines.insert(idx, block.rstrip('\n'))
with io.open(p, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f"[OK] test-newfeatures.mjs 在第 {idx} 行前插入仙缘断言块（13 条）")
