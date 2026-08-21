#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""向 test-newfeatures.mjs 插入残图修复相关断言（缩进无关，锚定 console.log）。"""
import io

PATH = "Z:/1/xiuxian/tests/test-newfeatures.mjs"

with io.open(PATH, "r", encoding="utf-8") as f:
    s = f.read()

anchor = "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
assert anchor in s, "未找到测试汇总锚点"

block = r'''/* ---------- 残图死道具修复：游历产出海上遗府残图 + 罗盘进度提示 ---------- */
{
  // 1) 洞府游历事件稳定产出 海上遗府残图（不再是孤立、无法消耗的 秘境残图）
  const w = S.createNewGame({ name: '残图', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(w);
  const cave = S.WANDER_EVENTS.find((e) => e.id === 'cave');
  ok(!!cave, '游历事件池含洞府(cave)事件');
  const before = w.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0);
  cave.run(w);
  const after = w.items.filter((i) => i.名称 === '海上遗府残图').reduce((s, i) => s + (i.数量 || 1), 0);
  ok(after === before + 1, '洞府游历稳定产出 1 张海上遗府残图');
  ok(!w.items.some((i) => i.名称 === '秘境残图'), '不再产出孤立的 秘境残图');

  // 2) 罗盘海上遗府选项随持有残图数变化提示进度
  const c = S.createNewGame({ name: '罗盘残图', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(c);
  c.world.month = 1; c.flags.auctionAvailable = false; c.player.level = 55;
  const opt0 = S.extraCompassOptions(c).find((o) => o.action.realmId === 'yifu');
  ok(opt0 && /当前持有 0 张/.test(opt0.desc), '0 张残图时提示当前持有 0 张');
  storeItem(c, { 名称: '海上遗府残图', 类型: '线索', 数量: 3, 描述: '测试', 价值: 100 });
  const opt3 = S.extraCompassOptions(c).find((o) => o.action.realmId === 'yifu');
  ok(opt3 && /已集齐 3 张残图，可开启/.test(opt3.desc), '集齐 3 张时提示可开启');
}

''' + anchor

s = s.replace(anchor, block, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(s)

print("OK: 测试断言已插入")
