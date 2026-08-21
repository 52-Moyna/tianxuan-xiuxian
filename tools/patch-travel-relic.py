# -*- coding: utf-8 -*-
# 修复两个遗留死道具：旅行凭证/远航凭证(travel效果)、海岛通行令(relic效果)
ROOT = "Z:/1/xiuxian"

def patch_file(rel, patches):
    p = ROOT + "/" + rel
    with open(p, "r", encoding="utf-8") as f:
        s = f.read()
    for old, new, label in patches:
        cnt = s.count(old)
        if cnt != 1:
            raise SystemExit("[FAIL] %s 补丁「%s」匹配 %d 次（应为1）" % (rel, label, cnt))
        s = s.replace(old, new, 1)
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)
    print("[OK] %s : 应用 %d 处补丁" % (rel, len(patches)))

# ---------- life.js ----------
life_patches = [
    (
'''  if (state.world.travel?.destination) return { ok: false, text: '你已在旅途中，不能重复规划路线。' };
  if (!spendStoneLike(state, target.cost)) return { ok: false, text: `路费不足，需要下品灵石${target.cost}。` };
  state.world.travel = { destination: regionId, remaining: target.months };
  const name = REGION_NAMES[regionId] || regionId;
  return { ok: true, text: `你踏上前往${name}的路途，预计${target.months}个月抵达。`, months: target.months };''',
'''  if (state.world.travel?.destination) return { ok: false, text: '你已在旅途中，不能重复规划路线。' };
  // 跨域旅行凭证：持有时本次路费减半（单张消耗），使「远航凭证/旅行凭证」成为真实可用道具
  let cost = target.cost;
  const voucher = state.items.find((i) => i.effect && i.effect.travel);
  let usedVoucher = null;
  if (voucher) {
    cost = Math.max(0, Math.round(target.cost * (1 - (voucher.effect.travel || 0) / 100)));
    usedVoucher = voucher;
  }
  if (!spendStoneLike(state, cost)) return { ok: false, text: `路费不足，需要下品灵石${cost}。` };
  if (usedVoucher) {
    usedVoucher.数量 -= 1;
    if (usedVoucher.数量 <= 0) state.items.splice(state.items.indexOf(usedVoucher), 1);
  }
  state.world.travel = { destination: regionId, remaining: target.months };
  const name = REGION_NAMES[regionId] || regionId;
  const tail = usedVoucher ? `（使用「${usedVoucher.名称}」，路费减半）` : '';
  return { ok: true, text: `你踏上前往${name}的路途，预计${target.months}个月抵达。${tail}`, months: target.months };''',
        "startTravel 旅行凭证折扣"
    ),
    (
'''    { name: '制式护心甲', type: '装备', price: 160, level: 1, desc: '稳定防护，战力 +1。' },
  ],
  donghuang: [''',
'''    { name: '制式护心甲', type: '装备', price: 160, level: 1, desc: '稳定防护，战力 +1。' },
    { name: '旅行凭证', type: '消耗品', price: 160, desc: '下次跨域旅行费用减半。', effect: { travel: 50 } },
  ],
  donghuang: [''',
        "zhongzhou 坊市补旅行凭证"
    ),
]

