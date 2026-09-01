# -*- coding: utf-8 -*-
"""为灵草园一键补种补充测试（tests/test-newfeatures.mjs）"""
import io, sys

P = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'
s = io.open(P, encoding='utf-8').read()
orig = s

block = r'''
/* ---------- 灵草园：一键补种 ---------- */
{
  const mk = () => {
    const s = S.createNewGame({ name: '一键补种', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(s);
    s.currencies['下品灵石'] = 100000;
    return s;
  };
  const seedCost = (id) => HERB_TYPES.find((h) => h.id === id).seedCost;
  const HERB_TYPES = (await import('../public/js/data.js')).HERB_TYPES;

  // 空园：一次性补满所有空位
  const a = mk();
  const capA = gardenCapacity(a);
  const beforeA = a.currencies['下品灵石'];
  const ra = plantHerbFill(a, 'lingcao');
  ok(ra.ok && ra.count === capA, `一键补种：空园补满 ${capA} 株（实得 ${ra.count}）`);
  ok(a.cave.garden.length === capA && a.cave.garden.every((h) => h.id === 'lingcao'), '一键补种：全部播上所选灵草');
  ok(ra.spent === capA * seedCost('lingcao'), '一键补种：花费 = 株数 × 种子价');
  ok(a.currencies['下品灵石'] === beforeA - ra.spent, '一键补种：灵石如实扣除');

  // 满园：拒绝补种
  const rb = plantHerbFill(a, 'huoqing');
  ok(!rb.ok && rb.count === 0 && a.cave.garden.length === capA, '一键补种：灵田已满时拒绝且不扣费');

  // 部分空位：只补剩余空位
  const c = mk();
  plantHerb(c, 'lingcao');
  const capC = gardenCapacity(c);
  const rc = plantHerbFill(c, 'huoqing');
  ok(rc.ok && rc.count === capC - 1, `一键补种：只补剩余 ${capC - 1} 个空位（实得 ${rc.count}）`);
  ok(c.cave.garden.length === capC, '一键补种：补种后灵田填满');

  // 灵石不足：种到负担不起为止，不透支
  const d = mk();
  const capD = gardenCapacity(d);
  d.currencies['下品灵石'] = seedCost('lingcao') * 2 + 3;
  const rd = plantHerbFill(d, 'lingcao');
  ok(rd.ok && rd.count === 2, `一键补种：灵石不足时只种负担得起的 2 株（实得 ${rd.count}）`);
  ok(d.currencies['下品灵石'] === 3, '一键补种：不会透支灵石');
  ok(d.cave.garden.length === 2 && capD > 2, '一键补种：灵田未填满但已尽力');

  // 一株都种不起：明确失败且不扣费
  const e = mk();
  e.currencies['下品灵石'] = 0;
  const re = plantHerbFill(e, 'lingcao');
  ok(!re.ok && re.count === 0 && e.cave.garden.length === 0, '一键补种：一株都种不起时失败且不扣费');
  ok(re.logs.some((l) => l.includes('灵石不足')), '一键补种：灵石不足给出明确提示');

  // 未知灵草：安全失败
  ok(!plantHerbFill(mk(), 'not_exist').ok, '一键补种：未知灵草返回失败');
}

'''
anchor = "console.log(`\n===== 本轮新功能专项测试"
assert s.count(anchor) == 1, '测试尾部锚点不唯一'
s = s.replace(anchor, block.lstrip('\n') + anchor, 1)

# 顶部补充 import：HERB_TYPES
old_imp = "import { DIVINATION, PILL_RECIPES, HERB_HYBRIDS, HERB_HYBRID_COST, DESTINY_LINES } from '../public/js/data.js';"
assert s.count(old_imp) == 1, 'data.js import 锚点不唯一'
s = s.replace(old_imp, old_imp.replace("DESTINY_LINES }", "DESTINY_LINES, HERB_TYPES }"), 1)
# 块内不再重复导入
s = s.replace("  const seedCost = (id) => HERB_TYPES.find((h) => h.id === id).seedCost;\n  const HERB_TYPES = (await import('../public/js/data.js')).HERB_TYPES;\n",
              "  const seedCost = (id) => HERB_TYPES.find((h) => h.id === id).seedCost;\n")

if s == orig:
    print('NO CHANGE'); sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('test patched OK')
