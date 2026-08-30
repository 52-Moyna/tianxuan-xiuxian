#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""审计 effect 键覆盖率：
1) 扫描 public/js/*.js 中所有 `effect:{...}` 定义块的顶层键，得「已定义 effect 键」集合。
2) 已知 useItem/itemUsePreview 显式处理的键集合（handled）。
3) 找「已定义但未被处理」的 effect 键（潜在死效果 / 装饰性假承诺）。
4) 同时输出所有 effect 定义位置，便于人工核对。
"""
import re, json, os

ROOT = "Z:/1/xiuxian/public/js"
FILES = ["systems.js", "data.js", "codex.js", "life.js", "ui.js"]

# useItem / itemUsePreview 显式处理的 effect 键（来自人工核对）
HANDLED = {
    "exp", "heal", "wuxing", "daoBase", "cultivateBoostMonths", "power",
    "lifespan", "beastSlot", "detox", "battleBuff",
    "tribulation", "ward", "tame",  # 自动消耗类（breakthrough 用顶层字段标记）
}
# 特殊：地火引 按名称(名称==='地火引')拦截；breakthrough 按顶层字段
SPECIAL_NAME = {"地火引"}
SPECIAL_TOPLEVEL = {"breakthrough"}

def extract_top_keys(block):
    """从 effect:{...} 块内容中提取顶层 key（跳过嵌套层级，只取第一层 key:）。"""
    keys = set()
    depth = 0
    # 按 token 走：遇到未引号的 `key:` 且 depth==0 记为键
    i = 0
    n = len(block)
    while i < n:
        c = block[i]
        if c in "\"'":
            # 跳过字符串
            q = c
            i += 1
            while i < n and block[i] != q:
                if block[i] == "\\":
                    i += 2
                    continue
                i += 1
            i += 1
            continue
        if c == "{":
            depth += 1; i += 1; continue
        if c == "}":
            depth -= 1; i += 1; continue
        if depth == 0:
            m = re.match(r"[A-Za-z_$][\w$]*\s*:", block[i:])
            if m:
                keys.add(m.group(0).split(":")[0].strip())
                i += len(m.group(0))
                continue
        i += 1
    return keys

def find_effect_blocks(text):
    """返回所有 `effect:` 后的 {...} 块（含内容）。"""
    blocks = []
    for m in re.finditer(r"effect\s*:\s*\{", text):
        start = m.end() - 1  # index of {
        depth = 0
        i = start
        n = len(text)
        while i < n:
            c = text[i]
            if c in "\"'":
                q = c; i += 1
                while i < n and text[i] != q:
                    if text[i] == "\\": i += 2; continue
                    i += 1
                i += 1; continue
            if c == "{": depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(text[start+1:i])
                    break
            i += 1
    return blocks

all_defs = {}  # key -> list of (file, snippet)
for fn in FILES:
    path = os.path.join(ROOT, fn)
    if not os.path.exists(path):
        print("MISSING", path); continue
    text = open(path, encoding="utf-8", errors="ignore").read()
    blocks = find_effect_blocks(text)
    for b in blocks:
        ks = extract_top_keys(b)
        for k in ks:
            snippet = b.strip()[:80].replace("\n", " ")
            all_defs.setdefault(k, []).append(f"{fn}: {snippet}")

print("=" * 60)
print(f"已定义 effect 顶层键（共 {len(all_defs)} 种）:")
for k in sorted(all_defs):
    print(f"  - {k}  ({len(all_defs[k])} 处)")

print("=" * 60)
print("未被 useItem/itemUsePreview 处理的 effect 键（需核查）:")
unhandled = sorted(k for k in all_defs if k not in HANDLED)
if not unhandled:
    print("  （无：所有已定义 effect 键均被处理 ✓）")
else:
    for k in unhandled:
        print(f"  ! {k}")
        for loc in all_defs[k]:
            print(f"      {loc}")

print("=" * 60)
# 反向：handled 中是否全部有定义（找出已处理但可能从未定义的键，属正常，仅提示）
defined = set(all_defs.keys())
never_defined_handled = sorted(h for h in HANDLED if h not in defined)
print("已处理但代码中无 effect 定义的键（可能由运行时对象提供，仅提示）:")
for h in never_defined_handled:
    print(f"  ~ {h}")
