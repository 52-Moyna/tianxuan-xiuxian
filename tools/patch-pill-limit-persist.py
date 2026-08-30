# -*- coding: utf-8 -*-
"""本轮打磨补丁：
1) 修复「延寿丹一生 3 颗」上限被存读档绕过（lifespanPillsTaken 未写入存档）。
2) 落实图鉴承诺「洗髓丹一生最多服用 2 颗」（此前完全无限制）。
3) itemUsePreview 显示洗髓丹已服计数，行囊预览与实际结算一致。
4) 旧档兜底与图鉴道基丹文案精确化。
"""
import io, sys, re

ROOT = 'Z:/1/xiuxian/'

def rw(path, pairs, must=True):
    p = ROOT + path
    s = io.open(p, encoding='utf-8').read()
    for old, new in pairs:
        if old not in s:
            if must:
                raise SystemExit('锚点未找到 [%s]: %r' % (path, old[:90]))
            continue
        if new in s and old != new:
            print('  跳过（已存在）:', path, old[:40])
            continue
        s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('  已写入:', path)

# ---------- 1. systems.js ----------
rw('public/js/systems.js', [
    # 新档字段
    (
        "      lifespanPillsTaken: 0, // 延寿丹：当前轮回一生至多服用 3 颗，超出则经脉难承（转世后随 newGame 归零）\n",
        "      lifespanPillsTaken: 0, // 延寿丹：当前轮回一生至多服用 3 颗，超出则经脉难承（转世后随 newGame 归零）\n"
        "      marrowPillsTaken: 0,   // 洗髓丹：当前轮回一生至多服用 2 颗（图鉴承诺），同样随转世归零\n"
    ),
    # useItem daoBase 分支：洗髓丹计数拦截
    (
        "  // 洗髓伐毛：随机提升一项道基（洗髓丹）\n"
        "  if (it.effect.daoBase) {\n"
        "    const kb = it.effect.daoBase;\n",
        "  // 洗髓伐毛：随机提升一项道基（洗髓丹 / 炎玉丹 / 玉华丹）\n"
        "  // 图鉴承诺「洗髓丹一生最多服用 2 颗」：仅对洗髓丹按当前轮回计数，满 2 则药力无从着落，\n"
        "  // 本次服用失效（不消耗、不加道基），与延寿丹同口径；炎玉丹/玉华丹不受此限。\n"
        "  if (it.effect.daoBase) {\n"
        "    if (it.名称 === '洗髓丹') {\n"
        "      const mTaken = state.player.marrowPillsTaken || 0;\n"
        "      if (mTaken >= 2) {\n"
        "        return [`「洗髓丹」一生至多可服 2 颗，你已服满（${mTaken} 颗），骨髓再难重塑，此丹暂难生效（留于储物袋即可）。`];\n"
        "      }\n"
        "      state.player.marrowPillsTaken = mTaken + 1;\n"
        "    }\n"
        "    const kb = it.effect.daoBase;\n"
    ),
    # itemUsePreview daoBase 分支：显示计数
    (
        "  if (eff.daoBase) {\n"
        "    const kb = eff.daoBase || {};\n"
        "    parts.push(`随机提升「${(kb.keys || []).join('/')}」之一 +${kb.min}~${kb.max} 级`);\n"
        "  }\n",
        "  if (eff.daoBase) {\n"
        "    const kb = eff.daoBase || {};\n"
        "    const base = `随机提升「${(kb.keys || []).join('/')}」之一 +${kb.min}~${kb.max} 级`;\n"
        "    if (it.名称 === '洗髓丹') {\n"
        "      const mTaken = (state && state.player && state.player.marrowPillsTaken) || 0;\n"
        "      parts.push(mTaken >= 2\n"
        "        ? `${base}（一生限 2 颗，已服满 ${mTaken}/2，此丹暂难生效）`\n"
        "        : `${base}（一生限 2 颗，已服 ${mTaken}/2）`);\n"
        "    } else parts.push(base);\n"
        "  }\n"
    ),
])

# ---------- 2. life.js：旧档兜底 ----------
rw('public/js/life.js', [
    (
        "  // 封号系统状态标准化（旧档若无 titles 字段，初始化为空）\n",
        "  // 珍贵丹药「一生服用次数」计数兜底：旧档缺字段时归零，避免 undefined 参与比较导致上限失效\n"
        "  if (typeof state.player.lifespanPillsTaken !== 'number') state.player.lifespanPillsTaken = 0;\n"
        "  if (typeof state.player.marrowPillsTaken !== 'number') state.player.marrowPillsTaken = 0;\n"
        "  // 封号系统状态标准化（旧档若无 titles 字段，初始化为空）\n"
    ),
])

# ---------- 3. save.js：持久化计数（此前漏存，存读档即可绕过上限） ----------
rw('public/js/save.js', [
    (
        "        战力: p.power, 寿元上限: p.lifespan, 寿元修正: p.lifeBonus || 0,\n",
        "        战力: p.power, 寿元上限: p.lifespan, 寿元修正: p.lifeBonus || 0,\n"
        "        // 珍贵丹药一生服用次数：必须随档持久化，否则存读档即可绕过「延寿丹3颗/洗髓丹2颗」上限\n"
        "        延寿丹已服: p.lifespanPillsTaken || 0, 洗髓丹已服: p.marrowPillsTaken || 0,\n"
    ),
    (
        "      lifeBonus: Number(xiu.寿元修正) || 0,\n",
        "      lifeBonus: Number(xiu.寿元修正) || 0,\n"
        "      lifespanPillsTaken: Number(xiu.延寿丹已服) || 0,\n"
        "      marrowPillsTaken: Number(xiu.洗髓丹已服) || 0,\n"
    ),
])

# ---------- 4. codex.js：道基丹文案精确化（点明实际可提升的道基项） ----------
rw('public/js/codex.js', [
    (
        "effect: '服用后随机提升一项道基 5~10 级；一生最多服用 2 颗。', toxicity: 20 },",
        "effect: '服用后随机提升「根骨/道心」之一 5~10 级；一生最多服用 2 颗。', toxicity: 20 },",
    ),
    (
        "effect: '服用后随机提升一项道基 4~8 级；连续服用会产生丹毒。', toxicity: 16 },",
        "effect: '服用后随机提升「根骨/道心」之一 4~8 级；连续服用会产生丹毒。', toxicity: 16 },",
    ),
    (
        "effect: '服用后随机提升一项道基 5~10 级；连续服用会产生丹毒。', toxicity: 18 },",
        "effect: '服用后随机提升「悟性/气运」之一 5~10 级；连续服用会产生丹毒。', toxicity: 18 },",
    ),
])

print('补丁完成')
