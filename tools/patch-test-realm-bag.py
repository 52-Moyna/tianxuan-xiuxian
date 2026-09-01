# -*- coding: utf-8 -*-
"""为秘境满仓前置校验补充测试（tests/test-newfeatures.mjs）"""
import io, sys

P = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'
s = io.open(P, encoding='utf-8').read()
orig = s

block = r'''
/* ---------- 秘境满仓前置校验：付费（残图 + 护阵灵石）后不得静默丢失灵材 ---------- */
{
  const mkYifu = () => {
    const g = S.createNewGame({ name: '遗府满仓测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.player.level = 55;
    g.currencies['下品灵石'] = 1000;
    for (let k = 0; k < 3; k++) g.items.push({ 名称: '海上遗府残图', 类型: '线索', 数量: 1, 描述: '残图' });
    return g;
  };
  // 构造「储物袋满载」：容量 = 当前已用（不能用 capacity=0，会被 ensureLifeState 归一为 100）
  const fillBag = (g) => {
    const used = inventoryUsed(g);
    g.inventory.ringBonus = 0;
    g.inventory.capacity = Math.max(1, used);
    g.inventory.used = used;
  };
  const mapCount = (g) => g.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0);
  const realmWithMat = { rewards: { materials: ['测试灵材'] } };
  const realmNoMat = { rewards: { materials: [] } };

  // 有空位：放行
  const a = mkYifu();
  ok(S.mysticBagBlockReason(a, realmWithMat) === null, '有空位时秘境容量校验放行');
  // 满仓：给出原因，且进入前拦截、不扣残图与护阵灵石
  fillBag(a);
  const reason = S.mysticBagBlockReason(a, realmWithMat);
  ok(typeof reason === 'string' && reason.includes('储物袋已满'), '满仓时秘境容量校验给出中文原因');
  ok(S.mysticBagBlockReason(a, realmNoMat) === null, '无材料产出的秘境不做容量校验');
  const stonesA = S.totalStones(a);
  const ra = S.exploreMysticRealm(a, 'yifu', 1);
  ok(ra.logs.some((l) => l.includes('储物袋已满')), '满仓时拒绝进入秘境并明确提示');
  ok(mapCount(a) === 3, '满仓时残图不被消耗（3 张仍在）');
  ok(S.totalStones(a) === stonesA, '满仓时护阵灵石不被扣除');

  // 腾出空间后可正常进入：残图与灵石照常消耗、材料入袋
  const b = mkYifu();
  b.inventory.capacity = inventoryUsed(b) + 8;
  b.inventory.ringBonus = 0;
  const itemsB = b.items.length;
  const rb = S.exploreMysticRealm(b, 'yifu', 1);
  ok(!rb.logs.some((l) => l.includes('储物袋已满')), '留出空间后可正常进入秘境');
  ok(mapCount(b) === 0, '正常进入时消耗 3 张残图');
  ok(S.totalStones(b) < 1000, '正常进入时缴纳护阵灵石');
  ok(b.items.length > itemsB - 3 || b.items.some((i) => i.类型 === '材料'), '正常进入时材料已入袋');

  // 宗门秘境：满仓不拦截（贡献与灵石照常入账），但产出无法带走时必须明确提示、不得静默
  const mkSect = () => {
    const g = S.createNewGame({ name: '宗门满仓测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g); S.joinSect(g, '测试仙宗');
    g.sect.rank = 3; g.sect.contribution = 0;
    return g;
  };
  const c = mkSect();
  fillBag(c);
  const beforeC = S.totalStones(c);
  const rc = S.exploreSectRealm(c, 2);
  ok(rc.ok && c.sect.contribution === 48, '宗门秘境满仓仍可进入、贡献照常入账');
  ok(S.totalStones(c) === beforeC + 128, '宗门秘境满仓时灵石照常入账');
  ok(rc.logs.some((l) => l.includes('储物袋已满')), '宗门秘境满仓时给出明确警示');
  ok(!c.items.some((i) => i.名称 === '宗门灵脉晶'), '宗门秘境满仓时灵脉晶未入袋');
  ok(rc.logs.some((l) => l.includes('未能带走')), '宗门秘境满仓时产出丢失有明确日志（不再静默）');
  // 空间充足时正常带走灵脉晶与深处丹药
  const d = mkSect();
  d.inventory.capacity = inventoryUsed(d) + 10;
  const rd = S.exploreSectRealm(d, 2);
  ok(rd.ok && d.items.some((i) => i.名称 === '宗门灵脉晶' && i.数量 === 3), '宗门秘境有空间时灵脉晶正常入袋');
  ok(!rd.logs.some((l) => l.includes('未能带走')), '宗门秘境有空间时无丢失日志');
}

'''

anchor = "console.log(`\n===== 本轮新功能专项测试"
assert s.count(anchor) == 1, '测试尾部锚点不唯一'
s = s.replace(anchor, block.lstrip('\n') + anchor, 1)

if s == orig:
    print('NO CHANGE'); sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('test-newfeatures.mjs patched OK')
