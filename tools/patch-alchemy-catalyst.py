# -*- coding: utf-8 -*-
"""天玄修仙录·打磨：将「年份灵草」「私藏丹方·残卷」从死道具接入炼丹催化（确定性、无 RNG）。
修改 4 个文件：life.js / systems.js / codex.js / tests/test-newfeatures.mjs。
补丁脚本入 tools/，便于审计与回滚。"""
import io

ROOT = 'Z:/1/xiuxian'
FILES = {
    'life': ROOT + '/public/js/life.js',
    'sys': ROOT + '/public/js/systems.js',
    'codex': ROOT + '/public/js/codex.js',
    'test': ROOT + '/tests/test-newfeatures.mjs',
}

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)

def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        raise SystemExit('[FAIL] ' + label + ': 期望命中 1 次，实际 ' + str(n) + ' 次')
    return src.replace(old, new, 1)

# ---------- life.js ----------
life = read(FILES['life'])

# A) 新增 ALCHEMY_CATALYSTS 常量（接在 HERB_IRRIGATE_YIELD_CAP 之后）
oldA = """export const HERB_IRRIGATE_YIELD_CAP = 3;
/**
 * 灵泉自然加成：洞府灵泉涌动后，每株灵草月度自然生长额外 +1（确定性，无 RNG）。"""
newA = """export const HERB_IRRIGATE_YIELD_CAP = 3;
/** 炼丹催化材料：开炉时若持有，自动消耗 1 份以提升成丹率（确定性、无 RNG）。
 *  来源：道友深谈（灵植师赠「年份灵草」、炼丹师赠「私藏丹方·残卷」）与道友委托酬谢。
 *  此前这两样材料无真实消费点=死道具；现接入炼丹成为可感知的催化助力，
 *  落实其图鉴描述中的「炼丹上品 / 研习可助炼丹」承诺。 */
export const ALCHEMY_CATALYSTS = {
  '年份灵草': { bonus: 8, label: '年份灵草催化' },
  '私藏丹方·残卷': { bonus: 15, label: '丹方心得催化' },
};
/**
 * 灵泉自然加成：洞府灵泉涌动后，每株灵草月度自然生长额外 +1（确定性，无 RNG）。"""
life = replace_once(life, oldA, newA, 'life.A')

# B) refinePill：开炉扣灵石后自动消耗催化材料并记录加成
oldB = """  // 扣灵石（分层）
  if (r.stoneCost) alchemySpendStones(state, r.stoneCost);
  // 写入炼制中（到期年月）
  const w = state.world;
  let dy = w.year, dm = w.month + (r.months || 1);
  while (dm > 12) { dm -= 12; dy += 1; }
  state.cave.alchemy.push({ recipeId, name: r.name, dueYear: dy, dueMonth: dm, startedYear: w.year, startedMonth: w.month });
  state.inventory.used = inventoryUsed(state);
  return { ok: true, logs: [`你点燃丹炉，开始炼制「${r.name}」（${r.months} 月后出炉，基础成丹率 ${r.baseRate}%）。`, `耗灵石 ${r.stoneCost || 0}。`] };
}"""
newB = """  // 扣灵石（分层）
  if (r.stoneCost) alchemySpendStones(state, r.stoneCost);
  // 炼丹催化：自动消耗持有的催化材料，提升本次成丹率（确定性、无 RNG）
  let catalystBonus = 0;
  const usedCatalysts = [];
  for (const [cname, cfg] of Object.entries(ALCHEMY_CATALYSTS)) {
    const it = state.items.find((x) => x.名称 === cname);
    if (it && it.数量 >= 1) {
      it.数量 -= 1;
      if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      catalystBonus += cfg.bonus;
      usedCatalysts.push(cname);
    }
  }
  // 写入炼制中（到期年月）
  const w = state.world;
  let dy = w.year, dm = w.month + (r.months || 1);
  while (dm > 12) { dm -= 12; dy += 1; }
  state.cave.alchemy.push({ recipeId, name: r.name, dueYear: dy, dueMonth: dm, startedYear: w.year, startedMonth: w.month, catalystBonus, usedCatalysts });
  state.inventory.used = inventoryUsed(state);
  const catNote = catalystBonus ? `，催化加成 +${catalystBonus}%（${usedCatalysts.join('、')}）` : '';
  return { ok: true, logs: [`你点燃丹炉，开始炼制「${r.name}」（${r.months} 月后出炉，基础成丹率 ${r.baseRate}%${catNote}）。`, `耗灵石 ${r.stoneCost || 0}。`] };
}"""
life = replace_once(life, oldB, newB, 'life.B')

# C) settleRefine：成丹率叠加催化加成
oldC = "const rate = Math.min(98, r.baseRate + caveBonus);"
newC = "const rate = Math.min(98, r.baseRate + caveBonus + (p.catalystBonus || 0));"
life = replace_once(life, oldC, newC, 'life.C')
write(FILES['life'], life)

# ---------- systems.js ----------
sys = read(FILES['sys'])

# D) 委托回赠物品：发放即解锁图鉴
oldD = """  } else if (r.type === 'item') {
    const it = { ...r }; delete it.type;
    if (storeItem(state, it)) logs.push(`「${npc.name}」收下${task.item}，回赠${r.名称}x${r.数量 || 1}，已收入储物袋。`);
    else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
  }"""
