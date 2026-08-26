# -*- coding: utf-8 -*-
"""天玄修仙录 · 本轮打磨：行囊「装备」接入换装对比弹窗 + 对比弹窗补充套装归属。
游戏源码位于 Z:/1/xiuxian（Windows 风格盘符，原生 python 可识别）。
所有替换均带唯一性断言，任一锚点不匹配立即报错，绝不半改。
"""
import io

ROOT = "Z:/1/xiuxian"


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def patch(path, repls):
    """repls: list of (old, new, label)。每个 old 必须全局唯一。"""
    s = read(path)
    for old, new, label in repls:
        c = s.count(old)
        assert c == 1, f"[{label}] 锚点唯一性失败，命中 {c} 次"
        s = s.replace(old, new)
    write(path, s)
    print(f"  ✔ {path} 已应用 {len(repls)} 处替换")


# ---------- 1. systems.js：导出 guessEquipSlot ----------
patch(
    f"{ROOT}/public/js/systems.js",
    [
        (
            "function guessEquipSlot(item) {",
            "export function guessEquipSlot(item) {",
            "导出 guessEquipSlot",
        ),
    ],
)

# ---------- 2. ui.js：对比弹窗增强 + 行囊装备接入 ----------
UI = f"{ROOT}/public/js/ui.js"

requestEquipFromBag = """/** 行囊「装备」按钮：与备用栏路径一致，换装前弹对比（旧 vs 新），避免误换降级装备 */
function requestEquipFromBag(state, invIdx) {
  const it = state.items[invIdx];
  if (!it) return;
  const equipData = it._equip || it;
  const slot = equipData.部位 || S.guessEquipSlot(it);
  const old = state.equipment[slot];
  if (old) {
    const newItem = {
      名称: equipData.名称 || it.名称,
      品阶: equipData.品阶 || (typeof it.品阶 === 'string' ? it.品阶 : null),
      等级: equipData.等级 || it.等级 || 1,
      战力: equipData.战力 || it.战力 || 0,
      部位: slot,
    };
    compareEquipModal(old, newItem, () => {
      const logs = S.useItem(state, invIdx);
      if (logs) { logs.forEach((l) => pushLog(l)); toast(logs[0] || '装备已更换', 'gold'); }
      renderAll();
    });
  } else {
    const logs = S.useItem(state, invIdx);
    if (logs) { logs.forEach((l) => pushLog(l)); toast(logs[0] || '已装备', 'gold'); }
    renderAll();
  }
}
"""

# 2a. 在 compareEquipModal 之前插入 requestEquipFromBag；并为其注入 setOf 助手；两列补套装徽标。
ui_repls = [
    # 在对比弹窗函数定义前插入行囊换装函数
    (
        "function compareEquipModal(oldItem, newItem, onConfirm) {",
        requestEquipFromBag + "\nfunction compareEquipModal(oldItem, newItem, onConfirm) {",
        "插入 requestEquipFromBag",
    ),
    # 注入套装助手
    (
        "const slotName = EQUIP_SLOTS.find((s) => s.id === newItem.部位)?.name || '装备';",
        "const slotName = EQUIP_SLOTS.find((s) => s.id === newItem.部位)?.name || '装备';\n"
        "  const setOf = (n) => (typeof CX !== 'undefined' && CX.itemSetOf) ? CX.itemSetOf(n) : null;",
        "注入 setOf 助手",
    ),
    # 旧装备列：补套装徽标
    (
        '<div class="compare-meta">${gradeNameOf(oldItem)}</div>',
        '<div class="compare-meta">${gradeNameOf(oldItem)}</div>\n'
        '          ${setOf(oldItem.名称) ? `<div class="compare-set">🌟 ${setOf(oldItem.名称)}套装</div>` : \'\'}',
        "旧列套装徽标",
    ),
    # 新装备列：补套装徽标
    (
        '<div class="compare-meta">${gradeNameOf(newItem)}</div>',
        '<div class="compare-meta">${gradeNameOf(newItem)}</div>\n'
        '          ${setOf(newItem.名称) ? `<div class="compare-set">🌟 ${setOf(newItem.名称)}套装</div>` : \'\'}',
        "新列套装徽标",
    ),
    # 2b. 行囊 [data-use] 处理器：装备类走对比，其余照旧
    (
        "const logs = S.useItem(st, Number(b.dataset.use));",
        "const idx = Number(b.dataset.use);\n"
        "      const it = st.items[idx];\n"
        "      if (it && isEquipable(it)) { requestEquipFromBag(st, idx); return; }\n"
        "      const logs = S.useItem(st, idx);",
        "行囊装备接入对比",
    ),
]
patch(UI, ui_repls)

# ---------- 3. main.css：对比弹窗套装徽标样式 ----------
CSS = f"{ROOT}/public/css/main.css"
css_add = "\n/* 装备对比弹窗·套装归属徽标（2026-08-26 打磨） */\n.compare-set{font-size:.72rem;color:#c9a14a;margin-top:3px;letter-spacing:.5px}\n"
css = read(CSS)
if ".compare-set" not in css:
    write(CSS, css.rstrip() + "\n" + css_add)
    print("  ✔ main.css 追加 .compare-set 样式")
else:
    print("  · main.css 已有 .compare-set，跳过")

print("OK 全部补丁应用完成")
