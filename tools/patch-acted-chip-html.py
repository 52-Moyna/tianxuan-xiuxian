#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补丁：index.html 顶栏新增 #tb-acted（本月行动状态）chip。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/index.html"

with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = '        <span id="tb-sect" class="tb-chip tb-sect" style="display:none"></span>'
assert anchor in src, "未找到 tb-sect 锚点"

new_chip = anchor + '\n        <span id="tb-acted" class="tb-chip tb-acted" style="display:none"></span>'
assert new_chip != src, "重复插入？"
new = src.replace(anchor, new_chip, 1)
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("OK: index.html 已新增 tb-acted")
