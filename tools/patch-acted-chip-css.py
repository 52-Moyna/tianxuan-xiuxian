#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补丁：main.css 新增 .tb-acted / .tb-acted-done 顶栏样式（明暗主题复用既有变量）。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/css/main.css"

with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = ".tb-sect { color: #b48ad6; border-color: #b48ad6; }"
assert anchor in src, "未找到 .tb-sect 锚点"

css = anchor + """
.tb-acted { color: var(--jade); border-color: var(--jade-soft); background: rgba(111,191,143,.10); }
.tb-acted-done { color: var(--warn); border-color: var(--warn); background: rgba(220,180,70,.12); font-weight: 600; }"""

new = src.replace(anchor, css, 1)
assert new != src, "写入失败：文本未变化"
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("OK: main.css 已新增 tb-acted 样式")
