# -*- coding: utf-8 -*-
"""行囊 UI：搜索过滤 + 满仓「建议清理」一键出货（2026-09-01 20:00 轮次）
- 新增搜索框（名称 + 描述模糊匹配），与既有类型筛选叠加；搜索时显示命中数量
- 满仓（占用 >= 85%）时展示「建议清理」清单：按每格售价升序挑 5 件，一键出售并腾格
- 顺手修正行囊物品索引：原用 nonContainerItems.indexOf(it)（去掉容器后会整体错位），
  改为 st.items.indexOf(it)，保证「使用 / 装备」按钮永远指向 state.items 的正确下标
- CSS：新增 .inv-search / .inv-search-hit / .bag-cleanup 系列
"""
import io
import sys

UI = 'Z:/1/xiuxian/public/js/ui.js'
CSS = 'Z:/1/xiuxian/public/css/main.css'

s = io.open(UI, encoding='utf-8').read()
orig = s

# --- 1) 搜索过滤 + 可见列表 ---
old = """    const nonContainerItems = st.items.filter((it) => resolveType(it) !== 'container');
    const grouped = {};
    for (const it of nonContainerItems) {"""
assert s.count(old) == 1, '锚点1 异常'
new = """    const nonContainerItems = st.items.filter((it) => resolveType(it) !== 'container');
    // 行囊搜索：名称 + 描述模糊匹配（物品一多靠翻找太低效），与既有类型筛选叠加生效。
    // 关键词存在 box.dataset.invQuery 上，重渲染后仍保留（与 itemFilter 同机制）。
    const invQuery = (box.dataset.invQuery || '').trim().toLowerCase();
    const visibleItems = invQuery
      ? nonContainerItems.filter((it) => `${it.名称 || ''} ${it.描述 || ''}`.toLowerCase().includes(invQuery))
      : nonContainerItems;
    const grouped = {};
    for (const it of visibleItems) {"""
s = s.replace(old, new)

# --- 2) 索引统一指向 state.items（修正容器导致的错位） ---
old = "              const i = nonContainerItems.indexOf(it);"
assert s.count(old) == 1, '锚点2 异常'
s = s.replace(old, "              const i = st.items.indexOf(it); // 必须相对 state.items：nonContainerItems 去掉容器后会整体错位")

# --- 3) 满仓建议清理区块（插在容量条之后） ---
old = """        <div class="bag-meter"><i style="width:${Math.min(100, st.inventory.used / effCap * 100)}%"></i></div>`; })()}
        <div class="opt-desc">普通物品每件 1 格；装备和法宝每件 2 格。扩容可通过坊市服务、百艺或特殊机缘获得。</div>"""
assert s.count(old) == 1, '锚点3 异常'
new = """        <div class="bag-meter"><i style="width:${Math.min(100, st.inventory.used / effCap * 100)}%"></i></div>`; })()}
        ${(() => {
          const bag = S.bagUsage(st);
          if (!bag || bag.ratio < 0.85) return '';
          const sug = S.lowValueSuggestions(st, 5);
          if (!sug.length) return '';
          const gain = sug.reduce((a, r) => a + r.price, 0);
          const free = sug.reduce((a, r) => a + r.space, 0);
          return `
          <div class="bag-cleanup">
            <div class="bag-cleanup-title">🧺 储物袋吃紧 · 建议清理这 ${sug.length} 件（腾出 ${free} 格，约售 ${gain} 灵石）</div>
            ${sug.map((r) => `<div class="bag-cleanup-row"><span>${r.name}${r.qty > 1 ? ` ×${r.qty}` : ''}</span><em>${r.space}格 · 约${r.price}灵石</em></div>`).join('')}
            <button class="btn btn-sm btn-gold" id="btn-sell-cleanup">💰 售出以上 ${sug.length} 件</button>
            <div class="bag-cleanup-tip">清单按「每格能卖多少」排序，优先清理最不值钱的；珍贵材料与在用储物袋不会列入。</div>
          </div>`;
        })()}
        <div class="opt-desc">普通物品每件 1 格；装备和法宝每件 2 格。扩容可通过坊市服务、百艺或特殊机缘获得。</div>"""
s = s.replace(old, new)

# --- 4) 搜索框（插在类型筛选按钮之前） ---
old = """        <div class="item-section-title">行囊物品 <span>按类型分类 · 可直接使用的显示「使用」</span></div>
        <div class="inv-filters">"""