# ---------- systems.js ----------
systems_patches = [
    (
'''/* ============================================================
 * 十八、秘境多层探索（与遗府残图、天命联动）
 * ========================================================== */
export function exploreMysticRealm(state, realmId, depth = 1) {''',
'''/* ============================================================
 * 十八、秘境多层探索（与遗府残图、天命联动）
 * ========================================================== */
// 海上遗府（需残图秘境）进入需缴纳的护阵灵石；海岛通行令可减 20%（持久生效、不消耗）
const MYSTIC_REALM_ENTRY_FEE = 100;
export function exploreMysticRealm(state, realmId, depth = 1) {''',
        "新增 MYSTIC_REALM_ENTRY_FEE 常量"
    ),
    (
'''  // 遗府需要残图
  if (realm.requiresMap) {
    const maps = state.items.filter((i) => i.名称 === '海上遗府残图');
    const total = maps.reduce((s, i) => s + (i.数量 || 1), 0);
    if (total < 3) return { logs: [`需集齐 3 张「海上遗府残图」方可开启，当前 ${total} 张。`] };
    // 消耗 3 张残图
    let need = 3;
    for (const m of maps) {
      const consume = Math.min(need, m.数量 || 1);
      m.数量 -= consume;
      need -= consume;
      if (m.数量 <= 0) state.items.splice(state.items.indexOf(m), 1);
      if (need <= 0) break;
    }
  }
  const logs = [`你深入「${realm.name}·${dcfg.name}」：${realm.desc}`];
  const setFlags = setBonusFlags(state);''',
'''  const logs = [`你深入「${realm.name}·${dcfg.name}」：${realm.desc}`];
  // 遗府需要残图
  if (realm.requiresMap) {
    const maps = state.items.filter((i) => i.名称 === '海上遗府残图');
    const total = maps.reduce((s, i) => s + (i.数量 || 1), 0);
    if (total < 3) return { logs: [`需集齐 3 张「海上遗府残图」方可开启，当前 ${total} 张。`] };
    // 护阵灵石（海岛通行令可减 20%，持久生效、不消耗），先校验费用再consum残图
    const relicDiscount = state.items
      .filter((i) => i.effect && i.effect.relic)
      .reduce((mx, i) => Math.max(mx, i.effect.relic || 0), 0);
    const fee = Math.max(0, Math.round(MYSTIC_REALM_ENTRY_FEE * (1 - relicDiscount / 100)));
    if (fee > 0 && !spendStones(state, fee)) {
      return { logs: [`遗府护阵需缴纳灵石 ${fee}，当前灵石不足，无法进入。`] };
    }
    // 消耗 3 张残图
    let need = 3;
    for (const m of maps) {
      const consume = Math.min(need, m.数量 || 1);
      m.数量 -= consume;
      need -= consume;
      if (m.数量 <= 0) state.items.splice(state.items.indexOf(m), 1);
      if (need <= 0) break;
    }
    if (fee > 0) logs.push(`缴纳遗府护阵灵石 -${fee}${relicDiscount > 0 ? '（海岛通行令减费）' : ''}。`);
  }
  const setFlags = setBonusFlags(state);''',
        "exploreMysticRealm 护阵灵石+通行令减费"
    ),
]

# ---------- tests/test-newfeatures.mjs ----------
test_import_old = "REGION_TRAVEL, beastLevelRange } from '../public/js/life.js';"
test_import_new = "REGION_TRAVEL, beastLevelRange, startTravel, travelOptions } from '../public/js/life.js';"

