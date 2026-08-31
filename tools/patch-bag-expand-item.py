# -*- coding: utf-8 -*-
"""把 codex 幽灵条目「扩容储物袋」做成真实可用道具：可坊市购买、可服用扩容。
改动：systems.js useItem(+eff.bag) / itemUsePreview(+bag) / shopStock(+道具) + codex.js 文案校准。
"""
import io, sys

ROOT = 'Z:/1/xiuxian'
SYS = f'{ROOT}/public/js/systems.js'
COX = f'{ROOT}/public/js/codex.js'

def patch(path, repls):
    s = open(path, encoding='utf-8').read()
    for old, new in repls:
        cnt = s.count(old)
        if cnt != 1:
            print(f'[FAIL] {path} 锚点命中 {cnt} 次（应为 1）：{old[:60]!r}')
            sys.exit(1)
        s = s.replace(old, new)
    open(path, 'w', encoding='utf-8').write(s)
    print(f'[OK] {path} 应用 {len(repls)} 处替换')

# ---- systems.js ----
sys_repls = [
    # 1) useItem：新增 eff.bag 结算（在灵兽契约之后、解毒丹之前）
    (
'''  // 解毒丹：服用降低丹毒（与 codex 承诺「丹毒 -30」一致），是丹毒危机唯一主动恢复途径''',
'''  // 扩容储物袋：服用直接拓展行囊容量（容量 +N 格），与坊市「储物袋扩容契」服务并行的另一种扩容途径
  if (it.effect.bag) {
    const add = Number(it.effect.bag) || 20;
    state.inventory.capacity += add;
    state.inventory.upgrades = (state.inventory.upgrades || 0) + 1;
    state.inventory.bagName = bagNameByCapacity(state.inventory.capacity, '乾坤储物袋');
    logs.push(`施法展开「${it.名称}」，行囊容量 +${add} 格（现 ${state.inventory.capacity} 格）。`);
  }
  // 解毒丹：服用降低丹毒（与 codex 承诺「丹毒 -30」一致），是丹毒危机唯一主动恢复途径''',
    ),
    # 2) itemUsePreview：新增 eff.bag 预览
    (
'''  if (eff.detox) parts.push(`丹毒 -${eff.detox}`);''',
'''  if (eff.bag) parts.push(`行囊容量 +${eff.bag} 格`);
  if (eff.detox) parts.push(`丹毒 -${eff.detox}`);''',
    ),
    # 3) shopStock：上架「扩容储物袋」道具（与扩容契同价同效，可囤积）
    (
'''  state.world.market = { stock, refreshTurn: state.world.turns };''',
'''  // 扩容储物袋：可购回行囊、服用即拓展容量 +20 格（与「储物袋扩容契」服务同效，便于囤积备用）
  stock.push({ 名称: '扩容储物袋', 类型: '道具', 价格: BAG_UPGRADE_BASE + (state.inventory.upgrades || 0) * BAG_UPGRADE_STEP, 价值: Math.round(BAG_UPGRADE_BASE * 0.6), 描述: '服用后行囊容量 +20 格（与坊市扩容契同效，可囤积备用）。', effect: { bag: 20 } });
  state.world.market = { stock, refreshTurn: state.world.turns };''',
    ),
]
patch(SYS, sys_repls)

# ---- codex.js ----
cox_repls = [
    (
'''  { id: 'item_bag', category: '容器', name: '扩容储物袋', rarity: '容器', source: '坊市、百艺、机缘', effect: '增加行囊容量 +20 格，容量不足会限制资源获取。' },''',
'''  { id: 'item_bag', category: '容器', name: '扩容储物袋', rarity: '容器', source: '坊市（可购道具）、服用即生效', effect: '服用后行囊容量 +20 格，与坊市「储物袋扩容契」服务同效，可囤积备用，缓解满仓丢物之忧。' },''',
    ),
]
patch(COX, cox_repls)
print('全部补丁应用完毕。')
