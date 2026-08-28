# -*- coding: utf-8 -*-
"""补丁：test-newfeatures.mjs 追加「延寿丹一生 3 颗上限」确定性断言。
锚点：延寿丹服用测试末尾 `ok(stYS.player.lifespan === lifeBefore + 20, ...)` 之后。
"""
import io

ROOT = "Z:/1/xiuxian"
T = ROOT + "/tests/test-newfeatures.mjs"

ANCHOR = "ok(stYS.player.lifespan === lifeBefore + 20, '服用拍卖延寿丹寿元上限 +20');\n"

NEW = ANCHOR + r"""
// 延寿丹「一生最多 3 颗」上限：第 4 颗服用失效（不消耗、不累加、寿命不变），兑现图鉴承诺
{
  const stCap = S.createNewGame({ name: '延寿上限', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stCap);
  stCap.inventory.capacity = 1000;
  const life0 = stCap.player.lifespan;
  for (let i = 0; i < 4; i++) grantAuctionItem(stCap, poolYS); // 注入 4 颗延寿丹
  const idxs = stCap.items.map((it, k) => ({ it, k })).filter((o) => o.it.名称 === '延寿丹' && o.it.effect && o.it.effect.lifespan).map((o) => o.k);
  ok(idxs.length === 4, '延寿上限：注入 4 颗延寿丹');
  S.useItem(stCap, idxs[0]); S.useItem(stCap, idxs[1]); S.useItem(stCap, idxs[2]); // 服满 3 颗
  ok(stCap.player.lifespan === life0 + 60, '延寿上限：服满 3 颗寿元 +60');
  ok(stCap.player.lifespanPillsTaken === 3, '延寿上限：服用计数 = 3');
  ok(stCap.items.filter((i) => i.名称 === '延寿丹').reduce((a, b) => a + b.数量, 0) === 1, '延寿上限：3 颗已消耗、剩 1 颗');
  const before4 = stCap.player.lifespan;
  const logs4 = S.useItem(stCap, pickLastIdx(stCap.items, (i) => i.名称 === '延寿丹' && i.effect && i.effect.lifespan)) || [];
  ok(stCap.player.lifespan === before4, '延寿上限：第 4 颗服用不增加寿元');
  ok(stCap.player.lifespanPillsTaken === 3, '延寿上限：第 4 颗不累加计数');
  ok(logs4.join('').includes('一生至多可服 3 颗'), '延寿上限：第 4 颗返回拒绝文案');
  ok(pickLastIdx(stCap.items, (i) => i.名称 === '延寿丹') >= 0, '延寿上限：第 4 颗未被消耗（仍留储物袋）');
  const fresh = S.createNewGame({ name: '新世', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ok(fresh.player.lifespanPillsTaken === 0, '延寿上限：转世新一生计数归零（newGame 重置）');
}
"""

with io.open(T, "r", encoding="utf-8") as f:
    s = f.read()

if ANCHOR not in s:
    raise SystemExit("[FAIL] 锚点未命中（延寿丹服用测试行缺失）")

if "延寿上限：注入 4 颗延寿丹" in s:
    print("[SKIP] 该测试补丁已应用")
else:
    s = s.replace(ANCHOR, NEW, 1)
    with io.open(T, "w", encoding="utf-8") as f:
        f.write(s)
    print("[OK] 已写入测试断言")

print("done")
