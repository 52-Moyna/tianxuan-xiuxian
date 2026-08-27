# -*- coding: utf-8 -*-
# 天命奖励确定性预览 + 天命进度常驻卡
import io, sys

ROOT = "Z:/1/xiuxian"

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)

# ---------- systems.js ----------
sys_path = ROOT + "/public/js/systems.js"
s = read(sys_path)

# 1) 新增 destinyRewardPreview（紧跟 destinyAvailable 之后）
anchor_avail = """export function destinyAvailable(state) {
  const st = destinyCurrent(state);
  return st && state.player.level >= st.reqLv;
}"""
assert anchor_avail in s, "destinyAvailable anchor not found"
new_fn = anchor_avail + """

/**
 * 天命当前阶段奖励的确定性预览（用于罗盘「顺应天命」选项的收益展示）。
 * 不改变状态，仅展示真实将发放的奖励，帮助玩家决策。
 */
export function destinyRewardPreview(state) {
  const st = destinyCurrent(state);
  if (!st || !st.reward) return '主线奖励，推进世界故事';
  const r = st.reward;
  switch (r.type) {
    case '道基': return `奖励：${r.key}+${r.val}（道基）`;
    case '货币': return `奖励：下品灵石+${r.val}`;
    case '功法': {
      const g = D.TECHNIQUE_GRADES.find((x) => x.id === r.grade);
      return `奖励：功法《${r.name}》（${g ? g.name : r.grade}）`;
    }
    case '装备': return `奖励：${r.name}（战力法宝，入备用栏）`;
    case '称号': return `奖励：封号「${r.title}」`;
    default: return r.text || '主线奖励，推进世界故事';
  }
}"""
s = s.replace(anchor_avail, new_fn, 1)

# 2) 罗盘「顺应天命」接入确定性奖励预览
anchor_preview = "if (o.action.type === 'destiny') return { ...o, preview: '收益：主线奖励，推进世界故事' };"
assert anchor_preview in s, "destiny preview anchor not found"
s = s.replace(anchor_preview,
              "if (o.action.type === 'destiny') return { ...o, preview: destinyRewardPreview(state) };", 1)
write(sys_path, s)
print("systems.js patched")

# ---------- ui.js ----------
ui_path = ROOT + "/public/js/ui.js"
u = read(ui_path)

# 主页（天命/决策罗盘）新增常驻「天命进度」卡：插在 news 面板之后、panel-core 之前。
# 注意：外层已是模板字符串，注入片段内不得出现反引号，统一用单引号拼接。
inject = (
    "      ${(() => {\n"
    "        const dt = S.destinyCurrent(st);\n"
    "        const total = D.DESTINY_LINES[st.destiny.lineId].stages.length;\n"
    "        const idx = st.destiny.stage;\n"
    "        const avail = S.destinyAvailable(st);\n"
    "        let statusHtml;\n"
    "        if (!dt) statusHtml = '<span class=\"dp-status dp-done\">🎊 天命已圆满</span>';\n"
    "        else if (avail) statusHtml = '<span class=\"dp-status dp-ready\">✅ 时机已至：年初「顺应天命」即可推进（' + dt.name + '）</span>';\n"
    "        else statusHtml = '<span class=\"dp-status dp-wait\">尚需 Lv.' + Math.max(0, dt.reqLv - st.player.level) + ' 级（要求 Lv.' + dt.reqLv + '）</span>';\n"
    "        return '<div class=\"panel panel-destiny-progress\">' +\n"
    "          '<div class=\"panel-title\"><svg class=\"pt-ico\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 4h16v16H4zM8 8h8M8 12h8M8 16h6\"/></svg>' +\n"
    "          '<span class=\"pt-text\">天命主线</span><span class=\"panel-hint\">' + st.destiny.lineName + '</span></div>' +\n"
    "          '<div class=\"dp-stage\">第 ' + (idx + 1) + ' / ' + total + ' 阶段 · ' + (dt ? dt.name : '已圆满') + '</div>' + statusHtml + '</div>';\n"
    "      })()}\n"
)
anchor_core = "      <div class=\"panel panel-core\">"
assert anchor_core in u, "panel-core anchor not found"
u = u.replace(anchor_core, inject + anchor_core, 1)
write(ui_path, u)
print("ui.js patched")

# ---------- main.css ----------
css_path = ROOT + "/public/css/main.css"
c = read(css_path)
if ".panel-destiny-progress" not in c:
    c += """

/* 天命进度卡（主页常驻） */
.panel-destiny-progress { }
.dp-stage { margin: 8px 0 6px; font-size: 14px; font-weight: 600; color: var(--gold); }
.dp-status { display: inline-block; margin-top: 2px; padding: 4px 12px; border-radius: 999px; font-size: 13px; border: 1px solid; }
.dp-ready { color: var(--jade); border-color: var(--jade); }
.dp-wait  { color: var(--gold-soft); border-color: var(--gold-soft); }
.dp-done  { color: var  (--gold); border-color: var(--gold); }
"""
    # 修正上面误写的 var  (--gold) -> var(--gold)
    c = c.replace("var  (--gold)", "var(--gold)")
    write(css_path, c)
    print("main.css patched")
else:
    print("main.css already patched")

print("ALL DONE")
