# -*- coding: utf-8 -*-
"""本轮补丁（2）：消灭剩下两处「点了才发现买不起」
1) 坊市货架：买不起的货整行置灰、价格旁标明「尚缺 N」，购买按钮禁用
2) 洞府「一键浇灌」：按可负担株数降级显示（够浇 3 株就只承诺 3 株），全无则禁用
"""
import io, sys

ROOT = 'Z:/1/xiuxian/'
def rw(p):
    return io.open(p, 'r', encoding='utf-8').read()
def ww(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

ok = []

# ---------- 1) ui.js ----------
p = ROOT + 'public/js/ui.js'
s = rw(p)

# 1a 坊市货架门禁
old = """          ${groups[t].map(({ g, i }) => {
            const cmp = (g.类型 === '装备' || g.类型 === '法宝') ? S.marketCompare(st, g) : null;
            const cmpHtml = cmp ? `<span class="si-cmp si-cmp-${cmp.cls}" title="与当前同部位已装备对比">${cmp.tag} ${cmp.text}</span>` : '';
            return `
            <div class="shop-item" data-buy="${i}">
              <div class="si-body"><b>${g.名称}${g.品阶 ? ` <em class="grade-${g.品阶}">${gradeName(g.品阶)}</em>` : ''}${g.品级 ? ` <em class="grade-tag">${g.品级}</em>` : ''}</b><span>${g.描述}</span>${cmpHtml}</div>
              <div class="si-price">${g.价格} 灵石</div>
              <button class="btn btn-sm btn-gold shop-buy-btn">购买</button>
            </div>`;
          }).join('')}"""
new = """          ${groups[t].map(({ g, i }) => {
            const cmp = (g.类型 === '装备' || g.类型 === '法宝') ? S.marketCompare(st, g) : null;
            const cmpHtml = cmp ? `<span class="si-cmp si-cmp-${cmp.cls}" title="与当前同部位已装备对比">${cmp.tag} ${cmp.text}</span>` : '';
            // 买不起就当场说清楚：整行置灰 + 标明还差多少，别让玩家点了才吃一句「灵石不足」
            const lack = g.价格 - S.totalStones(st);
            const poor = lack > 0;
            return `
            <div class="shop-item${poor ? ' shop-item-poor' : ''}" data-buy="${i}">
              <div class="si-body"><b>${g.名称}${g.品阶 ? ` <em class="grade-${g.品阶}">${gradeName(g.品阶)}</em>` : ''}${g.品级 ? ` <em class="grade-tag">${g.品级}</em>` : ''}</b><span>${g.描述}</span>${cmpHtml}</div>
              <div class="si-price${poor ? ' poor' : ''}">${g.价格} 灵石${poor ? `<em class="si-lack">尚缺 ${lack}</em>` : ''}</div>
              <button class="btn btn-sm ${poor ? '' : 'btn-gold'} shop-buy-btn" ${poor ? 'disabled title="灵石不足"' : ''}>购买</button>
            </div>`;
          }).join('')}"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('坊市货架：买不起的货置灰并标明缺口')
else:
    print('!! 未匹配坊市货架'); sys.exit(1)

# 1b 一键浇灌按可负担株数降级
old = """        ${(() => {
          const canIrr = garden.filter((h) => h.progress < h.grow && (h.irrigatedThisMonth || 0) < HERB_IRRIGATE_CAP_PER_MONTH);
          if (!canIrr.length) return '';
          return `<button class="btn btn-sm btn-gold btn-block" id="btn-irrigate-all" style="margin:6px 0 2px">💧 一键浇灌 ${canIrr.length} 株（${canIrr.length * HERB_IRRIGATE_COST} 灵石）</button>`;
        })()}"""
new = """        ${(() => {
          const canIrr = garden.filter((h) => h.progress < h.grow && (h.irrigatedThisMonth || 0) < HERB_IRRIGATE_CAP_PER_MONTH);
          if (!canIrr.length) return '';
          // 按「当下付得起几株」显示：灵石只够浇 3 株就别承诺 5 株，
          // 否则玩家点下去只浇了部分，日志里混着「灵石不足」，像 bug。
          const afford = Math.min(canIrr.length, Math.floor(S.totalStones(st) / HERB_IRRIGATE_COST));
          if (afford <= 0) {
            return `<button class="btn btn-sm btn-block" disabled title="灵石不足（单次浇灌需 ${HERB_IRRIGATE_COST} 灵石）" style="margin:6px 0 2px">💧 灵石不足，暂无法浇灌</button>`;
          }
          const partial = afford < canIrr.length;
          return `<button class="btn btn-sm btn-gold btn-block" id="btn-irrigate-all" style="margin:6px 0 2px" title="${partial ? `灵石仅够浇灌 ${afford}/${canIrr.length} 株` : ''}">💧 一键浇灌 ${partial ? `${afford}/${canIrr.length}` : canIrr.length} 株（${afford * HERB_IRRIGATE_COST} 灵石）${partial ? ' · 灵石不足，仅浇部分' : ''}</button>`;
        })()}"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('洞府一键浇灌：按可负担株数降级')
else:
    print('!! 未匹配一键浇灌'); sys.exit(1)

ww(p, s)

# ---------- 2) main.css ----------
p = ROOT + 'public/css/main.css'
s = rw(p)
old = "/* 路线不可达（灵石不足）：置灰且不可点击 */"
new = """/* 坊市买不起的货：整行压暗，价格旁附「尚缺 N」 */
.shop-item-poor { opacity: .5; }
.shop-item-poor .si-price.poor { color: var(--text-faint); text-decoration: line-through; }
.si-lack { display: block; font-style: normal; font-size: .72rem; color: var(--text-faint); text-decoration: none; }
/* 路线不可达（灵石不足）：置灰且不可点击 */"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('main.css: 新增 .shop-item-poor / .si-lack')
else:
    print('!! 未匹配 css 锚点'); sys.exit(1)
ww(p, s)

print('补丁完成：')
for x in ok:
    print('  -', x)
