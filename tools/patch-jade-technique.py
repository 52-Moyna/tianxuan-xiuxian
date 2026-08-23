#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复：基础功法玉简购买时按 effect.technique 授予具体功法（如「基础吐纳术」）。

原 buyItem 对 功法 类型只用 goods.名称（玉简名）与 goods.品级，
导致 REGION_MARKET.zhongzhou 的「基础功法玉简」声明 effect.technique='基础吐纳术'
被忽略：实际写入名为「基础功法玉简」的功法，且品级缺失（战力兜底为 1）。
本补丁改为优先使用 effect.technique 作为功法名、品级缺失补「凡品」。

用法：python3 tools/patch-jade-technique.py
"""
import io, sys, os

PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'js', 'systems.js')
PATH = os.path.abspath(PATH)

with io.open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

OLD = """  } else if (goods.类型 === '功法') {
    state.techniques.push({ 名称: goods.名称, 品级: goods.品级, 等级: 1, 经验: 0 });
    discoverItem(state, { 名称: goods.名称, 类型: '功法' });
  } else {"""

NEW = """  } else if (goods.类型 === '功法') {
    // 2026-08-23：功法玉简若声明了 effect.technique，则按声明授予具体功法（如「基础功法玉简」→「基础吐纳术」），
    // 避免把玉简名本身当功法写入、且品级缺失导致战力兜底。无声明则沿用玉简名与货架品级。
    const tname = goods.effect?.technique || goods.名称;
    const tgrade = goods.品级 || '凡品';
    state.techniques.push({ 名称: tname, 品级: tgrade, 等级: 1, 经验: 0 });
    discoverItem(state, { 名称: tname, 类型: '功法' });
  } else {"""

if OLD not in src:
    print('PATCH FAILED: 未找到待替换代码块（可能已修补或文本漂移）')
    sys.exit(2)

src = src.replace(OLD, NEW, 1)
with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)
print('PATCH OK: 基础功法玉简现按 effect.technique 授予具体功法')