test_block = r'''

/* ---------- 死道具修复：旅行凭证 / 远航凭证（跨域旅行费用减半，单张消耗） ---------- */
const pickNeighbor = (st) => travelOptions(st)[0];
{
  // 无凭证：路费 = 全额
  const t1 = S.createNewGame({ name: '旅行测试1', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(t1);
  const nb1 = pickNeighbor(t1);
  t1.currencies['下品灵石'] = 100000;
  const b1 = t1.currencies['下品灵石'];
  const r1 = startTravel(t1, nb1.id);
  ok(r1.ok, '无凭证旅行可规划');
  ok(b1 - t1.currencies['下品灵石'] === nb1.cost, '无凭证路费=全额');
  ok(!r1.text.includes('减半'), '无凭证文案不含减半');

  // 持旅行凭证：路费减半且消耗一张
  const t2 = S.createNewGame({ name: '旅行测试2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(t2);
  const nb2 = pickNeighbor(t2);
  t2.currencies['下品灵石'] = 100000;
  t2.items.push({ 名称: '旅行凭证', 类型: '消耗品', 数量: 1, effect: { travel: 50 }, 描述: '跨域旅行费用减半。' });
  const b2 = t2.currencies['下品灵石'];
  const r2 = startTravel(t2, nb2.id);
  const exp2 = Math.max(0, Math.round(nb2.cost * 0.5));
  ok(r2.ok, '持旅行凭证旅行可规划');
  ok(b2 - t2.currencies['下品灵石'] === exp2, '持旅行凭证路费减半(实扣' + (b2 - t2.currencies['下品灵石']) + ',期望' + exp2 + ')');
  ok(!t2.items.some((i) => i.名称 === '旅行凭证'), '旅行凭证被消耗');
  ok(r2.text.includes('减半'), '持凭证文案提示减半');

  // 持远航凭证同样生效
  const t3 = S.createNewGame({ name: '旅行测试3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(t3);
  const nb3 = pickNeighbor(t3);
  t3.currencies['下品灵石'] = 100000;
  t3.items.push({ 名称: '远航凭证', 类型: '消耗品', 数量: 1, effect: { travel: 50 }, 描述: '跨域旅行费用减半。' });
  const b3 = t3.currencies['下品灵石'];
  const r3 = startTravel(t3, nb3.id);
  ok(r3.ok && b3 - t3.currencies['下品灵石'] === Math.max(0, Math.round(nb3.cost * 0.5)), '远航凭证同样减半并消耗');
}

/* ---------- 死道具修复：海岛通行令（海上遗府护阵灵石减费，持久生效） ---------- */
{
  const mkYifu = () => {
    const g = S.createNewGame({ name: '遗府测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.player.level = 55;
    g.currencies['下品灵石'] = 1000;
    for (let k = 0; k < 3; k++) g.items.push({ 名称: '海上遗府残图', 类型: '线索', 数量: 1, 描述: '残图' });
    return g;
  };
  // 灵石不足：提前返回且残图不消耗
  const a = mkYifu(); a.currencies['下品灵石'] = 0;
  const ra = S.exploreMysticRealm(a, 'yifu', 1);
  ok(ra.logs.some((l) => l.includes('灵石不足')), '遗府灵石不足时拒绝进入');
  ok(a.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0) === 3, '灵石不足时残图不被消耗');

  // 无通行令：全额护阵灵石 100
  const b = mkYifu();
  const rb = S.exploreMysticRealm(b, 'yifu', 1);
  ok(rb.logs.some((l) => l.includes('缴纳遗府护阵灵石 -100')), '无通行令缴全额100护阵灵石');
  ok(!rb.logs.some((l) => l.includes('海岛通行令减费')), '无通行令无减费提示');
  ok(b.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0) === 0, '遗府探索消耗3张残图');

  // 持海岛通行令：减费至 80，且通行令持久不消耗
  const c = mkYifu();
  c.items.push({ 名称: '海岛通行令', 类型: '消耗品', 数量: 1, effect: { relic: 20 }, 描述: '降低海外遗府探索费用。' });
  const rc = S.exploreMysticRealm(c, 'yifu', 1);
  ok(rc.logs.some((l) => l.includes('缴纳遗府护阵灵石 -80')), '持通行令缴80护阵灵石(减费20%)');
  ok(rc.logs.some((l) => l.includes('海岛通行令减费')), '持通行令有减费提示');
  ok(c.items.some((i) => i.名称 === '海岛通行令'), '海岛通行令持久不消耗');
}
'''

summary_anchor = "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);\n\nprocess.exit(fail ? 1 : 0);"

def patch_test():
    p = ROOT + "/tests/test-newfeatures.mjs"
    with open(p, "r", encoding="utf-8") as f:
        s = f.read()
    if s.count(test_import_old) != 1:
        raise SystemExit("[FAIL] test 导入锚点匹配 %d 次" % s.count(test_import_old))
    s = s.replace(test_import_old, test_import_new, 1)
    if s.count(summary_anchor) != 1:
        raise SystemExit("[FAIL] test 汇总锚点匹配 %d 次" % s.count(summary_anchor))
    s = s.replace(summary_anchor, test_block + summary_anchor, 1)
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)
    print("[OK] tests/test-newfeatures.mjs : 应用 2 处补丁（导入 + 新增测试块）")

patch_file("public/js/life.js", life_patches)
patch_file("public/js/systems.js", systems_patches)
patch_test()
print("ALL PATCHES APPLIED")
