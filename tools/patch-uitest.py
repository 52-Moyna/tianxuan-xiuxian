# -*- coding: utf-8 -*-
import io
def patch(path, olds, news):
    with io.open(path,'r',encoding='utf-8') as f: s=f.read()
    for old,new in zip(olds,news):
        c=s.count(old)
        if c!=1: raise SystemExit('[FAIL] anchor not unique (%d)'%c)
        s=s.replace(old,new,1)
    with io.open(path,'w',encoding='utf-8') as f: f.write(s)
    print('[OK]', path)

UI='public/js/ui.js'
ui_btn='''        ${(npc.relation >= 3) ? (() => { const ci = S.commissionInfo(st, npc); return ci.cdRemaining > 0 ? `<button class="btn btn-dim" disabled>委托筹措中（剩 ${ci.cdRemaining} 月）</button>` : `<button class="btn btn-gold" data-k="commission">交付委托 · 需 ${ci.need} ${ci.task.item}（持 ${ci.have}）</button>`; })() : ''}
        <button class="btn btn-red" data-k="qiecuo">切磋较技 · 会进入斗法</button>'''
patch(UI,
  ['        <button class="btn btn-red" data-k="qiecuo">切磋较技 · 会进入斗法</button>'],
  [ui_btn])

TST='tests/test-newfeatures.mjs'
test_block='''/* ---------- 道友委托（交付类支线闭环） ---------- */
{
  const cnt = (st, name) => (st.items || []).filter((x) => x.名称 === name).reduce((s, x) => s + (Number(x.数量) || 1), 0);
  const mk = (job) => {
    const g = S.createNewGame({ name: '委托测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    g.npcs = [{ name: '炉伯', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job, trait: '木讷', level: 10 }];
    return g;
  };
  const g0 = mk('炼器师');
  g0.npcs[0].relation = 1; g0.npcs[0].relationName = '熟识';
  ok(!S.commissionInfo(g0, g0.npcs[0]).available, '关系不足时委托不可见');
  const r0 = S.interactNpc(g0, g0.npcs[0], 'commission');
  ok(Array.isArray(r0) && r0.some((l) => l.includes('无意相托')), '关系不足时交付委托被拦截');
  const g = mk('炼器师');
  const ci = S.commissionInfo(g, g.npcs[0]);
  ok(ci.available && ci.task.item === '矿石' && ci.need === 3, '炼器师委托为矿石x3');
  const blocked = S.interactNpc(g, g.npcs[0], 'commission');
  ok(blocked.some((l) => l.includes('暂难交差')), '材料不足时委托交付被拒');
  ok(cnt(g, '矿石') === 0, '拒绝后不消耗材料');
  storeItem(g, { 名称: '矿石', 类型: '材料', 数量: 3, 描述: '测试矿石', 价值: 5 });
  const beforeStash = g.equipment.stash.length;
  const done = S.interactNpc(g, g.npcs[0], 'commission');
  ok(done.some((l) => l.includes('了结一桩委托')), '材料齐全时交付成功');
  ok(cnt(g, '矿石') === 0, '交付后矿石被消耗');
  ok(g.equipment.stash.length === beforeStash + 1, '交付后回赠一件装备入备用栏');
  ok(g.npcs[0].commissionCd > g.world.turns, '交付后进入冷却');
  const cd = S.interactNpc(g, g.npcs[0], 'commission');
  ok(cd.some((l) => l.includes('筹措中')), '冷却期内不可再交付');
  const gs = mk('散修');
  storeItem(gs, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: '测试矿石', 价值: 5 });
  const stonesBefore = S.totalStones(gs);
  const ds = S.interactNpc(gs, gs.npcs[0], 'commission');
  ok(ds.some((l) => l.includes('灵石+120')), '散修委托确定性回赠灵石+120');
  ok(S.totalStones(gs) === stonesBefore + 120, '灵石实际到账+120');
}

'''
with io.open(TST,'r',encoding='utf-8') as f: t=f.read()
lines=t.split('\n')
idx=[i for i,l in enumerate(lines) if l.startswith("console.log(`") and "本轮新功能专项测试" in l]
if len(idx)!=1: raise SystemExit('[FAIL] summary line count %d'%len(idx))
lines.insert(idx[0], test_block.rstrip('\n'))
with io.open(TST,'w',encoding='utf-8') as f: f.write('\n'.join(lines))
print('[OK]', TST)