newD = """  } else if (r.type === 'item') {
    const it = { ...r }; delete it.type;
    if (storeItem(state, it)) {
      logs.push(`「${npc.name}」收下${task.item}，回赠${r.名称}x${r.数量 || 1}，已收入储物袋。`);
      discoverItem(state, { 名称: r.名称, 类型: r.类型 });
    } else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
  }"""
sys = replace_once(sys, oldD, newD, 'sys.D')

# E) 道友深谈赠物：发放即解锁图鉴
oldE = """        } else if (r.type === 'item') {
          const it = { ...r }; delete it.type;
          if (storeItem(state, it)) logs.push(`「${npc.name}」赠你${r.名称}×${r.数量 || 1}，已收入储物袋。`);
          else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
        }"""
newE = """        } else if (r.type === 'item') {
          const it = { ...r }; delete it.type;
          if (storeItem(state, it)) {
            logs.push(`「${npc.name}」赠你${r.名称}×${r.数量 || 1}，已收入储物袋。`);
            discoverItem(state, { 名称: r.名称, 类型: r.类型 });
          } else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
        }"""
sys = replace_once(sys, oldE, newE, 'sys.E')
write(FILES['sys'], sys)

# ---------- codex.js ----------
codex = read(FILES['codex'])
oldF = """  { id: 'mat_xianyuan_taichu', category: '材料', name: '仙缘·太初之气', rarity: '传说材料', source: '上古遗府/秘境深处隐藏奇遇（极稀有）', effect: '传说中的仙界之气，可遇不可求。持此物者可于罗盘「太初仙缘」处寻上古仙缘使者兑换绝世机缘：修为+2000、道韵+40、悟性+25、下品灵石+800，并赠天品功法《太虚剑经》。价值连城。' },"""
newF = oldF + """
  { id: 'mat_year_herb', category: '材料', name: '年份灵草', rarity: '稀有材料', source: '道友深谈（灵植师）、道友委托酬谢', effect: '灵植师精心培育的年份灵草，灵气醇厚，炼丹上品。开炉炼丹时若持有可自动催化，成丹率 +8%。' },
  { id: 'mat_danfang_scroll', category: '材料', name: '私藏丹方·残卷', rarity: '稀有材料', source: '道友深谈（炼丹师）', effect: '炼丹师相赠的丹方心得残卷，研习可助炼丹。开炉炼丹时若持有可自动催化，成丹率 +15%。' },"""
codex = replace_once(codex, oldF, newF, 'codex.F')
write(FILES['codex'], codex)

# ---------- tests/test-newfeatures.mjs ----------
test = read(FILES['test'])
oldT = "  ok(e.flags.pillToxicity === 22, '丹毒月度衰减 8');"
newT = """  ok(e.flags.pillToxicity === 22, '丹毒月度衰减 8');

  // 6) 炼丹催化：「年份灵草」「私藏丹方·残卷」自动消耗提升成丹率（消除死道具，确定性）
  const cat = S.createNewGame({ name: '炼丹催化', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cat);
  cat.currencies['下品灵石'] = 1000;
  storeItem(cat, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat, { 名称: '年份灵草', 类型: '材料', 数量: 2, 描述: '催化材料', 价值: 60 });
  const yearBefore = cat.items.find((x) => x.名称 === '年份灵草').数量;
  const rrYear = refinePill(cat, '聚气丹');
  ok(rrYear.ok && /催化/.test(rrYear.logs[0]), '持年份灵草开炉触发催化提示');
  ok((cat.items.find((x) => x.名称 === '年份灵草')?.数量 || 0) === yearBefore - 1, '开炉自动消耗 1 份年份灵草');
  ok(cat.cave.alchemy[0].catalystBonus === 8, '年份灵草催化加成 +8%');

  const cat2 = S.createNewGame({ name: '丹方催化', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cat2);
  cat2.currencies['下品灵石'] = 1000;
  storeItem(cat2, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat2, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat2, { 名称: '私藏丹方·残卷', 类型: '材料', 数量: 1, 描述: '催化材料', 价值: 120 });
  const rrDf = refinePill(cat2, '聚气丹');
  ok(rrDf.ok && cat2.cave.alchemy[0].catalystBonus === 15, '私藏丹方·残卷催化加成 +15%');
  ok(!cat2.items.some((x) => x.名称 === '私藏丹方·残卷'), '开炉自动消耗私藏丹方·残卷');

  // 无催化材料时不消耗、无加成（无回归）
  const cat3 = S.createNewGame({ name: '无催化', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cat3);
  cat3.currencies['下品灵石'] = 1000;
  storeItem(cat3, { 名称: '百越灵草', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  storeItem(cat3, { 名称: '海灵珠', 类型: '材料', 数量: 5, 描述: '测试材料', 价值: 5 });
  const rrNo = refinePill(cat3, '聚气丹');
  ok(rrNo.ok && (!cat3.cave.alchemy[0].catalystBonus || cat3.cave.alchemy[0].catalystBonus === 0), '无催化材料时加成 0（不误消耗）');"""
test = replace_once(test, oldT, newT, 'test.T')
write(FILES['test'], test)

print('OK: 全部 6 处替换成功')
