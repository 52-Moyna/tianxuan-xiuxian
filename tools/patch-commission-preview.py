# -*- coding: utf-8 -*-
"""补丁：道友委托回赠奖励确定性预览（信息透明·确定性预览主题）。
落点：Z:/1/xiuxian 真实仓库。仅替换既有锚点，不重写整文件。
"""
import io, sys, os

ROOT = 'Z:/1/xiuxian'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    with open(full, 'r', encoding='utf-8') as f:
        s = f.read()
    if old not in s:
        raise SystemExit(f'[{label}] 锚点未命中：{path}')
    cnt = s.count(old)
    if cnt != 1:
        raise SystemExit(f'[{label}] 锚点出现 {cnt} 次（须唯一）：{path}')
    s = s.replace(old, new, 1)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] {label} -> {path}')

# 1) systems.js：commissionInfo 之后新增 commissionRewardPreview 纯函数
sys_anchor = (
    "  return { task, available, have, need: task.need, cdRemaining: onCd ? (npc.commissionCd - state.world.turns) : 0 };\n"
    "}\n"
)
sys_new = sys_anchor + (
    "\n"
    "/**\n"
    " * 道友委托回赠奖励的确定性预览文案（与 applyCommissionReward 同口径，无 RNG）。\n"
    " * 委托是「投资型决策」，玩家此前只见所需材料、不知回赠内容，属信息盲区；\n"
    " * 现补确定性预览，延续「信息透明·确定性预览」主题。\n"
    " */\n"
    "export function commissionRewardPreview(task) {\n"
    "  const r = task && task.reward;\n"
    "  if (!r) return '无';\n"
    "  if (r.type === 'stones') return `灵石 +${r.amount}`;\n"
    "  if (r.type === 'item') return `${r.名称} ×${r.数量 || 1}`;\n"
    "  if (r.type === 'equip') {\n"
    "    const slotName = EQUIP_SLOTS.find((s) => s.id === r.slot)?.name || '装备';\n"
    "    return `随机${slotName}（Lv.${r.level}）`;\n"
    "  }\n"
    "  if (r.type === 'exp') return `${r.base} 道基经验 +${r.amount}`;\n"
    "  return '未知回赠';\n"
    "}\n"
)
patch('public/js/systems.js', sys_anchor, sys_new, 'systems.commissionRewardPreview')

# 2) ui.js：道缘对话委托按钮块接入回赠预览
ui_old = (
    "        ${(npc.relation >= 3) ? (() => { const ci = S.commissionInfo(st, npc); return ci.cdRemaining > 0 ? `<button class=\"btn btn-dim\" disabled>委托筹措中（剩 ${ci.cdRemaining} 月）</button>` : `<button class=\"btn btn-gold\" data-k=\"commission\">交付委托 · 需 ${ci.need} ${ci.task.item}（持 ${ci.have}）</button>`; })() : ''}\n"
)
ui_new = (
    "        ${(npc.relation >= 3) ? (() => { const ci = S.commissionInfo(st, npc); const rw = S.commissionRewardPreview(ci.task); return ci.cdRemaining > 0 ? `<button class=\"btn btn-dim\" disabled>委托筹措中（剩 ${ci.cdRemaining} 月）</button>` : `<div class=\"commission-hint\">回赠预览：${rw}</div><button class=\"btn btn-gold\" data-k=\"commission\">交付委托 · 需 ${ci.need} ${ci.task.item}（持 ${ci.have}）</button>`; })() : ''}\n"
)
patch('public/js/ui.js', ui_old, ui_new, 'ui.commissionHint')

# 3) main.css：补 .commission-hint 样式（追加到文件末尾）
css_add = (
    "\n"
    "/* 道友委托回赠预览提示（信息透明·确定性预览） */\n"
    ".commission-hint { font-size: 12px; line-height: 1.4; color: var(--jade); margin: 4px 8px 2px; text-align: center; }\n"
)
css_path = os.path.join(ROOT, 'public/css/main.css')
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()
if '.commission-hint' not in css:
    with open(css_path, 'a', encoding='utf-8') as f:
        f.write(css_add)
    print(f'[OK] css .commission-hint 追加 -> public/css/main.css')
else:
    print('[SKIP] .commission-hint 已存在')

# 4) tests/test-newfeatures.mjs：委托测试块后新增确定性断言
test_anchor = (
    "  ok(S.totalStones(gs) === stonesBefore + 120, '灵石实际到账+120');\n"
    "}\n"
)
test_add = test_anchor + (
    "\n"
    "/* ---------- 道友委托·回赠奖励确定性预览（信息透明·确定性预览） ---------- */\n"
    "{\n"
    "  const buildCi = (job) => { const g = S.createNewGame({ name: '委托预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() }); ensureLifeState(g); g.npcs = [{ name: '甲', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job, trait: 'x', level: 10 }]; return S.commissionInfo(g, g.npcs[0]); };\n"
    "  ok(S.commissionRewardPreview(buildCi('散修').task) === '灵石 +120', '散修委托预览：灵石 +120');\n"
    "  ok(S.commissionRewardPreview(buildCi('坊市商贩').task) === '灵石 +100', '坊市商贩委托预览：灵石 +100');\n"
    "  ok(S.commissionRewardPreview(buildCi('炼丹师').task) === '悟性 道基经验 +30', '炼丹师委托预览：悟性 道基经验 +30');\n"
    "  ok(S.commissionRewardPreview(buildCi('炼器师').task) === '随机武器（Lv.8）', '炼器师委托预览：随机武器（Lv.8）');\n"
    "  ok(S.commissionRewardPreview(buildCi('符师').task) === '低阶符箓 ×2', '符师委托预览：低阶符箓 ×2');\n"
    "  ok(S.commissionRewardPreview(buildCi('灵植师').task) === '年份灵草 ×2', '灵植师委托预览：年份灵草 ×2');\n"
    "  ok(S.commissionRewardPreview(buildCi('剑修').task) === '悟性 道基经验 +30', '剑修委托预览：悟性 道基经验 +30');\n"
    "  ok(S.commissionRewardPreview(buildCi('体修').task) === '根骨 道基经验 +30', '体修委托预览：根骨 道基经验 +30');\n"
    "  // 预览文案与真实回赠一致（散修委托交付实际到账灵石+120）\n"
    "  const gP = S.createNewGame({ name: '委托预览一致', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() }); ensureLifeState(gP);\n"
    "  gP.npcs = [{ name: '散人', relation: 3, relationName: '道友', favor: 70, met: true, gender: '男', race: '人', realm: '练气', job: '散修', trait: 'x', level: 10 }];\n"
    "  storeItem(gP, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: 't', 价值: 5 });\n"
    "  const beforeP = S.totalStones(gP);\n"
    "  S.interactNpc(gP, gP.npcs[0], 'commission');\n"
    "  ok(S.totalStones(gP) === beforeP + 120, '预览文案与真实回赠一致（散修灵石+120）');\n"
    "}\n"
)
patch('tests/test-newfeatures.mjs', test_anchor, test_add, 'test.commissionPreview')

print('ALL PATCHES APPLIED')
