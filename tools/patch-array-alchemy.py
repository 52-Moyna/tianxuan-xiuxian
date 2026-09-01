#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""聚灵阵联动丹炉成丹率：refineRate/settleRefine 同源加成 + UI 拆解 + 罗盘描述。"""
import io, sys, os

ROOT = "Z:/1/xiuxian"
files = {
    "life": os.path.join(ROOT, "public/js/life.js"),
    "ui": os.path.join(ROOT, "public/js/ui.js"),
    "systems": os.path.join(ROOT, "public/js/systems.js"),
    "test": os.path.join(ROOT, "tests/test-newfeatures.mjs"),
}

def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8") as f:
        f.write(s)

def repl(s, old, new, label):
    if old not in s:
        print("!! 未命中：" + label)
        sys.exit(1)
    # 防重复应用
    if s.count(old) != 1:
        print("?? 命中%d次(疑似已应用)：" % s.count(old) + label)
    return s.replace(old, new, 1)

life = read(files["life"])

# 1) refineRate 新增 arrayBonus（与修炼加成同源 ARRAY_BONUS_PER_LEVEL）
life = repl(life,
    "  const rate = Math.min(98, baseRate + caveBonus + catalystBonus);\n  return { baseRate, caveBonus, catalystBonus, rate };",
    "  const arrayBonus = Math.round((state.cave?.arrayLevel || 0) * ARRAY_BONUS_PER_LEVEL * 100);\n  const rate = Math.min(98, baseRate + caveBonus + catalystBonus + arrayBonus);\n  return { baseRate, caveBonus, catalystBonus, arrayBonus, rate };",
    "life.refineRate.arrayBonus")

# 2) settleRefine 同步同口径（预览=结算）
life = repl(life,
    "    const caveBonus = Math.round((state.cave?.bonus || 0) * 30); // 洞府丹炉加成（最高约 +24）\n    const rate = Math.min(98, r.baseRate + caveBonus + (p.catalystBonus || 0));",
    "    const caveBonus = Math.round((state.cave?.bonus || 0) * 30); // 洞府丹炉加成（最高约 +24）\n    const arrayBonus = Math.round((state.cave?.arrayLevel || 0) * ARRAY_BONUS_PER_LEVEL * 100); // 聚灵阵灵气助丹（每重 +8%，最高 +40%）\n    const rate = Math.min(98, r.baseRate + caveBonus + (p.catalystBonus || 0) + arrayBonus);",
    "life.settleRefine.arrayBonus")
write(files["life"], life)

ui = read(files["ui"])
# 3) 丹炉面板拆解新增「＋聚灵阵N」
ui = repl(ui,
    '<div class="ar-meta">耗时 ${r.months}月 ｜ 期望成丹 <b class="ar-rate">${pr.rate}%</b><span class="ar-bonus">（基础${pr.baseRate}${pr.caveBonus ? `＋丹炉${pr.caveBonus}` : ""}${pr.catalystBonus ? `＋催化${pr.catalystBonus}` : ""}）</span>${pr.catalystBonus ? `<span class="ar-cat-ready">🔥催化就绪</span>` : ""}</div>',
    '<div class="ar-meta">耗时 ${r.months}月 ｜ 期望成丹 <b class="ar-rate">${pr.rate}%</b><span class="ar-bonus">（基础${pr.baseRate}${pr.caveBonus ? `＋丹炉${pr.caveBonus}` : ""}${pr.catalystBonus ? `＋催化${pr.catalystBonus}` : ""}${pr.arrayBonus ? `＋聚灵阵${pr.arrayBonus}` : ""}）</span>${pr.catalystBonus ? `<span class="ar-cat-ready">🔥催化就绪</span>` : ""}</div>',
    "ui.丹炉面板arrayBonus")
write(files["ui"], ui)

systems = read(files["systems"])
# 4) 罗盘布设描述标注丹炉成丹率加成
systems = repl(systems,
    "desc: `花费灵石${ARRAY_UPGRADE_BASE * (cur + 1)}，修炼效率永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%（与洞府加成、聚灵阵旗叠加）。`, action: { type: 'upgradeArray' }",
    "desc: `花费灵石${ARRAY_UPGRADE_BASE * (cur + 1)}，修炼效率与丹炉成丹率各永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%/重（最高 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100 * ARRAY_MAX_LEVEL)}%，与洞府加成、聚灵阵旗叠加）。`, action: { type: 'upgradeArray' }",
    "systems.布设描述")
