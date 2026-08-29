#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""天机运势英雄卡常驻显示：index.html 新增 omen-row；ui.js renderStatus 填充；main.css 高亮。"""
import io, sys

ROOT = "Z:/1/xiuxian"
FILES = {
    "index.html": f"{ROOT}/public/index.html",
    "ui.js": f"{ROOT}/public/js/ui.js",
    "main.css": f"{ROOT}/public/css/main.css",
}

def patch_index(src: str) -> str:
    anchor = (
        '            <span class="vital-label">丹毒</span><b id="st-toxic">0</b>\n'
        '          </div>\n'
        '        </div>\n'
    )
    assert anchor in src, "index.html 锚点未命中（丹毒行/hero-vitals 闭合）"
    addition = (
        '            <span class="vital-label">丹毒</span><b id="st-toxic">0</b>\n'
        '          </div>\n'
        '          <div class="vital-row omen-row" id="st-omen-row" style="display:none">\n'
        '            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.6L20 9.2l-4.6 3.8L17 19l-5-3.4L7 19l1.6-6L4 9.2l5.8-.6z"/></svg>\n'
        '            <span class="vital-label">天机</span><b id="st-omen">—</b>\n'
        '          </div>\n'
        '        </div>\n'
    )
    return src.replace(anchor, addition, 1)

def patch_ui(src: str) -> str:
    anchor = (
        "  const toxRow = $('#st-toxic-row'); if (toxRow) toxRow.classList.toggle('danger', toxWarn.level !== 'ok');\n"
    )
    assert anchor in src, "ui.js 锚点未命中（toxRow toggle）"
    addition = anchor + (
        "  // 天机运势常驻显示：卜算所得的 omen 加成跨月生效，玩家在任意标签页都能看到当前运势（影响修炼/灵草/商道/悟性），弥补仅仙途新闻列表可见的不足\n"
        "  const omenNow = st.flags?.omen && omenActive(st) ? st.flags.omen : null;\n"
        "  const omenRow = $('#st-omen-row');\n"
        "  const omenB = $('#st-omen');\n"
        "  if (omenRow && omenB) {\n"
        "    if (omenNow) {\n"
        "      omenRow.style.display = '';\n"
        "      omenB.innerHTML = `<span class=\"omen-ico\">${omenNow.icon}</span>${omenNow.label}`;\n"
        "      omenB.title = `${omenNow.desc}（生效至 ${omenNow.expireYear}年${omenNow.expireMonth}月）`;\n"
        "    } else {\n"
        "      omenRow.style.display = 'none';\n"
        "    }\n"
        "  }\n"
    )
    return src.replace(anchor, addition, 1)

def patch_css(src: str) -> str:
    anchor = (
        ".vital-row.danger { background: rgba(224,138,106,.1); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }\n"
    )
    assert anchor in src, "main.css 锚点未命中（vital-row.danger）"
    addition = anchor + (
        ".omen-row { background: linear-gradient(90deg, rgba(212,175,55,.12), rgba(212,175,55,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }\n"
        ".omen-row .vital-label { color: var(--gold, #d4af37); }\n"
        ".omen-row b { color: var(--gold, #d4af37); font-weight: 600; }\n"
        ".omen-ico { margin-right: 2px; }\n"
    )
    return src.replace(anchor, addition, 1)

def main():
    for name, path in FILES.items():
        with io.open(path, "r", encoding="utf-8") as f:
            src = f.read()
        if name == "index.html":
            out = patch_index(src)
        elif name == "ui.js":
            out = patch_ui(src)
        else:
            out = patch_css(src)
        if out == src:
            print(f"[跳过] {name}: 未发生变化（可能已打过补丁）")
            continue
        with io.open(path, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"[完成] {name}: 已写入改动")

if __name__ == "__main__":
    main()
