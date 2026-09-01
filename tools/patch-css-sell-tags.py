# -*- coding: utf-8 -*-
"""补齐坊市出售页新增元素的样式：
- .price-spec 本地特产标签（与 .price-up/.price-down 同一行内标签体系）
- .batch-est 批量按钮的件数/总价预览小字
- .shop-item-locked 在用储物袋行（不可出售，整行淡化）
- .shop-batch .btn-sm[disabled] 无货时的禁用态
"""
import io

CSS = 'Z:/1/xiuxian/public/css/main.css'

with io.open(CSS, 'r', encoding='utf-8') as f:
    css = f.read()

anchor = ".price-down { color: var(--jade); font-style: normal; font-size: .72rem; }"
assert anchor in css, 'CSS 锚点缺失'
add = anchor + """
.price-spec { color: var(--gold); font-style: normal; font-size: .72rem; margin-left: 4px; }"""
css = css.replace(anchor, add, 1)

anchor2 = ".shop-batch .btn-sm { padding: 5px 10px; font-size: .76rem; }"
assert anchor2 in css, 'CSS 批量条锚点缺失'
add2 = anchor2 + """
.shop-batch .btn-sm[disabled] { opacity: .42; cursor: not-allowed; }
.batch-est { font-style: normal; font-size: .68rem; color: var(--text-dim); margin-left: 4px; }
.shop-batch .btn-sm:not([disabled]) .batch-est { color: var(--gold-soft); }
.shop-item-locked { opacity: .55; }
.shop-item-locked .si-price { color: var(--text-dim); }"""
css = css.replace(anchor2, add2, 1)

with io.open(CSS, 'w', encoding='utf-8', newline='') as f:
    f.write(css)
print('main.css: 新增 .price-spec / .batch-est / .shop-item-locked / 禁用态样式')
