# -*- coding: utf-8 -*-
"""天玄修仙录 · 补丁：为「满仓保护」与「一键浇灌」补测试断言（test-newfeatures）"""
import io, sys

P = r"Z:/1/xiuxian/tests/test-newfeatures.mjs"
src = io.open(P, encoding="utf-8").read()
orig = src
changed = []

# ---------- 1. import 补齐 irrigateAllHerbs ----------
I_OLD = "harvestAllHerbs, irrigateHerb, crossbreedHerbs,"
I_NEW = "harvestAllHerbs, irrigateHerb, irrigateAllHerbs, crossbreedHerbs,"
assert src.count(I_OLD) == 1, "1: 未唯一匹配 import 片段"
src = src.replace(I_OLD, I_NEW)
changed.append("测试 import irrigateAllHerbs")

# ---------- 2. 追加测试块 ----------
ANCHOR = """console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);
"""
BLOCK = r"""
/* ---------- 满仓保护：产出不再被静默丢弃 ---------- */
{
  const mk = () => {
    const s = S.createNewGame({ name: '满仓保护', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(s);
    s.currencies['下品灵石'] = 100000;
    return s;
  };

  // 1) 收获灵草：满载时拒绝（灵草保留、不谎报成功）；腾出空间后可正常收获
  const g = mk();
  plantHerb(g, 'lingcao');
  g.cave.garden[0].progress = g.cave.garden[0].grow;
  g.inventory.capacity = 0; // 模拟储物袋满载
  const cntBefore = g.items.length;
  const r1 = harvestHerb(g, 0);
  ok(!r1.ok, '满仓·收获：拒绝收获（产出不被静默丢弃）');
  ok(g.cave.garden.length === 1, '满仓·收获：灵草仍留在灵田');
  ok((r1.logs[0] || '').includes('储物袋空间不足'), '满仓·收获：给出可行动提示');
  ok(g.items.length === cntBefore, '满仓·收获：未凭空消耗灵草');
  g.inventory.capacity = 200;
  const r2 = harvestHerb(g, 0);
  ok(r2.ok && g.cave.garden.length === 0, '满仓·收获：腾出空间后可正常收获');

  // 2) 一键收获：满载时逐株拒绝，count=0 且成熟灵草全保留
  const g2 = mk();
  plantHerb(g2, 'lingcao');
  plantHerb(g2, 'huoqing');
  g2.cave.garden.forEach((h) => { h.progress = h.grow; });
  g2.inventory.capacity = 0;
  const ra = harvestAllHerbs(g2);
  ok(!ra.ok && ra.count === 0, '满仓·一键收获：count=0（不谎报收获）');
  ok(g2.cave.garden.length === 2, '满仓·一键收获：成熟灵草全部保留在灵田');

  // 3) 灵草杂交：满载时拒绝，且灵石与两份材料都原样保留
  const c = mk();
  storeItem(c, { 名称: '凝露草', 类型: '材料', 数量: 2, 描述: '测试材料。' });
  storeItem(c, { 名称: '火精枣', 类型: '材料', 数量: 2, 描述: '测试材料。' });
  c.inventory.capacity = 0;
  const stonesBefore = c.currencies['下品灵石'];
  const rc = crossbreedHerbs(c, '凝露草', '火精枣');
  ok(!rc.ok, '满仓·杂交：拒绝杂交');
  ok(c.currencies['下品灵石'] === stonesBefore, '满仓·杂交：不扣灵石');
  ok((c.items.find((x) => x.名称 === '凝露草')?.数量 || 0) === 2, '满仓·杂交：不消耗材料');
  c.inventory.capacity = 200;
  const rc2 = crossbreedHerbs(c, '凝露草', '火精枣');
  ok(rc2.ok && !!c.items.find((x) => x.名称 === '凝火奇实'), '满仓·杂交：腾出空间后可正常杂交');

  // 4) 拍卖落槌预检：装备/功法不受行囊格位限制；杂物满载时给出拒绝理由
  const a = mk();
  ok(S.auctionBagBlockReason(a, { name: '青风靴', type: '装备' }) === null, '拍卖预检：装备类不受行囊限制');
  ok(S.auctionBagBlockReason(a, { name: '某功法', type: '功法' }) === null, '拍卖预检：功法类不受行囊限制');
  a.inventory.capacity = 0;
  const reason = S.auctionBagBlockReason(a, { name: '聚气丹', type: '丹药' });
  ok(typeof reason === 'string' && reason.includes('储物袋空间不足'), '拍卖预检：杂物类满载时给出理由');

  // 5) 一口价：满载时不落槌、不扣灵石、拍品也不被吞掉
  const b = mk();
  b.auction = {
    items: [{ name: '聚气丹', type: '丹药', basePrice: 100, currentBid: 100, bidder: '起拍价', buyout: 300, rivalBudget: 0, rivalName: '萧无名' }],
    active: true, month: b.world.turns, bids: {},
  };
  b.inventory.capacity = 0;
  const stonesB = S.totalStones(b);
  const rb = S.buyoutAuction(b, 0);
  ok(!rb.ok, '满仓·一口价：拒绝成交（不静默吞掉灵石）');
  ok(S.totalStones(b) === stonesB, '满仓·一口价：不扣灵石');
  ok(b.auction.items.length === 1, '满仓·一口价：拍品仍在场上');
  b.inventory.capacity = 200;
  ok(S.buyoutAuction(b, 0).ok, '满仓·一口价：腾出空间后可正常买下');
}

/* ---------- 灵草园：一键浇灌 ---------- */
{
  const mk = () => {
    const s = S.createNewGame({ name: '一键浇灌', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(s);
    s.currencies['下品灵石'] = 100000;
    return s;
  };

  const g = mk();
  plantHerb(g, 'lingcao');  // grow 3
  plantHerb(g, 'huoqing');  // grow 5
  g.cave.garden[0].progress = 2;
  g.cave.garden[1].progress = 0;
  const r1 = irrigateAllHerbs(g);
  ok(r1.ok && r1.count === 2, `一键浇灌：本月各浇灌 1 次（实得 ${r1.count}）`);
  ok(r1.spent === HERB_IRRIGATE_COST * 2, '一键浇灌：花费 = 次数 × 单价');
  ok(g.cave.garden[0].progress === 3, '一键浇灌：最接近成熟的灵草已浇熟');
  ok(g.cave.garden[1].progress === 1, '一键浇灌：未熟灵草推进 1 月');
  const r2 = irrigateAllHerbs(g);
  ok(r2.ok && r2.count === 1, '一键浇灌：本月已达上限的灵草不再重复浇');
  const r3 = irrigateAllHerbs(g);
  ok(!r3.ok && r3.count === 0, '一键浇灌：全部达上限后无可浇灌');

  // 灵石不足时只浇灌负担得起的部分，不透支
  const p = mk();
  plantHerb(p, 'lingcao');
  plantHerb(p, 'huoqing');
  p.currencies['下品灵石'] = HERB_IRRIGATE_COST + 5;
  const rp = irrigateAllHerbs(p);
  ok(rp.ok && rp.count === 1, '一键浇灌：灵石不足时只浇能负担的株数');
  ok(p.currencies['下品灵石'] === 5, '一键浇灌：不会透支灵石');
}

""" + ANCHOR
assert src.count(ANCHOR) == 1, "2: 未唯一匹配文件尾锚点"
src = src.replace(ANCHOR, BLOCK)
changed.append("追加满仓保护 + 一键浇灌测试块")

if src != orig:
    io.open(P, "w", encoding="utf-8").write(src)
    print("test-newfeatures.mjs 已更新：")
    for c in changed:
        print("  -", c)
else:
    print("无改动")
    sys.exit(1)
