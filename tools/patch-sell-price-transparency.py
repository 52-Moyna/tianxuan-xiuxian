# -*- coding: utf-8 -*-
"""坊市出售透明化补丁：
1) systems.js 新增 sellPriceFactors（拆解售价加成来源，供 UI 标注）与
   sellBatchPreview（批量出售确定性预览：件数/预估灵石/腾出格位）。
2) ui.js 坊市出售页预估价改用 itemSellPrice(...,false) 唯一口径（此前只算行情，
   漏了地域特产 1.25x 与交易运势倍率，导致玩家看到的价与实际到手价系统性偏差），
   并显示特产/运势标签；批量清空按钮标注件数与预估总价。
"""
import io

SYS = 'Z:/1/xiuxian/public/js/systems.js'
UI = 'Z:/1/xiuxian/public/js/ui.js'


def rd(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


# ---------- 1. systems.js ----------
s = rd(SYS)
anchor = "/** 使用丹药（含丹毒系统） */"
assert anchor in s, 'systems.js 锚点缺失'

add = """/** 拆解出售价的加成来源，供 UI 明示「为何是这个价」。
 *  regional=地域特产倍率、news=行情倍率、omen=交易运势倍率，est=确定性预估价（不含 ±8% 浮动）。
 *  与 itemSellPrice 同源，不消耗随机数，可在渲染期安全调用。 */
export function sellPriceFactors(state, item) {
  ensureLifeState(state);
  const regional = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(item.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;
  const news = newsPriceMul(state, item);
  const omen = omenMul(state, 'trade');
  return { regional, news, omen, base: item.价值 || (item.类型 === '材料' ? 35 : 15), est: itemSellPrice(state, item, false) };
}
/** 批量出售确定性预览：件数 / 预估总灵石 / 可腾出格位。
 *  与 sellItems 的筛选口径一致（跳过在用容器），但不消耗随机数、不改状态，
 *  供「一键清空某类」按钮在点击前就把收益摆给玩家看。 */
export function sellBatchPreview(state, predicate) {
  ensureLifeState(state);
  let count = 0;
  let stones = 0;
  let space = 0;
  for (const it of state.items || []) {
    if (!it || it.类型 === '容器') continue;
    if (predicate && !predicate(it)) continue;
    count += 1;
    stones += itemSellPrice(state, it, false);
    space += itemSpace(it) * Math.max(1, Number(it.数量) || 1);
  }
  return { count, stones, space };
}
"""
s = s.replace(anchor, add + anchor, 1)
wr(SYS, s)
print('systems.js: 新增 sellPriceFactors / sellBatchPreview')

# ---------- 2. ui.js 出售页估价口径 ----------
u = rd(UI)

old_sell = """      const buildSellHtml = () => st.items.length ? st.items.map((it, i) => {
        const mul = S.newsPriceMul(st, it);
        const trendTag = mul > 1 ? '<em class="price-up">行情↑</em>' : mul < 1 ? '<em class="price-down">行情↓</em>' : '';
        const est = Math.max(1, Math.round((it.价值 || (it.类型 === '材料' ? 35 : 15)) * (it.数量 || 1) * mul));
        return `
          <div class="shop-item" data-sell="${i}">
            <div class="si-body"><b>${it.名称}</b>${it.数量 > 1 ? `<span> ×${it.数量}</span>` : ''}<span>${it.描述 || ''} ${trendTag}</span></div>
            <div class="si-price">约${est}灵石</div>
            <button class="btn btn-sm shop-sell-btn">出售</button>
          </div>`;
      }).join('') : '<div class="opt-desc">储物袋空空如也。</div>';"""

new_sell = """      const buildSellHtml = () => st.items.length ? st.items.map((it, i) => {
        // 预估价与实际结算共用 itemSellPrice（withFluct=false）：此前这里只乘行情倍率，
        // 漏掉地域特产 1.25x 与交易运势倍率，玩家看到的价与到手价会系统性偏差。
        const f = S.sellPriceFactors(st, it);
        const trendTag = f.news > 1 ? '<em class="price-up">行情↑</em>' : f.news < 1 ? '<em class="price-down">行情↓</em>' : '';
        const specTag = f.regional > 1 ? '<em class="price-spec">本地特产↑25%</em>' : '';
        const omenTag = f.omen > 1 ? `<em class="price-up">交易运势↑${Math.round((f.omen - 1) * 100)}%</em>`
          : f.omen < 1 ? `<em class="price-down">交易运势↓${Math.round((1 - f.omen) * 100)}%</em>` : '';
        const isContainer = it.类型 === '容器';
        return `
          <div class="shop-item${isContainer ? ' shop-item-locked' : ''}" data-sell="${i}">
            <div class="si-body"><b>${it.名称}</b>${it.数量 > 1 ? `<span> ×${it.数量}</span>` : ''}<span>${it.描述 || ''} ${trendTag}${specTag}${omenTag}</span></div>
            <div class="si-price">${isContainer ? '在用' : `约${f.est}灵石`}</div>
            ${isContainer ? '<button class="btn btn-sm" disabled title="当前使用中的储物袋不可出售">在用</button>' : '<button class="btn btn-sm shop-sell-btn">出售</button>'}
          </div>`;
      }).join('') : '<div class="opt-desc">储物袋空空如也。</div>';
      // 批量清空按钮 —— 点击前先把「几件 / 约多少灵石 / 腾出几格」摆出来，消除信息盲区
      const buildBatchHtml = () => ['材料', '杂物', '消耗品'].map((t) => {
        const p = S.sellBatchPreview(st, (it) => it.类型 === t);
        return p.count
          ? `<button class="btn btn-sm" data-batch="${t}">全部${t} <em class="batch-est">${p.count}件 · 约${p.stones}灵石 · 腾${p.space}格</em></button>`
          : `<button class="btn btn-sm" data-batch="${t}" disabled title="行囊中没有此类物品">全部${t} <em class="batch-est">无</em></button>`;
      }).join('');"""

assert old_sell in u, 'ui.js buildSellHtml 锚点缺失'
u = u.replace(old_sell, new_sell, 1)

old_batch = """            <div class="shop-batch">
              <span class="shop-batch-label">一键清空：</span>
              <button class="btn btn-sm" data-batch="材料">全部材料</button>
              <button class="btn btn-sm" data-batch="杂物">全部杂物</button>
              <button class="btn btn-sm" data-batch="消耗品">全部消耗品</button>
            </div>"""
new_batch = """            <div class="shop-batch">
              <span class="shop-batch-label">一键清空：</span>
              ${buildBatchHtml()}
            </div>"""
assert old_batch in u, 'ui.js 批量按钮锚点缺失'
u = u.replace(old_batch, new_batch, 1)

# 出售/批量后需同步刷新批量按钮预览（件数与总价会变），故把绑定抽进 renderSellList
old_render = """      const renderSellList = () => {
        const list = m.querySelector('.shop-sell-list');
        if (list) list.innerHTML = buildSellHtml();
        m.querySelector('.shop-money b').textContent = S.totalStones(st);
        m.querySelectorAll('.shop-sell-btn').forEach((b) => b.addEventListener('click', () => {
          const row = b.closest('.shop-item');
          const idx = row?.dataset.sell;
          if (idx == null) return;
          const msg = S.sellItem(st, Number(idx));
          toast(msg, 'gold'); logs.push(msg);
          renderSellList();
          renderAll();
        }));
      };
      renderSellList();

      // 批量出售按钮（一键清空某类杂物）
      m.querySelectorAll('[data-batch]').forEach((b) => b.addEventListener('click', () => {
        const type = b.dataset.batch;
        const res = S.sellItems(st, (it) => it.类型 === type);
        if (!res.count) { toast(`行囊中没有可出售的「${type}」。`, 'gold'); return; }
        toast(`已售出 ${res.count} 件${type}，共得灵石${res.stones}。`, 'gold');
        logs.push(`批量售出 ${res.count} 件${type}，得灵石${res.stones}。`);
        renderSellList();
        renderAll();
      }));"""
new_render = """      const bindBatch = () => {
        m.querySelectorAll('[data-batch]').forEach((b) => b.addEventListener('click', () => {
          if (b.disabled) return;
          const type = b.dataset.batch;
          const res = S.sellItems(st, (it) => it.类型 === type);
          if (!res.count) { toast(`行囊中没有可出售的「${type}」。`, 'gold'); return; }
          toast(`已售出 ${res.count} 件${type}，共得灵石${res.stones}。`, 'gold');
          logs.push(`批量售出 ${res.count} 件${type}，得灵石${res.stones}。`);
          renderSellList();
          renderAll();
        }));
      };
      const renderSellList = () => {
        const list = m.querySelector('.shop-sell-list');
        if (list) list.innerHTML = buildSellHtml();
        // 批量按钮的件数/总价预览会随出售变化，必须一并重建（否则显示过期数字）
        const batchBar = m.querySelector('.shop-batch');
        if (batchBar) {
          batchBar.innerHTML = `<span class="shop-batch-label">一键清空：</span>${buildBatchHtml()}`;
          bindBatch();
        }
        m.querySelector('.shop-money b').textContent = S.totalStones(st);
        m.querySelectorAll('.shop-sell-btn').forEach((b) => b.addEventListener('click', () => {
          const row = b.closest('.shop-item');
          const idx = row?.dataset.sell;
          if (idx == null) return;
          const msg = S.sellItem(st, Number(idx));
          toast(msg, 'gold'); logs.push(msg);
          renderSellList();
          renderAll();
        }));
      };
      renderSellList();"""
assert old_render in u, 'ui.js renderSellList 锚点缺失'
u = u.replace(old_render, new_render, 1)
wr(UI, u)
print('ui.js: 出售页估价口径统一 + 特产/运势标签 + 批量预览')
