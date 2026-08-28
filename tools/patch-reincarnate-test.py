# -*- coding: utf-8 -*-
import io, sys
TEST = "Z:/1/xiuxian/tests/test-newfeatures.mjs"
def read(p):
    with io.open(p, encoding="utf-8") as f: return f.read()
def write(p, s):
    with io.open(p, "w", encoding="utf-8") as f: f.write(s)

test_block = """
/* ---------- 转世继承确定性预览（自由优化：补齐投资型决策预览最后缺口） ---------- */
const rcS = S.createNewGame({ name: '转世', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(rcS);
rcS.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0, '极品灵石': 0, '灵晶': 0 };
rcS.player.daoBase['根骨'].level = 10;
rcS.player.daoBase['悟性'].level = 5;
rcS.player.daoYun.exp = 200;
rcS.player.mainTechnique = rcS.techniques[0].名称;
const pv = S.reincarnatePreview(rcS);
ok(pv.stones === 500, '转世预览：继承灵石为半数（1000→500）');
ok(pv.totalStones === 1000, '转世预览：记录总灵石数');
const gengu = pv.daoList.find((d) => d.name === '根骨');
ok(gengu && gengu.cur === 10 && gengu.add === 3 && gengu.next === 13, '转世预览：根骨 +floor(10×0.3)=+3（10→13）');
const wux = pv.daoList.find((d) => d.name === '悟性');
ok(wux && wux.cur === 5 && wux.add === 1 && wux.next === 6, '转世预览：悟性 +floor(5×0.3)=+1（5→6）');
ok(pv.yunExp === 40, '转世预览：道韵经验 +floor(200×0.2)=+40');
ok(pv.techName === rcS.techniques[0].名称, '转世预览：主修功法名为当前主修');
ok(rcS.player.daoBase['根骨'].level === 10 && rcS.player.daoYun.exp === 200 && rcS.currencies['下品灵石'] === 1000, '转世预览纯函数：完全不改动原状态');
const inhR = S.reincarnate(rcS, false);
ok(inhR && inhR.stones === 500 && inhR.daoBase['根骨'] === 3 && inhR.yunExp === 40 && inhR.tech && inhR.tech.名称 === rcS.techniques[0].名称, 'reincarnate 返回继承对象与预览一致（行为不变）');
ok(S.reincarnate(rcS, true) === null, 'reincarnate(full=true) 返回 null（完全重开走新建流程）');

"""
s = read(TEST)
old = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
if s.count(old) != 1:
    print("!!! 汇总锚点不匹配（命中 %d），中止。" % s.count(old)); sys.exit(1)
s = s.replace(old, test_block + old, 1)
write(TEST, s)
print("OK  测试断言已插入汇总 console.log 之前（%d 条）" % (test_block.count("ok(")))
