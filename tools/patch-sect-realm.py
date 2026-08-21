#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
宗门秘境（核心弟子可进）实现补丁。
把 codex.js 中「核心弟子 benefit：可使用宗门秘境」的装饰性死文案，
变为真实、确定性、无 RNG、可测试的玩法。

改动文件（真实仓库 Z:/1/xiuxian）：
  public/js/systems.js  —— 新增 exploreSectRealm + performAction case 'sectRealm' + 罗盘选项
  public/js/ui.js       —— sectRealm 分发 + 深度选择弹窗 chooseSectDepth
  tests/test-newfeatures.mjs —— 确定性断言
"""
import io, re, sys

ROOT = "Z:/1/xiuxian"

def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8") as f:
        f.write(s)

def patch_once(s, old, new, label):
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"[FAIL] {label}: 期望精确匹配 1 处，实际 {n} 处")
    return s.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1) systems.js：罗盘选项（核心弟子可入宗门秘境）
# ---------------------------------------------------------------------------
sys_path = f"{ROOT}/public/js/systems.js"
s = read(sys_path)

old_compass = (
    "  // 宗门任务（加入宗门后）\n"
    "  if (state.sect?.name) {\n"
    "    opts.push({ icon: '🏯', tag: '宗门', title: `执行宗门任务（${state.sect.name}）`, desc: `当前职级：${SECT_RANKS[state.sect.rank]?.name}，贡献 ${state.sect.contribution}。`, action: { type: 'sectTask' }, preview: '换取贡献、晋升职级、获得修炼加成' });\n"
    "  }\n"
)
new_compass = old_compass + (
    "  // 宗门秘境（核心弟子及以上可入）：确定性收益，无妖兽风险\n"
    "  if ((state.sect?.rank || 0) >= 3) {\n"
    "    opts.push({ icon: '🏞️', tag: '宗门', title: '潜修宗门秘境', desc: '宗门禁地，核心弟子及以上方可进入。体悟传承得宗门贡献，采灵脉矿髓与材料（无妖兽风险）。', action: { type: 'sectRealm' }, preview: '确定性收益：宗门贡献 + 下品灵石 + 材料（深处额外得聚气丹）' });\n"
    "  }\n"
)
s = patch_once(s, old_compass, new_compass, "systems.compass")

# ---------------------------------------------------------------------------
# 2) systems.js：performAction 新增 case 'sectRealm'
# ---------------------------------------------------------------------------
old_mystic = (
    "    case 'mystic': {\n"
    "      const r = exploreMysticRealm(state, a.realmId, extra.depth || 1);\n"
    "      logs.push(...r.logs);\n"
    "      if (r.battle) battle = r.battle;\n"
    "      if (r.hiddenEvent) { /* 深处隐藏奇遇，由 UI 接管 */ extra.hiddenEvent = r.hiddenEvent; }\n"
    "      break;\n"
    "    }\n"
)
new_mystic = old_mystic + (
    "    case 'sectRealm': {\n"
    "      const r = exploreSectRealm(state, extra.depth || 1);\n"
    "      logs.push(...r.logs);\n"
    "      break;\n"
    "    }\n"
)
s = patch_once(s, old_mystic, new_mystic, "systems.performAction")

# ---------------------------------------------------------------------------
# 3) systems.js：新增 exploreSectRealm（在「十九、机缘事件链」之前插入）
# ---------------------------------------------------------------------------
NEW_SECT_REALM = (
    "/* ============================================================\n"
    " * 十八·甲、宗门秘境（核心弟子及以上可进入，确定性收益，无妖兽风险）\n"
    " * ========================================================== */\n"
    "/**\n"
    " * 潜修宗门秘境：核心弟子(rank>=3)及以上可进入本宗禁地，体悟传承获取\n"
    " * 宗门贡献与灵脉资源。完全确定性、无 RNG、无妖兽风险，作为稳定资源来源。\n"
    " * @param {object} state\n"
    " * @param {number} depth 1..MYSTIC_DEPTH.max\n"
    " * @returns {{ ok:boolean, logs:string[] }}\n"
    " */\n"
    "export function exploreSectRealm(state, depth = 1) {\n"
    "  ensureLifeState(state);\n"
    "  if (!state.sect?.name) return { ok: false, logs: ['你尚未加入任何宗门，无处进入宗门秘境。'] };\n"
    "  if ((state.sect.rank || 0) < 3) {\n"
    "    return { ok: false, logs: [`需核心弟子及以上方可进入宗门秘境（当前职级：${SECT_RANKS[state.sect.rank]?.name || '散修'}）。`] };\n"
    "  }\n"
    "  depth = Math.min(MYSTIC_DEPTH.max, Math.max(1, Number(depth) || 1));\n"
    "  const dcfg = MYSTIC_DEPTH.of(depth);\n"
    "  const logs = [`你步入「宗门秘境·${dcfg.name}」，灵脉环绕，宗门先辈留下的洞天福地静候你的体悟……`];\n"
    "  // 体悟传承：宗门贡献（确定性，按深度缩放）\n"
    "  const gain = Math.round(30 * dcfg.stoneMul);\n"
    "  state.sect.contribution += gain;\n"
    "  logs.push(`体悟宗门传承，宗门贡献 +${gain}。`);\n"
    "  // 采得灵脉矿髓：下品灵石（确定性）\n"
    "  const stones = Math.round(80 * dcfg.stoneMul);\n"
    "  addStones(state, stones);\n"
    "  logs.push(`采得灵脉矿髓，下品灵石 +${stones}。`);\n"
    "  // 灵脉所凝材料（确定性）\n"
    "  const mat = { 名称: '宗门灵脉晶', 类型: '材料', 数量: depth, 描述: '宗门秘境灵脉所凝之晶，可充作炼器灵材。' };\n"
    "  if (storeItem(state, mat)) logs.push(`获得材料：宗门灵脉晶 ×${mat.数量}。`);\n"
    "  // 深处藏有宗门丹房旧藏（确定性，depth>=2 可得聚气丹）\n"
    "  if (depth >= 2) {\n"
    "    const pill = { 名称: '聚气丹', 类型: '丹药', 数量: 1, effect: { exp: 90 }, toxicity: 8, 描述: '宗门丹房旧藏，服下修为 +90（连续服用生丹毒）。' };\n"
    "    if (storeItem(state, pill)) logs.push(`于深处丹室寻得宗门旧藏：聚气丹 ×1。`);\n"
    "  }\n"
    "  makeChronicle(state, { type: '宗门', title: `潜修宗门秘境·${dcfg.name}`, text: logs.join('') });\n"
    "  addLog(state, '事件', `潜修宗门秘境·${dcfg.name}：${logs.slice(1).join('')}`);\n"
    "  refreshDerived(state);\n"
    "  return { ok: true, logs };\n"
    "}\n"
)
pat = re.compile(
    r"/\* =+\n \* 十九、修仙机缘事件链（走火入魔、心魔、天道注视、因果债）\n \* =+ \*/\n"
    r"export function checkSpecialEvent\(state\) \{"
)
m = pat.search(s)
if not m:
    raise SystemExit("[FAIL] systems.sectRealm 未找到插入锚点（十九、机缘事件链）")
s = s[:m.start()] + NEW_SECT_REALM + "\n" + s[m.start():]

write(sys_path, s)
print("[OK] systems.js 已更新（罗盘选项 + performAction + exploreSectRealm）")

# ---------------------------------------------------------------------------
# 4) ui.js：sectRealm 分发 + chooseSectDepth 弹窗
# ---------------------------------------------------------------------------
ui_path = f"{ROOT}/public/js/ui.js"
u = read(ui_path)

old_dispatch = (
    "    if (option.action.type === 'mystic') {\n"
    "      const depth = await chooseMysticDepth();\n"
    "      if (!depth) return;\n"
    "      const r = S.performAction(GameState.data, option, { depth });\n"
    "      await resolveFlows(r, option);\n"
    "      return;\n"
    "    }\n"
)
new_dispatch = (
    "    if (option.action.type === 'sectRealm') {\n"
    "      const depth = await chooseSectDepth();\n"
    "      if (!depth) return;\n"
    "      const r = S.performAction(GameState.data, option, { depth });\n"
    "      await resolveFlows(r, option);\n"
    "      return;\n"
    "    }\n\n"
    "    if (option.action.type === 'mystic') {\n"
    "      const depth = await chooseMysticDepth();\n"
    "      if (!depth) return;\n"
    "      const r = S.performAction(GameState.data, option, { depth });\n"
    "      await resolveFlows(r, option);\n"
    "      return;\n"
    "    }\n"
)
u = patch_once(u, old_dispatch, new_dispatch, "ui.dispatch")

old_modal_end = (
    "    m.querySelector('#btn-cancel-depth').addEventListener('click', () => { closeModal(); resolve(); });\n"
    "  });\n"
    "  return pick;\n"
    "}\n"
)
NEW_SECT_MODAL = (
    "    m.querySelector('#btn-cancel-depth').addEventListener('click', () => { closeModal(); resolve(); });\n"
    "  });\n"
    "  return pick;\n"
    "}\n\n"
    "/* ---------------- 宗门秘境深度选择 ---------------- */\n"
    "async function chooseSectDepth() {\n"
    "  const depths = D.MYSTIC_DEPTH.levels;\n"
    "  let pick = null;\n"
    "  await new Promise((resolve) => {\n"
    "    const m = openModal(`\n"
    "      <div class=\"choice-intro\">选择本次潜修的纵深。越深，宗门贡献、灵石与材料越丰厚；深处更藏有宗门丹房旧藏（聚气丹）。无妖兽风险。</div>\n"
    "      <div class=\"depth-list\">\n"
    "        ${depths.map((d) => `\n"
    "          <div class=\"depth-opt\">\n"
    "            <div class=\"depth-name\">${d.name}<span class=\"depth-idx\">第 ${depths.indexOf(d) + 1} 层</span></div>\n"
    "            <div class=\"depth-detail\">贡献&灵石×${d.stoneMul} ｜ 材料×${d.matMul}${d.depth >= 2 ? ' ｜ 深处得聚气丹' : ''}</div>\n"
    "            <button class=\"btn btn-sm btn-gold\" data-depth=\"${depths.indexOf(d) + 1}\">深入${d.name}</button>\n"
    "          </div>`).join('')}\n"
    "      </div>\n"
    "      <div class=\"modal-actions\"><button class=\"btn\" id=\"btn-cancel-sectdepth\">取消</button></div>`,\n"
    "      { title: '宗门秘境 · 深度选择', lock: true, cls: 'modal-lg' });\n"
    "    m.querySelectorAll('[data-depth]').forEach((b) => b.addEventListener('click', () => { pick = Number(b.dataset.depth); closeModal(); resolve(); }));\n"
    "    m.querySelector('#btn-cancel-sectdepth').addEventListener('click', () => { closeModal(); resolve(); });\n"
    "  });\n"
    "  return pick;\n"
    "}\n"
)
u = patch_once(u, old_modal_end, NEW_SECT_MODAL, "ui.chooseSectDepth")

write(ui_path, u)
print("[OK] ui.js 已更新（sectRealm 分发 + chooseSectDepth 弹窗）")

# ---------------------------------------------------------------------------
# 5) tests/test-newfeatures.mjs：确定性断言（插在汇总 console.log 之前）
# ---------------------------------------------------------------------------
test_path = f"{ROOT}/tests/test-newfeatures.mjs"
t = read(test_path)

ANCHOR = "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
if t.count(ANCHOR) != 1:
    raise SystemExit(f"[FAIL] tests anchor 匹配 {t.count(ANCHOR)} 处，期望 1")

NEW_TESTS = (
    "/* ---------- 宗门秘境：核心弟子可入，确定性收益，无妖兽风险 ---------- */\n"
    "{\n"
    "  const mkSect = (rank, contrib = 0) => {\n"
    "    const g = S.createNewGame({ name: '宗门秘境测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "    ensureLifeState(g);\n"
    "    S.joinSect(g, '测试仙宗');\n"
    "    g.sect.rank = rank;\n"
    "    g.sect.contribution = contrib;\n"
    "    return g;\n"
    "  };\n"
    "  // 门禁：内外门(rank<3) 不能进入\n"
    "  const gLow = mkSect(2);\n"
    "  const rLow = S.exploreSectRealm(gLow, 1);\n"
    "  ok(!rLow.ok && rLow.logs.some((l) => l.includes('需核心弟子')), 'rank<3 拒绝进入宗门秘境');\n"
    "  ok(gLow.sect.contribution === 0, 'rank<3 进入失败不改动贡献');\n"
    "  // 未入宗：拒绝\n"
    "  const gNone = S.createNewGame({ name: '无宗', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "  ensureLifeState(gNone); gNone.sect = { name: '', rank: 0, contribution: 0 };\n"
    "  const rNone = S.exploreSectRealm(gNone, 1);\n"
    "  ok(!rNone.ok && rNone.logs.some((l) => l.includes('尚未加入')), '未入宗拒绝进入宗门秘境');\n"
    "  // 核心弟子(rank3) depth1：确定性收益\n"
    "  const g3 = mkSect(3, 0);\n"
    "  const beforeStones = g3.currencies['下品灵石'];\n"
    "  const r3 = S.exploreSectRealm(g3, 1);\n"
    "  ok(r3.ok, 'rank3 可进入宗门秘境');\n"
    "  ok(g3.sect.contribution === 30, `depth1 贡献+30（实际 ${g3.sect.contribution}）`);\n"
    "  ok(g3.currencies['下品灵石'] === beforeStones + 80, `depth1 灵石+80（实际 ${g3.currencies['下品灵石'] - beforeStones}）`);\n"
    "  ok(g3.items.some((i) => i.名称 === '宗门灵脉晶' && i.数量 === 1), 'depth1 得材料 宗门灵脉晶×1');\n"
    "  ok(!g3.items.some((i) => i.名称 === '聚气丹'), 'depth1 深处丹药未出现');\n"
    "  // 深处(depth2)：聚气丹出现，贡献/灵石按 1.6 倍缩放\n"
    "  const g2 = mkSect(3, 0);\n"
    "  const before2 = g2.currencies['下品灵石'];\n"
    "  const r2 = S.exploreSectRealm(g2, 2);\n"
    "  ok(r2.ok, 'rank3 depth2 可进入');\n"
    "  ok(g2.sect.contribution === 48, `depth2 贡献 30×1.6=48（实际 ${g2.sect.contribution}）`);\n"
    "  ok(g2.currencies['下品灵石'] === before2 + 128, `depth2 灵石 80×1.6=128（实际 ${g2.currencies['下品灵石'] - before2}）`);\n"
    "  ok(g2.items.some((i) => i.名称 === '宗门灵脉晶' && i.数量 === 2), 'depth2 材料 宗门灵脉晶×2');\n"
    "  ok(g2.items.some((i) => i.名称 === '聚气丹' && i.数量 === 1), 'depth2 深处得聚气丹×1');\n"
    "  // 罗盘选项：rank>=3 出现，rank<3 不出现\n"
    "  const gOpt = mkSect(1);\n"
    "  ok(!S.extraCompassOptions(gOpt).some((o) => o.action.type === 'sectRealm'), 'rank1 罗盘无宗门秘境选项');\n"
    "  gOpt.sect.rank = 3;\n"
    "  ok(S.extraCompassOptions(gOpt).some((o) => o.action.type === 'sectRealm'), 'rank3 罗盘出现宗门秘境选项');\n"
    "}\n"
    "\n" + ANCHOR
)

t = t.replace(ANCHOR, NEW_TESTS, 1)
write(test_path, t)
print("[OK] tests/test-newfeatures.mjs 已追加宗门秘境确定性断言")
print("[DONE] 全部补丁应用完成")
