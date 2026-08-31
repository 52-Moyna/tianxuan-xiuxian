#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补丁：tests/test-newfeatures.mjs 新增 monthActionStatus 确定性断言。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/tests/test-newfeatures.mjs"

with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

old = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
assert old in src, "未找到汇总行锚点"

block = """/* ---------- 顶栏「本月行动状态」常驻 chip（monthActionStatus 纯函数） ---------- */
{
  // 新游戏尚未行动：actedThisMonth 初始化为空对象
  const st = S.createNewGame({ name: '本月', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2 });
  ensureLifeState(st);
  const m0 = S.monthActionStatus(st);
  ok(m0.count === 0 && m0.done === false && Array.isArray(m0.acted) && m0.acted.length === 0, 'monthActionStatus：新游戏未行动→count=0/done=false');
  // 注入两类已行动分类（与 ui.js 罗盘 lightActionKey 同口径的 actedThisMonth 键）
  st.flags.actedThisMonth = { cultivate: true, study: true };
  const m1 = S.monthActionStatus(st);
  ok(m1.count === 2 && m1.done === true && m1.acted.includes('cultivate') && m1.acted.includes('study'), 'monthActionStatus：注入两类已行动→count=2/done=true');
  // 兼容无 flags / 无 actedThisMonth 的极端旧档
  const bare = { player: {} };
  const m2 = S.monthActionStatus(bare);
  ok(m2.count === 0 && m2.done === false, 'monthActionStatus：极端旧档(无flags)不报错→count=0');
}

""" + old

new = src.replace(old, block, 1)
assert new != src, "写入失败：文本未变化"
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("OK: test-newfeatures.mjs 已新增 monthActionStatus 断言")
