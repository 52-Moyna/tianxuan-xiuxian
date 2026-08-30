# -*- coding: utf-8 -*-
"""天玄修仙录·打磨：新增 bagUsage 确定性测试（tests/test-newfeatures.mjs）。
直接改写真实仓库 Z:/1/xiuxian/tests/test-newfeatures.mjs，插入于汇总 console.log 之前。
用最小控制对象直接验证 bagUsage 公式，避免受新游戏起始物品干扰（确定性）。
"""
import pathlib

ROOT = pathlib.Path(r"Z:/1/xiuxian")
TEST = ROOT / "tests/test-newfeatures.mjs"
txt = TEST.read_text(encoding="utf-8")

ANCHOR = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
if ANCHOR not in txt:
    raise SystemExit("[FAIL] 汇总锚点未命中，可能测试文件结构已变。")

# 最小控制对象：bagUsage 仅读取 state.inventory 的 used/capacity/ringBonus，故用纯对象验证公式
BLOCK = '''/* ---------- 储物袋容量常驻（信息透明 + 危机预警） ---------- */
ok(typeof S.bagUsage === 'function', 'bagUsage 已导出');
const bagState = (used, cap, ring = 0) => ({ inventory: { used, capacity: cap, ringBonus: ring } });
ok(S.bagUsage(bagState(0, 100)).used === 0 && S.bagUsage(bagState(0, 100)).capacity === 100 && S.bagUsage(bagState(0, 100)).total === 100, '0/100 容量字段正确');
ok(S.bagUsage(bagState(0, 100)).level === 'ok' && S.bagUsage(bagState(0, 100)).ratio === 0, '空袋 0/100 → ok、ratio=0');
// 90% → danger（满仓临界，再拾取物品将被 storeItem 静默丢弃）
ok(S.bagUsage(bagState(92, 100)).level === 'danger' && Math.abs(S.bagUsage(bagState(92, 100)).ratio - 0.92) < 1e-9, '占用 92/100 → danger');
// 70% → warn（容量偏紧）
ok(S.bagUsage(bagState(70, 100)).level === 'warn', '占用 70/100 → warn');
// 50% → ok
ok(S.bagUsage(bagState(50, 100)).level === 'ok', '占用 50/100 → ok');
// 边界：恰好 0.9（90/100）→ danger
ok(S.bagUsage(bagState(90, 100)).level === 'danger', '恰好 90/100 → danger（临界）');
// 空间戒 ringBonus 计入 total（与 canStore 同口径）
const ru = S.bagUsage(bagState(100, 100, 20));
ok(ru.total === 120 && Math.abs(ru.ratio - 100 / 120) < 1e-9, '空间戒 ringBonus 计入 total');
ok(ru.level === 'warn', '100/120（含戒）→ warn（83% 偏紧，与阈值一致）');

'''

new = txt.replace(ANCHOR, BLOCK + ANCHOR, 1)
if new == txt:
    raise SystemExit("[FAIL] 替换后无变化。")
TEST.write_text(new, encoding="utf-8")
print("[OK] 已插入 9 条 bagUsage 确定性断言（汇总 console.log 之前）。")
