#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""坊市渲染：装备/法宝显示「与当前同部位对比」智能徽标。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/js/ui.js"
with io.open(path, "r", encoding="utf-8") as f:
    s = f.read()

old_block = """          ${groups[t].map(({ g, i }) => `
            <div class="shop-item" data-buy="${i}">
              <div class="si-body"><b>${g.名称}${g.品阶 ? ` <em class="grade-${g.品阶}">${gradeName(g.品阶)}</em>` : ''}${g.品级 ? ` <em class="grade-tag">${g.品级}</em>` : ''}</b><span>${g.描述}</span></div>
              <div class="si-price">${g.价格} 灵石</div>
              <button class="btn btn-sm btn-gold shop-buy-btn">购买</button>
            </div>`).join('')}"""

new_block = """          ${groups[t].map(({ g, i }) => {
            const cmp = (g.类型 === '装备' || g.类型 === '法宝') ? S.marketCompare(st, g) : null;
            const cmpHtml = cmp ? `<span class="si-cmp si-cmp-${cmp.cls}" title="与当前同部位已装备对比">${cmp.tag} ${cmp.text}</span>` : '';
            return `
            <div class="shop-item" data-buy="${i}">
              <div class="si-body"><b>${g.名称}${g.品阶 ? ` <em class="grade-${g.品阶}">${gradeName(g.品阶)}</em>` : ''}${g.品级 ? ` <em class="grade-tag">${g.品级}</em>` : ''}</b><span>${g.描述}</span>${cmpHtml}</div>
              <div class="si-price">${g.价格} 灵石</div>
              <button class="btn btn-sm btn-gold shop-buy-btn">购买</button>
            </div>`;
          }).join('')}"""

assert old_block in s, "ui.js 坊市渲染块未匹配"
s = s.replace(old_block, new_block, 1)

with io.open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("ui.js 已更新")
