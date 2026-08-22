# -*- coding: utf-8 -*-
# 修复死道具：仙缘·太初之气 接入「太初仙缘·兑换绝世机缘」罗盘选项（确定性收益，无 RNG）
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SYS = 'public/js/systems.js'
CODEX = 'public/js/codex.js'
TEST = 'tests/test-newfeatures.mjs'

def patch(path, old, new):
    with open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    if old not in s:
        raise SystemExit('[FAIL] 锚点未命中：' + path)
    cnt = s.count(old)
    if cnt != 1:
        raise SystemExit('[FAIL] 锚点出现 ' + str(cnt) + ' 次（应为 1）：' + path)
    s = s.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print('[OK] 已修改 ' + path)

old1 = '''  // 观星卜算（灵石充裕时出现）：请动星盘，得确定性道韵/悟性经验与一则天机提示
  if (canAfford(state, DIVINATION.cost)) {
    opts.push({ icon: '🔮', tag: '天机', title: '观星卜算', desc: `夜观天象，请动星盘（耗灵石 ${DIVINATION.cost}）。道韵经验+${DIVINATION.daoYun}，悟性经验+${DIVINATION.wuxing}，并得下月一则天机运势加成。`, action: { type: 'divination' }, preview: '收益：道韵/悟性经验 + 下月天机运势（修炼/灵草/商道/悟性四类之一）' });
  }
  return opts;
}'''

new1 = '''  // 观星卜算（灵石充裕时出现）：请动星盘，得确定性道韵/悟性经验与一则天机提示
  if (canAfford(state, DIVINATION.cost)) {
    opts.push({ icon: '🔮', tag: '天机', title: '观星卜算', desc: `夜观天象，请动星盘（耗灵石 ${DIVINATION.cost}）。道韵经验+${DIVINATION.daoYun}，悟性经验+${DIVINATION.wuxing}，并得下月一则天机运势加成。`, action: { type: 'divination' }, preview: '收益：道韵/悟性经验 + 下月天机运势（修炼/灵草/商道/悟性四类之一）' });
  }
  // 太初仙缘（持有「仙缘·太初之气」时出现）：上古仙缘使者处兑换绝世机缘（确定性、无 RNG、无风险）
  const taichu = state.items.filter((i) => i.名称 === '仙缘·太初之气').reduce((sum, i) => sum + (i.数量 || 1), 0);
  if (taichu >= 1) {
    opts.push({ icon: '🌟', tag: '天机', title: '太初仙缘·兑换绝世机缘', desc: `持「仙缘·太初之气」×1，寻上古仙缘使者兑换一段绝世机缘：修为+2000、道韵+40、悟性+25、下品灵石+800，并获赠天品功法《太虚剑经》（已持有则改赠灵石）。当前持有 ${taichu} 份。`, action: { type: 'taichuXianyuan' }, preview: '收益：修为/道韵/悟性大涨 + 赠天品功法《太虚剑经》' });
  }
  return opts;
}'''

patch(SYS, old1, new1)

old2 = '''    case 'refinePill': {
      const r = refinePill(state, option.recipeId, option);
      (r.logs || []).forEach((l) => logs.push(l));
      break;
    }
    /* market / art / socialList / auction / tameBeast / sectTask 由 UI 打开子界面处理，不在此处结算 */'''

new2 = '''    case 'refinePill': {
      const r = refinePill(state, option.recipeId, option);
      (r.logs || []).forEach((l) => logs.push(l));
      break;
    }
    case 'taichuXianyuan': {
      // 仙缘·太初之气：兑换绝世机缘（确定性收益，无 RNG、无战斗风险）
      const held = state.items.filter((i) => i.名称 === '仙缘·太初之气');
      const cnt = held.reduce((s, i) => s + (i.数量 || 1), 0);
      if (cnt < 1) { logs.push('你手中尚无「仙缘·太初之气」，无缘兑换。'); break; }
      const it = held[0];
      it.数量 -= 1;
      if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      gainExp(state, 2000, logs);
      addDaoYunExp(state, 40, logs);
      addDaoBaseExp(state, '悟性', 25, logs);
      addStones(state, 800);
      // 赠天品功法《太虚剑经》；已持有则改赠灵石
      if (!state.techniques.some((t) => t.名称 === '太虚剑经')) {
        state.techniques.push({ 名称: '太虚剑经', 品级: '天品', 等级: 1, 经验: 0 });
        logs.push('🌟 仙缘使者颔首，赠你天品功法《太虚剑经》一部，剑意可震慑低阶妖兽。');
      } else {
        addStones(state, 1200);
        logs.push('🌟 仙缘使者见你已通《太虚剑经》，改赠下品灵石 1200 以助道途。');
      }
      logs.push('✨ 太初仙缘加身，修为+2000、道韵+40、悟性+25、下品灵石+800。一段绝世机缘就此圆满。');
      break;
    }
    /* market / art / socialList / auction / tameBeast / sectTask 由 UI 打开子界面处理，不在此处结算 */'''

