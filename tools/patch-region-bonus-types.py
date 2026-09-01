# -*- coding: utf-8 -*-
"""修复：地域特产 1.25x 售价加成 5/7 地域为死内容。

根因：itemSellPrice / sellPriceFactors 用
      (REGION_TRAVEL[regionId]?.specialty || '').includes(类型 === '材料' ? '材料' : '奇珍')
      判定地域特产，而 specialty 是「炼器火材」「灵植与毒材」「海产灵材」这类复合词，
      只有东荒「妖兽材料」含「材料」二字、海外「遗府与奇珍」含「奇珍」二字能命中，
      其余 5 个地域的溢价承诺全部落空（地图面板却明写「特产：炼器火材」）。

修法：给 REGION_TRAVEL 每项补显式 bonusTypes 字段（'*' 表示「除材料外全部」，
      用于保持海外既有行为不变），判定改由纯函数 regionSellBonus 统一负责，
      itemSellPrice 与 sellPriceFactors 共用同一函数，杜绝两处漂移。

只改 public/js/life.js 与 public/js/systems.js，不碰其它文件。
"""
import io
import os
import re
import sys

ROOT = r'Z:/1/xiuxian'
LIFE = os.path.join(ROOT, 'public/js/life.js')
SYS = os.path.join(ROOT, 'public/js/systems.js')

fails = []


def rd(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def sub1(text, old, new, label):
    """精确替换一次，失败则记录。"""
    if text.count(old) != 1:
        fails.append('%s：匹配 %d 次（期望 1 次）' % (label, text.count(old)))
        return text
    return text.replace(old, new, 1)


life = rd(LIFE)
sys_ = rd(SYS)

# ---------------------------------------------------------------- 1. bonusTypes
BONUS = {
    'zhongzhou': "[]",                 # 消息与功法：功法不入行囊，无特产溢价（原行为 1.00x，保持一致）
    'donghuang': "['材料']",           # 妖兽材料
    'nanming':   "['材料']",           # 炼器火材（原落空）
    'xiji':      "['材料', '道具']",   # 符箓与阵材（原落空）
    'beiming':   "['材料']",           # 海产灵材（原落空）
    'lingnan':   "['材料']",           # 灵植与毒材（原落空）
    'haiwai':    "['*']",              # 遗府与奇珍：'*' = 除材料外全部（保持原行为：非材料 1.25x）
}
for rid, bt in BONUS.items():
    pat = re.compile(r'(  %s: \{ neighbors: \[[^\]]*\], cost: \d+, months: \d+, specialty: \'[^\']*\', flavor: \'[^\']*\', danger: \d+, realmReq: \d+)( \},)' % rid)
    m = pat.search(life)
    if not m:
        fails.append('REGION_TRAVEL.%s 行未匹配' % rid)
        continue
    life = life[:m.end(1)] + (', bonusTypes: %s' % bt) + life[m.end(1):]

# ------------------------------------------------- 2. regionSellBonus 纯函数
anchor = """/**
 * 地域危险度 → 妖兽等级区间（与玩家战力脱钩）。"""
if life.count(anchor) != 1:
    fails.append('regionSellBonus 插入锚点匹配 %d 次' % life.count(anchor))
else:
    fn = """/**
 * 地域特产售价加成倍率（唯一口径）。
 * 读取 REGION_TRAVEL[id].bonusTypes 显式声明的可溢价物品类型；'*' 表示「除材料外全部」。
 * 历史坑：此前靠 specialty 文案做 includes('材料') 模糊匹配，而特产值多为「炼器火材」
 * 「灵植与毒材」「海产灵材」这类复合词，不含「材料」二字 → 7 个地域里 5 个的溢价承诺
 * 从未兑现。改为显式字段后，文案改词不再影响结算。
 * @returns {number} 1.25 或 1
 */
export function regionSellBonus(state, item) {
  const types = REGION_TRAVEL[state?.world?.regionId]?.bonusTypes;
  if (!Array.isArray(types) || !types.length || !item) return 1;
  if (types.includes('*')) return item.类型 === '材料' ? 1 : 1.25;
  return types.includes(item.类型) ? 1.25 : 1;
}

""" + anchor
    life = life.replace(anchor, fn, 1)

wr(LIFE, life)

# ---------------------------------------------------------- 3. systems.js 接入
sys_ = sub1(
    sys_,
    'storeItem, storeItemOrNote, canStore,',
    'storeItem, storeItemOrNote, canStore, regionSellBonus,',
    'systems.js import 追加 regionSellBonus')

sys_ = sub1(
    sys_,
    "  const regionalBonus = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(item.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;\n"
    "  const newsMul = newsPriceMul(state, item);",
    "  const regionalBonus = regionSellBonus(state, item);\n"
    "  const newsMul = newsPriceMul(state, item);",
    'itemSellPrice 改用 regionSellBonus')

sys_ = sub1(
    sys_,
    "  const regional = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(item.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;",
    "  const regional = regionSellBonus(state, item);",
    'sellPriceFactors 改用 regionSellBonus')

wr(SYS, sys_)

if fails:
    print('FAILED:')
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('OK: region bonusTypes patched (life.js + systems.js)')
