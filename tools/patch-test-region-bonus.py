# -*- coding: utf-8 -*-
"""为「地域特产 1.25x 溢价」补回归防线测试。

背景：判定逻辑原本靠 specialty 文案做 includes('材料') 模糊匹配，而特产值多为
      「炼器火材」「灵植与毒材」「海产灵材」这类复合词 → 7 个地域里 5 个的溢价
      从未兑现，而既有测试只断言了中州（唯一「不应当生效」的地域），形成覆盖盲区。

本补丁在 tests/test-newfeatures.mjs 的「坊市出售透明化」段落内补：
  1. 五个此前落空地域的「应当生效」断言（南冥/岭南/北冥/西极 + 西极道具）
  2. 反向断言（南冥不加成丹药、海外不加成材料），防止过度加成
  3. 结构校验：每个 REGION_TRAVEL 项都必须声明 bonusTypes，防新增地域静默失效
  4. 端到端：岭南卖材料较中州实测溢价约 25%（结算价对比，非仅因子字段）
"""
import io
import os
import sys

ROOT = r'Z:/1/xiuxian'
T = os.path.join(ROOT, 'tests/test-newfeatures.mjs')

fails = []


def sub1(text, old, new, label):
    if text.count(old) != 1:
        fails.append('%s：匹配 %d 次（期望 1 次）' % (label, text.count(old)))
        return text
    return text.replace(old, new, 1)


with io.open(T, encoding='utf-8') as f:
    t = f.read()

# 1. import 追加 regionSellBonus
t = sub1(
    t,
    'herbMonthlyGrowth, herbArrayGrowth, storeItemOrNote }',
    'herbMonthlyGrowth, herbArrayGrowth, storeItemOrNote, regionSellBonus }',
    'import 追加 regionSellBonus')

# 2. 在「海外奇珍 1.25x」断言之后插入回归防线
anchor = """  sp.world.regionId = 'haiwai';
  ok(S.sellPriceFactors(sp, pill).regional === 1.25, '海外奇珍类售价 1.25x 特产加成');
  sp.world.regionId = 'zhongzhou';
"""
new_block = """  sp.world.regionId = 'haiwai';
  ok(S.sellPriceFactors(sp, pill).regional === 1.25, '海外奇珍类售价 1.25x 特产加成');

  // 1b) 复合词特产回归防线：此前判定靠 specialty 文案 includes('材料')，
  //     而「炼器火材 / 灵植与毒材 / 海产灵材 / 符箓与阵材」都不含「材料」二字，
  //     导致 5/7 地域的 1.25x 溢价从未兑现。现改为读 REGION_TRAVEL.bonusTypes 显式字段，
  //     文案改词不再影响结算。以下逐地域锁定「应当生效」与「不应生效」两端。
  const talis = { 名称: '测试符箓', 类型: '道具', 数量: 1, 价值: 100, 描述: '西极特产校验。' };
  for (const [rid, item, want, label] of [
    ['nanming', mat, 1.25, '南冥「炼器火材」加成材料'],
    ['lingnan', mat, 1.25, '岭南「灵植与毒材」加成材料'],
    ['beiming', mat, 1.25, '北冥「海产灵材」加成材料'],
    ['xiji', mat, 1.25, '西极「符箓与阵材」加成材料'],
    ['xiji', talis, 1.25, '西极加成道具（符箓）'],
    ['nanming', pill, 1, '南冥不加成丹药（非本地特产）'],
    ['haiwai', mat, 1, '海外不加成材料（* = 除材料外全部）'],
    ['zhongzhou', mat, 1, '中州「消息与功法」不加成材料'],
  ]) {
    sp.world.regionId = rid;
    const got = S.sellPriceFactors(sp, item).regional;
    ok(got === want, `${label} → ${got}（期望 ${want}）`);
  }
  // 结构校验：每个地域都必须显式声明 bonusTypes，否则新增地域会静默失去溢价
  for (const [rid, cfg] of Object.entries(REGION_TRAVEL)) {
    ok(Array.isArray(cfg.bonusTypes), `REGION_TRAVEL.${rid} 声明了 bonusTypes（防溢价静默失效）`);
  }
  // regionSellBonus 与 sellPriceFactors 同口径（避免两处判定再次漂移）
  sp.world.regionId = 'lingnan';
  ok(regionSellBonus(sp, mat) === S.sellPriceFactors(sp, mat).regional, 'regionSellBonus 与 sellPriceFactors 同口径');
  // 端到端：岭南卖同一件材料，结算价较中州实测溢价约 25%（不只看因子字段）
  const lnPrice = S.itemSellPrice(sp, mat, false);
  sp.world.regionId = 'zhongzhou';
  const zzPrice = S.itemSellPrice(sp, mat, false);
  ok(Math.abs(lnPrice / zzPrice - 1.25) < 0.02, `岭南卖材料较中州实测溢价 25%（中州 ${zzPrice} → 岭南 ${lnPrice}）`);
  sp.world.regionId = 'zhongzhou';
"""
t = sub1(t, anchor, new_block, '地域特产回归防线插入')

with io.open(T, 'w', encoding='utf-8', newline='') as f:
    f.write(t)

if fails:
    print('FAILED:')
    for x in fails:
        print('  -', x)
    sys.exit(1)
print('OK: region bonus regression tests added')
