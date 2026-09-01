# -*- coding: utf-8 -*-
"""修复 ensureLifeState 地域归一的非确定性语义。

原实现：Object.entries(REGION_NAMES).find(([id, name]) =>
          id === state.world.regionId || name === regionName || regionName.includes(name))
这是 OR 条件混在同一次 find 里，谁在 REGION_NAMES 键序中排前面谁中标。
后果：一旦 world.region（中文名）与 world.regionId 不一致（例如某处只改了 id 未同步名，
或旧档字段残缺），regionId 会被静默改成键序更靠前的地域 —— 中州排第一，
于是几乎总是被拉回中州，直接影响坊市特产售价、妖兽等级、野外材料与路线判定。

修复：regionId 是权威口径 —— 合法则直接采信并据此刷新显示名；
仅当 regionId 缺失/非法时，才用中文名反查（旧档兼容），最后兜底中州。
"""
import io

LIFE = 'Z:/1/xiuxian/public/js/life.js'

with io.open(LIFE, 'r', encoding='utf-8') as f:
    s = f.read()

old = """  const regionName = String(state.world.region || '中州圣城');
  const found = Object.entries(REGION_NAMES).find(([id, name]) => id === state.world.regionId || name === regionName || regionName.includes(name));
  state.world.regionId = found?.[0] || 'zhongzhou';
  state.world.region = REGION_NAMES[state.world.regionId] || regionName;"""

new = """  const regionName = String(state.world.region || '中州圣城');
  // regionId 是权威口径：合法则直接采信，并据此刷新中文显示名。
  // 此前把「id 命中」和「名称命中」混在同一次 find 的 OR 条件里，结果取决于 REGION_NAMES 的键序，
  // 只要 id 与中文名不一致就会被键序更靠前的地域（中州）悄悄顶替，
  // 连带影响坊市特产售价、妖兽等级区间、野外材料与旅行路线判定。
  let rid = REGION_NAMES[state.world.regionId] ? state.world.regionId : '';
  if (!rid) {
    // 旧档兼容：只有中文名时按名反查（先全等，再退化到包含匹配）
    const exact = Object.entries(REGION_NAMES).find(([, name]) => name === regionName);
    const fuzzy = exact || Object.entries(REGION_NAMES).find(([, name]) => regionName.includes(name));
    rid = fuzzy?.[0] || 'zhongzhou';
  }
  state.world.regionId = rid;
  state.world.region = REGION_NAMES[rid] || regionName;"""

assert old in s, 'life.js 地域归一锚点缺失'
s = s.replace(old, new, 1)

with io.open(LIFE, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('life.js: ensureLifeState 地域归一改为「regionId 权威」，消除键序依赖')
