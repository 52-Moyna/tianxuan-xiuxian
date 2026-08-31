#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补丁：systems.js 新增 monthActionStatus 纯函数（顶栏「本月行动状态」chip 使用）。"""
import io, sys

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/js/systems.js"

with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = """export function sectContribution(state) {
  const sect = state.sect;
  if (!sect || !sect.name) return { has: false, name: '', rank: 0, rankName: '', contribution: 0 };
  const rankName = (SECT_RANKS[sect.rank] && SECT_RANKS[sect.rank].name) || '';
  return { has: true, name: sect.name, rank: sect.rank || 0, rankName, contribution: sect.contribution || 0 };
}"""

assert anchor in src, "未找到 sectContribution 锚点"

func = anchor + """

/**
 * 本月行动状态（纯函数，不修改 state）。
 * 游戏采用「每月仅能推进有限行动」的闸门：state.flags.actedThisMonth 是按行动分类记载的布尔对象，
 * 罗盘内已有横幅，但切到其它标签页即不可见。此处提供统一查询，供顶栏常驻 chip 使用，
 * 延续「跨标签页不可见状态常驻化」主题（储物袋/丹炉/灵草/旅行/宗门贡献/危机预警…
 * 之后，补上「本月是否已行动」这一最后盲区）。
 * @returns {{acted:string[], count:number, done:boolean}}
 */
export function monthActionStatus(state) {
  const acted = (state && state.flags && state.flags.actedThisMonth) || {};
  const keys = Object.keys(acted).filter((k) => acted[k]);
  return { acted: keys, count: keys.length, done: keys.length > 0 };
}"""

new = src.replace(anchor, func, 1)
assert new != src, "写入失败：文本未变化"
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("OK: monthActionStatus 已写入 systems.js")
