# -*- coding: utf-8 -*-
import io, sys, os

ROOT = "Z:/1/xiuxian"

edits = []  # (path, old, new)

# 1) systems.js: 导出护身计数助手
edits.append((
    ROOT + "/public/js/systems.js",
    "export const COMMISSION_COOLDOWN = 3;\n",
    "export const COMMISSION_COOLDOWN = 3;\n\n"
    "// 护身类道具（败北时自动消耗一件替你挡灾）：用于英雄卡常驻展示\n"
    "// 名称与 resolveBattle 的 wardKind 判定保持一致（高阶护身符挡重伤+护灵石，其余挡重伤）\n"
    "export const WARD_ITEM_NAMES = ['护身符', '低阶护身符', '低阶符箓', '简易阵旗'];\n"
    "export function wardItems(state) {\n"
    "  return (state.items || []).filter((x) => WARD_ITEM_NAMES.includes(x.名称));\n"
    "}\n",
))

# 2) index.html: 英雄卡 stat 网格新增护身 tile（放在百艺之后）
old_html = ('          <div class="stat wide"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'
            '<path d="M14 4l6 6-3 3-6-6zM3 21l8-8M11 13l-3 3-4-4 3-3"/></svg>'
            '<span class="stat-label">百艺</span><b id="st-arts">—</b></div>\n')
new_html = (old_html +
            '          <div class="stat" id="st-ward-stat"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'
            '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>'
            '<span class="stat-label">护身</span><b id="st-ward">0</b></div>\n')
edits.append((ROOT + "/public/index.html", old_html, new_html))

# 3) ui.js: renderStatus 在 // 道基条 前渲染护身常驻显示
old_ui = "  renderChronicle();\n\n  // 道基条\n"
new_ui = (
    "  renderChronicle();\n\n"
    "  // 护身道具常驻显示（败北时自动挡灾，跨标签页可见）\n"
    "  const wardHeld = S.wardItems(st);\n"
    "  const wardCount = wardHeld.reduce((s, x) => s + (Number(x.数量) || 1), 0);\n"
    "  const wardStatEl = document.getElementById('st-ward');\n"
    "  if (wardStatEl) {\n"
    "    wardStatEl.textContent = wardCount > 0 ? wardCount + ' 件' : '0';\n"
    "    const wardTile = document.getElementById('st-ward-stat');\n"
    "    if (wardTile) {\n"
    "      wardTile.classList.toggle('has-ward', wardCount > 0);\n"
    "      const hasHigh = wardHeld.some((x) => x.名称 === '护身符');\n"
    "      wardTile.title = wardCount > 0\n"
    "        ? '持有护身道具 ' + wardCount + ' 件' + (hasHigh ? '（含高阶护身符：败北时挡重伤并护住灵石）' : '（败北时自动消耗一件替你挡去重伤）')\n"
    "        : '未持有护身道具：败北将直接承受重伤与损失，可在坊市或结交道友处获取';\n"
    "    }\n"
    "  }\n\n"
    "  // 道基条\n"
)
edits.append((ROOT + "/public/js/ui.js", old_ui, new_ui))

# 4) main.css: 护身有货高亮样式
old_css = ".stat.wide b { font-weight: 600; }\n"
new_css = (".stat.wide b { font-weight: 600; }\n"
          ".stat.has-ward { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--bg-2)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--gold) 35%, transparent); }\n"
          ".stat.has-ward .stat-label { color: var(--gold); }\n")
edits.append((ROOT + "/public/css/main.css", old_css, new_css))

ok = True
for path, old, new in edits:
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    cnt = s.count(old)
    if cnt != 1:
        print("MISS/多匹配 %s : count=%d" % (path, cnt))
        ok = False
        continue
    s = s.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print("OK %s" % path)

if not ok:
    print("有匹配异常，已跳过相关编辑，终止。")
    sys.exit(2)
print("ALL DONE")