patch(SYS, old2, new2)

old3 = "{ id: 'mat_xianyuan_taichu', category: '材料', name: '仙缘·太初之气', rarity: '传说材料', source: '海外仙岛机缘（极稀有），气运/悟性双满时概率大幅提升', effect: '传说中的仙界之气，可遇不可求。持此物者可触发特殊天命事件，或于特定NPC处兑换绝世机缘。价值连城。' },"

new3 = "{ id: 'mat_xianyuan_taichu', category: '材料', name: '仙缘·太初之气', rarity: '传说材料', source: '上古遗府/秘境深处隐藏奇遇（极稀有）', effect: '传说中的仙界之气，可遇不可求。持此物者可于罗盘「太初仙缘」处寻上古仙缘使者兑换绝世机缘：修为+2000、道韵+40、悟性+25、下品灵石+800，并赠天品功法《太虚剑经》。价值连城。' },"

patch(CODEX, old3, new3)

test_anchor = "process.exit(fail ? 1 : 0);"

block = '''/* ---------- 仙缘·太初之气：兑换绝世机缘（死道具修复，确定性收益） ---------- */
{
  const g = S.createNewGame({ name: '太初仙缘', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.currencies = g.currencies || {};
  g.player.level = 90; g.player.exp = 0; // 高位避免 2000 修为触发连升，便于稳定断言
  storeItem(g, { 名称: '仙缘·太初之气', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  const expBefore = g.player.exp;
  const yunBefore = (g.player.daoYun?.exp || 0);
  const wuxingBefore = (g.player.daoBase?.悟性?.exp || 0);
  const stonesBefore = S.totalStones(g);
  const r = S.performAction(g, { title: '太初仙缘·兑换绝世机缘', action: { type: 'taichuXianyuan' } });
  ok(r && Array.isArray(r.logs) && r.logs.length > 0, '太初仙缘兑换返回结构化日志');
  ok(!g.items.some((i) => i.名称 === '仙缘·太初之气'), '兑换后仙缘·太初之气被消耗');
  ok(g.player.exp === expBefore + 2000, '兑换后修为+2000（高位不连升）');
  ok((g.player.daoYun?.exp || 0) === yunBefore + 40, '兑换后道韵经验+40');
  ok((g.player.daoBase?.悟性?.exp || 0) === wuxingBefore + 25, '兑换后悟性经验+25');
  ok(S.totalStones(g) === stonesBefore + 800, '兑换后下品灵石+800');
  ok(g.techniques.some((t) => t.名称 === '太虚剑经'), '兑换赠天品功法《太虚剑经》');
  // 罗盘选项：持有才出现
  const gOpt = S.createNewGame({ name: '太初选项', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gOpt);
  ok(!S.extraCompassOptions(gOpt).some((o) => o.action.type === 'taichuXianyuan'), '无仙缘时不出现太初仙缘选项');
  storeItem(gOpt, { 名称: '仙缘·太初之气', 类型: '材料', 数量: 1, 描述: 'x', 价值: 300 });
  ok(S.extraCompassOptions(gOpt).some((o) => o.action.type === 'taichuXianyuan'), '持有仙缘时出现太初仙缘选项');
  // 持有 2 份：仅消耗 1 份
  const g2 = S.createNewGame({ name: '太初仙缘2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g2);
  storeItem(g2, { 名称: '仙缘·太初之气', 类型: '材料', 数量: 2, 描述: 'x', 价值: 300 });
  S.performAction(g2, { title: '太初仙缘·兑换绝世机缘', action: { type: 'taichuXianyuan' } });
  const remain = g2.items.filter((i) => i.名称 === '仙缘·太初之气').reduce((s, i) => s + (i.数量 || 1), 0);
  ok(remain === 1, '持有 2 份兑换后仅消耗 1 份（剩 1）');
  // 无仙缘时不崩溃、不凭空产生
  const g3 = S.createNewGame({ name: '太初仙缘3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g3);
  const r3 = S.performAction(g3, { title: '太初仙缘·兑换绝世机缘', action: { type: 'taichuXianyuan' } });
  ok(r3 && Array.isArray(r3.logs), '无仙缘·太初之气时兑换不崩溃');
  ok(!g3.items.some((i) => i.名称 === '仙缘·太初之气'), '无仙缘时不凭空产生');
}

'''

with open(TEST, 'r', encoding='utf-8') as f:
    t = f.read()
if test_anchor not in t:
    raise SystemExit('[FAIL] 测试锚点未命中')
if t.count(test_anchor) != 1:
    raise SystemExit('[FAIL] 测试锚点出现 ' + str(t.count(test_anchor)) + ' 次')
t = t.replace(test_anchor, block + test_anchor, 1)
with open(TEST, 'w', encoding='utf-8') as f:
    f.write(t)
print('[OK] 已修改 ' + TEST)
print('全部补丁应用完成。')
