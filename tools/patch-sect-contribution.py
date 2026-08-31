#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本轮打磨：宗门贡献度常驻化（英雄卡行 + 顶栏 chip）。
改动：systems.js 新增 sectContribution 纯函数；index.html 顶栏 tb-sect + 英雄卡 st-sect-row；
ui.js renderAll 渲染两者（仅已入宗门时显示、点击直达宗门面板）；main.css 补明暗主题样式。
纯显示、零破坏。所有替换均做唯一性断言。"""
import io, sys, pathlib

ROOT = pathlib.Path(r"Z:/1/xiuxian")

def patch(path, edits):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    for old, new, label in edits:
        cnt = s.count(old)
        if cnt != 1:
            print(f"[FAIL] {path}: 锚点「{label}」命中 {cnt} 次（应为 1）")
            sys.exit(1)
        s = s.replace(old, new, 1)
        print(f"[OK] {path}: {label}")
    p.write_text(s, encoding="utf-8")

# ---------- systems.js：新增 sectContribution 纯函数 ----------
systems_edits = [
    (
        "  return Object.entries(ALCHEMY_CATALYSTS).map(([name, cfg]) => {\n"
        "    const have = state.items.find((x) => x.\u540d\u79f0 === name)?.\u6570\u91cf || 0;\n"
        "    return { name, have, bonus: cfg.bonus, label: cfg.label, held: have >= 1 };\n"
        "  });\n"
        "}\n"
        "\n"
        "export function addDaoBaseExp(state, name, amount, logs) {\n",
        "  return Object.entries(ALCHEMY_CATALYSTS).map(([name, cfg]) => {\n"
        "    const have = state.items.find((x) => x.\u540d\u79f0 === name)?.\u6570\u91cf || 0;\n"
        "    return { name, have, bonus: cfg.bonus, label: cfg.label, held: have >= 1 };\n"
        "  });\n"
        "}\n"
        "\n"
        "/** \u5b97\u95e8\u8d21\u732e\u5ea6\u72b6\u6001\uff1a\u4f9b\u82f1\u96c4\u5361\u5e38\u9a7b\u884c\u4e0e\u9876\u680f chip \u5c55\u793a\uff08\u5ef6\u7eed\u300c\u8de8\u6807\u7b7e\u9875\u4e0d\u53ef\u89c1\u72b6\u6001\u5e38\u9a7b\u5316\u300d\u4e3b\u9898\uff09\u3002\n"
        " *  \u5b97\u95e8\u8d21\u732e\u662f\u771f\u5b9e\u8fdb\u5ea6\u8d44\u6e90\uff08\u5b97\u95e8\u79d8\u5883/\u5b97\u95e8\u4efb\u52a1\u7d2f\u79ef\uff0c\u5b97\u95e8\u5151\u6362\u6240\u6d88\u8d39\uff09\uff0c\u6b64\u524d\u4ec5\u5728\u300c\u5b97\u95e8\u300d\u9762\u677f\u53ef\u89c1\uff0c\n"
        " *  \u5207\u8d70\u5373\u4e0d\u53ef\u77e5\uff1b\u73b0\u505a\u53ef\u88ab\u82f1\u96c4\u5361/\u9876\u680f\u5e38\u9a7b\u8bfb\u53d6\u7684\u7eaf\u51fd\u6570\uff08\u4e0d\u6539\u52a8\u72b6\u6001\u3001\u786e\u5b9a\u6027\u3001\u65e0 RNG\uff09\u3002\n"
        " *  @returns {{has:boolean, name:string, rank:number, rankName:string, contribution:number}} */\n"
        "export function sectContribution(state) {\n"
        "  const sect = state.sect;\n"
        "  if (!sect || !sect.name) return { has: false, name: '', rank: 0, rankName: '', contribution: 0 };\n"
        "  const rankName = (SECT_RANKS[sect.rank] && SECT_RANKS[sect.rank].name) || '';\n"
        "  return { has: true, name: sect.name, rank: sect.rank || 0, rankName, contribution: sect.contribution || 0 };\n"
        "}\n"
        "\n"
        "export function addDaoBaseExp(state, name, amount, logs) {\n",
        "systems.js: \u65b0\u589e sectContribution \u7eaf\u51fd\u6570",
    ),
]

# ---------- index.html：顶栏 tb-sect + 英雄卡 st-sect-row ----------
index_edits = [
    (
        '        <span id="tb-travel" class="tb-chip tb-travel" style="display:none"></span>\n'
        '        <span id="tb-code" class="tb-chip tb-code"></span>\n',
        '        <span id="tb-travel" class="tb-chip tb-travel" style="display:none"></span>\n'
        '        <span id="tb-sect" class="tb-chip tb-sect" style="display:none"></span>\n'
        '        <span id="tb-code" class="tb-chip tb-code"></span>\n',
        "index.html: \u9876\u680f\u65b0\u589e tb-sect chip",
    ),
    (
        '          <div class="vital-row alchemy-row" id="st-alchemy-row" style="display:none">\n'
        '            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 14H4z"/><path d="M8 10h8"/></svg>\n'
        '            <span class="vital-label">\u4e39\u7089</span><b id="st-alchemy">\u2014</b>\n'
        '          </div>\n',
        '          <div class="vital-row alchemy-row" id="st-alchemy-row" style="display:none">\n'
        '            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 14H4z"/><path d="M8 10h8"/></svg>\n'
        '            <span class="vital-label">\u4e39\u7089</span><b id="st-alchemy">\u2014</b>\n'
        '          </div>\n'
        '          <div class="vital-row sect-row" id="st-sect-row" style="display:none">\n'
        '            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/></svg>\n'
        '            <span class="vital-label">\u5b97\u95e8</span><b id="st-sect">\u2014</b>\n'
        '          </div>\n',
        "index.html: \u82f1\u96c4\u5361\u65b0\u589e st-sect-row",
    ),
]

# ---------- ui.js：renderAll 渲染英雄卡行 + 顶栏 chip ----------
ui_edits = [
    (
        "    } else {\n"
        "      alchRow.style.display = 'none';\n"
        "    }\n"
        "  }\n"
        "\n"
        "  // \u5371\u673a\u63d0\u793a\u6a2a\u5e45\uff1a\u6c47\u603b\u5bff\u5143/\u4e39\u6bd2\u9884\u8b66\uff0c\u7ed9\u51fa\u53ef\u884c\u7684\u5ef6\u5bff/\u89e3\u6bd2\u9014\u5f84\uff1b\u82e5\u884c\u56ca\u6b63\u597d\u6709\u5bf9\u5e94\u89e3\u836f\uff0c\u6e32\u67d3\u53ef\u70b9\u51fb\u300c\u670d\u7528\u300d\u6309\u94ae\uff08\u9884\u8b66\u2192\u884c\u52a8\u95ed\u73af\uff09\n",
        "    } else {\n"
        "      alchRow.style.display = 'none';\n"
        "    }\n"
        "  }\n"
        "  // \u5b97\u95e8\u8d21\u732e\u5ea6\u5e38\u9a7b\u884c\uff1a\u5b97\u95e8\u8d21\u732e\u662f\u771f\u5b9e\u8fdb\u5ea6\u8d44\u6e90\uff08\u5b97\u95e8\u79d8\u5883/\u4efb\u52a1\u7d2f\u79ef\u3001\u5151\u6362\u6240\u6d88\u8d39\uff09\uff0c\u6b64\u524d\u4ec5\u5728\u300c\u5b97\u95e8\u300d\u9762\u677f\u53ef\u89c1\uff0c\n"
        "  // \u5207\u8d70\u5373\u4e0d\u53ef\u77e5\uff1b\u73b0\u505a\u82f1\u96c4\u5361\u5e38\u9a7b\u884c\uff0c\u5ef6\u7eed\u300c\u8de8\u6807\u7b7e\u9875\u4e0d\u53ef\u89c1\u72b6\u6001\u5e38\u9a7b\u5316\u300d\u4e3b\u9898\uff0c\u8ba9\u73a9\u5bb6\u968f\u65f6\u77e5\u6653\u8d21\u732e\u4e0e\u804c\u7ea7\u3002\n"
        "  const sc = S.sectContribution(st);\n"
        "  const sectRow = document.getElementById('st-sect-row');\n"
        "  const sectB = document.getElementById('st-sect');\n"
        "  if (sectRow && sectB) {\n"
        "    if (sc.has) {\n"
        "      sectRow.style.display = '';\n"
        "      sectB.innerHTML = `${sc.contribution} \uff5c ${sc.rankName}`;\n"
        "      sectB.title = `\u5df2\u5165\u5b97\u95e8\u300c${sc.name}\u300d\uff0c\u804c\u7ea7\uff1a${sc.rankName}\uff0c\u5b97\u95e8\u8d21\u732e ${sc.contribution}\uff08\u5b97\u95e8\u79d8\u5883/\u4efb\u52a1\u7d2f\u79ef\uff0c\u5151\u6362\u6240\u6d88\u8d39\uff09\u3002`;\n"
        "    } else {\n"
        "      sectRow.style.display = 'none';\n"
        "    }\n"
        "  }\n"
        "\n"
        "  // \u5371\u673a\u63d0\u793a\u6a2a\u5e45\uff1a\u6c47\u603b\u5bff\u5143/\u4e39\u6bd2\u9884\u8b66\uff0c\u7ed9\u51fa\u53ef\u884c\u7684\u5ef6\u5bff/\u89e3\u6bd2\u9014\u5f84\uff1b\u82e5\u884c\u56ca\u6b63\u597d\u6709\u5bf9\u5e94\u89e3\u836f\uff0c\u6e32\u67d3\u53ef\u70b9\u51fb\u300c\u670d\u7528\u300d\u6309\u94ae\uff08\u9884\u8b66\u2192\u884c\u52a8\u95ed\u73af\uff09\n",
        "ui.js: \u82f1\u96c4\u5361\u6e32\u67d3 st-sect-row",
    ),
    (
        "    } else {\n"
        "      travelChip.style.display = 'none';\n"
        "    }\n"
        "  }\n"
        "\n"
        "  // \u72b6\u6001\u5361\n",
        "    } else {\n"
        "      travelChip.style.display = 'none';\n"
        "    }\n"
        "  }\n"
        "\n"
        "  // \u5b97\u95e8\u8d21\u732e\u5e38\u9a7b\u63d0\u793a\uff1a\u5b97\u95e8\u8d21\u732e\u6b64\u524d\u4ec5\u5728\u300c\u5b97\u95e8\u300d\u9762\u677f\u53ef\u89c1\uff0c\u5207\u8d70\u5373\u4e0d\u53ef\u77e5\uff1b\n"
        "  // \u6b64\u5904\u505a\u9876\u680f\u5e38\u9a7b chip\uff0c\u663e\u793a\u5f53\u524d\u804c\u7ea7\u4e0e\u8d21\u732e\uff0c\u70b9\u51fb\u76f4\u8fbe\u5b97\u95e8\u9762\u677f\uff08\u5ef6\u7eed\u8de8\u6807\u7b7e\u9875\u4e0d\u53ef\u89c1\u72b6\u6001\u5e38\u9a7b\u5316\u4e3b\u9898\uff09\u3002\n"
        "  const sectInfo = S.sectContribution(st);\n"
        "  const sectChip = document.getElementById('tb-sect');\n"
        "  if (sectChip) {\n"
        "    if (sectInfo.has) {\n"
        "      sectChip.style.display = '';\n"
        "      sectChip.classList.add('tb-clickable');\n"
        "      sectChip.innerHTML = `${ICO('<path d=\"M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6\"/>')}\u5b97\u95e8 ${sectInfo.rankName} \u00b7 ${sectInfo.contribution}`;\n"
        "      sectChip.title = `\u5df2\u5165\u5b97\u95e8\u300c${sectInfo.name}\u300d\uff0c\u804c\u7ea7\uff1a${sectInfo.rankName}\uff0c\u8d21\u732e ${sectInfo.contribution}\u3002\u70b9\u51fb\u6253\u5f00\u5b97\u95e8\u9762\u677f\u3002`;\n"
        "      sectChip.onclick = () => { if (typeof flowSectTask === 'function') flowSectTask(); };\n"
        "    } else {\n"
        "      sectChip.style.display = 'none';\n"
        "    }\n"
        "  }\n"
        "\n"
        "  // \u72b6\u6001\u5361\n",
        "ui.js: \u9876\u680f\u6e32\u67d3 tb-sect chip",
    ),
]

# ---------- main.css：明暗主题样式 ----------
css_edits = [
    (
        ".tb-travel { color: var(--cat-lilian); border-color: var(--cat-lilian); }\n",
        ".tb-travel { color: var(--cat-lilian); border-color: var(--cat-lilian); }\n"
        ".tb-sect { color: #b48ad6; border-color: #b48ad6; }\n",
        "main.css: \u9876\u680f .tb-sect \u6837\u5f0f",
    ),
    (
        ".alchemy-row b { color: #e08a6a; font-weight: 600; }\n",
        ".alchemy-row b { color: #e08a6a; font-weight: 600; }\n"
        ".sect-row { background: linear-gradient(90deg, rgba(180,138,214,.14), rgba(180,138,214,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }\n"
        ".sect-row .vital-label { color: #b48ad6; }\n"
        ".sect-row b { color: #b48ad6; font-weight: 600; }\n",
        "main.css: \u82f1\u96c4\u5361 .sect-row \u6837\u5f0f",
    ),
]

patch("public/js/systems.js", systems_edits)
patch("public/index.html", index_edits)
patch("public/js/ui.js", ui_edits)
patch("public/css/main.css", css_edits)
print("ALL DONE")
