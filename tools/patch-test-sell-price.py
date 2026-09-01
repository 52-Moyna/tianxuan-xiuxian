# -*- coding: utf-8 -*-
"""为坊市出售透明化补测试：sellPriceFactors 加成拆解 + sellBatchPreview 确定性预览，
并验证「UI 预估价」与「实际结算价」落在 ±8% 浮动区间内（此前预估漏算特产/运势，偏差可达 25%+）。
"""
import io

T = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'

with io.open(T, 'r', encoding='utf-8') as f:
    t = f.read()

anchor = "console.log(`\n===== 本轮新功能专项测试："
assert anchor in t, '测试文件锚点缺失'

block = """
/* ---------- 坊市出售透明化：加成拆解 / 批量预览 / 预估价与结算价一致 ---------- */
{
  const sp = S.createNewGame({ name: '售价测试', gender: '女', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sp);
  sp.items.length = 0;
  sp.inventory.capacity = 300; sp.inventory.ringBonus = 0;
  const mat = { 名称: '测试灵材', 类型: '材料', 数量: 2, 价值: 100, 描述: '用于售价口径校验。' };
  const pill = { 名称: '测试丹药', 类型: '丹药', 数量: 1, 价值: 100, 描述: '用于售价口径校验。' };
  storeItem(sp, mat); storeItem(sp, pill);

  // 1) 地域特产：中州特产「消息与功法」不含材料 → 无加成
  sp.world.regionId = 'zhongzhou';
  ok(S.sellPriceFactors(sp, mat).regional === 1, '中州不加成材料售价（specialty 不含材料）');
  // 东荒特产「妖兽材料」→ 材料 1.25x
  sp.world.regionId = 'donghuang';
  const fMat = S.sellPriceFactors(sp, mat);
  ok(fMat.regional === 1.25, `东荒材料售价 1.25x 特产加成（${fMat.regional}）`);
  ok(S.sellPriceFactors(sp, pill).regional === 1, '东荒不加成非材料类（丹药走奇珍判定）');
  // 海外特产「遗府与奇珍」→ 非材料 1.25x
  sp.world.regionId = 'haiwai';
  ok(S.sellPriceFactors(sp, pill).regional === 1.25, '海外奇珍类售价 1.25x 特产加成');
  sp.world.regionId = 'zhongzhou';

  // 2) 交易运势倍率进入售价（此前 UI 预估完全无视此项）
  ok(S.sellPriceFactors(sp, mat).omen === 1, '无运势时交易倍率为 1');
  const noOmenEst = S.sellPriceFactors(sp, mat).est;
  sp.flags = sp.flags || {};
  sp.flags.omen = { kind: 'trade', mul: 1.3, add: 0, expireYear: sp.world.year + 5, expireMonth: 12 };
  const fOmen = S.sellPriceFactors(sp, mat);
  ok(fOmen.omen === 1.3, `交易运势倍率被读取（${fOmen.omen}）`);
  ok(fOmen.est > noOmenEst, `运势生效时预估价提升（${noOmenEst} → ${fOmen.est}）`);
  // 非交易类运势不应影响售价
  sp.flags.omen = { kind: 'cultivate', mul: 1.5, add: 0, expireYear: sp.world.year + 5, expireMonth: 12 };
  ok(S.sellPriceFactors(sp, mat).omen === 1, '修炼类运势不影响交易售价');
  sp.flags.omen = null;

  // 3) est 为确定性值（渲染期可安全调用，不污染随机序列）
  ok(S.sellPriceFactors(sp, mat).est === S.sellPriceFactors(sp, mat).est, 'sellPriceFactors.est 确定性');
  ok(S.sellPriceFactors(sp, mat).base === 100, 'sellPriceFactors 回传基准价值');
  ok(S.sellPriceFactors(sp, { 名称: '无价材料', 类型: '材料', 数量: 1 }).base === 35, '未标价材料兜底基准 35');

  // 4) 预估价 vs 实际结算价：必须落在 ±8% 浮动区间（口径一致的硬校验）
  sp.world.regionId = 'donghuang';
  for (let round = 0; round < 30; round++) {
    const probe = { 名称: '校验材料', 类型: '材料', 数量: 1, 价值: 80, 描述: 'p' };
    sp.items.push(probe);
    const idx = sp.items.length - 1;
    const est = S.sellPriceFactors(sp, probe).est;
    const before = S.totalStones(sp);
    S.sellItem(sp, idx);
    const real = S.totalStones(sp) - before;
    if (real < Math.floor(est * 0.9) || real > Math.ceil(est * 1.1)) {
      ok(false, `预估价与结算价偏离超 ±8%（预估${est} 实得${real}）`);
      break;
    }
    if (round === 29) ok(true, '预估价与实际结算价 30 轮均落在 ±8% 浮动区间内');
  }
  sp.world.regionId = 'zhongzhou';

  // 5) sellBatchPreview：件数 / 总价 / 腾出格位，跳过在用容器
  sp.items = sp.items.filter((i) => i.类型 !== '容器');
  sp.items.length = 0;
  storeItem(sp, { 名称: '批材甲', 类型: '材料', 数量: 3, 价值: 40, 描述: 'd' });
  storeItem(sp, { 名称: '批材乙', 类型: '材料', 数量: 1, 价值: 60, 描述: 'd' });
  storeItem(sp, { 名称: '批杂物', 类型: '杂物', 数量: 1, 价值: 20, 描述: 'd' });
  sp.items.push({ 名称: '在用储物袋', 类型: '容器', 数量: 1, 价值: 999, 描述: 'd' });
  const pm = S.sellBatchPreview(sp, (it) => it.类型 === '材料');
  ok(pm.count === 2, `批量预览统计材料件数（${pm.count}）`);
  ok(pm.space === 4, `批量预览统计腾出格位（3+1=4，实际 ${pm.space}）`);
  ok(pm.stones > 0, '批量预览给出预估总价');
  const pAll = S.sellBatchPreview(sp, null);
  ok(pAll.count === 3, `批量预览无谓词时统计全部可售件数并跳过容器（${pAll.count}）`);
  ok(S.sellBatchPreview(sp, (it) => it.类型 === '不存在的类型').count === 0, '批量预览对空类返回 0 件');
  ok(S.sellBatchPreview(sp, (it) => it.类型 === '不存在的类型').stones === 0, '批量预览空类总价为 0');

  // 6) 预览与实际批量出售一致（同为确定性口径下的 ±8% 区间）
  const stonesBefore = S.sellBatchPreview(sp, (it) => it.类型 === '材料').stones;
  const before2 = S.totalStones(sp);
  const done = S.sellItems(sp, (it) => it.类型 === '材料');
  const got = S.totalStones(sp) - before2;
  ok(done.count === 2, '实际批量出售件数与预览一致');
  ok(got >= Math.floor(stonesBefore * 0.85) && got <= Math.ceil(stonesBefore * 1.15), `批量实得与预览接近（预览${stonesBefore} 实得${got}）`);
  ok(sp.items.some((i) => i.名称 === '在用储物袋'), '批量出售不会卖掉在用储物袋');
  ok(!sp.items.some((i) => i.类型 === '材料'), '批量出售后该类物品清空');

  // 7) 预览为纯函数：不改状态
  const snapshot = sp.items.length;
  const stonesNow = S.totalStones(sp);
  S.sellBatchPreview(sp, (it) => it.类型 === '杂物');
  S.sellPriceFactors(sp, { 名称: 'x', 类型: '杂物', 数量: 1, 价值: 10 });
  ok(sp.items.length === snapshot && S.totalStones(sp) === stonesNow, '预览类函数不产生副作用');
}

"""

t = t.replace(anchor, block + anchor, 1)

with io.open(T, 'w', encoding='utf-8', newline='') as f:
    f.write(t)
print('test-newfeatures.mjs: 追加坊市出售透明化测试块')
