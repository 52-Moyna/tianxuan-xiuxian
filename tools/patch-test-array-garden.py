# -*- coding: utf-8 -*-
"""为聚灵阵联动灵草园追加专项测试"""
import io, sys

P = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'

def rd(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(src, old, new, tag):
    if old not in src:
        print('MISS: ' + tag); sys.exit(1)
    if src.count(old) != 1:
        print('DUP(%d): %s' % (src.count(old), tag)); sys.exit(1)
    print('OK: ' + tag)
    return src.replace(old, new)

t = rd(P)

t = rep(t,
"ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL } from '../public/js/life.js';",
"ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, ARRAY_GROWTH_EVERY, ARRAY_GROWTH_MAX, herbMonthlyGrowth, herbArrayGrowth } from '../public/js/life.js';",
'test: import 补齐')

BLOCK = r"""
/* ---------- 聚灵阵联动灵草园（本轮新增） ---------- */
{
  // 基线：无洞府等级、无引泉、无聚灵阵、无运势 → 每月自然生长 1 月
  const g = S.createNewGame({ name: '阵草', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.cave.level = 0;
  g.cave.springLevel = 0;
  g.cave.arrayLevel = 0;
  delete g.flags.omen;
  ok(herbArrayGrowth(g) === 0, '聚灵阵·灵草：0 重阵额外生长 +0 月');
  ok(herbMonthlyGrowth(g) === 1, '聚灵阵·灵草：基线每月自然生长 = 1 月');

  // 每 ARRAY_GROWTH_EVERY 重 +1 月，封顶 ARRAY_GROWTH_MAX
  g.cave.arrayLevel = 1;
  ok(herbArrayGrowth(g) === 0, '聚灵阵·灵草：1 重阵尚未跨过 2 重阈值（+0 月）');
  g.cave.arrayLevel = 2;
  ok(herbArrayGrowth(g) === 1, '聚灵阵·灵草：2 重阵额外生长 +1 月');
  g.cave.arrayLevel = 3;
  ok(herbArrayGrowth(g) === 1, '聚灵阵·灵草：3 重阵仍为 +1 月');
  g.cave.arrayLevel = 4;
  ok(herbArrayGrowth(g) === 2, '聚灵阵·灵草：4 重阵额外生长 +2 月');
  g.cave.arrayLevel = 5;
  ok(herbArrayGrowth(g) === ARRAY_GROWTH_MAX, `聚灵阵·灵草：5 重阵封顶 +${ARRAY_GROWTH_MAX} 月`);

  // 与灵泉涌动、洞府基础涌动叠加：洞府 Lv.5(基础+1) + 引泉2重(+2) + 阵4重(+2) = 6 月/月
  g.cave.level = 5;
  g.cave.springLevel = 2;
  g.cave.arrayLevel = 4;
  ok(herbSpringBonus(g) === 3, '聚灵阵·灵草：洞府 Lv.5 基础涌动+引泉2重 = +3');
  ok(herbMonthlyGrowth(g) === 6, '聚灵阵·灵草：洞府基础1+灵泉3+阵2 → 合计 6 月/月');

  // 真实月度结算：growHerbs 按 herbMonthlyGrowth 推进（唯一事实来源，无口径漂移）
  g.cave.level = 0;
  g.cave.springLevel = 0;
  g.cave.arrayLevel = 4; // step = 3
  g.cave.garden = [{ id: 'herb_lingcao', name: '凝露灵草', progress: 0, grow: 10, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 }];
  growHerbs(g);
  ok(g.cave.garden[0].progress === 3, `聚灵阵·灵草：4 重阵下 growHerbs 单月推进 3 月（实得 ${g.cave.garden[0].progress}）`);
  g.cave.arrayLevel = 0;
  growHerbs(g);
  ok(g.cave.garden[0].progress === 4, '聚灵阵·灵草：撤去阵法后单月仅推进 1 月');

  // 旧档兼容：缺 arrayLevel 字段不报错、额外生长为 0
  const bare = S.createNewGame({ name: '阵草旧档', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(bare);
  delete bare.cave.arrayLevel;
  ok(herbArrayGrowth(bare) === 0, '聚灵阵·灵草：旧档缺 arrayLevel 时额外生长=0（不报错）');
  ok(herbMonthlyGrowth(bare) >= 1, '聚灵阵·灵草：旧档月度生长仍 >= 1');

  // 升级日志：跨过 2 重阈值时明确提示灵草收益
  const lg = S.createNewGame({ name: '阵草日志', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(lg);
  lg.currencies['下品灵石'] = 100000;
  lg.cave.arrayLevel = 1;
  const rep2 = S.performAction(lg, { title: '布设聚灵阵', action: { type: 'upgradeArray' } });
  ok(lg.cave.arrayLevel === 2, '聚灵阵·灵草：布设至 2 重成功');
  ok(rep2.logs.some((l) => l.includes('灵草每月自然生长 +1 月')), '聚灵阵·灵草：升级日志提示灵草生长收益');

  // 罗盘经营选项描述同步标注灵草增益（信息一致，不做隐藏加成）
  const ds = S.createNewGame({ name: '阵草描述', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(ds);
  ds.currencies['下品灵石'] = 100000;
  const arrOpt = S.generateCompass(ds).find((o) => o.action.type === 'upgradeArray');
  ok(!!arrOpt && arrOpt.desc.includes('灵草月生长'), '聚灵阵·灵草：罗盘选项描述标注灵草增益');
}

console.log(`"""

t = rep(t, "\nconsole.log(`", BLOCK, 'test: 追加测试块')

wr(P, t)
print('ALL DONE')
