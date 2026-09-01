# -*- coding: utf-8 -*-
"""本轮补丁：灵兽「放归山野」入口 + 拍卖发放满仓兜底。
用 Write 落盘后由 Bash 的 python 执行（避免 heredoc 中文长文本解析问题）。"""
import io, sys, re

UI = 'Z:/1/xiuxian/public/js/ui.js'
SYS = 'Z:/1/xiuxian/public/js/systems.js'


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def rep(src, old, new, tag, path):
    if src.count(old) != 1:
        print('!! 锚点命中 %d 次，中止：%s (%s)' % (src.count(old), tag, path))
        sys.exit(1)
    print('OK 替换：%s' % tag)
    return src.replace(old, new)


# ============ ui.js 改动 1：面板常量（满栏指引） ============
ui = read(UI)

old1 = "  const totalPower = CX.beastPowerBonus(st);\n"
new1 = (
    "  const totalPower = CX.beastPowerBonus(st);\n"
    "  // 满栏指引：灵兽栏默认仅 1 格，占满后 canTameBeast 为假、决策罗盘不再出现「前往灵兽栖息地」，\n"
    "  // 玩家既换不掉弱灵兽也拿不到「灵兽契约」扩栏，形同死锁。此处显式说明两条出路。\n"
    "  const isFull = slots.length >= maxSlots;\n"
    "  const hasContract = (st.items || []).some((i) => i.名称 === '灵兽契约');\n"
    "  const fullNote = isFull\n"
    "    ? `<div class=\"opt-desc\" style=\"margin-top:6px\">⚠ <b>灵兽栏已满</b>，决策罗盘将不再出现「前往灵兽栖息地」。想收服更强的灵兽，可先<b>放归山野</b>腾出栏位${hasContract ? '，或服用行囊中的「灵兽契约」拓宽栏位（上限 6 栏）' : '；服用「灵兽契约」可拓宽栏位，成功收服新灵兽时会获赠'}。</div>`\n"
    "    : '';\n"
)
ui = rep(ui, old1, new1, 'ui.js: 面板常量 fullNote', UI)

# ============ ui.js 改动 2：每张灵兽卡加「放归山野」按钮 ============
old2 = (
    "              <button class=\"btn btn-xs ${maxed ? 'btn-dim' : 'btn-gold'}\" data-starup=\"${i}\" ${maxed || !canAfford ? 'disabled' : ''}>${maxed ? '已满星' : `升星 · ${starCost}灵石`}</button>\n"
    "            </div>"
)
new2 = (
    "              <button class=\"btn btn-xs ${maxed ? 'btn-dim' : 'btn-gold'}\" data-starup=\"${i}\" ${maxed || !canAfford ? 'disabled' : ''}>${maxed ? '已满星' : `升星 · ${starCost}灵石`}</button>\n"
    "              <button class=\"btn btn-xs btn-unequip\" data-release=\"${i}\" title=\"解除契约、放回山野，腾出 1 个灵兽栏位（不可撤销）\">放归山野</button>\n"
    "            </div>"
)
ui = rep(ui, old2, new2, 'ui.js: 放归山野按钮', UI)

# ============ ui.js 改动 3：满栏提示插入 ============
old3 = "        <div class=\"opt-desc\" style=\"margin-top:8px\">灵兽总战力加成："
new3 = "        ${fullNote}\n        <div class=\"opt-desc\" style=\"margin-top:8px\">灵兽总战力加成："
ui = rep(ui, old3, new3, 'ui.js: 满栏提示插入', UI)

# ============ ui.js 改动 4：放归事件绑定（二次确认 + 落盘） ============
old4 = (
    "  box.querySelectorAll('[data-starup]').forEach((b) => b.addEventListener('click', () => {\n"
    "    const r = S.upgradeBeast(st, Number(b.dataset.starup));\n"
    "    (r.logs || []).forEach((l) => toast(l, r.ok ? 'gold' : 'warn'));\n"
    "    renderAll();\n"
    "  }));\n"
    "  renderSidePanel();\n"
    "}"
)
new4 = (
    "  box.querySelectorAll('[data-starup]').forEach((b) => b.addEventListener('click', () => {\n"
    "    const r = S.upgradeBeast(st, Number(b.dataset.starup));\n"
    "    (r.logs || []).forEach((l) => toast(l, r.ok ? 'gold' : 'warn'));\n"
    "    renderAll();\n"
    "  }));\n"
    "  // 放归山野：不可逆操作，先二次确认；确认后立即落盘，避免刷新页面后灵兽「复活」\n"
    "  box.querySelectorAll('[data-release]').forEach((b) => b.addEventListener('click', async () => {\n"
    "    const idx = Number(b.dataset.release);\n"
    "    const target = (CX.ensureBeastState(st).slots || [])[idx];\n"
    "    if (!target) return;\n"
    "    const detail = `${target.element}系 · ★${target.star || 1} · 战力 +${target.power}`;\n"
    "    const yes = await confirmModal(`确定放归「${target.name}」？\\n\\n${detail}\\n解除契约后它不会再回来，灵兽栏腾出 1 个空位（不可撤销）。`, '放归山野', '再想想');\n"
    "    if (!yes) return;\n"
    "    const msg = S.releaseBeast(st, idx);\n"
    "    toast(typeof msg === 'string' ? msg : '已解除契约。', 'info');\n"
    "    renderAll();\n"
    "    saveNow();\n"
    "  }));\n"
    "  renderSidePanel();\n"
    "}"
)
ui = rep(ui, old4, new4, 'ui.js: 放归事件绑定', UI)

write(UI, ui)

# ============ systems.js：拍卖发放满仓兜底 ============
sy = read(SYS)
old5 = (
    "    if (typeof item.toxicity === 'number') it.toxicity = item.toxicity;\n"
    "    storeItem(state, it);\n"
    "    discoverItem(state, item);\n"
)
new5 = (
    "    if (typeof item.toxicity === 'number') it.toxicity = item.toxicity;\n"
    "    // 调用方已在扣灵石前用 auctionBagBlockReason 拦截满仓；此处再兜一层：\n"
    "    // 严守「入袋成功才解锁图鉴」，杜绝图鉴显示已解锁、行囊里却找不着实物的幽灵状态。\n"
    "    if (storeItem(state, it)) discoverItem(state, item);\n"
    "    else addLog(state, '事件', `⚠ 储物袋已满，拍得之物「${item.name}」未能带走（灵石已付，请腾出格子后再竞拍）。`);\n"
)
sy = rep(sy, old5, new5, 'systems.js: 拍卖发放兜底', SYS)
write(SYS, sy)

print('\n全部补丁应用完成。')
