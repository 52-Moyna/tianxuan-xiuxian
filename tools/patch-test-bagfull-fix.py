# -*- coding: utf-8 -*-
"""天玄修仙录 · 修正测试构造：capacity 置 0 会被 ensureLifeState 归一成 100，
须改用「容量 = 当前已用」的方式真实填满储物袋。"""
import io, sys

P = r"Z:/1/xiuxian/tests/test-newfeatures.mjs"
src = io.open(P, encoding="utf-8").read()
orig = src

# 1) import 补齐 inventoryUsed
I_OLD = "refineRate, storeItem, REGION_TRAVEL,"
I_NEW = "refineRate, storeItem, inventoryUsed, REGION_TRAVEL,"
assert src.count(I_OLD) == 1, "1: 未唯一匹配 import 片段"
src = src.replace(I_OLD, I_NEW)

# 2) 插入 fillBag / freeBag 辅助
MK_OLD = """    s.currencies['下品灵石'] = 100000;
    return s;
  };

  // 1) 收获灵草：满载时拒绝（灵草保留、不谎报成功）；腾出空间后可正常收获"""
MK_NEW = """    s.currencies['下品灵石'] = 100000;
    return s;
  };
  // 构造「储物袋满载」：capacity 会被 ensureLifeState 归一（0 视作缺省、重置为 100），
  // 故以「容量 = 当前已用格数」真实填满，而不是把容量写成 0。
  const fillBag = (s) => {
    if (!s.items.length) storeItem(s, { 名称: '测试杂物', 类型: '杂物', 数量: 1, 描述: '占位的测试杂物。' });
    s.inventory.capacity = Math.max(1, inventoryUsed(s));
    s.inventory.ringBonus = 0;
  };
  const freeBag = (s) => { s.inventory.capacity = 200; };

  // 1) 收获灵草：满载时拒绝（灵草保留、不谎报成功）；腾出空间后可正常收获"""
assert src.count(MK_OLD) == 1, "2: 未唯一匹配 mk 片段"
src = src.replace(MK_OLD, MK_NEW)

# 3) 替换满载/腾空间的构造写法
REPL = [
    ("  g.inventory.capacity = 0; // 模拟储物袋满载", "  fillBag(g);"),
    ("  g.inventory.capacity = 200;", "  freeBag(g);"),
    ("  g2.inventory.capacity = 0;", "  fillBag(g2);"),
    ("  c.inventory.capacity = 0;", "  fillBag(c);"),
    ("  c.inventory.capacity = 200;", "  freeBag(c);"),
    ("  a.inventory.capacity = 0;", "  fillBag(a);"),
    ("  b.inventory.capacity = 0;", "  fillBag(b);"),
    ("  b.inventory.capacity = 200;", "  freeBag(b);"),
]
for old, new in REPL:
    assert src.count(old) >= 1, f"3: 未匹配 {old!r}"
    src = src.replace(old, new)

assert "inventory.capacity = 0" not in src, "3: 仍残留 capacity=0 的构造"
if src != orig:
    io.open(P, "w", encoding="utf-8").write(src)
    print("test-newfeatures.mjs 已修正满载构造")
else:
    print("无改动")
    sys.exit(1)
