# -*- coding: utf-8 -*-
"""向 test-newfeatures.mjs 注入「成就收集里程碑」确定性断言（行级替换，稳健）。"""
import io, sys, os

ROOT = "Z:/1/xiuxian"
PATH = os.path.join(ROOT, "tests/test-newfeatures.mjs")
with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

# ---- 1) 扩展 codex.js 的 import，加入里程碑相关导出 ----
old_import = ("import { achievementView, checkAchievements, codexEntries, ownedEquipPower, "
              "activeSetBonuses, beastPowerBonus, ensureBeastState, availableMysticRealms, "
              "SECT_EXCHANGE, AUCTION_ITEMS_POOL } from '../public/js/codex.js';")
new_import = ("import { achievementView, checkAchievements, codexEntries, ownedEquipPower, "
              "activeSetBonuses, beastPowerBonus, ensureBeastState, availableMysticRealms, "
              "SECT_EXCHANGE, AUCTION_ITEMS_POOL, ACHIEVEMENTS, ACH_MILESTONE_IDS, "
              "ACH_BASE_TOTAL, claimAllAchievements } from '../public/js/codex.js';")
assert old_import in src and src.count(old_import) == 1, "codex import 锚点异常"
src = src.replace(old_import, new_import, 1)

# ---- 2) 行级定位汇总行，整体替换为 [测试块 + 汇总行] ----
lines = src.split("\n")
idx = None
for i, ln in enumerate(lines):
    if "本轮新功能专项测试：" in ln:
        idx = i
        break
assert idx is not None, "未找到汇总行"
summary_line = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
block = """/* ---------- 成就收集里程碑奖励（统计已解锁基础成就数，解锁阶段性收集奖励） ---------- */
const baseIds = ACHIEVEMENTS.filter((a) => !ACH_MILESTONE_IDS.has(a.id)).map((a) => a.id);
ok(baseIds.length >= 31, '基础成就数量充足（≥31）');
const mkAchState = (n) => {
  const s = S.createNewGame({ name: '里程碑测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s);
  s.achievements = baseIds.slice(0, n).map((id) => ({ id, name: 'x', icon: 'x', time: '1年1月' }));
  return s;
};
// 10 个基础成就 → 解锁「小有所成」，但「登堂入室/仙途大成」不解锁
let s10 = mkAchState(10);
const new10 = checkAchievements(s10);
ok(new10.some((a) => a.id === 'achCount10'), '解锁10个基础成就→小有所成');
ok(!new10.some((a) => a.id === 'achCount20'), '仅10个→登堂入室未解锁');
ok(!new10.some((a) => a.id === 'achCountAll'), '仅10个→仙途大成未解锁');
ok(s10.achievements.filter((a) => !ACH_MILESTONE_IDS.has(a.id)).length === 10, '里程碑自身不计入基础计数');
// 20 个 → 解锁「登堂入室」
let s20 = mkAchState(20);
const new20 = checkAchievements(s20);
ok(new20.some((a) => a.id === 'achCount20'), '解锁20个基础成就→登堂入室');
ok(!new20.some((a) => a.id === 'achCountAll'), '仅20个→仙途大成未解锁');
// 全部基础成就 → 解锁「仙途大成」
let sAll = mkAchState(baseIds.length);
const newAll = checkAchievements(sAll);
ok(newAll.some((a) => a.id === 'achCountAll'), '解锁全部基础成就→仙途大成');
// 进度条上限正确
const vAll = achievementView(sAll);
const vCountAll = vAll.find((a) => a.id === 'achCountAll');
ok(vCountAll && vCountAll.progress && vCountAll.progress.max === baseIds.length && vCountAll.progress.ratio >= 1, '仙途大成进度上限=基础成就总数');
// 一键领取含三档收集奖励
const rc = claimAllAchievements(sAll);
ok(rc.ok && rc.total >= 800 + 1800 + 5000, '一键领取含三档收集奖励（≥7600灵石）');
const vAfter = achievementView(sAll);
ok(vAfter.filter((a) => ACH_MILESTONE_IDS.has(a.id)).every((a) => a.claimed), '三档收集奖励均已领取');

"""
# block 以 "\n\n" 结尾，拼接 summary_line 即为独立一行
lines[idx] = block + summary_line
src = "\n".join(lines)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

checks = ["achCount10", "achCount20", "achCountAll", "ACH_BASE_TOTAL", "claimAllAchievements", "本轮新功能专项测试："]
missing = [c for c in checks if c not in src]
if missing:
    print("FAIL 测试缺少:", missing); sys.exit(1)
# 确保汇总行唯一且无重复尾
assert src.count("本轮新功能专项测试：") == 1, "汇总行重复"
print("OK test-newfeatures.mjs 已注入成就收集里程碑断言。")
