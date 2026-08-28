# -*- coding: utf-8 -*-
import io, sys, os

UI = 'Z:/1/xiuxian/public/js/ui.js'
CSS = 'Z:/1/xiuxian/public/css/main.css'
TEST = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'

def read(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)

# ---------- 1) ui.js：危机横幅可操作化 ----------
ui = read(UI)

helper = (
    "// 在行囊中按名称查找物品索引（危机预警一键服用解药等场景复用）\n"
    "function findItemIndex(state, name) {\n"
    "  const items = state.items || [];\n"
    "  for (let i = 0; i < items.length; i++) if (items[i].名称 === name) return i;\n"
    "  return -1;\n"
    "}\n\n"
)
anchor_helper = "export function renderAll() {"
assert anchor_helper in ui, "ui.js 未找到 renderAll 锚点"
ui = ui.replace(anchor_helper, helper + anchor_helper, 1)

old_banner = (
    "  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径\n"
    "  const banner = $('#crisis-banner');\n"
    "  if (banner) {\n"
    "    const warns = [lifeWarn, toxWarn].filter((w) => w.level !== 'ok');\n"
    "    if (warns.length) {\n"
    "      banner.className = `crisis-banner ${warns.some((w) => w.level === 'danger') ? 'danger' : 'warn'}`;\n"
    "      banner.innerHTML = warns.map((w) => `<div class=\"cb-item\">${w.hint}</div>`).join('');\n"
    "      banner.style.display = '';\n"
    "    } else {\n"
    "      banner.style.display = 'none';\n"
    "    }\n"
    "  }\n"
)
new_banner = (
    "  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径；若行囊正好有对应解药，渲染可点击「服用」按钮（预警→行动闭环）\n"
    "  const banner = $('#crisis-banner');\n"
    "  if (banner) {\n"
    "    const warns = [lifeWarn, toxWarn].filter((w) => w.level !== 'ok');\n"
    "    if (warns.length) {\n"
    "      banner.className = `crisis-banner ${warns.some((w) => w.level === 'danger') ? 'danger' : 'warn'}`;\n"
    "      banner.innerHTML = warns.map((w) => {\n"
    "        const cure = w === lifeWarn ? '延寿丹' : '凝血丹';\n"
    "        const cidx = findItemIndex(st, cure);\n"
    "        const btn = cidx >= 0 ? ` <button class=\"cb-cure\" data-cure=\"${cidx}\">服用${cure}</button>` : '';\n"
    "        return `<div class=\"cb-item\">${w.hint}${btn}</div>`;\n"
    "      }).join('');\n"
    "      banner.querySelectorAll('[data-cure]').forEach((b) => b.addEventListener('click', () => {\n"
    "        const cidx = Number(b.dataset.cure);\n"
    "        const logs = S.useItem(st, cidx);\n"
    "        if (logs) { logs.forEach((l) => pushLog(l)); toast(logs[0], 'gold'); }\n"
    "        renderAll();\n"
    "      }));\n"
    "      banner.style.display = '';\n"
    "    } else {\n"
    "      banner.style.display = 'none';\n"
    "    }\n"
    "  }\n"
)
assert old_banner in ui, "ui.js 未找到旧横幅代码块，锚点可能已漂移"
ui = ui.replace(old_banner, new_banner, 1)
write(UI, ui)
print("ui.js 已更新危机横幅为可操作")

# ---------- 2) main.css：.cb-cure 按钮样式 ----------
css = read(CSS)
css_anchor = ".crisis-banner .cb-item::before { content: '⚠'; flex: none; font-weight: 700; }"
assert css_anchor in css, "main.css 未找到危机横幅锚点"
cb_cure = (
    "\n"
    ".crisis-banner .cb-cure { margin-left: auto; flex: none; padding: 2px 10px; border-radius: 8px;\n"
    "  border: 1px solid var(--gold); background: var(--gold-soft, rgba(212,175,90,.18)); color: var(--gold);\n"
    "  font-size: .78rem; cursor: pointer; white-space: nowrap; }\n"
    ".crisis-banner .cb-cure:hover { background: var(--gold); color: #1a1208; }\n"
)
css = css.replace(css_anchor, css_anchor + cb_cure, 1)
write(CSS, css)
print("main.css 已补 .cb-cure 样式")

# ---------- 3) test-newfeatures.mjs：解药服用闭环断言 ----------
test = read(TEST)
test_anchor = "console.log(`\n===== 本轮新功能专项测试："
assert test_anchor in test, "测试文件未找到汇总 console.log 锚点"
new_asserts = (
    "// 解药服用闭环：危机预警下手握解药，服用即生效（对应横幅「服用」按钮逻辑）\n"
    "const scCure = JSON.parse(JSON.stringify(state));\n"
    "scCure.player.age = scCure.player.lifespan - 3; // 触发 danger 预警\n"
    "scCure.items.push({ 名称: '延寿丹', 类型: '丹药', 数量: 1, 描述: '延寿', effect: { lifespan: 20 }, toxicity: 15 });\n"
    "const li = scCure.items.length - 1;\n"
    "ok(S.lifespanWarning(scCure).level === 'danger' && S.useItem(scCure, li) && scCure.player.lifespan > (state.player.lifespan || 0), '寿元将尽+持有延寿丹：服用提升寿元上限');\n"
    "const stCure = JSON.parse(JSON.stringify(state));\n"
    "stCure.flags = Object.assign({}, stCure.flags, { pillToxicity: 90, wounded: 2 }); // 触发 danger 预警\n"
    "stCure.items.push({ 名称: '凝血丹', 类型: '丹药', 数量: 1, 描述: '清伤', effect: { heal: true }, toxicity: 0 });\n"
    "const ti = stCure.items.length - 1;\n"
    "ok(S.toxicityWarning(stCure).level === 'danger' && S.useItem(stCure, ti) && (stCure.flags.wounded || 0) === 0, '丹毒攻心+持有凝血丹：服用清除全部伤势');\n\n"
)
test = test.replace(test_anchor, new_asserts + test_anchor, 1)
write(TEST, test)
print("tests/test-newfeatures.mjs 已补充 2 条解药闭环断言")

print("ALL_PATCH_DONE")
