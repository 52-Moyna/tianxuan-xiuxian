#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""向 tests/test-newfeatures.mjs 插入「基础功法玉简」确定性断言（插在汇总行之前）。"""
import io, sys, os

PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'tests', 'test-newfeatures.mjs'))

with io.open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

MARK = "console.log(`\\n===== 本轮新功能专项测试"
assert MARK in src, '未找到汇总行锚点'

BLOCK = """
/* ---------- 基础功法玉简：购买按 effect.technique 授予具体功法（确定性） ---------- */
{
  const g = S.createNewGame({ name: '功法玉简测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(g);
  g.inventory.capacity = 999; g.inventory.used = 0;
  S.addStones(g, 100000);
  const jade = S.shopStock(g).find((x) => x.名称 === '基础功法玉简');
  ok(!!jade, '坊市含基础功法玉简');
  if (jade) {
    S.buyItem(g, jade);
    const t = g.techniques.find((x) => x.名称 === '基础吐纳术');
    ok(!!t, '基础功法玉简授予「基础吐纳术」', t ? '品级=' + t.品级 : '缺失');
    ok(t && t.品级 === '凡品', '「基础吐纳术」品级为凡品', t ? t.品级 : '缺失');
    ok(!g.techniques.some((x) => x.名称 === '基础功法玉简'), '不会把玉简名当功法写入');
  }
}

"""

if '基础功法玉简授予' in src:
    print('TEST ALREADY PRESENT')
    sys.exit(0)

idx = src.index(MARK)
src = src[:idx] + BLOCK + src[idx:]

with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)
print('TEST INSERTED OK')
