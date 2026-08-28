# -*- coding: utf-8 -*-
"""补丁：延寿丹「一生最多 3 颗」上限强制化。
- systems.js: player 初始化加 lifespanPillsTaken:0；useItem lifespan 分支对延寿丹计数+满3拒绝。
落点均为唯一锚点，安全幂等。
"""
import io, sys

ROOT = "Z:/1/xiuxian"
SYS = ROOT + "/public/js/systems.js"

def patch(path, old, new):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f"[FAIL] 锚点未命中：{path}\n--- 期望出现的片段 ---\n{old[:200]}")
    if new in s.split(old, 1)[1]:
        print(f"[SKIP] 该补丁已应用：{path}")
        return False
    s = s.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] 已写入：{path}")
    return True

# 1) player 初始化加 lifespanPillsTaken:0
old1 = "      lifespan: 100, power: 1, realmName: '凡人境', lifeBonus: ageGroup.mods.寿元修正 || 0,\n"
new1 = ("      lifespan: 100, power: 1, realmName: '凡人境', lifeBonus: ageGroup.mods.寿元修正 || 0,\n"
        "      lifespanPillsTaken: 0, // 延寿丹：当前轮回一生至多服用 3 颗，超出则经脉难承（转世后随 newGame 归零）\n")
patch(SYS, old1, new1)

# 2) useItem lifespan 分支加延寿丹上限校验
old2 = """  // 延寿：提升寿元上限（延寿丹）——叠加持久加成 lifeBonus，避免被 refreshDerived 重算覆盖
  if (it.effect.lifespan) {
    const yrs = it.effect.lifespan;
    state.player.lifeBonus = (state.player.lifeBonus || 0) + yrs;
    refreshDerived(state);
    logs.push(`服之延寿，寿元上限 +${yrs} 年（现 ${state.player.lifespan} 岁）。`);
  }"""
new2 = """  // 延寿：提升寿元上限（延寿丹）——叠加持久加成 lifeBonus，避免被 refreshDerived 重算覆盖。
  // 图鉴承诺「一生最多服用 3 颗」：对延寿丹按当前轮回计数，满 3 则经脉难承、本次服用失效（不消耗、不累加）。
  if (it.effect.lifespan) {
    if (it.名称 === '延寿丹') {
      const taken = state.player.lifespanPillsTaken || 0;
      if (taken >= 3) {
        return [`「延寿丹」一生至多可服 3 颗，你已服满（${taken} 颗），经脉难承更多药力，此丹暂难生效（留于储物袋即可）。`];
      }
      state.player.lifespanPillsTaken = taken + 1;
    }
    const yrs = it.effect.lifespan;
    state.player.lifeBonus = (state.player.lifeBonus || 0) + yrs;
    refreshDerived(state);
    logs.push(`服之延寿，寿元上限 +${yrs} 年（现 ${state.player.lifespan} 岁）。`);
  }"""
patch(SYS, old2, new2)

print("done")
