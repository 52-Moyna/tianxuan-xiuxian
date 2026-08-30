# -*- coding: utf-8 -*-
# 危机横幅打磨：新增 woundWarning（伤势预警）+ 修正 toxicityWarning 假承诺(凝血丹→解毒丹)
import io, sys

ROOT = 'Z:/1/xiuxian'
SYS = ROOT + '/public/js/systems.js'
UI = ROOT + '/public/js/ui.js'

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)

def replace_once(src, old, new, label):
    if src.count(old) != 1:
        raise SystemExit('[FAIL] 锚点不唯一或缺失: ' + label + '  count=' + str(src.count(old)))
    return src.replace(old, new, 1)

# ---------- systems.js ----------
s = read(SYS)

# 1) lifespanWarning：补 cure 字段
s = replace_once(
    s,
    "  return { level, lifeLeft, hint };",
    "  const cure = level !== 'ok' ? '延寿丹' : '';\n  return { level, lifeLeft, hint, cure };",
    'lifespanWarning.cure'
)

# 2) toxicityWarning：危险提示改指向解毒丹 + 补 cure 字段
OLD_TOX = """export function toxicityWarning(state) {
  const toxic = Number(state.flags?.pillToxicity || 0);
  let level = 'ok', hint = '';
  if (toxic >= 85) {
    level = 'danger';
    hint = '丹毒攻心！再服毒丹将重创修为，可服「凝血丹」清伤（无毒）或暂停服丹。';
  } else if (toxic >= 60) {
    level = 'warn';
    hint = '丹毒累积偏多，服丹收益下降、风险升高，宜暂缓毒性丹药。';
  }
  return { level, toxic, hint };
}"""
NEW_TOX = """export function toxicityWarning(state) {
  const toxic = Number(state.flags?.pillToxicity || 0);
  let level = 'ok', hint = '', cure = '';
  if (toxic >= 85) {
    level = 'danger';
    hint = '丹毒攻心！再服毒丹将重创修为，可服「解毒丹」化解丹毒或暂停服丹。';
    cure = '解毒丹';
  } else if (toxic >= 60) {
    level = 'warn';
    hint = '丹毒累积偏多，服丹收益下降、风险升高，宜暂缓毒性丹药或服「解毒丹」化解。';
    cure = '解毒丹';
  }
  return { level, toxic, hint, cure };
}"""
s = replace_once(s, OLD_TOX, NEW_TOX, 'toxicityWarning.rewrite')

# 3) 新增 woundWarning（插在 seclusionRiskWarning 之前）
WOUND_FN = """/** 伤势危机预警（纯函数，不修改状态；供危机横幅展示）。
 *  level: 'danger' 身负重伤(伤势≥3月，历练胜率-9%起、收益大降)、'warn' 带伤(≥1月)、'ok' 无伤。
 *  hint 指向「凝血丹」(清除全部伤势) 这一已实现途径，与危机横幅「服用」按钮闭环（寿元→延寿丹、丹毒→解毒丹同口径）。 */
export function woundWarning(state) {
  const wounds = Number(state.flags?.wounded || 0);
  let level = 'ok', hint = '', cure = '';
  if (wounds >= 3) {
    level = 'danger';
    hint = `身负重伤（伤势 ${wounds} 月）！历练胜率与收益大降，宜速服「凝血丹」痊愈。`;
    cure = '凝血丹';
  } else if (wounds >= 1) {
    level = 'warn';
    hint = `身负伤势（${wounds} 月），历练胜率略降，可服「凝血丹」立即痊愈或静养自愈。`;
    cure = '凝血丹';
  }
  return { level, wounds, hint, cure };
}

"""
s = replace_once(s, "export function seclusionRiskWarning(state) {", WOUND_FN + "export function seclusionRiskWarning(state) {", 'insert.woundWarning')

write(SYS, s)
print('[OK] systems.js 已更新')

# ---------- ui.js ----------
u = read(UI)

# 4) 渲染层新增 woundWarn 计算（toxWarn 块之后）
OLD_UI1 = """  const toxWarn = S.toxicityWarning(st);
  const toxEl = $('#st-toxic'); if (toxEl) toxEl.textContent = `${toxWarn.toxic}`;
  const toxRow = $('#st-toxic-row'); if (toxRow) toxRow.classList.toggle('danger', toxWarn.level !== 'ok');"""
NEW_UI1 = """  const toxWarn = S.toxicityWarning(st);
  const toxEl = $('#st-toxic'); if (toxEl) toxEl.textContent = `${toxWarn.toxic}`;
  const toxRow = $('#st-toxic-row'); if (toxRow) toxRow.classList.toggle('danger', toxWarn.level !== 'ok');
  // 伤势危机预警：身负重伤时历练胜率与收益大降，此前仅在英雄卡显示（无横幅指引），
  // 现接入危机横幅，给出「凝血丹」可点击服用途径（与寿元→延寿丹、丹毒→解毒丹同口径闭环）。
  const woundWarn = S.woundWarning(st);"""
u = replace_once(u, OLD_UI1, NEW_UI1, 'ui.woundWarn.calc')

# 5) 危机横幅接入 woundWarn + 服用按钮改用 w.cure
OLD_UI2 = """    const warns = [lifeWarn, toxWarn].filter((w) => w.level !== 'ok');
    if (warns.length) {
      banner.className = `crisis-banner ${warns.some((w) => w.level === 'danger') ? 'danger' : 'warn'}`;
      banner.innerHTML = warns.map((w) => {
        const cure = w === lifeWarn ? '延寿丹' : '解毒丹';
        const cidx = findItemIndex(st, cure);
        const btn = cidx >= 0 ? ` <button class="cb-cure" data-cure="${cidx}">服用${cure}</button>` : '';
        return `<div class="cb-item">${w.hint}${btn}</div>`;
      }).join('');"""
NEW_UI2 = """    const warns = [lifeWarn, toxWarn, woundWarn].filter((w) => w.level !== 'ok');
    if (warns.length) {
      banner.className = `crisis-banner ${warns.some((w) => w.level === 'danger') ? 'danger' : 'warn'}`;
      banner.innerHTML = warns.map((w) => {
        const cure = w.cure || '';
        const cidx = cure ? findItemIndex(st, cure) : -1;
        const btn = cidx >= 0 ? ` <button class="cb-cure" data-cure="${cidx}">服用${cure}</button>` : '';
        return `<div class="cb-item">${w.hint}${btn}</div>`;
      }).join('');"""
u = replace_once(u, OLD_UI2, NEW_UI2, 'ui.banner.woundWarn')

write(UI, u)
print('[OK] ui.js 已更新')