# 5) 升级日志标注丹炉成丹率加成
systems = repl(systems,
    "logs.push(`聚灵阵布设至第 ${state.cave.arrayLevel} 重！修炼效率永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%（现合计 +${Math.round(state.cave.arrayLevel * ARRAY_BONUS_PER_LEVEL * 100)}%）。`);",
    "logs.push(`聚灵阵布设至第 ${state.cave.arrayLevel} 重！修炼效率与丹炉成丹率各永久 +${Math.round(ARRAY_BONUS_PER_LEVEL * 100)}%/重（现各合计 +${Math.round(state.cave.arrayLevel * ARRAY_BONUS_PER_LEVEL * 100)}%）。`);",
    "systems.升级日志")
write(files["systems"], systems)

test = read(files["test"])
# 6) 导入 ARRAY_BONUS_PER_LEVEL / ARRAY_MAX_LEVEL
test = repl(test,
    "HERB_SPRING_MAX, HERB_SPRING_COST_BASE } from '../public/js/life.js';",
    "HERB_SPRING_MAX, HERB_SPRING_COST_BASE, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL } from '../public/js/life.js';",
    "test.import")
# 7) 在 catalystStatus 块后插入聚灵阵成丹率断言
anchor = "  ok(csEmpty.length === 2 && csEmpty.every((c) => c.have === 0 && !c.held), 'catalystStatus·无催化材料时全部 have=0');\n}"
block = anchor + """

  // 6) 聚灵阵联动丹炉成丹率：每重 +8%（与修炼加成同源于 ARRAY_BONUS_PER_LEVEL）
  ar.cave.bonus = 0;
  ar.cave.arrayLevel = 0;
  ar.items = ar.items.filter((x) => x.名称 !== '年份灵草' && x.名称 !== '私藏丹方·残卷');
  pr = refineRate(ar, '聚气丹');
  ok(pr.catalystBonus === 0, '聚灵阵测试·催化材料已清空(隔离变量)');
  ok(pr.arrayBonus === 0, 'refineRate·聚灵阵 0 重无成丹率加成');
  ar.cave.arrayLevel = 1;
  pr = refineRate(ar, '聚气丹');
  ok(pr.arrayBonus === 8, 'refineRate·聚灵阵 1 重成丹率 +8');
  ok(pr.rate === Math.min(98, rec.baseRate + 8), 'refineRate·聚灵阵 1 重期望率=基础+8');
  ar.cave.arrayLevel = ARRAY_MAX_LEVEL;
  pr = refineRate(ar, '聚气丹');
  ok(pr.arrayBonus === 40, `refineRate·聚灵阵 ${ARRAY_MAX_LEVEL} 重成丹率 +40`);
  ok(pr.rate === Math.min(98, rec.baseRate + 40), 'refineRate·聚灵阵 5 重期望率=基础+40(封顶)');
  // 三源叠加：洞府丹炉 + 催化 + 聚灵阵 与结算公式等价
  ar.cave.bonus = 0.8;
  storeItem(ar, { 名称: '年份灵草', 类型: '材料', 数量: 1, 描述: '催化材料' });
  pr = refineRate(ar, '筑基丹');
  ok(pr.rate === Math.min(98, recB.baseRate + 24 + 8 + 40), 'refineRate·洞府+催化+聚灵阵三源叠加与结算等价');
  // 结算路径同样消费聚灵阵加成（与 refineRate 同源，force 消解 RNG 验证代码路径无异常）
  const stArr = S.createNewGame({ name: '聚灵结算', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stArr);
  stArr.cave.arrayLevel = 3;
  stArr.cave.alchemy.push({ recipeId: '聚气丹', name: '聚气丹', dueYear: stArr.world.year - 1, dueMonth: 1, startedYear: stArr.world.year, startedMonth: 1, catalystBonus: 0, usedCatalysts: [] });
  const beforeP = stArr.items.filter((x) => x.名称 === '聚气丹').length;
  S.settleRefine(stArr, [], 'success');
  ok(stArr.items.filter((x) => x.名称 === '聚气丹').length === beforeP + 1, '聚灵阵结算·force 成功出丹(含聚灵阵加成路径)');
  ar.cave.arrayLevel = 0; ar.cave.bonus = 0;
}"""
test = repl(test, anchor, block, "test.聚灵阵断言")
write(files["test"], test)

print("OK · 全部替换完成")
