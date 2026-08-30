# -*- coding: utf-8 -*-
"""修复坊市专属渡劫丹的死字段 effect.item，改为正确的 breakthrough 标记。

背景：systems.js shopStock 给筑基丹/结丹丹/元婴丹/化神丹/九转金丹写入
effect: { item: tp.名称 }，该键全代码只写不读（死字段）。功能上
attemptBreakthrough 按名称匹配仍能 +20% 生效，但 itemUsePreview 不识别，
导致背包里这些丹药不显示「瓶颈专属丹·自动消耗」提示，玩家误以为废丹。

改为 breakthrough: true（与炼丹配方版 data.js 筑基丹一致），让 UI 正确标注。
"""
import io, sys, os

ROOT = "Z:/1/xiuxian"
sys_js = os.path.join(ROOT, "public", "js", "systems.js")
test = os.path.join(ROOT, "tests", "test-newfeatures.mjs")

# ---- 1. 修复 systems.js ----
old = "    if (lv >= tp.min && lv <= tp.max) stock.push({ 名称: tp.名称, 类型: '丹药', 品阶: 'shang', 价格: 800, 价值: 700, 描述: tp.描述, effect: { item: tp.名称 } });"
new = "    if (lv >= tp.min && lv <= tp.max) stock.push({ 名称: tp.名称, 类型: '丹药', 品阶: 'shang', 价格: 800, 价值: 700, 描述: tp.描述, breakthrough: true, effect: { exp: 150 } });"

with io.open(sys_js, "r", encoding="utf-8") as f:
    src = f.read()
assert old in src, "systems.js 锚点未找到，可能已改动"
assert "effect: { item: tp.名称 }" not in src.replace(old, ""), "重复锚点"
src = src.replace(old, new)
with io.open(sys_js, "w", encoding="utf-8") as f:
    f.write(src)
print("systems.js 已修复：坊市专属渡劫丹改为 breakthrough: true")

# ---- 2. 测试守护：坊市版筑基丹须被识别为瓶颈专属丹 ----
anchor = "  ok(S.itemUsePreview(st0, { 名称: '星砂', 类型: '材料' }).mode === 'none', '无 effect 材料无可用操作');"
block = anchor + """

/* ---------- 坊市专属渡劫丹（筑基丹等）须正确标注为瓶颈专属丹（防死字段回归）---------- */
{
  const stB = S.createNewGame({ name: '渡劫', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stB);
  stB.player.level = 20; // 筑基瓶颈区间（15~25）
  const pill = S.shopStock(stB).find((x) => x.名称 === '筑基丹');
  ok(!!pill, '坊市在筑基区间上架筑基丹');
  ok(pill && pill.breakthrough === true, '坊市筑基丹标注为瓶颈专属丹(breakthrough)');
  ok(pill && S.itemUsePreview(stB, pill).mode === 'auto', '坊市筑基丹在行囊标注为自动消耗类');
}"""

with io.open(test, "r", encoding="utf-8") as f:
    tsrc = f.read()
assert anchor in tsrc, "test 锚点未找到"
assert "坊市在筑基区间上架筑基丹" not in tsrc, "测试已存在，勿重复插入"
tsrc = tsrc.replace(anchor, block)
with io.open(test, "w", encoding="utf-8") as f:
    f.write(tsrc)
print("tests/test-newfeatures.mjs 已新增坊市专属渡劫丹守护断言")