assert s.count(old) == 1, '锚点4 异常'
new = """        <div class="item-section-title">行囊物品 <span>按类型分类 · 可直接使用的显示「使用」</span></div>
        <div class="inv-search">
          <input type="text" id="inv-search" placeholder="🔍 搜索名称或描述…" value="${attr(box.dataset.invQuery || '')}" />
          ${invQuery ? '<button class="btn btn-xs" id="inv-search-clear">✕ 清空</button>' : ''}
        </div>
        ${invQuery ? `<div class="inv-search-hit">匹配 ${visibleItems.length} 种${visibleItems.length ? '' : ' · 换个关键词试试'}</div>` : ''}
        <div class="inv-filters">"""
s = s.replace(old, new)

# --- 5) 空列表提示区分「搜索无结果」与「行囊空」 ---
old = """        `).join('') || '<div class="opt-desc">空空如也。</div>'}"""
assert s.count(old) == 1, '锚点5 异常'
s = s.replace(old, """        `).join('') || `<div class="opt-desc">${invQuery ? `没有匹配「${box.dataset.invQuery}」的物品。` : '空空如也。'}</div>`}""")

# --- 6) 事件绑定：搜索 / 清空 / 一键清理 ---
old = """    box.querySelector('#btn-organize').addEventListener('click', () => {
      const n = organizeBag(st);
      toast(`行囊已整理，共 ${n} 件物品。`, 'gold');
      renderAll();
    });"""
assert s.count(old) == 1, '锚点6 异常'
new = """    box.querySelector('#btn-organize').addEventListener('click', () => {
      const n = organizeBag(st);
      toast(`行囊已整理，共 ${n} 件物品。`, 'gold');
      renderAll();
    });
    // 搜索：input 事件即时过滤，重渲染后把焦点还给输入框并置于文末（否则每敲一个字就失焦）
    const invSearch = box.querySelector('#inv-search');
    if (invSearch) invSearch.addEventListener('input', () => {
      box.dataset.invQuery = invSearch.value;
      renderCenter();
      const again = box.querySelector('#inv-search');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
    const invClear = box.querySelector('#inv-search-clear');
    if (invClear) invClear.addEventListener('click', () => { box.dataset.invQuery = ''; renderCenter(); });
    // 一键清理：售出建议清单（按索引精确出货，不会误卖同类里的珍贵品）
    const cleanupBtn = box.querySelector('#btn-sell-cleanup');
    if (cleanupBtn) cleanupBtn.addEventListener('click', () => {
      const sug = S.lowValueSuggestions(st, 5);
      const res = S.sellItemsByIndex(st, sug.map((r) => r.idx));
      if (!res.count) { toast('没有可出售的物品。', 'gold'); return; }
      pushLog(`售出 ${res.count} 件杂物，得灵石${res.stones}，腾出 ${res.space} 格。`);
      toast(`已售出 ${res.count} 件，得灵石 ${res.stones}，腾出 ${res.space} 格。`, 'gold');
      renderAll();
    });"""
s = s.replace(old, new)

if s != orig:
    io.open(UI, 'w', encoding='utf-8', newline='\n').write(s)
    print('ui.js patched')
else:
    print('ui.js UNCHANGED')
    sys.exit(1)

# --- 7) CSS ---
c = io.open(CSS, encoding='utf-8').read()
anchor = ".inv-filter.on { background: var(--gold); border-color: var(--gold-soft); color: #1a1408; font-weight: 700; }"
assert c.count(anchor) == 1, 'CSS 锚点异常'
css_new = anchor + """
.inv-search { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.inv-search input {
  flex: 1; min-width: 0; padding: 6px 10px; border-radius: 8px; font: inherit; font-size: .82rem;
  background: var(--bg-3); border: 1px solid var(--line); color: var(--text);
}
.inv-search input:focus { outline: none; border-color: var(--gold-soft); }
.inv-search-hit { font-size: .74rem; color: var(--text-dim); margin: -2px 0 8px; }
.bag-cleanup {
  margin-top: 10px; padding: 10px 12px; border-radius: 10px;
  background: linear-gradient(145deg, rgba(255,180,80,.10), rgba(255,180,80,.03));
  border: 1px solid rgba(255,180,80,.28);
}
.bag-cleanup-title { font-size: .84rem; font-weight: 700; color: var(--gold); margin-bottom: 6px; }
.bag-cleanup-row {
  display: flex; justify-content: space-between; gap: 8px;
  font-size: .78rem; color: var(--text); padding: 3px 0;
}
.bag-cleanup-row em { font-style: normal; color: var(--text-dim); white-space: nowrap; }
.bag-cleanup-tip { font-size: .72rem; color: var(--text-dim); margin-top: 6px; line-height: 1.5; }"""
c = c.replace(anchor, css_new)
io.open(CSS, 'w', encoding='utf-8', newline='\n').write(c)
print('main.css patched')
